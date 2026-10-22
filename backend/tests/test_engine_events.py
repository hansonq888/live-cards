"""Event handling: stats, rating ledger, derived chances/assists, upgrades and evidence."""

import pytest

from livecards.engine.engine import MatchEngine


def rating(engine: MatchEngine, pid: str) -> float:
    return engine.players[pid].rating.value


def cpass(ev, t, frm, to, x=10.0, end_x=20.0, team="RIV", **kw):
    return ev("pass", t, team=team, player=frm, receiver=to, x=x, y=0.0, end_x=end_x,
              end_y=0.0, outcome="complete", under_pressure=False, **kw)


def test_pass_accuracy_and_forward_passes(engine, ev):
    engine.on_event(cpass(ev, 1, "RIV-08", "RIV-07", x=0, end_x=12))  # forward
    engine.on_event(cpass(ev, 2, "RIV-08", "RIV-06", x=0, end_x=-3))  # backward
    engine.on_event(ev("pass", 3, team="RIV", player="RIV-08", receiver="RIV-07", x=0, y=0,
                       end_x=20, end_y=0, outcome="incomplete", under_pressure=False))
    s = engine.players["RIV-08"].stats
    assert (s.passes, s.passes_completed, s.forward_passes) == (3, 2, 1)
    assert s.pass_pct == pytest.approx(66.67, abs=0.01)
    assert engine.players["RIV-07"].stats.touches == 1


def test_pass_under_pressure_adds_003(engine, ev):
    engine.on_event(ev("pass", 1, team="RIV", player="RIV-08", receiver="RIV-07", x=0, y=0,
                       end_x=5, end_y=0, outcome="complete", under_pressure=True))
    assert rating(engine, "RIV-08") == pytest.approx(6.03)


@pytest.mark.parametrize("x,team,expected", [(-20, "RIV", 5.85), (20, "RIV", 6.0),
                                             (20, "NGT", 5.85), (-20, "NGT", 6.0)])
def test_turnover_only_penalised_in_own_half(engine, ev, x, team, expected):
    pid = "RIV-05" if team == "RIV" else "NGT-05"
    engine.on_event(ev("pass", 1, team=team, player=pid, receiver=pid, x=x, y=0, end_x=x,
                       end_y=10, outcome="incomplete", under_pressure=False))
    assert rating(engine, pid) == pytest.approx(expected)


def test_goal_chain_credits_scorer_assister_and_chance(engine, ev):
    key = cpass(ev, 100, "RIV-07", "RIV-09", x=38, end_x=41.5)
    shot = ev("shot", 101, team="RIV", player="RIV-09", x=41.5, y=0, outcome="goal",
              speed_kmh=104)
    goal = ev("goal", 101.5, team="RIV", player="RIV-09", x=41.5, y=0)
    engine.on_event(key)
    engine.on_event(shot)
    moments = engine.on_event(goal)
    scorer, creator = engine.players["RIV-09"], engine.players["RIV-07"]
    assert (scorer.stats.goals, scorer.stats.shots, scorer.stats.touches) == (1, 1, 2)
    assert rating(engine, "RIV-09") == pytest.approx(6.0 + 0.1 + 1.0)
    assert rating(engine, "RIV-07") == pytest.approx(6.0 + 0.15 + 0.6)
    assert creator.stats.chances_created == 1 and creator.stats.assists == 1
    goal_m = next(m for m in moments if m.type == "goal")
    assert set(goal_m.evidence) == {goal.id, shot.id, key.id}
    assert goal_m.facts["speed_kmh"] == 104 and goal_m.facts["score_home"] == 1
    assert "assisted by Okelani" in goal_m.template
    ups = {m.player: m for m in moments if m.type == "rating_upgrade"}
    # The window starts before the shot, so the upgrade covers shot on target + goal.
    assert ups["RIV-09"].facts["from"] == 6.0 and ups["RIV-09"].facts["to"] == 7.1
    assert goal.id in ups["RIV-09"].evidence


def test_no_chance_credit_after_possession_changes(engine, ev):
    engine.on_event(cpass(ev, 100, "RIV-07", "RIV-09"))
    engine.on_event(ev("possession_change", 101, team="NGT", player="NGT-04"))
    engine.on_event(ev("possession_change", 103, team="RIV", player="RIV-09"))
    engine.on_event(ev("shot", 104, team="RIV", player="RIV-09", x=40, y=0, outcome="off_target"))
    assert engine.players["RIV-07"].stats.chances_created == 0


def test_tackle_won_penalises_dispossessed_player_in_own_half(engine, ev):
    # NGT-08 dispossessed at x=+15: that is NGT's own half (NGT attacks -x).
    engine.on_event(ev("tackle", 1, team="RIV", player="RIV-10", target="NGT-08", x=15, y=0,
                       outcome="won"))
    assert rating(engine, "RIV-10") == pytest.approx(6.1)
    assert rating(engine, "NGT-08") == pytest.approx(5.85)
    assert engine.players["NGT-08"].stats.turnovers_own_half == 1


def test_lost_tackle_changes_nothing(engine, ev):
    engine.on_event(ev("tackle", 1, team="RIV", player="RIV-10", target="NGT-08", x=15, y=0,
                       outcome="lost"))
    assert rating(engine, "RIV-10") == 6.0 and rating(engine, "NGT-08") == 6.0


def test_foul_and_yellow(engine, ev):
    engine.on_event(ev("foul", 1, team="NGT", player="NGT-06", target="RIV-07", x=0, y=0))
    moments = engine.on_event(ev("card", 1, team="NGT", player="NGT-06", kind="yellow"))
    assert rating(engine, "NGT-06") == pytest.approx(5.65)
    assert any(m.type == "card" for m in moments)


def test_pressure_won_within_five_seconds(engine, ev):
    engine.on_event(ev("pressure", 10, team="NGT", player="NGT-06", target="RIV-08"))
    engine.on_event(ev("pressure", 10, team="NGT", player="NGT-08", target="RIV-08"))
    engine.on_event(ev("possession_change", 13, team="NGT", player="NGT-06"))
    engine.on_event(ev("pressure", 20, team="RIV", player="RIV-09", target="NGT-04"))
    engine.on_event(ev("possession_change", 30, team="RIV", player="RIV-05"))  # too late
    assert engine.players["NGT-06"].stats.pressures_won == 1
    assert engine.players["NGT-08"].stats.pressures_won == 1
    assert engine.players["RIV-09"].stats.pressures_won == 0


def test_rating_upgrade_fires_once_per_rise(engine, ev):
    def tackle(t):
        return engine.on_event(ev("tackle", t, team="RIV", player="RIV-06", target="NGT-09",
                                  x=-10, y=0, outcome="won"))
    fired = [m for t in range(1, 5) for m in tackle(t) if m.type == "rating_upgrade"]
    assert fired == []  # +0.4 so far
    fired = [m for m in tackle(5) if m.type == "rating_upgrade"]
    assert len(fired) == 1 and fired[0].facts["delta"] == pytest.approx(0.5)
    assert len(fired[0].evidence) == 5
    assert not [m for t in range(6, 10) for m in tackle(t) if m.type == "rating_upgrade"]
    assert [m for m in tackle(10) if m.type == "rating_upgrade"]  # another +0.5


def test_rating_upgrade_needs_the_rise_inside_ten_minutes(engine, ev):
    for i in range(4):
        engine.on_event(ev("interception", i * 200, team="RIV", player="RIV-06", x=0, y=0))
    moments = engine.on_event(ev("interception", 800, team="RIV", player="RIV-06", x=0, y=0))
    assert not [m for m in moments if m.type == "rating_upgrade"]


def test_rating_downgrade_mirrors_upgrade(engine, ev):
    moments = []
    for t in range(1, 5):
        moments += engine.on_event(ev("pass", t, team="NGT", player="NGT-08", receiver="NGT-06",
                                      x=20, y=0, end_x=10, end_y=0, outcome="incomplete",
                                      under_pressure=False))
    down = [m for m in moments if m.type == "rating_downgrade"]
    assert len(down) == 1 and down[0].facts["to"] == pytest.approx(5.4)
    assert "lost the ball in own half" in down[0].template


def test_streak_after_three_successes_and_reset_on_failure(engine, ev):
    def win(t):
        return engine.on_event(ev("interception", t, team="RIV", player="RIV-06", x=0, y=0))
    assert not any(m.type == "streak" for t in (1, 2) for m in win(t))
    engine.on_event(ev("tackle", 3, team="RIV", player="RIV-06", target="NGT-09", x=0, y=0,
                       outcome="lost"))
    assert not any(m.type == "streak" for t in (4, 5) for m in win(t))
    streak = [m for m in win(6) if m.type == "streak"]
    assert len(streak) == 1 and len(streak[0].evidence) == 3


def test_big_chance_moment(engine, ev):
    moments = engine.on_event(ev("shot", 1, team="RIV", player="RIV-09", x=46.5, y=0,
                                 outcome="saved", speed_kmh=80))
    big = [m for m in moments if m.type == "big_chance"]
    assert big and big[0].facts["xg"] >= 0.3


def test_every_moment_number_is_in_facts(engine, ev):
    engine.on_event(cpass(ev, 100, "RIV-07", "RIV-09", x=38, end_x=41.5))
    engine.on_event(ev("shot", 101, team="RIV", player="RIV-09", x=41.5, y=0, outcome="goal",
                       speed_kmh=104))
    for m in engine.on_event(ev("goal", 101.5, team="RIV", player="RIV-09", x=41.5, y=0)):
        assert m.evidence, m
        assert m.facts, m
