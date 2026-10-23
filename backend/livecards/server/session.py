"""A live viewing session: replays a match through the engine, director and agents.

One session per connected viewer. The match clock advances at `speed`x; tracking
frames go out at most 20 times a second (the viewer interpolates); moments, director
decisions, verified cues and agent traces go out as they happen. Explanations run as
background tasks so a slow model never stalls the stream.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import asdict
from functools import cache

from livecards.agents.director import AutoDirector
from livecards.agents.explainer import INSTRUCTIONS, job_for
from livecards.agents.llm import make_agent
from livecards.agents.personalizer import (
    DEFAULT,
    SHOWCASE,
    PersonalizeRequest,
    Profile,
    personalize,
)
from livecards.agents.personalizer import INSTRUCTIONS as PERSONALIZER_INSTRUCTIONS
from livecards.agents.pipeline import Explained, TraceEvent, explain
from livecards.agents.reviewer import make_reviewer
from livecards.agents.verifier import check
from livecards.contracts import Moment
from livecards.engine.engine import MatchEngine
from livecards.replay import positions
from livecards.server.cues import make_cue
from livecards.sim.match import Match
from livecards.sim.simulator import simulate

Send = Callable[[dict], Awaitable[None]]

FRAME_INTERVAL_S = 0.05  # wall-clock: at most 20 frames per second to the browser
CARD_INTERVAL_S = 0.5
TEAM_INTERVAL_S = 1.0
MODEL_MOMENTS = {"goal", "rating_upgrade", "rating_downgrade", "big_chance", "momentum_swing",
                 "fastest_sprint", "attr_upgrade", "attr_downgrade"}
MAX_MODEL_INFLIGHT = 6
SHOWCASE_MOMENTS = {"goal", "rating_upgrade"}


@cache
def load_match(seed: int = 7) -> Match:
    return simulate(seed)


@cache
def explainer_agent():
    return make_agent("Explainer", INSTRUCTIONS)


@cache
def personalizer_agent():
    return make_agent("Personalizer", PERSONALIZER_INSTRUCTIONS)


@cache
def reviewer_agent():
    return make_reviewer()


class LiveSession:
    def __init__(self, send: Send, seed: int = 7, speed: float = 1.0, start: float = 0.0) -> None:
        self.send = send
        self.match = load_match(seed)
        self.meta = self.match.meta
        self.roster = {n for p in self.meta.players for n in (p.name, p.short)}
        self.speed = speed
        self.paused = False
        self.model_enabled = explainer_agent() is not None
        self.metrics = {"moments": 0, "cues": 0, "claims_checked": 0, "blocked": 0,
                        "model_lines": 0, "template_lines": 0, "rewrites": 0, "aired_unverified": 0,
                        "latency_ms": []}
        self.cue_seq = 0
        self.profile = DEFAULT
        self.inflight = 0
        self.tasks: set[asyncio.Task] = set()
        self._reset(start)

    def _reset(self, start: float) -> None:
        self.engine = MatchEngine(self.meta)
        self.director = AutoDirector(self.meta)
        self.i = 0
        self._advance_to(start, live=False)

    # ---- commands from the viewer -----------------------------------------------------
    async def command(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "select" and msg.get("player"):
            d = self.director.select(msg["player"], self.t)
            await self._send_director(d)
            await self._send_card(d.target)
        elif kind == "auto":
            self.director.set_auto()
        elif kind == "speed":
            self.speed = max(0.25, min(40.0, float(msg.get("value", 1))))
        elif kind == "pause":
            self.paused = True
        elif kind == "play":
            self.paused = False
        elif kind == "seek":
            self._reset(max(0.0, min(float(msg.get("t", 0)), self.meta.duration - 1)))
            await self.send({"type": "seeked", "t": self.t})
        elif kind == "profile":
            try:
                self.profile = Profile.parse(str(msg.get("key", "casual.en.neutral")))
            except ValueError:
                self.profile = DEFAULT
            await self.send({"type": "profile", "key": self.profile.key})
        elif kind == "model":
            self.model_enabled = bool(msg.get("enabled")) and explainer_agent() is not None
            await self.send({"type": "model", "enabled": self.model_enabled})

    # ---- main loop ------------------------------------------------------------------
    @property
    def t(self) -> float:
        return float(self.match.times[min(self.i, len(self.match) - 1)])

    async def run(self) -> None:
        await self.send(self.hello())
        last_frame = last_card = last_team = 0.0
        wall0, game0 = time.monotonic(), self.t
        speed0 = self.speed
        while self.i < len(self.match):
            if self.paused:
                await asyncio.sleep(0.05)
                wall0, game0 = time.monotonic(), self.t
                continue
            if self.speed != speed0:
                wall0, game0, speed0 = time.monotonic(), self.t, self.speed
            target_t = game0 + (time.monotonic() - wall0) * self.speed
            await self._advance_to(target_t, live=True)
            now = time.monotonic()
            if now - last_frame >= FRAME_INTERVAL_S:
                last_frame = now
                await self.send(self.frame_msg())
            if now - last_card >= CARD_INTERVAL_S and self.director.current:
                last_card = now
                await self._send_card(self.director.current.target)
            if now - last_team >= TEAM_INTERVAL_S:
                last_team = now
                await self.send(self.team_msg())
            await asyncio.sleep(0.01)
        await self.send({"type": "end", "score": self.engine.score})

    def _advance_to(self, target_t: float, live: bool):
        """Feed every tick up to target_t. Returns an awaitable when live."""
        out: list[dict] = []
        while self.i < len(self.match) and float(self.match.times[self.i]) <= target_t:
            tick_i = self.i
            t = float(self.match.times[tick_i])
            events = []
            j = getattr(self, "_ev_j", 0) if self.i else 0
            evs = self.match.events
            while j < len(evs) and evs[j].t <= t + 1e-6:
                events.append(evs[j])
                j += 1
            self._ev_j = j
            for e in events:
                self.director.on_event(e)
            moments = []
            for e in events:
                moments += self.engine.on_event(e)
            moments += self.engine.on_positions(t, positions(self.match, tick_i))
            for m in moments:
                self.director.on_moment(m)
            d = self.director.update(t, (float(self.match.ball[tick_i, 0]),
                                         float(self.match.ball[tick_i, 1])),
                                     list(positions(self.match, tick_i)))
            if live:
                if d.changed:
                    out.append(self._director_msg(d))
                for m in moments:
                    self._on_moment(m, out)
            self.i += 1
        if not live:
            return None

        async def flush() -> None:
            for msg in out:
                await self.send(msg)
        return flush()

    # ---- moments -> agents -> cues ---------------------------------------------------------
    # Facts first, then the story: the engine's template line airs instantly (code-built,
    # verified in microseconds); the AI line replaces it once it has passed the verifier and
    # the reviewer. Personalized variants follow for the viewer's profile and, on big
    # moments, for the showcase profiles.
    def _on_moment(self, m: Moment, out: list[dict]) -> None:
        self.metrics["moments"] += 1
        msg = {"type": "moment", "moment": m.model_dump()}
        if m.player:
            msg["card"] = self.engine.card(m.player).model_dump()
        out.append(msg)
        if m.importance < 0.3 and m.type != "distance_milestone":
            return
        job = job_for(m, self.engine)
        ring = self.director.current.target if self.director.current else None
        self.cue_seq += 1
        cue_id = self.cue_seq
        t0 = time.perf_counter()
        verdict = check(job.template, job.bundle(), self.roster)
        ms = round((time.perf_counter() - t0) * 1000, 3)
        self.metrics["claims_checked"] += 1
        if verdict.ok:
            self.metrics["cues"] += 1
            self.metrics["template_lines"] += 1
            instant = Explained(m.id, job.template, "template", 1, verdict, ms)
            out.append(self._cue_msg(cue_id, m, instant, ring, phase="instant"))
        else:
            self.metrics["blocked"] += 1
        use_model = (self.model_enabled and m.type in MODEL_MOMENTS
                     and self.inflight < MAX_MODEL_INFLIGHT)
        if not use_model:
            out.append({"type": "trace", "moment": m.id, "moment_type": m.type, "player": m.player,
                        "steps": [asdict(TraceEvent(m.id, "template-check",
                                                    "ok" if verdict.ok else "rejected", ms,
                                                    verdict.reason() or "instant line", 0))]})
            return
        task = asyncio.create_task(self._explain(m, job, ring, cue_id))
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    def _cue_msg(self, cue_id: int, m: Moment, result: Explained, ring: str | None,
                 phase: str) -> dict:
        cue = make_cue(cue_id, m, result, ring)
        return {"type": "cue", "cue": cue.model_dump(), "moment_type": m.type, "phase": phase,
                "source": result.source, "attempts": result.attempts, "latency_ms": result.ms,
                "claims_checked": result.verdict.checked}

    async def _explain(self, m: Moment, job, ring: str | None, cue_id: int) -> None:
        traces: list[TraceEvent] = []
        self.inflight += 1
        try:
            result = await explain(job, explainer_agent(), self.roster, traces.append,
                                   reviewer_agent())
        finally:
            self.inflight -= 1
        for ev in traces:
            if ev.stage in ("verifier", "reviewer"):
                self.metrics["claims_checked"] += 1
                self.metrics["blocked"] += ev.outcome == "rejected"
        await self.send({"type": "trace", "moment": m.id, "moment_type": m.type,
                         "player": m.player, "steps": [asdict(e) for e in traces]})
        if result is None or result.source != "model":
            return  # the instant template line stands
        self.metrics["cues"] += 1
        self.metrics["aired_unverified"] += not result.verdict.ok  # must stay 0
        self.metrics["model_lines"] += 1
        self.metrics["rewrites"] += result.attempts > 1
        self.metrics["latency_ms"].append(result.ms)
        await self.send(self._cue_msg(cue_id, m, result, ring, phase="story"))
        await self._personalize(m, job, result.text, cue_id)

    async def _personalize(self, m: Moment, job, base: str, cue_id: int) -> None:
        profiles = [self.profile]
        if m.type in SHOWCASE_MOMENTS and m.importance >= 0.55:
            profiles += SHOWCASE
        profiles = [p for p in dict.fromkeys(profiles) if p != DEFAULT]
        if not profiles:
            return
        traces: list[TraceEvent] = []
        req = PersonalizeRequest(job, base, self.meta.home.name, self.meta.away.name)
        variants = await personalize(req, profiles, personalizer_agent(), self.roster,
                                     traces.append, reviewer_agent())
        for ev in traces:
            self.metrics["claims_checked"] += 1
            self.metrics["blocked"] += ev.outcome == "rejected"
        await self.send({"type": "trace", "moment": m.id, "moment_type": m.type,
                         "player": m.player, "steps": [asdict(e) for e in traces]})
        await self.send({"type": "variants", "cue": f"o-{cue_id:04d}", "moment": m.id,
                         "moment_type": m.type, "player": m.player, "t": m.t, "base": base,
                         "variants": [asdict(v) for v in variants]})

    # ---- messages ---------------------------------------------------------------------
    def hello(self) -> dict:
        return {"type": "hello", "meta": self.meta.model_dump(), "speed": self.speed,
                "t": self.t, "model_enabled": self.model_enabled}

    def frame_msg(self) -> dict:
        i = min(self.i, len(self.match)) - 1
        i = max(i, 0)
        b = self.match.ball[i]
        return {"type": "frame", "t": round(self.t, 1),
                "ball": [round(float(b[0]), 2), round(float(b[1]), 2), round(float(b[2]), 2)],
                "players": [[pid, round(x, 2), round(y, 2), round(v, 2)]
                            for pid, x, y, v in positions(self.match, i)],
                "ring": self.director.current.target if self.director.current else None}

    def _director_msg(self, d) -> dict:
        return {"type": "director", "t": round(self.t, 1), "target": d.target, "reason": d.reason,
                "kind": d.kind, "predicted": d.predicted, "mode": self.director.mode}

    async def _send_director(self, d) -> None:
        await self.send(self._director_msg(d))

    async def _send_card(self, pid: str) -> None:
        await self.send({"type": "card", "card": self.engine.card(pid).model_dump(),
                         "stats": self.engine.stats(pid)})

    def team_msg(self) -> dict:
        ts = self.engine.team_state()
        lat = sorted(self.metrics["latency_ms"])
        m = {k: v for k, v in self.metrics.items() if k != "latency_ms"}
        m["latency_p50_ms"] = lat[len(lat) // 2] if lat else None
        m["latency_p95_ms"] = lat[int(len(lat) * 0.95)] if lat else None
        return {"type": "team", **asdict(ts), "metrics": m, "speed": self.speed,
                "model_enabled": self.model_enabled}
