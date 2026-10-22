"""Synthetic 90-minute match simulator.

A 10 Hz agent-based model. The ball carrier decides when to pass, carry or shoot;
off-ball players hold a formation that shifts with the ball; the nearest defenders
press. Passes succeed or fail from distance, pressure and passing-lane geometry.
Scripted beats (see storylines.py) take over the ball at set times to plant the
demo's storylines. Same seed, same match.
"""

from __future__ import annotations

import math
import random
from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from livecards.contracts import (
    FPS,
    HALF_DURATION,
    HALF_LENGTH,
    HALF_WIDTH,
    MATCH_DURATION,
    Event,
    PlayerMeta,
)
from livecards.engine.metrics import xg
from livecards.sim import storylines as sl
from livecards.sim.match import Match
from livecards.sim.roster import build_match_meta, spot_for

DT = 1.0 / FPS
MAX_RANDOM_SPEED = 8.85  # m/s (31.9 km/h): only scripted sprints break 32 km/h
TACKLE_RANGE = 1.8
INTERCEPT_LANE_M = 1.2  # a defender this close to the lane cuts the pass out
PRESSURE_RANGE = 3.0
# Preference for the safe option (recycling possession through the back line).
RECYCLE_BONUS = {"CB": 0.75, "FB": 0.55, "DM": 0.45, "CM": 0.2, "GK": 0.1, "ST": -0.25}


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def _seg_dist(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> tuple[float, float]:
    """Distance from P to segment AB, and the projection parameter s in [0, 1]."""
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    s = 0.0 if L2 == 0 else _clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0.0, 1.0)
    return math.hypot(px - (ax + s * dx), py - (ay + s * dy)), s


@dataclass(slots=True)
class SimPlayer:
    meta: PlayerMeta
    dir: int
    spot: tuple[float, float]
    x: float = 0.0
    y: float = 0.0
    vx: float = 0.0
    vy: float = 0.0
    top: float = 8.0
    pass_skill: float = 0.5
    finish: float = 0.5
    tackle: float = 0.5
    stamina: float = 1.0
    fade_t0: float | None = None
    fade_mult: float = 1.0
    phase: float = 0.0
    order: tuple[float, float, float, float] | None = None  # world x, y, speed, until
    tackle_ready: float = 0.0
    last_pressure: float = -99.0
    yellow: bool = False

    @property
    def id(self) -> str:
        return self.meta.id

    @property
    def team(self) -> str:
        return self.meta.team

    @property
    def role(self) -> str:
        return self.meta.role

    def att(self) -> tuple[float, float]:
        return self.x * self.dir, self.y * self.dir


@dataclass
class BallState:
    mode: str = "dead"  # held | flight | dead
    holder: SimPlayer | None = None
    x: float = 0.0
    y: float = 0.0
    z: float = 0.11
    f0: tuple[float, float, float] = (0, 0, 0)
    f1: tuple[float, float, float] = (0, 0, 0)
    ft0: float = 0.0
    ft1: float = 0.0
    arc: float = 0.0
    on_arrive: Callable[[], None] | None = None
    resume_at: float = 0.0
    restart: Callable[[], None] | None = None


@dataclass
class Carry:
    x: float  # world
    y: float
    speed: float
    accel: float = 4.5
    scripted: bool = False


@dataclass
class ActiveBeat:
    beat: sl.Beat
    idx: int = 0
    busy: bool = False  # waiting for a flight to land
    step_t0: float = 0.0
    step_target: tuple[float, float] | None = None


@dataclass
class Simulator:
    seed: int = 7
    story: sl.Storylines = field(default_factory=sl.default_storylines)

    def __post_init__(self) -> None:
        self.rng = random.Random(self.seed)
        self.meta = build_match_meta(self.seed)
        self.dirs = {self.meta.home.code: 1, self.meta.away.code: -1}
        self.players: dict[str, SimPlayer] = {}
        for pm in self.meta.players:
            p = SimPlayer(meta=pm, dir=self.dirs[pm.team], spot=(0.0, 0.0))
            a = pm.base_attrs
            p.top = min(MAX_RANDOM_SPEED, 7.3 + (a["pace"] - 40) / 50 * 1.5)
            p.pass_skill = _clamp((a["passing"] - 40) / 50, 0, 1)
            p.finish = _clamp((a["threat"] - 30) / 60, 0, 1)
            p.tackle = _clamp((a["defending"] - 30) / 60, 0, 1)
            p.phase = self.rng.uniform(0, 2 * math.pi)
            if pm.starter:
                p.spot = spot_for(pm.id)
            self.players[pm.id] = p
        for f in self.story.fades:
            self.players[f.player].fade_t0 = f.t0
            self.players[f.player].fade_mult = f.fatigue_mult
        self.slots: list[SimPlayer] = [p for p in self.players.values() if p.meta.starter]
        self.lineups: list[list[str]] = [[p.id for p in self.slots]]
        self.events: list[Event] = []
        self.ball = BallState()
        self.poss: str = self.meta.home.code
        self.carry: Carry | None = None
        self.decide_at = 0.0
        self.carries_in_row = 0
        self.t = 0.0
        self.reset_shape = False
        self.safe_until = 0.0
        self.beats = sorted(self.story.beats, key=lambda b: b.t)
        self.active: ActiveBeat | None = None
        self.subs = sorted(self.story.substitutions)
        self.last_pass: tuple[str, float] | None = None
        self.pressed = False

    # ---- helpers -------------------------------------------------------------------
    def on_pitch(self, team: str | None = None) -> list[SimPlayer]:
        return [p for p in self.slots if team is None or p.team == team]

    def other(self, team: str) -> str:
        return self.meta.away.code if team == self.meta.home.code else self.meta.home.code

    def mods(self, team: str) -> sl.TeamModifier:
        out = sl.TeamModifier(team, 0, 0)
        for m in self.story.modifiers:
            if m.team == team and m.t0 <= self.t < m.t1:
                out = m
        return out

    def quiet_penalty(self, p: SimPlayer) -> float:
        return sum(q.penalty for q in self.story.quiet if q.player == p.id and q.t0 <= self.t < q.t1)

    def emit(self, type_: str, **kw) -> Event:
        e = Event(id=f"e-{len(self.events) + 1:04d}", t=round(self.t, 1),
                  minute=int(self.t // 60), type=type_, **kw)
        for k in ("x", "y", "end_x", "end_y"):
            v = getattr(e, k)
            if v is not None:
                setattr(e, k, round(v, 1))
        self.events.append(e)
        return e

    def nearest(self, players: list[SimPlayer], x: float, y: float) -> tuple[SimPlayer, float]:
        best, bd = players[0], 1e9
        for p in players:
            d = math.hypot(p.x - x, p.y - y)
            if d < bd:
                best, bd = p, d
        return best, bd

    def pressure_on(self, p: SimPlayer) -> float:
        return self.nearest(self.on_pitch(self.other(p.team)), p.x, p.y)[1]

    # ---- possession ----------------------------------------------------------------
    def give(self, p: SimPlayer, *, change_event: bool = True, hold: tuple[float, float] = (1.4, 3.4)) -> None:
        if p.team != self.poss:
            self.poss = p.team
            if change_event:
                self.emit("possession_change", team=p.team, player=p.id, x=p.x, y=p.y)
            self._support_runs(p.team)
        self.ball.mode, self.ball.holder = "held", p
        p.order = None
        self.decide_at = self.t + self.rng.uniform(*hold)
        self.carries_in_row = 0
        self.pressed = False
        self._set_default_carry(p)

    def _set_default_carry(self, p: SimPlayer) -> None:
        ax, ay = p.att()
        tx = min(ax + 12, 36 if ax < 36 else ax + 1)
        ty = ay * (0.6 if ax > 20 else 0.95)
        spd = p.top * self.rng.uniform(0.5, 0.68)
        self.carry = Carry(tx * p.dir, ty * p.dir, spd)

    def _support_runs(self, team: str) -> None:
        for q in self.on_pitch(team):
            if q.role in ("W", "ST", "AM", "FB") and self.rng.random() < 0.09:
                ax, ay = q.att()
                tx, ty = min(ax + self.rng.uniform(14, 24), 46), ay * 0.9
                q.order = (tx * q.dir, ty * q.dir, q.top * self.rng.uniform(0.86, 0.98),
                           self.t + self.rng.uniform(2.5, 4.0))

    def flight(self, to: tuple[float, float, float], speed: float, arc: float,
               on_arrive: Callable[[], None]) -> float:
        b = self.ball
        d = math.hypot(to[0] - b.x, to[1] - b.y)
        dur = max(0.3, d / max(speed, 1.0))
        b.mode, b.holder = "flight", None
        b.f0, b.f1 = (b.x, b.y, b.z), to
        b.ft0, b.ft1, b.arc, b.on_arrive = self.t, self.t + dur, arc, on_arrive
        self.carry = None
        return dur

    def dead(self, seconds: float, restart: Callable[[], None]) -> None:
        b = self.ball
        b.mode, b.holder, b.resume_at, b.restart = "dead", None, self.t + seconds, restart
        self.carry = None

    # ---- actions ------------------------------------------------------------------
    def do_pass(self, p: SimPlayer, r: SimPlayer, target: tuple[float, float] | None = None, *,
                force: str | None = None, kind: str | None = None, speed_kmh: float | None = None,
                arc: float | None = None, on_done: Callable[[], None] | None = None,
                interceptor: SimPlayer | None = None) -> None:
        """Pass from p toward teammate r (world target).

        force: 'complete' | 'intercepted' | None (roll for it). A forced interception is
        made by `interceptor` if given, else by the opponent nearest the passing lane.
        """
        opps = self.on_pitch(self.other(p.team))
        if target is None:
            lx, ly = r.x + r.vx * 0.7, r.y + r.vy * 0.7
        else:
            lx, ly = target
        lx, ly = _clamp(lx, -HALF_LENGTH + 0.5, HALF_LENGTH - 0.5), _clamp(ly, -HALF_WIDTH + 0.5, HALF_WIDTH - 0.5)
        d = math.hypot(lx - p.x, ly - p.y)
        ax, ay = p.att()
        rx, ry = lx * p.dir, ly * p.dir
        lane, lane_opp, lane_s = 99.0, opps[0], 1.0
        for o in opps:
            ld, s = _seg_dist(o.x, o.y, p.x, p.y, lx, ly)
            if ld < lane and s > 0.15:
                lane, lane_opp, lane_s = ld, o, s
        pressure = self.pressure_on(p)
        under = pressure < PRESSURE_RANGE
        if kind is None:
            if rx > 30 and abs(ry) < 12 and abs(ay) > 15:
                kind = "cross"
            elif d > 30:
                kind = "long"
            elif rx - ax > 15 and lane < 3:
                kind = "through"
            else:
                kind = "ground"
        if force is None:
            m = self.mods(p.team)
            pc = (0.9 + 0.1 * p.pass_skill - 0.0055 * max(0.0, d - 12) - (0.10 if under else 0)
                  - 0.07 * max(0.0, 3 - lane) / 3 + m.pass_bonus)
            if kind == "cross":
                pc -= 0.25
            if p.fade_t0 is not None and self.t > p.fade_t0:
                pc -= 0.3 * (1 - p.stamina)
            ok = self.rng.random() < _clamp(pc, 0.25, 0.97)
        else:
            ok = force == "complete"
        if speed_kmh is not None:
            spd = speed_kmh / 3.6
        elif kind in ("long", "cross"):
            spd = 16 + 0.1 * d
        else:
            spd = _clamp(10 + 0.25 * d, 9, 24)
        if arc is None:
            arc = 2.0 + d * 0.06 if kind in ("long", "cross") else 0.15
        self.last_pass = (p.id, self.t) if ok else None
        if ok:
            self.emit("pass", team=p.team, player=p.id, x=p.x, y=p.y, end_x=lx, end_y=ly,
                           outcome="complete", receiver=r.id, under_pressure=under,
                           speed_kmh=round(spd * 3.6, 1), kind=kind)
            dur = d / spd
            r.order = (lx, ly, min(r.top * 0.97, math.hypot(lx - r.x, ly - r.y) / max(dur, 0.3) + 1.0),
                       self.t + dur + 0.5)

            def arrive() -> None:
                self.give(r)
                if on_done:
                    on_done()
            self.flight((lx, ly, 0.11), spd, arc, arrive)
        else:
            cut_out = True
            if interceptor is not None:
                icp, ix, iy = interceptor, interceptor.x, interceptor.y
            elif lane < INTERCEPT_LANE_M:
                icp, s = lane_opp, lane_s
                ix, iy = p.x + (lx - p.x) * s, p.y + (ly - p.y) * s
            else:
                icp, _ = self.nearest(opps, lx, ly)
                ix, iy = lx, ly
                cut_out = False
            self.emit("pass", team=p.team, player=p.id, x=p.x, y=p.y, end_x=ix, end_y=iy,
                           outcome="incomplete", receiver=r.id, under_pressure=under,
                           speed_kmh=round(spd * 3.6, 1), kind=kind)
            dur = math.hypot(ix - p.x, iy - p.y) / spd
            icp.order = (ix, iy, icp.top * 0.95, self.t + dur + 0.5)

            def arrive_int() -> None:
                self.emit("interception" if cut_out else "recovery", team=icp.team, player=icp.id,
                          x=ix, y=iy, target=p.id)
                self.give(icp)
                if on_done:
                    on_done()
            self.flight((ix, iy, 0.11), spd, arc, arrive_int)

    def do_shot(self, p: SimPlayer, *, target_y: float | None = None, speed_kmh: float | None = None,
                outcome: str | None = None, height: float | None = None) -> None:
        ax, ay = p.att()
        chance = xg(p.x, p.y, p.dir)
        dist = math.hypot(HALF_LENGTH - ax, ay)
        if outcome is None:
            m = self.mods(p.team)
            if self.rng.random() < chance * (0.7 + 0.6 * p.finish) * m.shot_mult:
                outcome = "goal" if self.story.allow_random_goals else "saved"
            else:
                outcome = self.rng.choices(["saved", "off_target", "blocked"], [0.38, 0.4, 0.22])[0]
        if speed_kmh is None:
            speed_kmh = _clamp(self.rng.gauss(88, 12) - dist * 0.4, 55, 118)
        if target_y is None:
            if outcome in ("goal", "saved"):
                target_y = self.rng.uniform(-3.3, 3.3)
            else:
                target_y = self.rng.choice([-1, 1]) * self.rng.uniform(4.0, 9.0)
        if height is None:
            height = self.rng.uniform(0.2, 2.0) if outcome != "off_target" else self.rng.uniform(0.5, 3.5)
        gx, gy = HALF_LENGTH * p.dir, target_y * p.dir
        if outcome == "blocked":
            ux, uy = (gx - p.x) / dist, (gy - p.y) / dist
            gx, gy = p.x + ux * 2.2, p.y + uy * 2.2
        self.emit("shot", team=p.team, player=p.id, x=p.x, y=p.y, end_x=gx, end_y=gy,
                  outcome=outcome, speed_kmh=round(speed_kmh, 1), xg=chance)
        spd = speed_kmh / 3.6
        defenders = self.on_pitch(self.other(p.team))
        gk = next((q for q in defenders if q.role == "GK"), defenders[0])

        def arrive() -> None:
            if outcome == "goal":
                self.ball.x, self.ball.y = gx + p.dir * 1.2, gy
                self.emit("goal", team=p.team, player=p.id, x=p.x, y=p.y)
                self.reset_shape = True
                self.dead(45, lambda: self.kickoff(self.other(p.team)))
            elif outcome == "saved":
                self.give(gk, hold=(2.5, 4.0))
                self.safe_until = self.t + 4.0
            elif outcome == "blocked":
                blk, _ = self.nearest(defenders, self.ball.x, self.ball.y)
                self.give(blk)
            else:
                self.dead(7, lambda: self._restart_with(gk, safe=4.0))
        self.flight((gx, gy, height), spd, 0.0 if outcome != "off_target" else 0.6, arrive)

    def _restart_with(self, p: SimPlayer, safe: float = 2.0) -> None:
        self.ball.x, self.ball.y, self.ball.z = p.x, p.y, 0.11
        self.give(p, hold=(1.5, 3.0))
        self.safe_until = self.t + safe

    def kickoff(self, team: str) -> None:
        self.reset_shape = False
        taker = next((q for q in self.on_pitch(team) if q.role == "ST"), self.on_pitch(team)[-1])
        taker.x, taker.y = -0.6 * taker.dir, 0.0
        self.ball.x, self.ball.y, self.ball.z = 0.0, 0.0, 0.11
        self.emit("kickoff", team=team, player=taker.id, x=0.0, y=0.0)
        self.give(taker, change_event=False, hold=(0.5, 0.8))
        self.poss = team
        self.safe_until = self.t + 2.0

    def decide(self, p: SimPlayer) -> None:
        ax, ay = p.att()
        m = self.mods(p.team)
        if p.role != "GK" and ax > 24 and abs(ay) < 22:
            dist = math.hypot(HALF_LENGTH - ax, ay)
            p_shot = (0.085 if dist < 30 else 0.012) * m.shot_mult
            if self.rng.random() < p_shot:
                self.do_shot(p)
                return
        opps = self.on_pitch(self.other(p.team))
        pressure = self.nearest(opps, p.x, p.y)[1]
        if (pressure > 7 and ax < 32 and self.carries_in_row < 2 and p.role != "GK"
                and self.rng.random() < 0.35):
            self.carries_in_row += 1
            self.decide_at = self.t + self.rng.uniform(0.8, 1.8)
            self._set_default_carry(p)
            return
        best: list[tuple[float, SimPlayer, float, float]] = []
        for q in self.on_pitch(p.team):
            if q is p or (q.role == "GK" and ax > -25):
                continue
            lx, ly = q.x + q.vx * 0.7, q.y + q.vy * 0.7
            d = math.hypot(lx - p.x, ly - p.y)
            if d < 5 or d > 60:
                continue
            openness = min(10.0, self.nearest(opps, lx, ly)[1])
            lane = min(_seg_dist(o.x, o.y, p.x, p.y, lx, ly)[0] for o in opps)
            prog = lx * p.dir - ax
            safety = RECYCLE_BONUS.get(q.role, 0.0) * (1.6 if pressure < 4 else 1.0)
            safety -= self.quiet_penalty(q)
            score = (0.03 * prog * m.forward_mult + 0.14 * openness + 0.12 * min(lane, 5.0)
                     - 0.012 * d + safety + self.rng.gauss(0, 0.35))
            best.append((score, q, lx, ly))
        if not best:
            self.decide_at = self.t + 0.5
            return
        top = max(s for s, *_ in best)
        weights = [math.exp((s - top) / 0.35) for s, *_ in best]
        _, q, lx, ly = self.rng.choices(best, weights)[0]
        self.do_pass(p, q, (lx, ly))

    # ---- per-tick updates ---------------------------------------------------------
    def tick_ball(self) -> None:
        b = self.ball
        if self.active and self.step_beat():
            pass
        elif b.mode == "held":
            p = b.holder
            assert p is not None
            if not self.active:
                self.try_tackle(p)
                if b.mode == "held" and self.t >= self.decide_at:
                    self.decide(p)
        if b.mode == "flight" and self.t >= b.ft1:
            b.x, b.y, b.z = b.f1
            cb, b.on_arrive = b.on_arrive, None
            b.mode = "dead"  # callback sets the next state
            b.resume_at = 1e9
            if cb:
                cb()
        elif b.mode == "dead" and self.t >= b.resume_at:
            cb, b.restart = b.restart, None
            b.resume_at = 1e9
            if cb:
                cb()

    def try_tackle(self, p: SimPlayer) -> None:
        if self.t < self.safe_until:
            return
        opps = self.on_pitch(self.other(p.team))
        o, d = self.nearest(opps, p.x, p.y)
        if d > TACKLE_RANGE or self.t < o.tackle_ready or o.role == "GK":
            return
        m = self.mods(o.team)
        if self.rng.random() > 0.11 * (0.6 + 0.8 * o.tackle) * m.tackle_mult * DT:
            return
        o.tackle_ready = self.t + 4.0
        if self.rng.random() < 0.3:
            self.emit("foul", team=o.team, player=o.id, x=p.x, y=p.y, target=p.id)
            if not o.yellow and self.t > 300 and self.rng.random() < 0.13:
                o.yellow = True
                self.emit("card", team=o.team, player=o.id, kind="yellow", x=p.x, y=p.y)
            self.dead(4.0, lambda: self._restart_with(p))
            return
        fade = 0.3 * (1 - p.stamina) if p.fade_t0 is not None and self.t > p.fade_t0 else 0.0
        if self.rng.random() < 0.5 + 0.25 * (o.tackle - 0.5) + fade:
            self.emit("tackle", team=o.team, player=o.id, x=p.x, y=p.y, outcome="won", target=p.id)
            self.give(o)
        else:
            self.emit("tackle", team=o.team, player=o.id, x=p.x, y=p.y, outcome="lost", target=p.id)

    def formation_target(self, p: SimPlayer) -> tuple[float, float, float]:
        """World target and speed for an off-ball player holding shape."""
        bx, by = self.ball.x * p.dir, self.ball.y * p.dir
        sx, sy = p.spot
        in_poss = self.poss == p.team
        if self.reset_shape:
            ax, ay = min(sx * 0.9 + 4, -2.0), sy
            spd = 3.0
        elif p.role == "GK":
            ax, ay = -48 + _clamp((bx + 20) * 0.08, 0, 6), _clamp(by * 0.15, -3, 3)
            spd = 3.5
        else:
            shift = _clamp(bx * 0.6 + 8, -14, 30) if in_poss else _clamp(bx * 0.55 - 6, -22, 16)
            ax = sx + shift
            ay = sy * (0.92 if in_poss else 0.72) + by * 0.25
            ax += 1.5 * math.sin(0.11 * self.t + p.phase)
            ay += 1.2 * math.sin(0.09 * self.t + 1.7 * p.phase)
            ax = _clamp(ax, -50, 47)
            spd = p.top * 0.5
        return ax * p.dir, _clamp(ay, -33, 33) * p.dir, spd

    def fatigue(self, p: SimPlayer) -> float:
        f = 0.82 + 0.18 * p.stamina
        if p.fade_t0 is not None and self.t > p.fade_t0:
            f *= 0.55 + 0.45 * p.stamina
        return f

    def move_players(self) -> None:
        b = self.ball
        pressing = self.other(self.poss)
        pressers: set[str] = set()
        if not self.reset_shape and b.mode != "dead":
            tx, ty = (b.f1[0], b.f1[1]) if b.mode == "flight" else (b.x, b.y)
            outfield = sorted((q for q in self.on_pitch(pressing)
                               if q.role != "GK" and not self.quiet_penalty(q)),
                              key=lambda q: math.hypot(q.x - tx, q.y - ty))
            n = 1 + self.mods(pressing).pressers + (1 if abs(tx) * -self.dirs[pressing] > 25 else 0)
            pressers = {q.id for q in outfield[:n]}
        for p in self.slots:
            accel = 4.5
            if b.mode == "held" and b.holder is p and self.carry is not None:
                c = self.carry
                tx, ty, vmax, accel = c.x, c.y, c.speed, c.accel
                if not c.scripted:
                    vmax *= self.fatigue(p)
            elif p.order is not None and self.t < p.order[3]:
                tx, ty, vmax, _ = p.order
                vmax = min(vmax, 9.6) * (1.0 if self.active else self.fatigue(p))
            elif p.id in pressers:
                p.order = None
                tx, ty = (b.f1[0], b.f1[1]) if b.mode == "flight" else (b.x, b.y)
                tx -= p.dir * 1.0
                vmax = p.top * 0.8 * self.fatigue(p)
            else:
                p.order = None
                tx, ty, vmax = self.formation_target(p)
                vmax *= self.fatigue(p)
            dx, dy = tx - p.x, ty - p.y
            d = math.hypot(dx, dy)
            gain = 1.1 if (p.order is not None or p.id in pressers or self.ball.holder is p) else 0.45
            want = min(vmax, d * gain) if d > 0.6 else 0.0
            wvx, wvy = (dx / d * want, dy / d * want) if d > 1e-6 else (0.0, 0.0)
            dvx, dvy = wvx - p.vx, wvy - p.vy
            dv = math.hypot(dvx, dvy)
            lim = accel * DT
            if dv > lim:
                dvx, dvy = dvx / dv * lim, dvy / dv * lim
            p.vx += dvx
            p.vy += dvy
            p.x = _clamp(p.x + p.vx * DT, -HALF_LENGTH - 2, HALF_LENGTH + 2)
            p.y = _clamp(p.y + p.vy * DT, -HALF_WIDTH - 2, HALF_WIDTH + 2)
            speed = math.hypot(p.vx, p.vy)
            rate = 0.5 / 11000
            if p.fade_t0 is not None and self.t > p.fade_t0:
                rate *= p.fade_mult
            p.stamina = max(0.05, p.stamina - speed * DT * rate)

    def update_ball_position(self) -> None:
        b = self.ball
        if b.mode == "held" and b.holder is not None:
            p = b.holder
            sp = math.hypot(p.vx, p.vy)
            ux, uy = (p.vx / sp, p.vy / sp) if sp > 0.3 else (p.dir, 0.0)
            b.x, b.y, b.z = p.x + ux * 0.55, p.y + uy * 0.55, 0.11
        elif b.mode == "flight":
            s = _clamp((self.t - b.ft0) / max(b.ft1 - b.ft0, 1e-6), 0, 1)
            (x0, y0, z0), (x1, y1, z1) = b.f0, b.f1
            b.x, b.y = x0 + (x1 - x0) * s, y0 + (y1 - y0) * s
            b.z = z0 + (z1 - z0) * s + b.arc * 4 * s * (1 - s)

    def check_pressure(self) -> None:
        b = self.ball
        if b.mode != "held" or b.holder is None:
            return
        p = b.holder
        o, d = self.nearest(self.on_pitch(self.other(p.team)), p.x, p.y)
        # One pressure event per possession spell of a carrier, and not on every jog-by.
        closing = ((p.x - o.x) * o.vx + (p.y - o.y) * o.vy) / max(d, 0.1)  # m/s toward carrier
        if (d < 2.4 and closing > 2.5 and not self.pressed and self.t - o.last_pressure > 8.0
                and o.role != "GK" and self.t > self.safe_until):
            self.pressed = True
            if self.rng.random() > 0.35:  # only committed presses get tagged, as in real feeds
                return
            o.last_pressure = self.t
            self.emit("pressure", team=o.team, player=o.id, x=o.x, y=o.y, target=p.id)

    # ---- schedule: substitutions and beats -----------------------------------------
    def process_schedule(self) -> None:
        if self.subs and self.t >= self.subs[0][0]:
            t0, off, on = self.subs[0]
            p_off = self.players[off]
            if (self.ball.mode == "dead" or self.t > t0 + 90) and self.ball.holder is not p_off \
                    and not self.active:
                self.subs.pop(0)
                p_on = self.players[on]
                p_on.spot = spot_for(on, replacing=off)
                p_on.x, p_on.y, p_on.vx, p_on.vy = p_off.x, p_off.y, 0.0, 0.0
                self.slots[self.slots.index(p_off)] = p_on
                self.lineups.append([q.id for q in self.slots])
                self.emit("substitution", team=p_off.team, player=off, player_in=on)
        if self.active is None and self.beats and self.t >= self.beats[0].t:
            beat = self.beats[0]
            first = self.players[self._step_player(beat.steps[0])]
            near = math.hypot(first.x - self.ball.x, first.y - self.ball.y) < beat.near
            if self.ball.mode == "held" and (near or self.t > beat.t + beat.deadline):
                self.beats.pop(0)
                self.active = ActiveBeat(beat, step_t0=self.t)

    @staticmethod
    def _step_player(step: sl.Step) -> str:
        if isinstance(step, sl.Pass):
            return step.passer
        if isinstance(step, sl.Tackle):
            return step.tackler
        return step.player

    def _resolve(self, target: sl.Target, p: SimPlayer, team_dir: int) -> tuple[float, float]:
        """Resolve a step target (attack frame of team_dir) to world coordinates."""
        ax, ay = target(p.att() if p.dir == team_dir else (p.x * team_dir, p.y * team_dir)) \
            if callable(target) else target
        return ax * team_dir, ay * team_dir

    def _advance(self) -> None:
        assert self.active is not None
        self.active.idx += 1
        self.active.busy = False
        self.active.step_t0 = self.t
        self.active.step_target = None
        if self.active.idx >= len(self.active.beat.steps):
            self.active = None

    def step_beat(self) -> bool:
        """Run the active beat. Returns True if it controlled the ball this tick."""
        ab = self.active
        assert ab is not None
        if ab.busy:
            return True
        step = ab.beat.steps[ab.idx]
        b = self.ball
        if b.mode != "held":
            return False  # let a flight land or a restart happen first
        h = b.holder
        assert h is not None
        if isinstance(step, sl.Start):
            tgt = self.players[step.player]
            if h is tgt:
                self._advance()
            elif h.team == tgt.team:
                ab.busy = True
                self.do_pass(h, tgt, (tgt.x + tgt.dir * 1.0, tgt.y), force="complete",
                             on_done=self._advance)
            else:
                ab.busy = True
                mates = [q for q in self.on_pitch(h.team) if q is not h]
                intended, _ = self.nearest(mates, tgt.x, tgt.y)
                self.do_pass(h, intended, (tgt.x, tgt.y), force="intercepted", interceptor=tgt,
                             on_done=self._advance)
            return True
        if isinstance(step, sl.Carry):
            p = self.players[step.player]
            if h is not p:
                self.active = None  # the script lost the ball; abandon
                return False
            if ab.step_target is None:
                ab.step_target = self._resolve(step.to, p, p.dir)
            tx, ty = ab.step_target
            self.carry = Carry(tx, ty, step.speed, step.accel, scripted=True)
            if math.hypot(p.x - tx, p.y - ty) < 1.2 or self.t - ab.step_t0 > 10:
                self._advance()
            return True
        if isinstance(step, sl.Pass):
            p, r = self.players[step.passer], self.players[step.receiver]
            if h is not p:
                self.active = None
                return False
            target = self._resolve(step.to, r, p.dir) if step.to is not None else None
            ab.busy = True
            self.do_pass(p, r, target, force="complete", kind=step.kind, speed_kmh=step.speed_kmh,
                         arc=step.arc, on_done=self._advance)
            return True
        if isinstance(step, sl.Tackle):
            tk, victim = self.players[step.tackler], self.players[step.victim]
            if h is not victim:
                self.active = None
                return False
            tk.order = (victim.x, victim.y, 8.6, self.t + 1.0)
            if math.hypot(tk.x - victim.x, tk.y - victim.y) < TACKLE_RANGE:
                self.emit("tackle", team=tk.team, player=tk.id, x=victim.x, y=victim.y,
                          outcome="won", target=victim.id)
                self.give(tk)
                self._advance()
            return True
        if isinstance(step, sl.Shot):
            p = self.players[step.player]
            if h is not p:
                self.active = None
                return False
            self._advance()
            self.do_shot(p, target_y=step.target_y, speed_kmh=step.speed_kmh,
                         outcome=step.outcome, height=step.height)
            return True
        return False

    # ---- main loop -------------------------------------------------------------------
    def place_formation(self, kickoff_team: str) -> None:
        for p in self.slots:
            sx, sy = p.spot
            p.x, p.y = min(sx * 0.9 + 4, -2.0) * p.dir, sy * p.dir
            if p.role == "GK":
                p.x = -48.0 * p.dir
            p.vx = p.vy = 0.0
            p.order = None
        self.active = None
        self.kickoff(kickoff_team)

    def run(self) -> Match:
        n = int(MATCH_DURATION * FPS)
        times = np.arange(n, dtype=np.float64) / FPS
        ball = np.zeros((n, 3), dtype=np.float32)
        pos = np.zeros((n, 22, 3), dtype=np.float32)
        lineup_idx = np.zeros(n, dtype=np.int16)
        half_tick = int(HALF_DURATION * FPS)
        self.place_formation(self.meta.home.code)
        for i in range(n):
            self.t = i / FPS
            if i == half_tick:
                self.place_formation(self.meta.away.code)
            self.process_schedule()
            self.tick_ball()
            self.move_players()
            self.update_ball_position()
            self.check_pressure()
            for p in self.slots:
                if p.order is not None and self.t >= p.order[3]:
                    p.order = None
            if i == half_tick - 1:
                self.emit("half_end")
            elif i == n - 1:
                self.emit("match_end")
            ball[i] = (self.ball.x, self.ball.y, self.ball.z)
            for k, p in enumerate(self.slots):
                pos[i, k] = (p.x, p.y, math.hypot(p.vx, p.vy))
            lineup_idx[i] = len(self.lineups) - 1
        return Match(self.meta, self.events, times, ball, pos, self.lineups, lineup_idx)


def simulate(seed: int = 7, story: sl.Storylines | None = None) -> Match:
    return Simulator(seed=seed, story=story or sl.default_storylines()).run()
