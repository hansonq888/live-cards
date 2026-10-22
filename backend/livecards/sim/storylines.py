"""Planted storylines: scripted beats and modifiers that give the demo drama on cue.

Everything outside a beat is simulated stochastically. Coordinates in steps are in
the acting player's attack frame (x toward the goal they attack, y to their left).

The default script (Riverside FC vs Northgate Athletic):
  20'-32'  Northgate's dominant spell: they press harder and pass better.
  ~31'     Northgate score at the end of that spell (Halden).
  62'      Riverside substitution: Marchbanks on for Halloway.
  ~66'     Hero moment: Okelani's 34 km/h sprint down the right, cross, Varenne scores.
  60'+     Northgate's Hearne fades: his legs go and his passing drops off.
  75'      Northgate substitution: Asquith on for Pilar.
  ~88'     Late winner: Hearne is dispossessed in his own half, Marchbanks scores.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

Point = tuple[float, float]
# A target can be fixed, or computed from the relevant player's current attack-frame position.
Target = Point | Callable[[Point], Point]


@dataclass
class Start:
    """Get the ball to `player` (forced pass from a teammate, or a misplaced one from an opponent)."""

    player: str


@dataclass
class Carry:
    player: str
    to: Target
    speed: float  # m/s; 9.45 m/s = 34 km/h
    accel: float = 5.0


@dataclass
class Pass:
    passer: str
    receiver: str
    to: Target | None = None  # None: the receiver's position plus a short lead
    kind: str = "ground"
    speed_kmh: float | None = None
    arc: float | None = None


@dataclass
class Tackle:
    tackler: str
    victim: str


@dataclass
class Shot:
    player: str
    target_y: float
    speed_kmh: float
    outcome: str = "goal"
    height: float = 0.6


Step = Start | Carry | Pass | Tackle | Shot


@dataclass
class Beat:
    name: str
    t: float  # earliest trigger time (s)
    steps: list[Step]
    near: float = 35.0  # trigger once the ball is this close to the first player...
    deadline: float = 60.0  # ...or this many seconds after `t`, whichever comes first


@dataclass
class TeamModifier:
    team: str
    t0: float
    t1: float
    pass_bonus: float = 0.0
    shot_mult: float = 1.0
    forward_mult: float = 1.0
    pressers: int = 0  # extra players pressing the ball
    tackle_mult: float = 1.0


@dataclass
class Fade:
    player: str
    t0: float
    fatigue_mult: float = 5.0  # stamina drains this much faster after t0


@dataclass
class Storylines:
    beats: list[Beat] = field(default_factory=list)
    modifiers: list[TeamModifier] = field(default_factory=list)
    substitutions: list[tuple[float, str, str]] = field(default_factory=list)  # (t, off, on)
    fades: list[Fade] = field(default_factory=list)
    allow_random_goals: bool = False


def _rw_receive(pos: Point) -> Point:
    # The winger checks back toward the ball so the sprint afterwards is long.
    return (min(pos[0], 10.0), -27.0)


def default_storylines() -> Storylines:
    m = 60.0
    return Storylines(
        modifiers=[
            TeamModifier("NGT", 20 * m, 32 * m, pass_bonus=0.07, shot_mult=1.6,
                         forward_mult=1.4, pressers=1, tackle_mult=1.6),
            TeamModifier("RIV", 20 * m, 32 * m, pass_bonus=-0.06, forward_mult=0.8),
        ],
        substitutions=[(62 * m, "RIV-11", "RIV-14"), (75 * m, "NGT-07", "NGT-17")],
        fades=[Fade("NGT-08", 60 * m)],
        beats=[
            Beat("ngt_opener", 30 * m + 20, [
                Start("NGT-10"),
                Carry("NGT-10", lambda p: (p[0] + 8, p[1] * 0.6), speed=6.0),
                Pass("NGT-10", "NGT-11", to=lambda p: (max(p[0], 28.0), 18.0)),
                Carry("NGT-11", (37.0, 14.0), speed=7.2),
                Pass("NGT-11", "NGT-09", to=(42.0, 3.0), kind="ground", speed_kmh=62),
                Shot("NGT-09", target_y=2.4, speed_kmh=96, outcome="goal", height=0.5),
            ]),
            Beat("hero_sprint_goal", 65 * m + 30, [
                Start("RIV-05"),
                Carry("RIV-05", lambda p: (p[0] + 6, p[1] * 0.8), speed=4.5),
                Pass("RIV-05", "RIV-08"),
                Carry("RIV-08", lambda p: (p[0] + 5, p[1] - 3), speed=5.5),
                Pass("RIV-08", "RIV-07", to=_rw_receive, kind="long", speed_kmh=68, arc=3.5),
                Carry("RIV-07", (40.0, -23.0), speed=9.45, accel=5.5),
                Pass("RIV-07", "RIV-09", to=(41.5, -1.5), kind="cross", speed_kmh=74, arc=2.2),
                Shot("RIV-09", target_y=2.3, speed_kmh=104, outcome="goal", height=1.2),
            ], near=40),
            Beat("late_winner", 87 * m + 20, [
                Start("NGT-08"),
                Carry("NGT-08", lambda p: (p[0] + 3, p[1] + 1), speed=2.2),
                Tackle("RIV-10", "NGT-08"),
                Pass("RIV-10", "RIV-14", to=lambda p: (max(p[0], 30.0), 14.0)),
                Carry("RIV-14", (40.0, 9.0), speed=7.0),
                Shot("RIV-14", target_y=-2.6, speed_kmh=99, outcome="goal", height=0.8),
            ], near=40, deadline=90),
        ],
    )
