import pytest

from livecards.engine.rating import CEILING, FLOOR, START, WEIGHTS, Rating


def test_weights_match_the_published_table():
    assert WEIGHTS == {
        "goal": 1.0, "assist": 0.6, "chance_created": 0.15, "shot_on_target": 0.1,
        "tackle_won": 0.1, "interception": 0.1, "pass_under_pressure": 0.03,
        "turnover_own_half": -0.15, "foul": -0.05, "yellow_card": -0.3,
    }


def test_starts_at_six():
    assert Rating().value == START == 6.0


def test_ledger_records_every_change():
    r = Rating()
    r.apply(10, "e-1", "goal")
    r.apply(20, "e-2", "foul")
    assert r.value == pytest.approx(6.95)
    assert [(e.event_id, e.delta) for e in r.ledger] == [("e-1", 1.0), ("e-2", -0.05)]
    assert [e.event_id for e in r.entries_since(15)] == ["e-2"]


def test_capped_between_floor_and_ceiling():
    r = Rating()
    for i in range(6):
        r.apply(i, f"g{i}", "goal")
    assert r.value == CEILING == 10.0
    r = Rating()
    for i in range(15):
        r.apply(i, f"y{i}", "yellow_card")
    assert r.value == FLOOR == 3.0
