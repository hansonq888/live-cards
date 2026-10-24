"""Personalizer: one verified line becomes many audiences, in parallel.

    verified English line ─fan-out─▶ [casual·es·home] [analyst·en·neutral] [casual·ar·neutral] ...
                                        │ each: write ▶ verify (in its language) ▶ one rewrite
                                     ─fan-in─▶ variants (failed ones fall back to the verified English)

Runs after verification, and the verifier re-checks every variant, so a translation can't
smuggle in a number, a name or a superlative the evidence doesn't support.
"""

from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass

from agent_framework import Executor, WorkflowBuilder, WorkflowContext, handler

from livecards.agents.explainer import ExplainJob
from livecards.agents.llm import RunsPrompt
from livecards.agents.pipeline import TraceEvent, TraceSink, _ms
from livecards.agents.reviewer import review
from livecards.agents.verifier import check

MODEL_TIMEOUT_S = 5.0
LANGUAGES = {"en": "English", "es": "Spanish", "fr": "French", "ar": "Arabic", "pt": "Portuguese"}

INSTRUCTIONS = """You adapt a verified live-football line for one fan. Adapt, don't just translate:
use the phrasing a native football broadcaster in that language would use.
Rules:
- ONE sentence, at most 18 words, in the requested language.
- Every number must be written in digits and must appear in the facts. You may drop numbers;
  never add new ones.
- Keep player names exactly as given, in Latin script, even in Arabic.
- Say nothing the verified line and facts don't support. No superlatives, records or history.
- Voice: "neutral" is an impartial broadcaster. "home"/"away" means you speak as a supporter of
  the named club: warm, partisan ("we", "our"), but still strictly factual about the other side.
- Audience: "casual" is plain words and the story, with no rating or attribute scores
  (say what happened instead); "analyst" is precise and names the metric."""


@dataclass(frozen=True)
class Profile:
    audience: str = "casual"  # casual | analyst
    lang: str = "en"
    voice: str = "neutral"  # neutral | home | away

    @property
    def key(self) -> str:
        return f"{self.audience}.{self.lang}.{self.voice}"

    @classmethod
    def parse(cls, key: str) -> Profile:
        a, lang, v = key.split(".")
        return cls(a, lang, v)


DEFAULT = Profile()
# The demo's side-by-side: the same moment for very different fans.
SHOWCASE = [Profile("analyst", "en", "neutral"), Profile("casual", "es", "home"),
            Profile("casual", "ar", "neutral"), Profile("casual", "fr", "away")]


@dataclass
class Variant:
    key: str
    text: str
    source: str  # model | fallback (the verified English line)
    attempts: int
    ms: float
    problems: list[str]


@dataclass
class PersonalizeRequest:
    job: ExplainJob
    base: str  # the verified English line
    home: str
    away: str


class Dispatch(Executor):
    def __init__(self) -> None:
        super().__init__(id="dispatch")

    @handler
    async def go(self, req: PersonalizeRequest, ctx: WorkflowContext[PersonalizeRequest]) -> None:
        await ctx.send_message(req)


class PersonalizerExec(Executor):
    def __init__(self, profile: Profile, agent: RunsPrompt, roster: set[str], sink: TraceSink,
                 reviewer: RunsPrompt | None = None):
        super().__init__(id=f"personalizer-{profile.key}")
        self.profile, self.agent, self.roster, self.sink = profile, agent, roster, sink
        self.reviewer = reviewer

    def _prompt(self, req: PersonalizeRequest, feedback: str | None) -> str:
        p = self.profile
        club = {"home": req.home, "away": req.away}.get(p.voice, "")
        lines = [
            f"Language: {LANGUAGES[p.lang]}. Audience: {p.audience}. Voice: {p.voice}"
            + (f" (supporter of {club})" if club else "") + ".",
            f"Verified line: {req.base}",
            f"Facts: {json.dumps(req.job.facts, ensure_ascii=False)}",
        ]
        if feedback:
            lines.append(f"Your previous version was rejected by the fact checker: {feedback}. "
                         "Fix exactly that.")
        return "\n".join(lines)

    @handler
    async def write(self, req: PersonalizeRequest, ctx: WorkflowContext[Variant]) -> None:
        t0 = time.perf_counter()
        bundle = req.job.bundle()
        feedback, problems = None, []
        mid = req.job.moment.id
        for attempt in range(2):
            start = time.perf_counter()
            try:
                res = await asyncio.wait_for(self.agent.run(self._prompt(req, feedback)),
                                             MODEL_TIMEOUT_S)
                text = " ".join((res.text or "").split()).strip().strip('"')
            except Exception as exc:  # noqa: BLE001 - any model failure falls back to English
                self.sink(TraceEvent(mid, f"personalizer:{self.profile.key}", "error",
                                     _ms(start), type(exc).__name__, attempt))
                break
            verdict = check(text, bundle, self.roster, self.profile.lang)
            if verdict.ok and self.reviewer is not None:
                r = await review(self.reviewer, text, req.job.facts)
                if not r.ok:
                    verdict.ok, verdict.problems = False, [r.reason()]
            self.sink(TraceEvent(mid, f"personalizer:{self.profile.key}",
                                 "ok" if verdict.ok else "rejected", _ms(start),
                                 verdict.reason() or text, attempt, text))
            if verdict.ok:
                await ctx.send_message(Variant(self.profile.key, text, "model", attempt + 1,
                                               _ms(t0), []))
                return
            feedback, problems = verdict.reason(), verdict.problems
        await ctx.send_message(Variant(self.profile.key, req.base, "fallback", 2, _ms(t0),
                                       problems))


class Collect(Executor):
    def __init__(self) -> None:
        super().__init__(id="collect")

    @handler
    async def collect(self, variants: list[Variant], ctx: WorkflowContext[None, list[Variant]]) -> None:
        await ctx.yield_output(variants)

    @handler
    async def single(self, variant: Variant, ctx: WorkflowContext[None, list[Variant]]) -> None:
        await ctx.yield_output([variant])


async def personalize(req: PersonalizeRequest, profiles: list[Profile], agent: RunsPrompt,
                      roster: set[str], sink: TraceSink,
                      reviewer: RunsPrompt | None = None) -> list[Variant]:
    """Fan out one verified line to several fan profiles; every variant is re-verified."""
    profiles = [p for p in profiles if p != DEFAULT]
    if not profiles:
        return []
    dispatch, collect = Dispatch(), Collect()
    workers = [PersonalizerExec(p, agent, roster, sink, reviewer) for p in profiles]
    builder = WorkflowBuilder(start_executor=dispatch, name="personalize")
    if len(workers) == 1:  # a fan-out needs two or more branches
        builder.add_chain([dispatch, workers[0], collect])
    else:
        builder.add_fan_out_edges(dispatch, workers).add_fan_in_edges(workers, collect)
    wf = builder.build()
    result = await wf.run(req)
    outs = result.get_outputs()
    return outs[0] if outs else []
