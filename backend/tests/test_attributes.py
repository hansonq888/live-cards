from livecards.engine.attributes import ATTRIBUTE_METRICS, compute_attributes, load_baselines
from livecards.engine.stats import PlayerStats

BASE = {"pace": 80, "passing": 70, "threat": 70, "defending": 40, "engine": 75}


def played(minutes: float, **kw) -> PlayerStats:
    return PlayerStats(seconds_played=minutes * 60, **kw)


def test_weights_sum_to_one():
    for metrics in ATTRIBUTE_METRICS.values():
        assert abs(sum(m.weight for m in metrics) - 1.0) < 1e-9


def test_every_role_has_every_baseline():
    keys = {m.key for ms in ATTRIBUTE_METRICS.values() for m in ms}
    for role in ("GK", "CB", "FB", "DM", "CM", "AM", "W", "ST"):
        assert keys <= set(load_baselines()[role])


def test_kickoff_card_equals_base():
    assert compute_attributes(PlayerStats(), "W", BASE) == BASE


def test_strong_threat_raises_threat_only_upward():
    weak = compute_attributes(played(60), "W", BASE)
    strong = compute_attributes(played(60, shots=6, xg=2.0, chances_created=6), "W", BASE)
    assert strong["threat"] > weak["threat"]
    assert strong["pace"] == weak["pace"]


def test_shrinkage_damps_early_events():
    # One tackle in 5 minutes is a huge per-90 rate; the prior keeps the move small.
    early = compute_attributes(played(5, tackles_won=1), "W", BASE)["defending"]
    late = compute_attributes(played(85, tackles_won=12, interceptions=6, pressures_won=14),
                              "W", BASE)["defending"]
    assert 0 < early - BASE["defending"] <= 4
    assert early < late


def test_pace_never_drops_for_not_sprinting():
    assert compute_attributes(played(30, top_speed_kmh=0.0), "W", BASE)["pace"] == BASE["pace"]
    assert compute_attributes(played(30, top_speed_kmh=33.5, sprints=6), "W", BASE)["pace"] > 80


def test_attributes_stay_in_range():
    extreme = played(90, shots=40, xg=20, chances_created=40, tackles_won=40, interceptions=40,
                     pressures_won=40, sprints=80, hi_runs=300, top_speed_kmh=40,
                     distance_m=20000)
    attrs = compute_attributes(extreme, "GK", {k: 95 for k in BASE})
    assert all(1 <= v <= 99 for v in attrs.values())
    assert max(v - 95 for v in attrs.values()) <= 20
