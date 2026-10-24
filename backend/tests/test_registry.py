"""The stat registry stays honest: every entry points at real code, shows the engine's real
settings, reads the same in every language, and has a real example play."""

import importlib
import math
import re

import pytest

from livecards.engine import metrics as mx
from livecards.engine.registry import LANGS, REGISTRY, as_json


def test_ids_are_unique():
    ids = [s.id for s in REGISTRY]
    assert len(ids) == len(set(ids))


@pytest.mark.parametrize("stat", REGISTRY, ids=lambda s: s.id)
def test_compute_points_at_real_code(stat):
    module, name = stat.compute.rsplit(".", 1)
    assert callable(getattr(importlib.import_module(module), name))


@pytest.mark.parametrize("stat", REGISTRY, ids=lambda s: s.id)
def test_every_meaning_has_every_language_with_the_same_placeholders(stat):
    for key, texts in stat.meaning.items():
        assert set(texts) == set(LANGS), (stat.id, key)
        holes = {lang: set(re.findall(r"\{(\w+)\}", t)) for lang, t in texts.items()}
        assert len({frozenset(h) for h in holes.values()}) == 1, (stat.id, key, holes)


@pytest.mark.parametrize("stat", [s for s in REGISTRY if s.bands], ids=lambda s: s.id)
def test_bands_match_their_meanings(stat):
    keys = [k for k in stat.meaning if k.startswith("band_")]
    assert len(keys) == len(stat.bands) + 1 and stat.bands == sorted(stat.bands)


def test_xg_settings_reproduce_the_engine():
    """The registry's settings are the engine's: recomputing xG from them gives the same value."""
    st = next(s for s in REGISTRY if s.id == "xg").settings
    x, y, d = 41.5, 0.0, 1  # the penalty spot, attacking +x
    dx, dy = 52.5 - x, y
    dist = math.hypot(dx, dy)
    angle = math.atan2(2 * 3.66 * dx, dx * dx + dy * dy - 3.66 ** 2)
    z = st["intercept"] + st["angle_weight"] * angle + st["distance_weight"] * dist
    assert round(1 / (1 + math.exp(-z)), 3) == mx.xg(x, y, d)


def test_api_shape_and_examples():
    from livecards.server.summary import summary
    j = as_json()
    assert j["version"] and len(j["stats"]) == len(REGISTRY)
    plays = {p["id"] for p in summary(7)["plays"]}
    assert all(summary(7)["examples"][s.id] in plays for s in REGISTRY)
