"""Tracking-derived stats and alerts: distance, top speed, sprints, milestones."""

import pytest

from livecards.engine.engine import MatchEngine

DT = 0.1


def run_profile(engine: MatchEngine, pid: str, speeds: list[float], t0: float = 0.0):
    moments = []
    for i, v in enumerate(speeds):
        moments += engine.on_positions(t0 + i * DT, [(pid, 0.0, 0.0, v)])
    return moments


def sprint(peak: float, ramp: int = 20, hold: int = 10) -> list[float]:
    up = [peak * (i + 1) / ramp for i in range(ramp)]
    return [0.0] * 5 + up + [peak] * hold + up[::-1] + [0.0] * 5


def test_distance_and_top_speed(engine):
    run_profile(engine, "RIV-07", [5.0] * 100)
    s = engine.players["RIV-07"].stats
    assert s.distance_m == pytest.approx(50.0)
    assert s.top_speed_kmh == 18.0
    assert s.seconds_played == pytest.approx(10.0)


def test_sprint_and_high_intensity_counts(engine):
    run_profile(engine, "RIV-07", sprint(8.0))  # 28.8 km/h
    s = engine.players["RIV-07"].stats
    assert s.sprints == 1 and s.hi_runs == 1


def test_short_burst_is_not_a_sprint(engine):
    run_profile(engine, "RIV-07", [0.0] * 3 + [8.0] * 5 + [0.0] * 3)  # 0.5 s
    assert engine.players["RIV-07"].stats.sprints == 0


def test_sprint_alert_at_peak_and_fastest_of_match(engine):
    moments = run_profile(engine, "RIV-07", sprint(9.45))  # 34.0 km/h
    alerts = [m for m in moments if m.type in ("sprint", "fastest_sprint")]
    assert len(alerts) == 1
    assert alerts[0].type == "fastest_sprint" and alerts[0].facts["speed_kmh"] == 34.0
    assert alerts[0].evidence[0].startswith("trk-RIV-07-")
    # A slower alert-worthy sprint later is a plain sprint, not "fastest".
    later = run_profile(engine, "NGT-07", sprint(9.0), t0=100)
    assert [m.type for m in later if "sprint" in m.type] == ["sprint"]


def test_no_alert_below_threshold(engine):
    moments = run_profile(engine, "RIV-07", sprint(8.8))  # 31.7 km/h
    assert not [m for m in moments if "sprint" in m.type]


def test_distance_milestones_every_2km(engine):
    moments = run_profile(engine, "RIV-07", [10.0] * 2100)  # 2.1 km
    ms = [m for m in moments if m.type == "distance_milestone"]
    assert [m.facts["km"] for m in ms] == [2]
