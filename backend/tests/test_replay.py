"""End to end: the full match through the engine, and the hero moment the demo depends on."""

import asyncio

from livecards.replay import stream, ticks


def test_events_arrive_before_their_frame(match):
    seen = 0
    for tick in ticks(match, 0, 300):
        assert all(e.t <= tick.t + 1e-6 for e in tick.events)
        seen += len(tick.events)
    assert seen == sum(1 for e in match.events if e.t < 300)


def test_stream_respects_speed(match):
    async def collect():
        return [t async for t in stream(match, speed=1000, start=60, end=62)]
    out = asyncio.run(collect())
    assert len(out) == 20 and out[0].t == 60.0


def test_all_event_evidence_resolves(played):
    ids = set(played.events)
    for m in played.moments:
        assert m.evidence, m
        for ref in m.evidence:
            assert ref in ids or ref.startswith("trk-"), (m.id, ref)


def test_hero_moment(played):
    by_type = {}
    for m in played.moments:
        by_type.setdefault((m.type, m.player), []).append(m)
    sprint = by_type[("fastest_sprint", "RIV-07")][-1]
    goal = by_type[("goal", "RIV-09")][0]
    assert sprint.facts["speed_kmh"] >= 33.5
    assert 0 < goal.t - sprint.t < 10
    up = next(m for m in by_type[("rating_upgrade", "RIV-09")] if m.t == goal.t)
    assert up.facts["delta"] >= 1.0 and up.facts["from"] < 7.5
    assert up.facts["top_reason"] == "goal"
    assist = next(m for m in by_type[("rating_upgrade", "RIV-07")] if m.t == goal.t)
    assert "set up a goal" in assist.template


def test_fading_player_gets_downgraded(played):
    downs = [m for m in played.moments if m.player == "NGT-08" and m.type == "rating_downgrade"
             and m.minute >= 60]
    assert downs


def test_ratings_spread_like_real_matches(played):
    ratings = sorted(ps.rating.value for ps in played.players.values() if ps.stats.minutes > 30)
    assert 5.5 <= ratings[len(ratings) // 2] <= 7.5  # median
    assert sum(r >= 10.0 for r in ratings) <= 1


def test_momentum_swing_during_dominant_spell(played):
    swings = [m for m in played.moments if m.type == "momentum_swing"]
    assert any(m.team == "NGT" and 20 <= m.minute <= 35 for m in swings)
