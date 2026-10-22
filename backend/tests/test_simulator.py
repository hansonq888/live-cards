"""Simulator invariants and the planted storylines the demo depends on."""

import numpy as np
import pytest

from livecards.contracts import FPS, HALF_LENGTH, HALF_WIDTH, MATCH_DURATION, Frame
from livecards.sim.simulator import simulate


def test_full_match_at_10fps(match):
    assert len(match) == MATCH_DURATION * FPS == 54_000
    assert np.allclose(np.diff(match.times), 0.1)
    assert match.pos.shape == (54_000, 22, 3)


def test_deterministic_per_seed(match):
    again = simulate(7)
    assert [e.model_dump() for e in again.events] == [e.model_dump() for e in match.events]
    assert np.array_equal(again.pos, match.pos)
    assert simulate(8).events != match.events


def test_positions_and_speeds_are_physical(match):
    xs, ys, vs = match.pos[..., 0], match.pos[..., 1], match.pos[..., 2]
    assert np.abs(xs).max() <= HALF_LENGTH + 2 and np.abs(ys).max() <= HALF_WIDTH + 2
    assert vs.max() <= 9.6  # 34.6 km/h
    jumps = np.hypot(np.diff(xs, axis=0), np.diff(ys, axis=0))
    # No teleporting outside half time and substitutions.
    sub_frames = set(np.flatnonzero(np.diff(match.lineup_idx)) + 1) | {27_000}
    big = {i + 1 for i in np.argwhere(jumps > 1.5)[:, 0]}
    assert big <= sub_frames


def test_events_sorted_with_unique_ids(match):
    ts = [e.t for e in match.events]
    assert ts == sorted(ts)
    assert len({e.id for e in match.events}) == len(match.events)
    assert all(e.minute == int(e.t // 60) for e in match.events)


def test_event_volumes_are_football_realistic(match):
    n = {k: sum(e.type == k for e in match.events) for k in ("pass", "shot", "foul", "tackle")}
    assert 800 <= n["pass"] <= 1600
    assert 12 <= n["shot"] <= 45
    assert 10 <= n["foul"] <= 45
    passes = [e for e in match.events if e.type == "pass"]
    pct = sum(e.outcome == "complete" for e in passes) / len(passes)
    assert 0.72 <= pct <= 0.9


def test_frames_match_the_contract(match):
    f = match.frame(22_874)
    Frame.model_validate(f.model_dump())
    assert len(f.players) == 22 and f.t == 2287.4


def check_storyline_goals(m):
    goals = [(e.minute, e.player) for e in m.events if e.type == "goal"]
    assert [pid for _, pid in goals] == ["NGT-09", "RIV-09", "RIV-14"]
    assert 30 <= goals[0][0] <= 31 and 65 <= goals[1][0] <= 67 and 87 <= goals[2][0] <= 89
    assert m.score() == {"RIV": 2, "NGT": 1}


@pytest.mark.parametrize("seed", [1, 3, 11])
def test_storylines_fire_on_any_seed(seed):
    check_storyline_goals(simulate(seed))


def test_planted_storylines(match):
    check_storyline_goals(match)
    subs = [(e.minute, e.player, e.player_in) for e in match.events if e.type == "substitution"]
    assert [s[1:] for s in subs] == [("RIV-11", "RIV-14"), ("NGT-07", "NGT-17")]


def test_hero_sprint_is_the_only_one_over_32kmh(match):
    over = set()
    for i in np.unique(match.lineup_idx):
        rows = match.lineup_idx == i
        for k, pid in enumerate(match.lineups[i]):
            if (match.pos[rows, k, 2] * 3.6 > 32).any():
                over.add(pid)
    assert over == {"RIV-07"}


def test_fading_player_slows_down(match):
    k = match.lineups[0].index("NGT-08")
    first = match.pos[: 60 * 60 * FPS, k, 2].mean()
    last = match.pos[75 * 60 * FPS:, k, 2].mean()
    assert last < 0.8 * first
