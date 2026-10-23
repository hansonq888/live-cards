"""Auto-director: who the ring follows, and why, decided ten times a second.

It is predictive: when a cross or through ball is played toward the box, the ring moves
to the intended receiver while the ball is still in the air, and says why ("cross
incoming: Varenne arriving, xG 0.29 from there"). Every number in a rationale comes
from the stats engine's formulas.

Signals (weight, lifetime):
  goal scorer 1.0 (until the restart) · cross/through ball into the box -> receiver 0.9 · sprint alert 0.8
  ball carrier breaking at 25+ km/h 0.75 · big chance 0.7 · long ball -> receiver 0.6
  rating upgrade 0.6 · streak 0.5 · nearest player to the ball 0.3 (0.4 in the final third)

Switching: the ring holds a player at least 6 s, unless a 0.85+ signal appears (a
chance about to happen), which may cut in after 1.5 s. A challenger must beat the
current target's score by 0.1 (the current target gets a 0.15 stickiness bonus).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from livecards.contracts import Event, MatchMeta, Moment
from livecards.engine import metrics as mx

MIN_HOLD_S = 6.0
URGENT_HOLD_S = 1.5
URGENT_WEIGHT = 0.85
STICKINESS = 0.15
MARGIN = 0.1
BOX_X = 52.5 - 16.5


@dataclass
class Signal:
    player: str
    weight: float
    until: float
    reason: str
    kind: str
    key: str = ""  # reason template id + args, so viewers can show it in their language
    args: dict = field(default_factory=dict)


@dataclass
class Decision:
    target: str
    reason: str
    kind: str
    since: float
    changed: bool = False
    predicted: bool = False
    weight: float = 0.0
    key: str = ""
    args: dict = field(default_factory=dict)


@dataclass
class AutoDirector:
    meta: MatchMeta
    mode: str = "auto"  # auto | manual
    signals: list[Signal] = field(default_factory=list)
    current: Decision | None = None

    def __post_init__(self) -> None:
        self.names = {p.id: p.short for p in self.meta.players}
        self.dirs = {self.meta.home.code: self.meta.home.attack_dir,
                     self.meta.away.code: self.meta.away.attack_dir}
        self.team_of = {p.id: p.team for p in self.meta.players}

    # ---- inputs ----------------------------------------------------------------------
    def on_event(self, e: Event) -> None:
        if e.type == "pass" and e.player:
            # The ball has left him: the story moves on with it.
            self.signals = [s for s in self.signals if s.player != e.player or s.kind == "goal"]
        if e.type == "pass" and e.receiver and e.end_x is not None:
            d = self.dirs[e.team]
            ax = e.end_x * d
            into_box = ax >= BOX_X and abs(e.end_y) <= 20.16
            name = self.names[e.receiver]
            dur = max(1.0, mx.pass_distance(e.x, e.y, e.end_x, e.end_y) / max(
                (e.speed_kmh or 60) / 3.6, 1.0))
            if into_box and e.kind in ("cross", "through", "ground", "long"):
                q = mx.xg(e.end_x, e.end_y, d)
                label = "Cross" if e.kind == "cross" else "Ball into the box"
                self._add(e.receiver, 0.9, e.t + dur + 2.5,
                          f"{label} incoming: {name} arriving, xG {q:.2f} from there", "predict",
                          "cross_incoming" if e.kind == "cross" else "box_incoming",
                          {"name": name, "xg": q})
            elif e.kind == "long" and ax > 0:
                self._add(e.receiver, 0.6, e.t + dur + 2.0,
                          f"Long ball toward {name}", "predict", "long_ball", {"name": name})
        elif e.type == "goal" and e.player:
            # Stay on the scorer through the celebration, until the restart.
            self._add(e.player, 1.0, e.t + 40, f"{self.names[e.player]} scores", "goal",
                      "scores", {"name": self.names[e.player]})

    def on_moment(self, m: Moment) -> None:
        if not m.player:
            return
        name = self.names.get(m.player, m.player)
        kmh = round(float(m.facts.get("speed_kmh", 0)), 1)
        to = round(float(m.facts.get("to", 0)), 1)
        count = m.facts.get("count", 3)
        table = {
            "fastest_sprint": (0.8, 8, f"{name} at {kmh:.1f} km/h, fastest sprint of the match",
                               {"name": name, "kmh": kmh}),
            "sprint": (0.8, 8, f"{name} sprinting at {kmh:.1f} km/h", {"name": name, "kmh": kmh}),
            "big_chance": (0.7, 8, f"Big chance for {name}", {"name": name}),
            "rating_upgrade": (0.6, 8, f"{name}'s card upgrades to {to:.1f}", {"name": name, "to": to}),
            "streak": (0.5, 8, f"{name}: {count} successful actions in a row",
                       {"name": name, "count": count}),
        }
        if m.type in table:
            w, life, reason, args = table[m.type]
            self._add(m.player, w, m.t + life, reason, m.type, m.type, args)

    def select(self, player: str, t: float, reason: str | None = None) -> Decision:
        """Manual pick (click, keyboard, or a replay): the director stops until set back to auto."""
        self.mode = "manual"
        changed = self.current is None or self.current.target != player
        self.current = Decision(player, reason or f"Following {self.names[player]} (your pick)",
                                "replay" if reason else "manual", t, changed,
                                key="replay" if reason else "your_pick",
                                args={"name": self.names[player], "text": reason or ""})
        return self.current

    def set_auto(self) -> None:
        """Back to auto: decide afresh from the current play rather than keep the manual pick."""
        self.mode = "auto"
        self.current = None

    def _add(self, player: str, weight: float, until: float, reason: str, kind: str,
             key: str = "", args: dict | None = None) -> None:
        self.signals.append(Signal(player, weight, until, reason, kind, key, args or {}))

    # ---- decision --------------------------------------------------------------------
    def update(self, t: float, ball: tuple[float, float],
               players: list[tuple[str, float, float, float]]) -> Decision:
        self.signals = [s for s in self.signals if s.until >= t]
        if self.current is not None:
            self.current.changed = False
        if self.mode == "manual" and self.current is not None:
            return self.current
        on_pitch = {pid for pid, *_ in players}
        scores: dict[str, tuple[float, Signal]] = {}

        def offer(s: Signal) -> None:
            if s.player in on_pitch and (s.player not in scores or s.weight > scores[s.player][0]):
                scores[s.player] = (s.weight, s)

        for s in self.signals:
            offer(s)
        bx, by = ball
        near = min(players, key=lambda p: math.hypot(p[1] - bx, p[2] - by))
        pid, x, y, v = near
        dist = math.hypot(x - bx, y - by)
        name = self.names[pid]
        if dist < 2.5 and v * 3.6 >= mx.SPRINT_KMH:
            offer(Signal(pid, 0.75, t, f"{name} breaking forward at {v * 3.6:.0f} km/h", "carry",
                         "breaking", {"name": name, "kmh": round(v * 3.6)}))
        else:
            final_third = x * self.dirs[self.team_of[pid]] >= mx.FINAL_THIRD_X
            on_ball = dist < 2.5
            offer(Signal(pid, 0.4 if final_third else 0.3, t,
                         f"{name} on the ball" if on_ball else f"{name} nearest the ball",
                         "ball", "on_ball" if on_ball else "nearest_ball", {"name": name}))

        best_pid, (best_w, best_sig) = max(scores.items(), key=lambda kv: kv[1][0])
        cur = self.current
        if cur is None:
            self.current = Decision(best_pid, best_sig.reason, best_sig.kind, t, True,
                                    best_sig.kind == "predict", best_w, best_sig.key,
                                    best_sig.args)
            return self.current
        cur_w = scores.get(cur.target, (0.0, None))[0] + STICKINESS
        held = t - cur.since
        if cur.target in scores:
            sig = scores[cur.target][1]
            cur.reason, cur.kind, cur.key, cur.args = sig.reason, sig.kind, sig.key, sig.args
            cur.predicted = sig.kind == "predict"
        if cur.target not in on_pitch:  # substituted off: switch immediately
            held = MIN_HOLD_S
        elif best_pid == cur.target or best_w < cur_w + MARGIN:
            return cur
        if held >= MIN_HOLD_S or (best_w >= URGENT_WEIGHT and held >= URGENT_HOLD_S):
            self.current = Decision(best_pid, best_sig.reason, best_sig.kind, t, True,
                                    best_sig.kind == "predict", best_w, best_sig.key,
                                    best_sig.args)
        return self.current
