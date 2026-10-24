"""HTTP + WebSocket API.

    uv run uvicorn livecards.server.app:app --reload --port 8000

GET  /api/health          liveness
GET  /api/meta            match metadata (clubs, players, formulas)
GET  /api/cue-schema      the overlay cue JSON Schema
WS   /ws/live?speed=1&start=0   live stream; send {"type": "select" | "auto" | "speed" |
                                "pause" | "play" | "seek" | "model" | "profile" | "ask" |
                                "redteam", ...} to control it
WS   /ws/console               broadcaster console: audit log, approvals, kill switches
GET  /api/audit?kind=blocked   the audit log
In production the built web app is served from / as static files.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from livecards import telemetry
from livecards.contracts import OverlayCue
from livecards.engine.rating import WEIGHTS
from livecards.engine.registry import as_json
from livecards.server.control import plane
from livecards.server.session import LiveSession, load_match, snapshots
from livecards.server.summary import summary


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    logging.basicConfig(level=logging.INFO)
    for noisy in ("azure", "agent_framework", "httpx", "httpx2"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    STATUS["tracing"] = "Azure Application Insights" if telemetry.configure() else "off"
    await asyncio.to_thread(load_match, 7)  # simulate once, share across viewers
    await asyncio.to_thread(snapshots, 7)  # engine snapshots for instant jumps (Revisit)
    yield


app = FastAPI(title="Live Cards", version="0.1.0", lifespan=lifespan)
WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


STATUS: dict[str, str] = {}


@app.get("/api/status")
async def status() -> dict:
    """Which backend is live for each concern (the cloud deployment vs. local fallbacks)."""
    from livecards.agents.llm import foundry_configured
    from livecards.server.pubsub import broadcast
    from livecards.server.session import FEED_SOURCE

    return {
        "match_feed": FEED_SOURCE.get(7, "not loaded"),
        "models": "Microsoft Foundry (Agent Framework)" if foundry_configured() else "off (templates)",
        "audit_log": type(plane().audit).__name__.replace("AuditLog", "") or "Sqlite",
        "console_fanout": "Azure Web PubSub" if broadcast() else "app WebSocket",
        "tracing": STATUS.get("tracing", "off"),
    }


@app.get("/api/model/default")
async def default_model() -> dict:
    """The default formula, with labels, for the 'Your model' editor."""
    from livecards.engine.attributes import ATTRIBUTE_METRICS
    from livecards.engine.model import ModelSpec
    from livecards.engine.rating import LABELS

    return {"spec": ModelSpec.default().model_dump(), "rating_labels": LABELS,
            "metric_labels": {a: {m.key: m.label for m in ms} for a, ms in ATTRIBUTE_METRICS.items()}}


@app.get("/api/meta")
async def meta() -> dict:
    return {"match": load_match(7).meta.model_dump(), "rating_weights": WEIGHTS}


@app.get("/api/summary")
async def match_summary() -> dict:
    """The finished match for the platform's pages: final cards, player stats, every play."""
    return await asyncio.to_thread(summary, 7)


@app.get("/api/stats")
async def stats_registry() -> dict:
    """Every stat, defined once: meaning, formula, calibratable settings, fan wording."""
    return as_json()


@app.get("/api/cue-schema")
async def cue_schema() -> dict:
    return OverlayCue.model_json_schema()


@app.websocket("/ws/live")
async def live(ws: WebSocket, speed: float = 1.0, start: float = 0.0) -> None:
    await ws.accept()
    lock = asyncio.Lock()

    async def send(msg: dict) -> None:
        async with lock:
            await ws.send_json(msg)

    session = LiveSession(send, speed=speed, start=start)
    runner = asyncio.create_task(session.run())
    try:
        while True:
            msg = await ws.receive_json()
            await session.command(msg)
    except WebSocketDisconnect:
        pass
    finally:
        runner.cancel()
        for t in list(session.tasks):
            t.cancel()
        # The viewer may already be gone: a send on a closed socket is not an error.
        with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect):
            await runner


@app.get("/api/audit")
async def audit(kind: str | None = None, limit: int = 200) -> dict:
    return {"counts": plane().audit.counts(), "entries": plane().audit.recent(min(limit, 1000), kind)}


@app.get("/api/console/negotiate")
async def console_negotiate() -> dict:
    """Web PubSub client URL for consoles (null when running without Web PubSub)."""
    from livecards.server.pubsub import broadcast

    wps = broadcast()
    return {"url": await asyncio.to_thread(wps.client_url) if wps else None}


@app.get("/api/console/snapshot")
async def console_snapshot() -> dict:
    return plane().snapshot()


@app.post("/api/console/command")
async def console_command(msg: dict) -> dict:
    p = plane()
    if msg.get("type") == "controls":
        p.update(msg.get("patch") or {})
    elif msg.get("type") == "decide":
        p.decide(int(msg["id"]), bool(msg.get("approve")), str(msg.get("operator") or "operator"))
    return {"ok": True}


@app.websocket("/ws/console")
async def console(ws: WebSocket) -> None:
    """Broadcaster console: live audit stream, approval queue and kill switches."""
    await ws.accept()
    p = plane()
    q = p.subscribe()
    await ws.send_json(p.snapshot())

    async def pump() -> None:
        while True:
            await ws.send_json(await q.get())

    pusher = asyncio.create_task(pump())
    try:
        while True:
            msg = await ws.receive_json()
            if msg.get("type") == "controls":
                p.update(msg.get("patch") or {})
            elif msg.get("type") == "decide":
                p.decide(int(msg["id"]), bool(msg.get("approve")), str(msg.get("operator") or "operator"))
    except WebSocketDisconnect:
        pass
    finally:
        pusher.cancel()
        p.unsubscribe(q)


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
