"""The live stream end to end: hello, frames, director, cues and traces over a WebSocket."""

import time

from fastapi.testclient import TestClient

from livecards.server.app import app


def test_health():
    with TestClient(app) as c:
        assert c.get("/api/health").json() == {"ok": True}
        assert "properties" in c.get("/api/cue-schema").json()


def test_live_stream_around_the_hero_goal(monkeypatch):
    from livecards.server import session
    monkeypatch.setattr(session, "explainer_agent", lambda: None)  # templates only in tests
    seen: dict[str, list] = {}
    with TestClient(app) as c, c.websocket_connect("/ws/live?speed=40&start=3930") as ws:
        deadline = time.time() + 20
        while time.time() < deadline:
            msg = ws.receive_json()
            seen.setdefault(msg["type"], []).append(msg)
            if any(m.get("moment_type") == "goal" for m in seen.get("cue", [])):
                break
        ws.send_json({"type": "select", "player": "NGT-08"})
        for _ in range(50):
            msg = ws.receive_json()
            if msg["type"] == "director" and msg["mode"] == "manual":
                break
        else:
            raise AssertionError("manual pick not acknowledged")
    assert seen["hello"][0]["meta"]["home"]["code"] == "RIV"
    assert len(seen["frame"][0]["players"]) == 22
    goal = next(m for m in seen["cue"] if m["moment_type"] == "goal")
    assert goal["cue"]["player"] == "RIV-09" and goal["cue"]["evidence"]
    assert goal["source"] == "template"
    assert any(d["target"] == "RIV-09" and d["predicted"] for d in seen["director"])
    assert all(s["stage"] for t in seen["trace"] for s in t["steps"])


def test_snapshot_jump_matches_replay_from_kickoff(match):
    """Revisit restores a snapshot and fast-forwards; the state must be identical."""
    from livecards.engine.engine import MatchEngine
    from livecards.replay import feed, ticks
    from livecards.server.session import LiveSession

    async def send(_):
        return None

    t = 3950.0
    jumped = LiveSession(send, start=t).engine
    replayed = MatchEngine(match.meta)
    for tk in ticks(match, 0, t + 0.05):
        feed(replayed, match, tk)
    for pid in ("RIV-09", "RIV-07", "NGT-08"):
        assert jumped.card(pid).model_dump() == replayed.card(pid).model_dump()
    assert [m.id for m in jumped.moments] == [m.id for m in replayed.moments]


def test_seek_backwards_is_not_undone_by_the_clock(monkeypatch):
    """Regression: after a jump the playback clock must restart from the new position."""
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        frames = []

        async def send(m):
            if m["type"] == "frame":
                frames.append(m["t"])
        s = S.LiveSession(send, speed=5, start=4000)
        task = asyncio.create_task(s.run())
        await asyncio.sleep(1.0)
        await s.command({"type": "seek", "t": 3900})
        await asyncio.sleep(1.0)
        task.cancel()
        return frames
    frames = asyncio.run(main())
    assert min(frames[-5:]) < 3920 and max(frames[-5:]) < 3920


def test_console_kill_switch_and_audit():
    from livecards.server.control import plane
    with TestClient(app) as c, c.websocket_connect("/ws/console") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "console_hello" and hello["controls"]["approval"] == "auto"
        ws.send_json({"type": "controls", "patch": {"features": {"alerts": False}}})
        assert ws.receive_json()["controls"]["features"]["alerts"] is False
        plane().record(kind="blocked", text="Varenne 9.5", reason="number '9.5'", evidence=["e-1"])
        assert ws.receive_json()["entry"]["kind"] == "blocked"
        ws.send_json({"type": "controls", "patch": {"features": {"alerts": True}}})
        ws.receive_json()
        assert c.get("/api/audit?kind=blocked").json()["entries"][0]["text"] == "Varenne 9.5"


def test_explain_goal_returns_build_up_and_story(monkeypatch):
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        got = []

        async def send(m):
            got.append(m)
        s = S.LiveSession(send, start=3960)
        await s.command({"type": "explain_goal"})
        for _ in range(50):
            if any(m["type"] == "buildup_story" for m in got):
                break
            await asyncio.sleep(0.05)
        return got
    got = asyncio.run(main())
    b = next(m for m in got if m["type"] == "buildup")
    assert b["scorer"] == "RIV-09" and b["steps"][0]["kind"] == "win"
    story = next(m for m in got if m["type"] == "buildup_story")
    assert story["text"].startswith("3 passes in")  # template when the model is off


def test_joining_mid_match_sends_the_current_pick(monkeypatch):
    """Regression: right after a goal the ring holds the scorer for 40 s; a viewer joining
    then must still get the director and a card immediately."""
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        got = []

        async def send(m):
            got.append(m["type"])
        s = S.LiveSession(send, start=3955)
        task = asyncio.create_task(s.run())
        await asyncio.sleep(0.3)
        task.cancel()
        return got
    got = asyncio.run(main())
    assert "director" in got[:5] and "card" in got[:6]


def test_your_model_runs_in_lockstep(monkeypatch):
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        got = []

        async def send(m):
            got.append(m)
        s = S.LiveSession(send, speed=20, start=3900)
        task = asyncio.create_task(s.run())
        await s.command({"type": "your_model", "spec": {"name": "Less passing", "rating_weights": {"pass_under_pressure": 0.0}}})
        await s.command({"type": "your_model", "spec": {"rating_weights": {"backflip": 1}}})
        for _ in range(100):
            if any(m["type"] == "card" and "custom" in m for m in got):
                break
            await asyncio.sleep(0.05)
        await asyncio.sleep(0.5)
        task.cancel()
        return s, got
    s, got = asyncio.run(main())
    statuses = [m.get("status") for m in got if m["type"] == "your_model"]
    assert "error" in statuses
    card = next(m for m in reversed(got) if m["type"] == "card" and "custom" in m)
    assert card["custom"]["name"] == "Less passing"
    assert all(b["kind"] != "pass_under_pressure" or b["total"] == 0 for b in card["custom"]["breakdown"])
    assert s.shadow_i == s.i  # lockstep


def test_summary_has_every_play_and_player():
    from livecards.server.summary import summary
    s = summary(7)
    assert len([p for p in s["plays"] if p["outcome"] == "goal"]) == sum(s["score"].values())
    assert len(s["players"]) >= 22 and all(0 <= p["rating"] <= 10 for p in s["players"])
    assert s["examples"]["xg"] in {p["id"] for p in s["plays"]}


def test_summary_team_totals_and_events_agree_with_the_score():
    from livecards.server.summary import summary
    s = summary(7)
    goals = [e for e in s["events"] if e["type"] == "goal"]
    assert len(goals) == sum(s["score"].values())
    home, away = s["meta"]["home"]["code"], s["meta"]["away"]["code"]
    assert abs(s["team"][home]["possession"] + s["team"][away]["possession"] - 100) < 0.5
    assert all(s["team"][c]["shots"] >= s["team"][c]["shots_on_target"] for c in (home, away))


def test_summary_flow_adds_up_to_team_shots():
    from livecards.server.summary import summary
    s = summary(7)
    for code in s["team"]:
        assert sum(b[code]["shots"] for b in s["flow"]) == s["team"][code]["shots"]


def test_heatmap_puts_a_player_where_they_played(match):
    from livecards.server.session import heatmap
    h = heatmap(match, "RIV-09", len(match))
    assert len(h["grid"]) == h["cols"] * h["rows"] and max(h["grid"]) == 100
    # Riverside attack +x: their striker spends more time in the right half than the left.
    half = h["cols"] // 2
    rows = [h["grid"][r * h["cols"]:(r + 1) * h["cols"]] for r in range(h["rows"])]
    assert sum(sum(r[half + 1:]) for r in rows) > sum(sum(r[:half]) for r in rows)


def test_stop_following_while_paused_reports_auto(monkeypatch):
    """Regression: at full time (or paused) no tick runs, so going back to auto must send the
    director's new decision at once, or the Follow panel never closes."""
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        got = []

        async def send(m):
            got.append(m)
        s = S.LiveSession(send, start=3000)
        s.paused = True
        await s.command({"type": "select", "player": "NGT-05"})
        got.clear()
        await s.command({"type": "auto"})
        return got
    got = asyncio.run(main())
    d = [m for m in got if m["type"] == "director"]
    assert d and d[-1]["mode"] == "auto"


def test_xg_endpoint_matches_the_engine():
    from fastapi.testclient import TestClient

    from livecards.engine import metrics as mx
    from livecards.server.app import app
    r = TestClient(app).get("/api/xg", params={"x": 41.5, "y": 0}).json()  # penalty spot
    assert r["xg"] == mx.xg(41.5, 0, 1) and 0.25 < r["xg"] < 0.33 and r["distance_m"] == 11.0


def test_breakdown_of_a_later_play_after_jumping_back(monkeypatch):
    """Regression: after a breakdown seeks back to 25', asking for a 65' play must still work
    (the session's engine hasn't reached it, so it is read from a full run)."""
    import asyncio

    from livecards.server import session as S
    monkeypatch.setattr(S, "explainer_agent", lambda: None)

    async def main():
        got = []

        async def send(m):
            got.append(m)
        s = S.LiveSession(send, start=1500)
        await s._explain_goal(None, play_id="e-1666")
        return [m for m in got if m["type"] == "buildup"]
    b = asyncio.run(main())
    assert b and "error" not in b[-1] and b[-1]["scorer"] == "RIV-09"


def test_summary_has_formation_spots_for_every_starter():
    """Regression: the players page lineup needs spots even when the match is loaded from disk."""
    from livecards.server.summary import summary
    starters = [p for p in summary()["players"] if p["starter"]]
    assert len(starters) == 22 and all(p["spot"] for p in starters)
