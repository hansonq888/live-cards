"""The explanation workflow (Microsoft Agent Framework).

    moment -> Explainer -> Verifier (code) --ok--> Reviewer (gpt-5-mini) --ok--> Publish
                  ^           |                         |
                  +-rejected--+-------------------------+   (one rewrite with the feedback)
                              |
                              +--rejected again / model down--> Template -> Verifier -> Publish

The verifier guarantees numbers, names and superlatives; the reviewer catches claimed
events the facts don't support. The reviewer fails closed.

Every step reports to a trace sink (stage, outcome, milliseconds) so the console can
show each moment moving through the agents, and why a line was blocked.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from agent_framework import Executor, WorkflowBuilder, WorkflowContext, handler

from livecards.agents.explainer import ExplainJob
from livecards.agents.llm import RunsPrompt
from livecards.agents.reviewer import review
from livecards.agents.verifier import Verdict, check

MODEL_TIMEOUT_S = 4.0


@dataclass
class TraceEvent:
    moment_id: str
    stage: str  # explainer | verifier | template | publish
    outcome: str  # ok | rejected | error | timeout | skipped | fallback
    ms: float
    detail: str = ""
    attempt: int = 0


TraceSink = Callable[[TraceEvent], None]


@dataclass
class Draft:
    job: ExplainJob
    text: str
    source: str  # model | template | none (model skipped or failed)
    attempt: int
    t0: float = field(default_factory=time.perf_counter)


@dataclass
class Checked:
    draft: Draft
    verdict: Verdict


@dataclass
class Explained:
    moment_id: str
    text: str
    source: str
    attempts: int
    verdict: Verdict
    ms: float


class ExplainerExec(Executor):
    def __init__(self, agent: RunsPrompt | None, sink: TraceSink) -> None:
        super().__init__(id="explainer")
        self.agent, self.sink = agent, sink

    async def _write(self, job: ExplainJob, attempt: int, t0: float) -> Draft:
        if self.agent is None:
            self.sink(TraceEvent(job.moment.id, "explainer", "skipped", 0, "model off", attempt))
            return Draft(job, "", "none", attempt, t0)
        start = time.perf_counter()
        try:
            res = await asyncio.wait_for(self.agent.run(job.prompt()), MODEL_TIMEOUT_S)
            text = " ".join((res.text or "").split()).strip().strip('"')
            self.sink(TraceEvent(job.moment.id, "explainer", "ok", _ms(start), text, attempt))
            return Draft(job, text, "model", attempt, t0)
        except TimeoutError:
            self.sink(TraceEvent(job.moment.id, "explainer", "timeout", _ms(start), "", attempt))
        except Exception as exc:  # noqa: BLE001 - any model failure falls back to the template
            self.sink(TraceEvent(job.moment.id, "explainer", "error", _ms(start),
                                 type(exc).__name__, attempt))
        return Draft(job, "", "none", attempt, t0)

    @handler
    async def first(self, job: ExplainJob, ctx: WorkflowContext[Draft]) -> None:
        await ctx.send_message(await self._write(job, 0, time.perf_counter()))

    @handler
    async def rewrite(self, rejected: Checked, ctx: WorkflowContext[Draft]) -> None:
        d = rejected.draft
        d.job.feedback = rejected.verdict.reason()
        await ctx.send_message(await self._write(d.job, d.attempt + 1, d.t0))


class VerifierExec(Executor):
    def __init__(self, roster: set[str], sink: TraceSink) -> None:
        super().__init__(id="verifier")
        self.roster, self.sink = roster, sink

    @handler
    async def verify(self, draft: Draft, ctx: WorkflowContext[Checked]) -> None:
        start = time.perf_counter()
        if not draft.text:  # nothing to check: the model was skipped or failed
            verdict = Verdict(False, ["no model output"], 0)
        else:
            verdict = check(draft.text, draft.job.bundle(), self.roster)
        stage = "verifier" if draft.source == "model" else "template-check"
        self.sink(TraceEvent(draft.job.moment.id, stage, "ok" if verdict.ok else "rejected",
                             _ms(start), verdict.reason() or f"{verdict.checked} claims checked",
                             draft.attempt))
        if _blocked(Checked(draft, verdict)):
            self.sink(TraceEvent(draft.job.moment.id, "publish", "blocked", _ms(draft.t0),
                                 verdict.reason(), draft.attempt))
        await ctx.send_message(Checked(draft, verdict))


class ReviewerExec(Executor):
    def __init__(self, agent: RunsPrompt | None, sink: TraceSink) -> None:
        super().__init__(id="reviewer")
        self.agent, self.sink = agent, sink

    @handler
    async def audit(self, c: Checked, ctx: WorkflowContext[Checked]) -> None:
        d = c.draft
        if self.agent is None:
            self.sink(TraceEvent(d.job.moment.id, "reviewer", "skipped", 0, "no reviewer",
                                 d.attempt))
            await ctx.send_message(c)
            return
        start = time.perf_counter()
        r = await review(self.agent, d.text, d.job.facts)
        self.sink(TraceEvent(d.job.moment.id, "reviewer", "ok" if r.ok else "rejected",
                             _ms(start), r.reason() or "claims supported", d.attempt))
        verdict = c.verdict if r.ok else Verdict(False, [r.reason()], c.verdict.checked + 1)
        await ctx.send_message(Checked(d, verdict))


class TemplateExec(Executor):
    def __init__(self, sink: TraceSink) -> None:
        super().__init__(id="template")
        self.sink = sink

    @handler
    async def fallback(self, rejected: Checked, ctx: WorkflowContext[Draft]) -> None:
        d = rejected.draft
        self.sink(TraceEvent(d.job.moment.id, "template", "fallback", 0, d.job.template, d.attempt))
        await ctx.send_message(Draft(d.job, d.job.template, "template", d.attempt + 1, d.t0))


class PublishExec(Executor):
    def __init__(self, sink: TraceSink) -> None:
        super().__init__(id="publish")
        self.sink = sink

    @handler
    async def publish(self, c: Checked, ctx: WorkflowContext[None, Explained]) -> None:
        ms = _ms(c.draft.t0)
        self.sink(TraceEvent(c.draft.job.moment.id, "publish", "ok", ms, c.draft.source,
                             c.draft.attempt))
        await ctx.yield_output(Explained(c.draft.job.moment.id, c.draft.text, c.draft.source,
                                         c.draft.attempt + 1, c.verdict, ms))


def _ms(t0: float) -> float:
    return round((time.perf_counter() - t0) * 1000, 1)


def _needs_rewrite(c: Checked) -> bool:
    return not c.verdict.ok and c.draft.source == "model" and c.draft.attempt == 0


def _needs_template(c: Checked) -> bool:
    return not c.verdict.ok and (c.draft.source == "none"
                                 or (c.draft.source == "model" and c.draft.attempt >= 1))


def _blocked(c: Checked) -> bool:
    """A rejected template is a stats-engine bug: nothing airs, and the trace says so."""
    return not c.verdict.ok and c.draft.source == "template"


def build_workflow(agent: RunsPrompt | None, roster: set[str], sink: TraceSink,
                   reviewer: RunsPrompt | None = None):
    explainer = ExplainerExec(agent, sink)
    verifier = VerifierExec(roster, sink)
    auditor = ReviewerExec(reviewer, sink)
    template = TemplateExec(sink)
    publish = PublishExec(sink)
    return (
        WorkflowBuilder(start_executor=explainer, name="explain-verify-review")
        .add_edge(explainer, verifier)
        .add_edge(verifier, explainer, condition=_needs_rewrite)
        .add_edge(verifier, template, condition=_needs_template)
        .add_edge(template, verifier)
        .add_edge(verifier, auditor, condition=lambda c: c.verdict.ok and c.draft.source == "model")
        .add_edge(verifier, publish, condition=lambda c: c.verdict.ok and c.draft.source != "model")
        .add_edge(auditor, explainer, condition=_needs_rewrite)
        .add_edge(auditor, template, condition=_needs_template)
        .add_edge(auditor, publish, condition=lambda c: c.verdict.ok)
        .build()
    )


async def explain(job: ExplainJob, agent: RunsPrompt | None, roster: set[str],
                  sink: TraceSink, reviewer: RunsPrompt | None = None) -> Explained | None:
    """Run one moment through the workflow. Returns None if nothing verifiable came out."""
    wf = build_workflow(agent, roster, sink, reviewer)
    result = await wf.run(job)
    outs = result.get_outputs()
    return outs[0] if outs else None
