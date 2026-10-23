"""Build-up of the hero goal, reconstructed from events alone."""

from livecards.engine.buildup import build_up


def test_hero_goal_build_up(match, played):
    goal = next(e for e in match.events if e.type == "goal" and e.player == "RIV-09")
    b = build_up(match.events, goal, match.meta, played.moments)
    kinds = [s["kind"] for s in b["steps"]]
    players = [s["player"] for s in b["steps"]]
    assert kinds[0] == "win" and players[0] == "RIV-05"  # won in his own half
    assert kinds[-2:] == ["shot", "goal"]
    assert "sprint" in kinds and players[kinds.index("sprint")] == "RIV-07"
    passers = [s["player"] for s in b["steps"] if s["kind"] == "pass"]
    assert passers == ["RIV-05", "RIV-08", "RIV-07"]
    assert "cross" in b["steps"][-3]["text"] or "cross" in " ".join(s["text"] for s in b["steps"])
    assert b["facts"]["passes"] == 3 and b["start_t"] < goal.t
    assert all(s["evidence"] for s in b["steps"])


def test_every_goal_has_a_build_up(match, played):
    for goal in [e for e in match.events if e.type == "goal"]:
        b = build_up(match.events, goal, match.meta, played.moments)
        assert b and b["steps"][-1]["kind"] == "goal"
