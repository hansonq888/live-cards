"""The stats engine: deterministic code that turns events and tracking into card state and moments.

No model ever computes a number. Each moment carries `facts` (every number a sentence
may use) and `evidence` (event ids, or `trk-<player>-<tenths of a second>` tracking refs).
Feed it in time order: events at time t before the frame at time t.
"""

from __future__ import annotations

import math
from collections import deque
from collections.abc import Iterable
from dataclasses import dataclass, field

from livecards.contracts import FPS, CardState, Event, Frame, MatchMeta, Moment, PlayerMeta
from livecards.engine import metrics as mx
from livecards.engine.attributes import (
    ATTRIBUTE_METRICS,
    compute_attributes,
    load_baselines,
    raw_value,
    z_scores,
)
from livecards.engine.rating import LABELS, Rating
from livecards.engine.stats import PlayerStats

DT = 1.0 / FPS
WINDOW_S = 600.0  # 10-minute window for upgrades and downgrades
RATING_STEP = 0.5
ATTR_STEP = 3
MIN_ATTR_MINUTES = 15  # no attribute moments on a tiny sample
STREAK_LEN = 3
STREAK_GAP_S = 180.0  # max gap between consecutive successful actions
STREAK_PASS_DIFFICULTY = 6.5
MILESTONE_M = 2000.0
PRESSURE_WIN_S = 5.0
CHANCE_WIN_S = 12.0
MOMENTUM_HALF_LIFE_S = 180.0
MOMENTUM_SWING = 0.4  # net shift needed within the window...
MOMENTUM_ON_TOP = 0.15  # ...ending with the other team on top by at least this much
TEAM_WINDOW_S = 300.0

IMPORTANCE = {
    "goal": 1.0, "big_chance": 0.7, "fastest_sprint": 0.65, "momentum_swing": 0.6,
    "rating_upgrade": 0.55, "card": 0.5, "sprint": 0.45, "streak": 0.45,
    "rating_downgrade": 0.45, "attr_upgrade": 0.4, "attr_downgrade": 0.35,
    "substitution": 0.35, "distance_milestone": 0.15,
}

ATTR_NAMES = {"pace": "Pace", "passing": "Passing", "threat": "Threat",
              "defending": "Defending", "engine": "Engine"}


def trk_ref(pid: str, t: float) -> str:
    return f"trk-{pid}-{round(t * 10)}"


@dataclass
class Run:
    start: float | None = None
    peak: float = 0.0
    alerted: bool = False


@dataclass
class PlayerState:
    meta: PlayerMeta
    dir: int
    stats: PlayerStats = field(default_factory=PlayerStats)
    rating: Rating = field(default_factory=Rating)
    attrs: dict[str, int] = field(default_factory=dict)
    on_pitch: bool = False
    rating_hist: list[tuple[float, float]] = field(default_factory=list)
    minute_hist: deque = field(default_factory=lambda: deque(maxlen=12))  # (min, attrs, z, stats)
    metric_log: list[tuple[float, str, str]] = field(default_factory=list)  # (t, metric, ref)
    sprint: Run = field(default_factory=Run)
    hi: Run = field(default_factory=Run)
    prev_kmh: float = 0.0
    next_milestone: float = MILESTONE_M
    streak: list[str] = field(default_factory=list)
    streak_t: float = -1e9
    fired: dict[str, float] = field(default_factory=dict)  # key -> value at last fire time
    fired_t: dict[str, float] = field(default_factory=dict)
    last_reason: str = ""
    last_evidence: list[str] = field(default_factory=list)
    last_delta: float = 0.0

    @property
    def short(self) -> str:
        return self.meta.short


@dataclass
class TeamState:
    t: float
    possession: dict[str, float]  # whole match, %
    possession_5m: dict[str, float]
    momentum: float  # -1 (away on top) .. +1 (home on top)
    chaos: int  # 0 calm/controlled .. 100 end-to-end chaos
    turnovers_5m: int
    score: dict[str, int]
    xg: dict[str, float] = field(default_factory=dict)
    shots: dict[str, int] = field(default_factory=dict)
    shots_on_target: dict[str, int] = field(default_factory=dict)


class MatchEngine:
    def __init__(self, meta: MatchMeta, *, compute_attrs: bool = True) -> None:
        self.meta = meta
        self.compute_attrs = compute_attrs
        self.home, self.away = meta.home.code, meta.away.code
        dirs = {self.home: meta.home.attack_dir, self.away: meta.away.attack_dir}
        self.dirs = dirs
        self.players = {p.id: PlayerState(p, dirs[p.team], attrs=dict(p.base_attrs))
                        for p in meta.players}
        for ps in self.players.values():
            ps.rating_hist.append((0.0, ps.rating.value))
        self.t = 0.0
        self.score = {self.home: 0, self.away: 0}
        self.team_xg = {self.home: 0.0, self.away: 0.0}
        self.team_shots = {self.home: 0, self.away: 0}
        self.team_sot = {self.home: 0, self.away: 0}
        self.poss: str | None = None
        self.poss_time = {self.home: 0.0, self.away: 0.0}
        self.poss_secs: deque[str] = deque(maxlen=int(TEAM_WINDOW_S))
        self.turnovers: deque[float] = deque()
        self.pressures: deque[tuple[float, str, str]] = deque()  # (t, player, team)
        self.last_pass: dict[str, Event | None] = {self.home: None, self.away: None}
        self.last_shot: dict[str, tuple[Event, Event | None]] = {}
        self.threat = {self.home: 0.0, self.away: 0.0}
        self.momentum_hist: deque[tuple[int, float]] = deque(maxlen=11)
        self.momentum_fired_t = -1e9
        self.momentum_fired_v = 0.0
        self.match_top_kmh = 0.0
        self.minute_done = -1
        self.frame_i = 0
        self.moments: list[Moment] = []
        self.events: dict[str, Event] = {}

    # ---- moments ------------------------------------------------------------------
    def _moment(self, type_: str, *, player: str | None, team: str | None, facts: dict,
                evidence: list[str], template: str, importance: float | None = None,
                t: float | None = None) -> Moment:
        t = self.t if t is None else t
        m = Moment(id=f"m-{len(self.moments) + 1:04d}", t=round(t, 1), minute=int(t // 60),
                   type=type_, player=player, team=team,
                   importance=round(importance if importance is not None else IMPORTANCE[type_], 2),
                   facts=facts, evidence=evidence, template=template)
        self.moments.append(m)
        if player and type_ not in ("substitution", "distance_milestone"):
            ps = self.players[player]
            ps.last_reason, ps.last_evidence = template, evidence
        return m

    # ---- events -------------------------------------------------------------------
    def on_event(self, e: Event) -> list[Moment]:
        self.t = e.t
        self.events[e.id] = e
        n0 = len(self.moments)
        touched: set[str] = set()
        handler = getattr(self, f"_ev_{e.type}", None)
        if handler:
            touched = handler(e) or set()
        for pid in touched:
            self._check_rating(pid)
        return self.moments[n0:]

    def _rate(self, pid: str, e: Event, kind: str) -> str:
        self.players[pid].rating.apply(e.t, e.id, kind)
        return pid

    def _log(self, pid: str, metric: str, ref: str) -> None:
        self.players[pid].metric_log.append((self.t, metric, ref))

    def _streak(self, pid: str, ok: bool, ref: str) -> None:
        ps = self.players[pid]
        if not ok:
            ps.streak = []
            return
        if ps.streak and ps.streak[-1] == ref:
            return
        if self.t - ps.streak_t > STREAK_GAP_S:
            ps.streak = []
        ps.streak.append(ref)
        ps.streak_t = self.t
        if len(ps.streak) == STREAK_LEN:
            kinds = [self._action_label(r) for r in ps.streak]
            self._moment("streak", player=pid, team=ps.meta.team,
                         facts={"count": STREAK_LEN, "actions": ", ".join(kinds)},
                         evidence=list(ps.streak),
                         template=f"{ps.short}: {STREAK_LEN} successful actions in a row "
                                  f"({', '.join(kinds)})")

    def _action_label(self, ref: str) -> str:
        e = self.events.get(ref)
        if e is None:
            return "action"
        return {"pass": "difficult pass",
                "shot": "shot on target", "tackle": "tackle won",
                "interception": "interception"}.get(e.type, e.type)

    def _ev_kickoff(self, e: Event) -> set[str]:
        self.poss = e.team
        return set()

    def _ev_pass(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        s = ps.stats
        d = ps.dir
        diff = mx.pass_difficulty(e.x, e.y, e.end_x, e.end_y, d, bool(e.under_pressure), e.kind)
        s.passes += 1
        s.touches += 1
        s.difficulty_sum += diff
        s.pass_distance_sum += mx.pass_distance(e.x, e.y, e.end_x, e.end_y)
        self._log(e.player, "pass_pct", e.id)
        self._log(e.player, "avg_difficulty", e.id)
        touched = set()
        if e.outcome == "complete":
            s.passes_completed += 1
            self.players[e.receiver].stats.touches += 1
            if mx.pass_progress(e.x, e.end_x, d) >= mx.FORWARD_PASS_M:
                s.forward_passes += 1
                self._log(e.player, "forward_passes", e.id)
            if e.under_pressure:
                s.passes_under_pressure_completed += 1
                touched.add(self._rate(e.player, e, "pass_under_pressure"))
            self.last_pass[e.team] = e
            if diff >= STREAK_PASS_DIFFICULTY:
                self._streak(e.player, True, e.id)
            if mx.to_attack(e.end_x, e.end_y, d)[0] >= mx.FINAL_THIRD_X:
                self.threat[e.team] += 0.05
        else:
            s.turnovers += 1
            self._streak(e.player, False, e.id)
            if mx.in_own_half(e.x, d):
                s.turnovers_own_half += 1
                touched.add(self._rate(e.player, e, "turnover_own_half"))
        return touched

    def _ev_shot(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        s = ps.stats
        q = mx.xg(e.x, e.y, ps.dir)
        s.shots += 1
        s.touches += 1
        s.xg += q
        self.team_xg[e.team] += q
        self.team_shots[e.team] += 1
        self.team_sot[e.team] += e.outcome in ("goal", "saved")
        s.max_shot_kmh = max(s.max_shot_kmh, e.speed_kmh or 0.0)
        self._log(e.player, "shots", e.id)
        self._log(e.player, "xg", e.id)
        touched = set()
        on_target = e.outcome in ("goal", "saved")
        if on_target:
            touched.add(self._rate(e.player, e, "shot_on_target"))
        self._streak(e.player, on_target, e.id)
        key = self.last_pass.get(e.team)
        if key is not None and key.receiver == e.player and e.t - key.t <= CHANCE_WIN_S:
            self.players[key.player].stats.chances_created += 1
            self._log(key.player, "chances_created", key.id)
            touched.add(self._rate(key.player, key, "chance_created"))
            self._streak(key.player, True, key.id)
        else:
            key = None
        self.last_shot[e.team] = (e, key)
        self.last_pass[e.team] = None
        self.threat[e.team] += 0.3 + 2.0 * q
        if q >= mx.BIG_CHANCE_XG and e.outcome != "goal":
            ev = [e.id] + ([key.id] if key else [])
            dist = mx.shot_distance(e.x, e.y, ps.dir)
            self._moment("big_chance", player=e.player, team=e.team,
                         facts={"xg": q, "distance_m": dist, "outcome": e.outcome,
                                "speed_kmh": e.speed_kmh or 0.0},
                         evidence=ev,
                         template=f"Big chance for {ps.short}: {dist:.0f} m out, xG {q:.2f}, "
                                  f"{e.outcome.replace('_', ' ')}")
        return touched

    def _ev_goal(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        ps.stats.goals += 1
        self.score[e.team] += 1
        touched = {self._rate(e.player, e, "goal")}
        shot, key = self.last_shot.get(e.team, (None, None))
        evidence = [e.id]
        facts: dict = {"score_home": self.score[self.home], "score_away": self.score[self.away],
                       "minute": e.minute}
        assist_txt = ""
        if shot is not None and shot.player == e.player:
            evidence.append(shot.id)
            facts.update(xg=mx.xg(shot.x, shot.y, ps.dir), speed_kmh=shot.speed_kmh or 0.0,
                         distance_m=mx.shot_distance(shot.x, shot.y, ps.dir))
            if key is not None:
                self.players[key.player].stats.assists += 1
                touched.add(self._rate(key.player, e, "assist"))
                evidence.append(key.id)
                facts["assist"] = self.players[key.player].meta.name
                assist_txt = f", assisted by {self.players[key.player].short}"
        score = f"{self.home} {self.score[self.home]}-{self.score[self.away]} {self.away}"
        shot_txt = (f" ({facts['distance_m']:.0f} m, {facts['speed_kmh']:.0f} km/h)"
                    if "speed_kmh" in facts else "")
        self._moment("goal", player=e.player, team=e.team, facts=facts, evidence=evidence,
                     template=f"GOAL {ps.meta.name}{shot_txt}{assist_txt}. {score}")
        self.threat[e.team] += 0.5
        return touched

    def _ev_tackle(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        touched = set()
        if e.outcome == "won":
            ps.stats.tackles_won += 1
            ps.stats.touches += 1
            self._log(e.player, "tackles_won", e.id)
            touched.add(self._rate(e.player, e, "tackle_won"))
            self._streak(e.player, True, e.id)
            if e.target:
                v = self.players[e.target]
                v.stats.turnovers += 1
                self._streak(e.target, False, e.id)
                if mx.in_own_half(e.x, v.dir):
                    v.stats.turnovers_own_half += 1
                    touched.add(self._rate(e.target, e, "turnover_own_half"))
            if not mx.in_own_half(e.x, ps.dir):
                self.threat[e.team] += 0.05
        else:
            ps.stats.tackles_lost += 1
            self._streak(e.player, False, e.id)
        return touched

    def _ev_interception(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        ps.stats.interceptions += 1
        ps.stats.touches += 1
        self._log(e.player, "interceptions", e.id)
        self._streak(e.player, True, e.id)
        if not mx.in_own_half(e.x, ps.dir):
            self.threat[e.team] += 0.05
        return {self._rate(e.player, e, "interception")}

    def _ev_foul(self, e: Event) -> set[str]:
        self.players[e.player].stats.fouls += 1
        self._streak(e.player, False, e.id)
        return {self._rate(e.player, e, "foul")}

    def _ev_card(self, e: Event) -> set[str]:
        ps = self.players[e.player]
        ps.stats.yellow_cards += 1
        self._moment("card", player=e.player, team=e.team, facts={"card": e.kind or "yellow"},
                     evidence=[e.id], template=f"Yellow card: {ps.meta.name}")
        return {self._rate(e.player, e, "yellow_card")}

    def _ev_pressure(self, e: Event) -> set[str]:
        self.players[e.player].stats.pressures += 1
        self.pressures.append((e.t, e.player, e.team))
        self.events[e.id] = e
        return set()

    def _ev_possession_change(self, e: Event) -> set[str]:
        self.poss = e.team
        self.turnovers.append(e.t)
        keep: deque = deque()
        for t, pid, team in self.pressures:
            if team == e.team and e.t - t <= PRESSURE_WIN_S:
                self.players[pid].stats.pressures_won += 1
                self._log(pid, "pressures_won", e.id)
            elif e.t - t <= PRESSURE_WIN_S:
                keep.append((t, pid, team))
        self.pressures = keep
        self.last_pass = {self.home: None, self.away: None}
        return set()

    def _ev_substitution(self, e: Event) -> set[str]:
        off, on = self.players[e.player], self.players[e.player_in]
        off.on_pitch, on.on_pitch = False, True
        self._moment("substitution", player=e.player_in, team=e.team,
                     facts={"off": off.meta.name, "on": on.meta.name}, evidence=[e.id],
                     template=f"Substitution {self.meta.team(e.team).name}: "
                              f"{on.meta.name} on for {off.meta.name}")
        return set()

    # ---- rating upgrades ------------------------------------------------------------
    def _check_rating(self, pid: str) -> None:
        ps = self.players[pid]
        now = ps.rating.value
        ps.rating_hist.append((self.t, now))
        for direction in (1, -1):
            key = "rating_up" if direction > 0 else "rating_down"
            t_fire = ps.fired_t.get(key, -1e9)
            window = [(t, v) for t, v in ps.rating_hist if t >= max(self.t - WINDOW_S, t_fire)]
            prior = [(t, v) for t, v in ps.rating_hist if t < self.t - WINDOW_S]
            if prior and prior[-1][0] >= t_fire:
                window.insert(0, prior[-1])
            ref_t, ref_v = (min(window, key=lambda tv: tv[1]) if direction > 0
                            else max(window, key=lambda tv: tv[1]))
            change = round(now - ref_v, 2)
            if change * direction < RATING_STEP - 1e-9:
                continue
            # Entries strictly after the reference point: those at ref_t are already in ref_v.
            entries = [en for en in ps.rating.entries_since(ref_t) if en.delta * direction > 0
                       and en.t > ref_t]
            if not entries:
                continue
            totals: dict[str, float] = {}
            for en in entries:
                totals[en.kind] = round(totals.get(en.kind, 0.0) + en.delta, 2)
            parts = sorted(totals.items(), key=lambda kv: -abs(kv[1]))
            why = ", ".join(f"{LABELS[k]} ({v:+.2f})" for k, v in parts[:3])
            ps.fired_t[key] = self.t
            ps.last_delta = change
            type_ = "rating_upgrade" if direction > 0 else "rating_downgrade"
            self._moment(type_, player=pid, team=ps.meta.team,
                         facts={"from": round(ref_v, 1), "to": round(now, 1), "delta": change,
                                "since_minute": int(ref_t // 60), "top_reason": LABELS[parts[0][0]],
                                "breakdown": why},
                         evidence=sorted({en.event_id for en in entries}),
                         importance=min(0.9, IMPORTANCE[type_] + 0.1 * (abs(change) - RATING_STEP)),
                         template=f"{ps.short} {ref_v:.1f} -> {now:.1f}: {why}")

    # ---- tracking -------------------------------------------------------------------
    def on_frame(self, f: Frame) -> list[Moment]:
        return self.on_positions(f.t, ((p.id, p.x, p.y, p.v) for p in f.players))

    def on_positions(self, t: float, players: Iterable[tuple[str, float, float, float]]) -> list[Moment]:
        self.t = t
        n0 = len(self.moments)
        minute = int(t // 60)
        if minute > self.minute_done:
            self.minute_done = minute
            if self.compute_attrs:
                self._minute_tick(minute)
        if self.poss:
            self.poss_time[self.poss] += DT
            if self.frame_i % FPS == 0:
                self.poss_secs.append(self.poss)
        self.frame_i += 1
        decay = math.exp(-DT * math.log(2) / MOMENTUM_HALF_LIFE_S)
        for k in self.threat:
            self.threat[k] *= decay
        for pid, _x, _y, v in players:
            self._track(self.players[pid], v)
        return self.moments[n0:]

    def _track(self, ps: PlayerState, v: float) -> None:
        if not ps.on_pitch:
            ps.on_pitch = True
        s = ps.stats
        s.seconds_played += DT
        s.distance_m += v * DT
        k = mx.kmh(v)
        if k > s.top_speed_kmh:
            s.top_speed_kmh = round(k, 1)
        self.match_top_kmh = max(self.match_top_kmh, k)
        for run, thr, metric in ((ps.sprint, mx.SPRINT_KMH, "sprints"),
                                 (ps.hi, mx.HIGH_INTENSITY_KMH, "hi_runs")):
            if k >= thr:
                if run.start is None:
                    run.start, run.peak, run.alerted = self.t, k, False
                run.peak = max(run.peak, k)
            elif run.start is not None:
                if self.t - run.start >= 1.0:
                    setattr(s, metric, getattr(s, metric) + 1)
                    self._log(ps.meta.id, metric, trk_ref(ps.meta.id, run.start))
                run.start = None
        run = ps.sprint
        if (run.start is not None and not run.alerted and run.peak >= mx.ALERT_SPRINT_KMH
                and k < ps.prev_kmh):
            run.alerted = True
            peak = round(run.peak, 1)
            fastest = run.peak >= self.match_top_kmh - 1e-9
            ref = trk_ref(ps.meta.id, self.t)
            type_ = "fastest_sprint" if fastest else "sprint"
            label = " - fastest sprint of the match" if fastest else ""
            ps.last_delta = 0.0
            self._moment(type_, player=ps.meta.id, team=ps.meta.team,
                         facts={"speed_kmh": peak, "fastest_of_match": int(fastest)},
                         evidence=[ref], template=f"{ps.short} {peak:.1f} km/h{label}")
        ps.prev_kmh = k
        if s.distance_m >= ps.next_milestone:
            km = int(ps.next_milestone // 1000)
            ps.next_milestone += MILESTONE_M
            self._moment("distance_milestone", player=ps.meta.id, team=ps.meta.team,
                         facts={"km": km}, evidence=[trk_ref(ps.meta.id, self.t)],
                         template=f"{ps.short} has covered {km} km")

    # ---- minute tick: attributes, momentum ----------------------------------------
    def _minute_tick(self, minute: int) -> None:
        for ps in self.players.values():
            if not ps.on_pitch and ps.stats.seconds_played == 0 and minute > 0:
                continue
            attrs = compute_attributes(ps.stats, ps.meta.role, ps.meta.base_attrs)
            zs = z_scores(ps.stats, ps.meta.role)
            ps.attrs = attrs
            ps.minute_hist.append((minute, attrs, zs, ps.stats.snapshot()))
            if ps.on_pitch and ps.stats.minutes >= MIN_ATTR_MINUTES:
                self._check_attrs(ps, minute)
        self._check_momentum(minute)

    def _check_attrs(self, ps: PlayerState, minute: int) -> None:
        hist = [h for h in ps.minute_hist if h[0] >= minute - WINDOW_S / 60]
        if len(hist) < 2:
            return
        now_attrs, now_z, now_stats = hist[-1][1], hist[-1][2], hist[-1][3]
        for attr in ATTRIBUTE_METRICS:
            for direction in (1, -1):
                key = f"{attr}_{'up' if direction > 0 else 'down'}"
                t_fire = ps.fired_t.get(key, -1e9) / 60
                cand = [h for h in hist if h[0] >= t_fire]
                if len(cand) < 2:
                    continue
                # Net change across the window (not from its low point), so a value that
                # wobbles up and back down doesn't fire both an upgrade and a downgrade.
                ref = cand[0]
                change = now_attrs[attr] - ref[1][attr]
                if change * direction < ATTR_STEP:
                    continue
                self._fire_attr(ps, attr, direction, change, ref, now_z, now_stats)

    def _fire_attr(self, ps: PlayerState, attr: str, direction: int, change: int, ref: tuple,
                   now_z: dict, now_stats: dict) -> None:
        since_min, ref_attrs, ref_z, ref_stats = ref
        metric = max(ATTRIBUTE_METRICS[attr],
                     key=lambda m: m.weight * (now_z[attr][m.key] - ref_z[attr][m.key]) * direction)
        driver, facts = self._describe_driver(metric.key, ref_stats, now_stats, since_min)
        evidence = [r for t, mk, r in ps.metric_log if mk == metric.key and t >= since_min * 60]
        if not evidence:
            evidence = [trk_ref(ps.meta.id, self.t)]
        key = f"{attr}_{'up' if direction > 0 else 'down'}"
        ps.fired_t[key] = self.t
        name = ATTR_NAMES[attr]
        type_ = "attr_upgrade" if direction > 0 else "attr_downgrade"
        facts.update({"attr": attr, "from": ref_attrs[attr], "to": ps.attrs[attr],
                      "delta": change, "since_minute": since_min, "metric": metric.key})
        self._moment(type_, player=ps.meta.id, team=ps.meta.team, facts=facts,
                     evidence=evidence[-12:],
                     importance=IMPORTANCE[type_] + 0.02 * (abs(change) - ATTR_STEP),
                     template=f"{name} {change:+d}: {driver}")

    def _describe_driver(self, key: str, a: dict, b: dict, since: int) -> tuple[str, dict]:
        """Plain-language driver for an attribute change between two stat snapshots."""
        mins = max(1e-6, (b["seconds_played"] - a["seconds_played"]) / 60)
        if key == "pass_pct":
            att = b["passes"] - a["passes"]
            cmp_ = b["passes_completed"] - a["passes_completed"]
            return (f"{cmp_} of {att} passes completed since {since}'",
                    {"passes": att, "completed": cmp_})
        if key == "avg_difficulty":
            att = b["passes"] - a["passes"]
            avg = (b["difficulty_sum"] - a["difficulty_sum"]) / att if att else 0.0
            return (f"average pass difficulty {avg:.1f} over {att} passes since {since}'",
                    {"passes": att, "avg_difficulty": round(avg, 1)})
        if key == "distance_per_min":
            per = (b["distance_m"] - a["distance_m"]) / mins
            return f"{per:.0f} m per minute since {since}'", {"m_per_min": round(per)}
        if key == "top_speed_kmh":
            return f"top speed {b['top_speed_kmh']:.1f} km/h", {"top_speed_kmh": b["top_speed_kmh"]}
        if key == "xg":
            n = b["shots"] - a["shots"]
            q = b["xg"] - a["xg"]
            return f"{n} shots worth {q:.2f} xG since {since}'", {"shots": n, "xg": round(q, 2)}
        labels = {"sprints": "sprints", "hi_runs": "high-intensity runs", "shots": "shots",
                  "chances_created": "chances created", "tackles_won": "tackles won",
                  "interceptions": "interceptions", "pressures_won": "pressures that won the ball",
                  "forward_passes": "forward passes"}
        n = int(b[key] - a[key])
        return f"{n} {labels[key]} since {since}'", {"count": n}

    def _check_momentum(self, minute: int) -> None:
        m = self.momentum()
        self.momentum_hist.append((minute, m))
        if minute - self.momentum_fired_t < 8:
            return
        for direction, team in ((1, self.home), (-1, self.away)):
            if m * direction < MOMENTUM_ON_TOP:
                continue
            past = [v for _, v in self.momentum_hist]
            frm = min(past, key=lambda v: v * direction)
            if frm * direction >= 0 or (m - frm) * direction < MOMENTUM_SWING:
                continue
            self.momentum_fired_t = minute
            name = self.meta.team(team).name
            self._moment("momentum_swing", player=None, team=team,
                         facts={"from": round(frm, 2), "to": round(m, 2)},
                         evidence=self._recent_threat_events(team),
                         template=f"Momentum swing: {name} take control "
                                  f"({frm:+.2f} -> {m:+.2f})")
            return

    def _recent_threat_events(self, team: str) -> list[str]:
        ids = [e.id for e in self.events.values()
               if e.team == team and self.t - e.t <= TEAM_WINDOW_S
               and e.type in ("shot", "interception", "tackle")]
        return ids[-10:]

    # ---- read models ----------------------------------------------------------------
    def momentum(self) -> float:
        h, a = self.threat[self.home], self.threat[self.away]
        return round((h - a) / (h + a + 1.0), 3)

    def team_state(self) -> TeamState:
        total = sum(self.poss_time.values()) or 1.0
        n5 = len(self.poss_secs) or 1
        recent = [t for t in self.turnovers if self.t - t <= TEAM_WINDOW_S]
        rate = len(recent) / (TEAM_WINDOW_S / 60)
        return TeamState(
            t=self.t,
            possession={k: round(100 * v / total, 1) for k, v in self.poss_time.items()},
            possession_5m={k: round(100 * sum(1 for x in self.poss_secs if x == k) / n5, 1)
                           for k in self.poss_time},
            momentum=self.momentum(),
            chaos=int(min(100, round(rate / 8 * 100))),
            turnovers_5m=len(recent),
            score=dict(self.score),
            xg={k: round(v, 2) for k, v in self.team_xg.items()},
            shots=dict(self.team_shots),
            shots_on_target=dict(self.team_sot),
        )

    def card(self, pid: str) -> CardState:
        ps = self.players[pid]
        return CardState(player=pid, t=round(self.t, 1), rating=round(ps.rating.value, 1),
                         delta=round(ps.last_delta, 1), attrs=dict(ps.attrs),
                         reason=ps.last_reason, evidence=list(ps.last_evidence), verified=True)

    def analyst(self, pid: str) -> dict:
        """Everything behind a card: the rating ledger by kind, and each attribute's metrics
        against the role baseline. Numbers only; the screen shows the working."""
        ps = self.players[pid]
        s = ps.stats
        totals: dict[str, list] = {}
        for en in ps.rating.ledger:
            c = totals.setdefault(en.kind, [0, 0.0])
            c[0] += 1
            c[1] += en.delta
        breakdown = [{"kind": k, "label": LABELS[k], "count": n, "total": round(t, 2)}
                     for k, (n, t) in sorted(totals.items(), key=lambda kv: -abs(kv[1][1]))]
        base = load_baselines()[ps.meta.role]
        zs = z_scores(s, ps.meta.role)
        attrs = {}
        for attr, metrics in ATTRIBUTE_METRICS.items():
            attrs[attr] = {
                "value": ps.attrs.get(attr, ps.meta.base_attrs[attr]),
                "base": ps.meta.base_attrs[attr],
                "metrics": [{
                    "key": m.key, "label": m.label, "weight": m.weight,
                    "per90": m.kind in ("rate", "lift"),
                    "count": getattr(s, m.key) if m.kind in ("rate", "lift") else None,
                    "value": round(raw_value(s, m.key), 2),
                    "role_mean": round(base[m.key][0], 2),
                    "z": round(zs[attr][m.key], 2),
                } for m in metrics],
            }
        return {
            "rating": round(ps.rating.value, 2), "start": 6.0, "breakdown": breakdown,
            "attrs": attrs, "role": ps.meta.role, "minutes": round(s.minutes, 1),
            "advanced": {
                "pass_pct": round(s.pass_pct, 1), "passes": s.passes,
                "avg_difficulty": round(s.avg_difficulty, 1), "forward_passes": s.forward_passes,
                "xg": round(s.xg, 2), "shots": s.shots, "shots_on_target": s.shots_on_target,
                "chances_created": s.chances_created, "tackles_won": s.tackles_won,
                "interceptions": s.interceptions, "pressures_won": s.pressures_won,
                "sprints": s.sprints, "hi_runs": s.hi_runs,
                "turnovers_own_half": s.turnovers_own_half,
            },
        }

    def stats(self, pid: str) -> dict:
        return self.players[pid].stats.public()
