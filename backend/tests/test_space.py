"""Space control: the race-to-each-cell model behaves like football says it should."""

import numpy as np

from livecards.engine import space

Z = np.zeros((1, 2))


def at(x, y):
    return np.array([[x, y]], dtype=float)


def test_mirror_positions_split_the_pitch_evenly():
    cm = space.control(at(-20, 0), Z, at(20, 0), Z)
    assert abs(cm.p.mean() - 0.5) < 1e-6
    assert cm.area() + cm.area(team_a=False) == cm.p.size * cm.cell_area


def test_each_team_controls_its_own_end():
    cm = space.control(at(-20, 0), Z, at(20, 0), Z)
    left, right = cm.p[:, cm.xs < -30].mean(), cm.p[:, cm.xs > 30].mean()
    assert left > 0.95 and right < 0.05


def test_a_lone_player_controls_more_than_a_crowded_one():
    alone = space.control(at(0, 0), Z, at(40, 30), Z)
    crowded = space.control(at(0, 0), Z, np.array([[3.0, 0.0], [-3.0, 0.0], [0.0, 3.0]]), np.zeros((3, 2)))
    assert alone.area() > crowded.area()


def test_running_toward_space_claims_it_sooner():
    still = space.control(at(0, 0), Z, at(10, 0), Z)
    running = space.control(at(0, 0), np.array([[6.0, 0.0]]), at(10, 0), Z)
    i = np.argmin(abs(still.xs - 12))
    j = np.argmin(abs(still.ys - 0))
    assert running.p[j, i] > still.p[j, i]


def test_space_ahead_of_the_ball_depends_on_direction():
    cm = space.control(at(10, 0), Z, at(-10, 0), Z)
    toward_plus = cm.area(space.ahead_of(cm, 0.0, +1))
    toward_minus = cm.area(space.ahead_of(cm, 0.0, -1))
    assert toward_plus > toward_minus


def test_snapshot_on_a_real_frame(match):
    i = 3000
    snap = space.snapshot(match.pos[i], match.pos[i - 1], 0.1, match.ids_at(i), "RIV",
                          float(match.ball[i][0]), match.meta.home.attack_dir)
    assert len(snap["grid"]) == snap["rows"] * snap["cols"]
    assert 0 <= min(snap["grid"]) and max(snap["grid"]) <= 255
    assert 0 < snap["final_third_m2"] < snap["total_m2"] < 105 * 68


def test_final_third_belongs_to_the_attacking_end():
    cm = space.control(at(40, 0), Z, at(-40, 0), Z)
    assert cm.area(space.final_third(cm, +1)) > cm.area(space.final_third(cm, -1))
