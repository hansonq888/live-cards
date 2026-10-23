"""A live viewing session: replays a match through the engine, director and agents.

One session per connected viewer. The match clock advances at `speed`x; tracking
frames go out at most 20 times a second (the viewer interpolates); moments, director
decisions, verified cues and agent traces go out as they happen. Explanations run as
background tasks so a slow model never stalls the stream.
"""

from __future__ import annotations

import asyncio
import copy
import secrets
import time
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass
from functools import cache

from livecards.agents.director import AutoDirector, Decision
from livecards.agents.explainer import INSTRUCTIONS, ExplainJob, job_for
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
from livecards.agents.qa import ask
from livecards.agents.redteam import RedTeamAgent
from livecards.agents.reviewer import make_reviewer
from livecards.agents.verifier import check
from livecards.contracts import FPS, Moment
from livecards.engine.buildup import build_up
from livecards.engine.engine import MatchEngine
from livecards.replay import positions
from livecards.server.control import plane
from livecards.server.cues import make_cue
from livecards.sim.match import Match
from livecards.sim.simulator import simulate
from livecards.telemetry import tracer

Send = Callable[[dict], Awaitable[None]]

FRAME_INTERVAL_S = 0.05  # wall-clock: at most 20 frames per second to the browser
CARD_INTERVAL_S = 0.5
TEAM_INTERVAL_S = 1.0
MODEL_MOMENTS = {"goal", "rating_upgrade", "rating_downgrade", "big_chance", "momentum_swing",
                 "fastest_sprint", "attr_upgrade", "attr_downgrade"}
MAX_MODEL_INFLIGHT = 6
SHOWCASE_MOMENTS = {"goal", "rating_upgrade"}
SNAPSHOT_EVERY_S = 300.0
HISTORY_TYPES = {"goal", "big_chance", "fastest_sprint", "rating_upgrade", "rating_downgrade",
                 "momentum_swing", "card", "substitution"}
ALERT_TYPES = {"sprint", "fastest_sprint", "streak", "distance_milestone"}
# Verified lines per moment. The match is deterministic, so a revisited (or re-watched)
# moment reuses its verified line instead of calling, and paying for, the model again.
LINE_CACHE: dict[tuple, Explained] = {}
VARIANT_CACHE: dict[tuple, dict] = {}


@cache
def load_match(seed: int = 7) -> Match:
    """The match feed: ingested from Azure Event Hubs when configured, else simulated here."""
    from livecards.feed import load_via_event_hubs

    match = load_via_event_hubs(seed, simulate)
    FEED_SOURCE[seed] = "Azure Event Hubs" if match is not None else "local simulator"
    return match or simulate(seed)


FEED_SOURCE: dict[int, str] = {}


def tick(match: Match, engine: MatchEngine, director: AutoDirector, i: int,
         ev_j: int) -> tuple[int, Decision, list[Moment]]:
    """Advance one 10 Hz tick: events, then tracking, then the director. Returns the new
    event cursor, the director's decision and the moments produced."""
    t = float(match.times[i])
    evs = match.events
    events = []
    while ev_j < len(evs) and evs[ev_j].t <= t + 1e-6:
        events.append(evs[ev_j])
        ev_j += 1
    for e in events:
        director.on_event(e)
    moments: list[Moment] = []
    for e in events:
        moments += engine.on_event(e)
    moments += engine.on_positions(t, positions(match, i))
    for m in moments:
        director.on_moment(m)
    d = director.update(t, (float(match.ball[i, 0]), float(match.ball[i, 1])),
                        list(positions(match, i)))
    return ev_j, d, moments


def job_for_story(b: dict, meta) -> ExplainJob:
    """The explain job for a goal's one-line story: its facts and the players involved."""
    names = {n for p in meta.players if p.id in b["players"] for n in (p.name, p.short)}
    goal_step = b["steps"][-1]
    story_moment = Moment(id=f"{b['goal']}-story", t=b["goal_t"], minute=int(b["goal_t"] // 60),
                          type="goal", player=b["scorer"], team=b["team"], importance=1.0,
                          facts=b["facts"], evidence=[s["evidence"][0] for s in b["steps"]] or
                          goal_step["evidence"], template=b["story"])
    return ExplainJob(moment=story_moment, facts=b["facts"], names=names, template=b["story"])


def feed_engine(match: Match, engine: MatchEngine, i: int, ev_j: int) -> int:
    """Advance a bare engine (no director) one tick; returns the new event cursor."""
    t = float(match.times[i])
    evs = match.events
    while ev_j < len(evs) and evs[ev_j].t <= t + 1e-6:
        engine.on_event(evs[ev_j])
        ev_j += 1
    engine.on_positions(t, positions(match, i))
    return ev_j


def build_shadow(match: Match, spec, until_i: int) -> tuple[MatchEngine, int]:
    """An engine running the analyst's model, caught up to frame `until_i`."""
    engine, ev_j = MatchEngine(match.meta, model=spec), 0
    for i in range(until_i):
        ev_j = feed_engine(match, engine, i, ev_j)
    return engine, ev_j


@dataclass
class Snapshot:
    t: float
    i: int
    ev_j: int
    engine: MatchEngine
    director: AutoDirector


@cache
def snapshots(seed: int = 7) -> list[Snapshot]:
    """Engine + director state every SNAPSHOT_EVERY_S of match time, so a jump (Revisit)
    is a short fast-forward instead of a replay from kickoff. Same seed, same states."""
    match = load_match(seed)
    engine, director = MatchEngine(match.meta), AutoDirector(match.meta)
    out, ev_j = [], 0
    step = int(SNAPSHOT_EVERY_S * FPS)
    for i in range(len(match)):
        if i % step == 0:
            out.append(Snapshot(float(match.times[i]), i, ev_j,
                                *copy.deepcopy((engine, director))))
        ev_j, _, _ = tick(match, engine, director, i, ev_j)
    return out


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
        self.seed = seed
        self.match = load_match(seed)
        self.meta = self.match.meta
        self.roster = {n for p in self.meta.players for n in (p.name, p.short)}
        self.speed = speed
        self.paused = False
        self.sid = secrets.token_hex(3)
        self.metrics = {"moments": 0, "cues": 0, "claims_checked": 0, "blocked": 0,
                        "model_lines": 0, "template_lines": 0, "rewrites": 0, "aired_unverified": 0,
                        "latency_ms": []}
        self.cue_seq = 0
        self.profile = DEFAULT
        self.last_job: dict[str, tuple] = {}  # player -> (moment, job, ring, cue_id)
        self._sent_key = ""  # last director reason sent to the viewer
        self.spec = None  # the analyst's ModelSpec, if any
        self.shadow: MatchEngine | None = None  # their model, kept in lockstep with the match
        self.shadow_i = 0
        self.shadow_ev = 0
        self._shadow_gen = 0
        self.redteam_mode = "number"
        self.inflight = 0
        self.tasks: set[asyncio.Task] = set()
        self._reset(start)

    @property
    def model_enabled(self) -> bool:
        """AI lines run only if Foundry is configured and the broadcaster allows them."""
        return plane().controls.feature("ai_lines") and explainer_agent() is not None

    def _audit(self, kind: str, m: Moment | None, **kw) -> None:
        plane().record(kind=kind, session=self.sid, match_t=m.t if m else self.t,
                       moment=m.id if m else None, moment_type=m.type if m else None,
                       player=m.player if m else None, **kw)

    def _audit_blocked(self, m: Moment, traces: list[TraceEvent]) -> None:
        for ev in traces:
            if ev.outcome == "rejected":
                self._audit("blocked", m, text=ev.text, stage=ev.stage, reason=ev.detail,
                            evidence=m.evidence)

    def _reset(self, start: float) -> None:
        """Jump to `start`: restore the nearest earlier snapshot, then fast-forward."""
        snap = max((sn for sn in snapshots(self.seed) if sn.t <= start), key=lambda sn: sn.t)
        self.engine, self.director = copy.deepcopy((snap.engine, snap.director))
        self.i, self._ev_j = snap.i, snap.ev_j
        self.director.mode = "auto"
        self.director.current = None
        self._advance_to(start, live=False)
        self._reanchor = True

    # ---- commands from the viewer -----------------------------------------------------
    async def command(self, msg: dict) -> None:
        kind = msg.get("type")
        if kind == "select" and msg.get("player"):
            d = self.director.select(msg["player"], self.t, msg.get("reason"))
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
            await self.send(self.history())
            await self._send_current()
            if self.spec is not None:
                self._spawn(self._set_model(self.spec.model_dump()))  # rebuild at the new position
        elif kind == "profile":
            try:
                self.profile = Profile.parse(str(msg.get("key", "casual.en.neutral")))
            except ValueError:
                self.profile = DEFAULT
            await self.send({"type": "profile", "key": self.profile.key})
        elif kind == "ask" and str(msg.get("question", "")).strip():
            self._spawn(self._ask(str(msg.get("id", "")), str(msg["question"])[:300]))
        elif kind == "redteam":
            await self._redteam()
        elif kind == "your_model":
            self._spawn(self._set_model(msg.get("spec")))  # building takes a moment; don't block
        elif kind == "explain_goal":
            self._spawn(self._explain_goal(msg.get("goal")))
        elif kind == "model":
            plane().update({"features": {"ai_lines": bool(msg.get("enabled"))}})
            await self.send({"type": "model", "enabled": self.model_enabled})

    # ---- main loop ------------------------------------------------------------------
    @property
    def t(self) -> float:
        return float(self.match.times[min(self.i, len(self.match) - 1)])

    async def run(self) -> None:
        await self.send(self.hello())
        await self.send(self.history())
        await self._send_current()
        last_frame = last_card = last_team = 0.0
        wall0, game0 = time.monotonic(), self.t
        speed0 = self.speed
        while self.i < len(self.match):
            if self.paused:
                await asyncio.sleep(0.05)
                wall0, game0 = time.monotonic(), self.t
                continue
            if self.speed != speed0 or self._reanchor:
                # Speed changed or the viewer jumped: restart the clock from here.
                wall0, game0, speed0 = time.monotonic(), self.t, self.speed
                self._reanchor = False
            if not plane().controls.feature("director") and self.director.mode == "auto" \
                    and self.director.current is not None:
                self.director.mode = "manual"  # auto-director switched off: hold the ring
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
            self._ev_j, d, moments = tick(self.match, self.engine, self.director, self.i,
                                          self._ev_j)
            if live:
                # Re-send when the player changes, or when the reason for following them does
                # ("cross incoming" -> "scores").
                if d.changed or d.key != self._sent_key:
                    self._sent_key = d.key
                    out.append(self._director_msg(d))
                for m in moments:
                    self._on_moment(m, out)
            self.i += 1
        if self.shadow is not None:  # keep the analyst's model in lockstep
            while self.shadow_i < self.i:
                self.shadow_ev = feed_engine(self.match, self.shadow, self.shadow_i, self.shadow_ev)
                self.shadow_i += 1
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
        controls = plane().controls
        if m.type in ALERT_TYPES and not controls.feature("alerts"):
            return  # alerts switched off by the broadcaster
        msg = {"type": "moment", "moment": m.model_dump()}
        if m.player:
            msg["card"] = self.engine.card(m.player).model_dump()
        out.append(msg)
        if m.importance < 0.3 and m.type != "distance_milestone":
            return
        if not controls.allowed(m.type):
            return  # the card's numbers still update; no line airs for this insight type
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
            self._audit("aired", m, text=job.template, source="template", stage="instant",
                        evidence=m.evidence, lang="en")
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
        if m.player:
            self.last_job[m.player] = (m, job, ring, cue_id)
        self._spawn(self._explain(m, job, ring, cue_id))
        if self.profile != DEFAULT and controls.feature("personalization"):
            # The viewer's own language starts now, from the verified stats line, in parallel
            # with the English story line, instead of waiting for it.
            self._spawn(self._personalize(m, job, job.template, cue_id, [self.profile]))

    async def _ask(self, qid: str, question: str) -> None:
        await self.send({"type": "answer_status", "id": qid, "question": question,
                         "stage": "checking the match data"})
        if not plane().controls.feature("ask"):
            await self.send({"type": "answer", "id": qid, "question": question,
                             "text": "Ask is switched off by the broadcaster right now.",
                             "verified": True, "source": "refusal", "evidence": [], "tools": [],
                             "ms": 0, "problems": [], "minute": int(self.t // 60)})
            return
        with tracer.start_as_current_span("fan.ask") as span:
            a = await ask(question, self.engine, self.roster, reviewer_agent())
            span.set_attributes({"answer.source": a.source, "answer.ms": a.ms,
                                 "answer.tools": ",".join(a.tools)})
        self._audit("answer", None, text=f"Q: {question}\nA: {a.text}", source=a.source,
                    stage=",".join(a.tools), reason="; ".join(a.problems), evidence=a.evidence)
        self.metrics["claims_checked"] += 1
        self.metrics["blocked"] += bool(a.problems)
        await self.send({"type": "answer", "id": qid, **asdict(a),
                         "minute": int(self.t // 60)})

    def _spawn(self, coro) -> None:
        task = asyncio.create_task(coro)
        self.tasks.add(task)
        task.add_done_callback(self.tasks.discard)

    async def _set_model(self, raw: dict | None) -> None:
        """Validate an analyst's model and start a shadow engine running it."""
        from pydantic import ValidationError

        from livecards.engine.model import ModelSpec

        if not raw:
            self._shadow_gen += 1
            self.spec, self.shadow = None, None
            await self.send({"type": "your_model", "status": "off"})
            return
        try:
            spec = ModelSpec.model_validate(raw)
        except ValidationError as exc:  # a bad model never replaces a good one
            await self.send({"type": "your_model", "status": "error",
                             "error": "; ".join(e["msg"] for e in exc.errors())})
            return
        self._shadow_gen += 1
        gen = self._shadow_gen
        self.spec, self.shadow = spec, None
        await self.send({"type": "your_model", "status": "building", "name": spec.name})
        until = self.i
        engine, ev_j = await asyncio.to_thread(build_shadow, self.match, spec, until)
        if gen != self._shadow_gen:
            return  # superseded by a newer model or a jump
        self.shadow, self.shadow_i, self.shadow_ev = engine, until, ev_j
        await self.send({"type": "your_model", "status": "ready", "name": spec.name})
        if self.director.current:
            await self._send_card(self.director.current.target)

    async def _explain_goal(self, goal_id: str | None) -> None:
        """Build-up of a goal (the latest so far, or a given one): steps now, AI story after."""
        goals = [m for m in self.engine.moments if m.type == "goal"]
        if goal_id:
            goals = [m for m in goals if m.evidence and m.evidence[0] == goal_id] or goals
        if not goals:
            await self.send({"type": "buildup", "error": "no goal yet"})
            return
        gm = goals[-1]
        goal_ev = self.engine.events[gm.evidence[0]]
        b = build_up(list(self.engine.events.values()), goal_ev, self.meta, self.engine.moments)
        if b is None:
            await self.send({"type": "buildup", "error": "no build-up found"})
            return
        await self.send({"type": "buildup", **b})
        key = (self.seed, b["goal"], "story")
        if key not in LINE_CACHE and self.model_enabled:
            job = job_for_story(b, self.meta)
            story_moment = job.moment
            traces: list[TraceEvent] = []
            result = await explain(job, explainer_agent(), self.roster, traces.append,
                                   reviewer_agent())
            self._audit_blocked(story_moment, traces)
            if result is not None and result.source == "model":
                LINE_CACHE[key] = result
                self._audit("aired", story_moment, text=result.text, source="model",
                            stage="goal story", evidence=story_moment.evidence, lang="en")
        result = LINE_CACHE.get(key)
        text = result.text if result else b["story"]
        localized = None
        if result is not None and self.profile.lang != "en" and self.model_enabled:
            # The viewer's language, through the Personalizer: re-verified in that language.
            vkey = (self.seed, b["goal"], self.profile.key, text)
            if vkey not in VARIANT_CACHE:
                req = PersonalizeRequest(job_for_story(b, self.meta), text, self.meta.home.name,
                                         self.meta.away.name)
                vs = await personalize(req, [self.profile], personalizer_agent(), self.roster,
                                       lambda _e: None, reviewer_agent())
                if vs and vs[0].source == "model":
                    VARIANT_CACHE[vkey] = asdict(vs[0])
            if vkey in VARIANT_CACHE:
                localized = VARIANT_CACHE[vkey]["text"]
        await self.send({"type": "buildup_story", "goal": b["goal"], "text": text,
                         "source": result.source if result else "template",
                         "localized": localized, "lang": self.profile.lang})

    async def _redteam(self) -> None:
        """Re-explain the followed player's latest moment with a corrupted first draft."""
        target = self.director.current.target if self.director.current else None
        entry = self.last_job.get(target or "") or (
            max(self.last_job.values(), key=lambda e: e[0].t) if self.last_job else None)
        if entry is None or explainer_agent() is None:
            await self.send({"type": "redteam", "stage": "unavailable",
                             "reason": "no explained moment yet" if entry is None else "model off"})
            return
        m, job, ring, cue_id = entry
        mode, self.redteam_mode = self.redteam_mode, ("event" if self.redteam_mode == "number"
                                                      else "number")
        attacker = RedTeamAgent(explainer_agent(), mode)
        traces: list[TraceEvent] = []
        await self.send({"type": "redteam", "stage": "started", "mode": mode, "moment": m.id,
                         "player": m.player})
        job.feedback = None
        result = await explain(job, attacker, self.roster, traces.append, reviewer_agent())
        blocked = next((e for e in traces if e.outcome == "rejected"), None)
        for ev in traces:
            if ev.stage in ("verifier", "reviewer"):
                self.metrics["claims_checked"] += 1
                self.metrics["blocked"] += ev.outcome == "rejected"
        await self.send({"type": "trace", "moment": m.id, "moment_type": f"red team: {m.type}",
                         "player": m.player, "steps": [asdict(e) for e in traces]})
        if result is not None:
            self.metrics["aired_unverified"] += not result.verdict.ok
        self._audit("redteam", m, text=attacker.injected, source=mode,
                    stage=blocked.stage if blocked else "", reason=blocked.detail if blocked else "",
                    evidence=m.evidence)
        await self.send({
            "type": "redteam", "stage": "result", "mode": mode, "moment": m.id,
            "player": m.player, "injected": attacker.injected,
            "blocked_by": blocked.stage if blocked else None,
            "reason": blocked.detail if blocked else "",
            "aired": result.text if result else None,
            "aired_source": result.source if result else None,
        })
        if result is not None and result.source == "model":
            await self.send(self._cue_msg(cue_id, m, result, ring, phase="story"))

    def _cue_msg(self, cue_id: int, m: Moment, result: Explained, ring: str | None,
                 phase: str) -> dict:
        cue = make_cue(cue_id, m, result, ring)
        return {"type": "cue", "cue": cue.model_dump(), "moment_type": m.type, "phase": phase,
                "facts": m.facts,
                "source": result.source, "attempts": result.attempts, "latency_ms": result.ms,
                "claims_checked": result.verdict.checked}

    async def _explain(self, m: Moment, job, ring: str | None, cue_id: int) -> None:
        with tracer.start_as_current_span("moment.explain") as span:
            span.set_attributes({"moment.id": m.id, "moment.type": m.type,
                                 "moment.player": m.player or "", "session": self.sid})
            await self._explain_traced(m, job, ring, cue_id, span)

    async def _explain_traced(self, m: Moment, job, ring: str | None, cue_id: int, span) -> None:
        traces: list[TraceEvent] = []
        key = (self.seed, m.id, job.template)
        if key in LINE_CACHE:
            result = LINE_CACHE[key]
            traces.append(TraceEvent(m.id, "cache", "ok", 0, "verified line reused", 0))
        else:
            self.inflight += 1
            try:
                result = await explain(job, explainer_agent(), self.roster, traces.append,
                                       reviewer_agent())
            finally:
                self.inflight -= 1
            if result is not None and result.source == "model":
                LINE_CACHE[key] = result
        for ev in traces:
            if ev.stage in ("verifier", "reviewer"):
                self.metrics["claims_checked"] += 1
                self.metrics["blocked"] += ev.outcome == "rejected"
        await self.send({"type": "trace", "moment": m.id, "moment_type": m.type,
                         "player": m.player, "steps": [asdict(e) for e in traces]})
        self._audit_blocked(m, traces)
        span.set_attributes({
            "result.source": result.source if result else "none",
            "result.attempts": result.attempts if result else 0,
            "result.latency_ms": result.ms if result else 0.0,
            "verifier.rejections": sum(e.outcome == "rejected" for e in traces),
        })
        if result is None or result.source != "model":
            return  # the instant template line stands
        if plane().controls.approval == "manual":
            await self.send({"type": "awaiting_approval", "moment": m.id, "player": m.player})
            approved = await plane().request_approval(
                session=self.sid, match_t=m.t, moment=m.id, moment_type=m.type,
                player=m.player, text=result.text, source="model", evidence=m.evidence,
                lang="en")
            if not approved:
                return  # held back by the operator: the instant stats line stands
        self._audit("aired", m, text=result.text, source="model", stage="story",
                    evidence=m.evidence, lang="en")
        self.metrics["cues"] += 1
        self.metrics["aired_unverified"] += not result.verdict.ok  # must stay 0
        self.metrics["model_lines"] += 1
        self.metrics["rewrites"] += result.attempts > 1
        self.metrics["latency_ms"].append(result.ms)
        await self.send(self._cue_msg(cue_id, m, result, ring, phase="story"))
        if (m.type in SHOWCASE_MOMENTS and m.importance >= 0.55
                and plane().controls.feature("personalization")):
            # The side-by-side for the Fans view isn't on the live path, so it can build on
            # the finished English story line.
            await self._personalize(m, job, result.text, cue_id, SHOWCASE)

    async def _personalize(self, m: Moment, job, base: str, cue_id: int,
                           profiles: list[Profile]) -> None:
        profiles = [p for p in dict.fromkeys(profiles) if p != DEFAULT]
        if not profiles:
            return
        traces: list[TraceEvent] = []
        cached = [VARIANT_CACHE[k] for p in profiles
                  if (k := (self.seed, m.id, p.key, base)) in VARIANT_CACHE]
        todo = [p for p in profiles if (self.seed, m.id, p.key, base) not in VARIANT_CACHE]
        req = PersonalizeRequest(job, base, self.meta.home.name, self.meta.away.name)
        fresh = await personalize(req, todo, personalizer_agent(), self.roster,
                                  traces.append, reviewer_agent()) if todo else []
        for v in fresh:
            if v.source == "model":
                VARIANT_CACHE[(self.seed, m.id, v.key, base)] = asdict(v)
                self._audit("aired", m, text=v.text, source="model", stage=f"personalizer {v.key}",
                            evidence=m.evidence, lang=v.key.split(".")[1])
        self._audit_blocked(m, traces)
        variants_out = cached + [asdict(v) for v in fresh]
        for ev in traces:
            self.metrics["claims_checked"] += 1
            self.metrics["blocked"] += ev.outcome == "rejected"
        await self.send({"type": "trace", "moment": m.id, "moment_type": m.type,
                         "player": m.player, "steps": [asdict(e) for e in traces]})
        await self.send({"type": "variants", "cue": f"o-{cue_id:04d}", "moment": m.id,
                         "moment_type": m.type, "player": m.player, "t": m.t, "base": base,
                         "variants": variants_out})

    # ---- messages ---------------------------------------------------------------------
    def hello(self) -> dict:
        return {"type": "hello", "meta": self.meta.model_dump(), "speed": self.speed,
                "t": self.t, "model_enabled": self.model_enabled}

    def history(self) -> dict:
        """Key moments so far (for the Revisit timeline when joining or jumping mid-match)."""
        keep = [m.model_dump() for m in self.engine.moments
                if m.type == "goal" or (m.type in HISTORY_TYPES and m.importance >= 0.55)]
        return {"type": "history", "moments": keep}

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
        mode = "replay" if d.kind == "replay" else self.director.mode
        return {"type": "director", "t": round(self.t, 1), "target": d.target, "reason": d.reason,
                "kind": d.kind, "predicted": d.predicted, "mode": mode, "key": d.key,
                "args": d.args}

    async def _send_director(self, d) -> None:
        await self.send(self._director_msg(d))

    async def _send_current(self) -> None:
        """Who the ring is on right now. After a jump or a mid-match join the director has
        already decided during the fast-forward, so tell the viewer instead of waiting for
        the next switch (which can be 40 s away after a goal)."""
        if self.director.current is not None:
            await self.send(self._director_msg(self.director.current))
            await self._send_card(self.director.current.target)

    async def _send_card(self, pid: str) -> None:
        msg = {"type": "card", "card": self.engine.card(pid).model_dump(),
               "stats": self.engine.stats(pid), "analyst": self.engine.analyst(pid)}
        if self.shadow is not None and self.spec is not None:
            msg["custom"] = {"name": self.spec.name, **self.shadow.analyst(pid)}
        await self.send(msg)

    def team_msg(self) -> dict:
        ts = self.engine.team_state()
        lat = sorted(self.metrics["latency_ms"])
        m = {k: v for k, v in self.metrics.items() if k != "latency_ms"}
        m["latency_p50_ms"] = lat[len(lat) // 2] if lat else None
        m["latency_p95_ms"] = lat[int(len(lat) * 0.95)] if lat else None
        return {"type": "team", **asdict(ts), "metrics": m, "speed": self.speed,
                "model_enabled": self.model_enabled}
