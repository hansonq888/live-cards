"""HTTP + WebSocket API.

    uv run uvicorn livecards.server.app:app --reload --port 8000

GET  /api/health          liveness
GET  /api/meta            match metadata (clubs, players, formulas)
GET  /api/cue-schema      the overlay cue JSON Schema
WS   /ws/live?speed=1&start=0   live stream; send {"type": "select" | "auto" | "speed" |
                                "pause" | "play" | "seek" | "model", ...} to control it
In production the built web app is served from / as static files.
"""

from __future__ import annotations

import asyncio
import contextlib
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from livecards.contracts import OverlayCue
from livecards.engine.rating import WEIGHTS
from livecards.server.session import LiveSession, load_match, snapshots


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    await asyncio.to_thread(load_match, 7)  # simulate once, share across viewers
    await asyncio.to_thread(snapshots, 7)  # engine snapshots for instant jumps (Revisit)
    yield


app = FastAPI(title="Live Cards", version="0.1.0", lifespan=lifespan)
WEB_DIST = Path(__file__).resolve().parents[3] / "web" / "dist"


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/api/meta")
async def meta() -> dict:
    return {"match": load_match(7).meta.model_dump(), "rating_weights": WEIGHTS}


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


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
