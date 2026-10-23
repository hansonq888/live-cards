from __future__ import annotations

import itertools
import os

os.environ.setdefault("AUDIT_DB", ":memory:")  # tests never touch the real audit log

import pytest

from livecards.contracts import Event
from livecards.engine.engine import MatchEngine
from livecards.replay import run_engine
from livecards.sim.match import Match
from livecards.sim.roster import build_match_meta
from livecards.sim.simulator import simulate


@pytest.fixture(scope="session")
def match() -> Match:
    return simulate(7)


@pytest.fixture(scope="session")
def played(match: Match) -> MatchEngine:
    return run_engine(match)


@pytest.fixture
def engine() -> MatchEngine:
    return MatchEngine(build_match_meta(1))


class EventFactory:
    """Builds events with sequential ids. RIV attacks +x, NGT attacks -x."""

    def __init__(self) -> None:
        self.n = itertools.count(1)

    def __call__(self, type_: str, t: float, **kw) -> Event:
        return Event(id=f"e-{next(self.n):04d}", t=t, minute=int(t // 60), type=type_, **kw)


@pytest.fixture
def ev() -> EventFactory:
    return EventFactory()
