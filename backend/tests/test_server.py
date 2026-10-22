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
