"""Data contracts shared by the simulator, stats engine, agents and frontend.

These mirror section 7 of CLAUDE.md. Coordinates: pitch 105 x 68 m, origin at the
centre spot, x toward the right-hand goal, y across the pitch. Times are seconds
from kickoff. Riverside (home) attacks +x all match; the away side attacks -x.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PITCH_LENGTH = 105.0
PITCH_WIDTH = 68.0
HALF_LENGTH = PITCH_LENGTH / 2
HALF_WIDTH = PITCH_WIDTH / 2
GOAL_HALF_WIDTH = 3.66
FPS = 10
HALF_DURATION = 45 * 60
MATCH_DURATION = 2 * HALF_DURATION

EventType = Literal[
    "kickoff",
    "pass",
    "shot",
    "goal",
    "tackle",
    "interception",
    "recovery",
    "foul",
    "card",
    "substitution",
    "possession_change",
    "pressure",
    "half_end",
    "match_end",
]

Role = Literal["GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"]


class PlayerMeta(BaseModel):
    id: str
    team: str
    number: int
    name: str
    short: str
    role: Role
    position: str
    starter: bool = True
    # Pre-match "form" attributes (1-99) that the live card starts from.
    base_attrs: dict[str, int]


class TeamMeta(BaseModel):
    code: str
    name: str
    color: str
    secondary: str
    attack_dir: Literal[1, -1]
    formation: str


class MatchMeta(BaseModel):
    match_id: str
    seed: int
    venue: str
    competition: str = "Synthetic League"
    home: TeamMeta
    away: TeamMeta
    players: list[PlayerMeta]
    duration: float = MATCH_DURATION
    fps: int = FPS

    def player(self, pid: str) -> PlayerMeta:
        for p in self.players:
            if p.id == pid:
                return p
        raise KeyError(pid)

    def team(self, code: str) -> TeamMeta:
        return self.home if self.home.code == code else self.away


class Ball(BaseModel):
    x: float
    y: float
    z: float


class PlayerPos(BaseModel):
    id: str
    x: float
    y: float
    v: float = Field(description="speed in m/s")


class Frame(BaseModel):
    t: float
    ball: Ball
    players: list[PlayerPos]


class Event(BaseModel):
    """A discrete match event. Optional fields depend on `type`."""

    id: str
    t: float
    minute: int
    type: EventType
    team: str | None = None
    player: str | None = None
    x: float | None = None
    y: float | None = None
    end_x: float | None = None
    end_y: float | None = None
    outcome: str | None = None
    receiver: str | None = None
    under_pressure: bool | None = None
    speed_kmh: float | None = None
    kind: str | None = None  # pass: ground/long/cross/through; card: yellow/red
    target: str | None = None  # tackle/foul/pressure: the opponent involved
    player_in: str | None = None  # substitution
    xg: float | None = None  # shot: chance quality from the simulator's model


class CardState(BaseModel):
    player: str
    t: float
    rating: float
    delta: float
    attrs: dict[str, int]
    reason: str
    evidence: list[str]
    verified: bool


MomentType = Literal[
    "goal",
    "big_chance",
    "sprint",
    "fastest_sprint",
    "streak",
    "distance_milestone",
    "rating_upgrade",
    "rating_downgrade",
    "attr_upgrade",
    "attr_downgrade",
    "momentum_swing",
    "card",
    "substitution",
]


class Moment(BaseModel):
    """Something worth putting on screen, scored for importance (0-1).

    `facts` holds every number a sentence about this moment may use; `evidence`
    holds the event ids it rests on. Agents write words around these, never numbers.
    """

    id: str
    t: float
    minute: int
    type: MomentType
    player: str | None = None
    team: str | None = None
    importance: float
    facts: dict[str, float | int | str]
    evidence: list[str]
    template: str


class OverlayCue(BaseModel):
    cue: str
    start: float
    duration: float
    type: str
    player: str | None = None
    ring: bool = False
    text: dict[str, str]
    lang: str = "en"
    evidence: list[str]
