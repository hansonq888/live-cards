"""Auto-director: predictive switching on the hero move, minimum hold, manual override."""

import pytest

from livecards.agents.director import MIN_HOLD_S, URGENT_HOLD_S, URGENT_WEIGHT, AutoDirector
from livecards.engine.engine import MatchEngine
from livecards.replay import feed, positions, ticks


@pytest.fixture(scope="module")
def decisions(match):
    engine, director = MatchEngine(match.meta), AutoDirector(match.meta)
    out = []
    for tick in ticks(match):
        for e in tick.events:
            director.on_event(e)
        for m in feed(engine, match, tick):
            director.on_moment(m)
        d = director.update(tick.t, tuple(match.ball[tick.i, :2]), list(positions(match, tick.i)))
        out.append((tick.t, d.target, d.reason, d.kind, d.changed, d.weight))
    return out


def test_ring_moves_to_striker_before_the_cross_lands(match, decisions):
    goal = next(e for e in match.events if e.type == "goal" and e.player == "RIV-09")
    cross = [e for e in match.events if e.type == "pass" and e.player == "RIV-07"
             and e.receiver == "RIV-09" and e.t < goal.t][-1]
    switch = next(d for d in decisions if d[4] and d[1] == "RIV-09" and d[0] >= cross.t)
    assert switch[0] < goal.t - 0.5  # predicted, not reactive
    assert switch[3] == "predict" and "xG" in switch[2]


def test_ring_is_on_the_winger_during_his_sprint(match, decisions):
    goal = next(e for e in match.events if e.type == "goal" and e.player == "RIV-09")
    window = [d for d in decisions if goal.t - 4 <= d[0] <= goal.t - 2]
    assert any(d[1] == "RIV-07" for d in window)


def test_minimum_hold(match, decisions):
    subs = {e.t for e in match.events if e.type == "substitution"}
    switches = [d for d in decisions if d[4]]
    for prev, cur in zip(switches, switches[1:]):
        held = cur[0] - prev[0]
        if any(abs(cur[0] - s) < 0.2 for s in subs):
            continue  # the followed player was substituted off
        assert held >= URGENT_HOLD_S - 1e-6
        if cur[5] < URGENT_WEIGHT:
            assert held >= MIN_HOLD_S - 1e-6, (prev, cur)
    assert 100 < len(switches) < 1200


def test_manual_pick_overrides_until_auto(match):
    d = AutoDirector(match.meta)
    d.select("NGT-08", 10.0)
    assert d.update(11.0, (0, 0), [("RIV-09", 0.5, 0, 0), ("NGT-08", 30, 0, 0)]).target == "NGT-08"
    d.set_auto()
    assert d.update(20.0, (0, 0), [("RIV-09", 0.5, 0, 0), ("NGT-08", 30, 0, 0)]).target == "RIV-09"
