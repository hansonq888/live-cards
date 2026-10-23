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
