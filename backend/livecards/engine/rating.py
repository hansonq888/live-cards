"""Live rating (0-10): starts at 6.0, moves with each event, shown capped to [3.0, 10.0].

Every change is written to a ledger with the event id behind it, so any rating can be
explained and audited line by line.
"""

from __future__ import annotations

from dataclasses import dataclass, field

START = 6.0
FLOOR = 3.0
CEILING = 10.0

# Event weights (CLAUDE.md section 4). Keys are the ledger labels.
WEIGHTS: dict[str, float] = {
    "goal": 1.0,
    "assist": 0.6,
    "chance_created": 0.15,
    "shot_on_target": 0.1,
    "tackle_won": 0.1,
    "interception": 0.1,
    "pass_under_pressure": 0.03,
    "turnover_own_half": -0.15,
    "foul": -0.05,
    "yellow_card": -0.3,
}

LABELS: dict[str, str] = {
    "goal": "goal",
    "assist": "assist",
    "chance_created": "chance created",
    "shot_on_target": "shot on target",
    "tackle_won": "tackle won",
    "interception": "interception",
    "pass_under_pressure": "pass completed under pressure",
    "turnover_own_half": "lost the ball in own half",
    "foul": "foul conceded",
    "yellow_card": "yellow card",
}


# The same reasons as a fan would say them, for the one-line explanation on the card.
PLAIN: dict[str, str] = {
    "goal": "scored",
    "assist": "set up a goal",
    "chance_created": "created a chance",
    "shot_on_target": "hit the target",
    "tackle_won": "won a tackle",
    "interception": "made an interception",
    "pass_under_pressure": "passed under pressure",
    "turnover_own_half": "lost the ball deep",
    "foul": "gave away a foul",
    "yellow_card": "was booked",
}


@dataclass(frozen=True)
class LedgerEntry:
    t: float
    event_id: str
    kind: str
    delta: float


@dataclass
class Rating:
    ledger: list[LedgerEntry] = field(default_factory=list)
    raw: float = START
    weights: dict[str, float] = field(default_factory=lambda: WEIGHTS)

    @property
    def value(self) -> float:
        return round(min(CEILING, max(FLOOR, self.raw)), 2)

    def apply(self, t: float, event_id: str, kind: str) -> LedgerEntry:
        entry = LedgerEntry(t, event_id, kind, self.weights[kind])
        self.ledger.append(entry)
        self.raw += entry.delta
        return entry

    def entries_since(self, t0: float) -> list[LedgerEntry]:
        return [e for e in self.ledger if e.t >= t0]
