import pytest

from livecards.engine import metrics as mx


def test_xg_reference_points():
    assert mx.xg(41.5, 0, 1) == pytest.approx(0.29, abs=0.005)  # penalty spot
    assert mx.xg(46.5, 0, 1) == pytest.approx(0.55, abs=0.005)  # 6 m, central
    assert mx.xg(27.5, 0, 1) == pytest.approx(0.075, abs=0.005)  # 25 m, central


def test_xg_is_symmetric_for_away_side():
    assert mx.xg(-41.5, 3, -1) == mx.xg(41.5, -3, 1)


def test_xg_falls_with_angle():
    assert mx.xg(41.5, 15, 1) < mx.xg(41.5, 0, 1)


def test_pass_difficulty_formula():
    # 10 m sideways, no pressure, own half: 1 + 1.0 = 2.0
    assert mx.pass_difficulty(-20, 0, -20, 10, 1, False) == 2.0
    # 30 m forward into the final third under pressure, through ball:
    # 1 + 3.0 (dist) + 2.0 (progress, capped) + 1.5 + 1.0 + 0.5 = 9.0
    assert mx.pass_difficulty(-5, 0, 25, 0, 1, True, "through") == 9.0
    # Capped at 10
    assert mx.pass_difficulty(-50, 0, 20, 30, 1, True, "cross") == 10.0


def test_pass_difficulty_uses_attack_direction():
    home = mx.pass_difficulty(0, 0, 20, 0, 1, False)
    away = mx.pass_difficulty(0, 0, -20, 0, -1, False)
    assert home == away
    assert mx.pass_difficulty(0, 0, 20, 0, -1, False) < home  # backward for the away side


def test_own_half():
    assert mx.in_own_half(-10, 1) and not mx.in_own_half(10, 1)
    assert mx.in_own_half(10, -1) and not mx.in_own_half(-10, -1)


def test_progress_and_distance():
    assert mx.pass_progress(0, 12, 1) == 12
    assert mx.pass_progress(0, 12, -1) == -12
    assert mx.pass_distance(0, 0, 3, 4) == 5
