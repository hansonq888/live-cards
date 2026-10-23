"""Your model: analyst-supplied weights, validated, applied by the same engine."""

import pytest
from pydantic import ValidationError

from livecards.engine.engine import MatchEngine
from livecards.engine.model import ModelSpec
from livecards.replay import run_engine


def test_default_spec_reproduces_the_engine(match, played):
    mine = run_engine(match, MatchEngine(match.meta, model=ModelSpec.default()))
    for pid in ("RIV-09", "RIV-07", "NGT-08"):
        assert mine.card(pid).rating == played.card(pid).rating
        assert mine.card(pid).attrs == played.card(pid).attrs


def test_custom_rating_weight_changes_the_rating_exactly(match, played):
    spec = ModelSpec(rating_weights={"pass_under_pressure": 0.01, "goal": 1.5})
    mine = run_engine(match, MatchEngine(match.meta, model=spec))
    ours, theirs = played.analyst("RIV-09"), mine.analyst("RIV-09")
    n_pressure = next(b["count"] for b in ours["breakdown"] if b["kind"] == "pass_under_pressure")
    expected = ours["rating"] + 0.5 - n_pressure * (0.03 - 0.01)
    assert theirs["rating"] == pytest.approx(min(10, expected), abs=0.011)


def test_attribute_weights_are_renormalized(match):
    spec = ModelSpec(attr_weights={"pace": {"top_speed_kmh": 1.0, "sprints": 0.0}})
    pace = spec.metrics()["pace"]
    assert {m.key: m.weight for m in pace} == {"top_speed_kmh": 1.0, "sprints": 0.0}
    passing = spec.metrics()["passing"]
    assert abs(sum(m.weight for m in passing) - 1) < 1e-9


@pytest.mark.parametrize("bad", [
    {"rating_weights": {"backflip": 1.0}},
    {"rating_weights": {"goal": 99}},
    {"attr_weights": {"charisma": {"x": 1}}},
    {"attr_weights": {"pace": {"shots": 0.5}}},
    {"attr_weights": {"pace": {"sprints": -1}}},
])
def test_invalid_models_are_rejected(bad):
    with pytest.raises(ValidationError):
        ModelSpec(**bad)
