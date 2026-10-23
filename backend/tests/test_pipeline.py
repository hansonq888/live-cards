"""The explain-verify workflow: every recovery path, with fake models."""

import asyncio
from dataclasses import dataclass

import pytest

from livecards.agents import pipeline
from livecards.agents.explainer import ExplainJob
from livecards.contracts import Moment

ROSTER = {"Luca Varenne", "Varenne", "Viktor Halden", "Halden"}


@dataclass
class Res:
    text: str


class FakeModel:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.prompts = []

    async def run(self, prompt, **_):
        self.prompts.append(prompt)
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        if r == "hang":
            await asyncio.sleep(60)
        return Res(r)


def make_job(template="Varenne 7.2 -> 8.7: goal (+1.00)"):
    m = Moment(id="m-1", t=3946, minute=65, type="rating_upgrade", player="RIV-09", team="RIV",
               importance=0.6, facts={"from": 7.2, "to": 8.7}, evidence=["e-1667"],
               template=template)
    return ExplainJob(moment=m, facts={"minute": 65, "from": 7.2, "to": 8.7,
                                       "breakdown": "goal (+1.00)"},
                      names={"Luca Varenne", "Varenne"}, template=template)


def run(model, job=None):
    trace = []
    out = asyncio.run(pipeline.explain(job or make_job(), model, ROSTER, trace.append))
    return out, trace


def test_good_model_line_airs():
    out, trace = run(FakeModel("Varenne's goal lifts him from 7.2 to 8.7."))
    assert out.source == "model" and out.attempts == 1 and out.verdict.ok
    assert [t.stage for t in trace] == ["explainer", "verifier", "reviewer", "publish"]


def test_rejected_line_is_rewritten_with_feedback():
    model = FakeModel("Varenne jumps to 9.1!", "Varenne's goal lifts him to 8.7.")
    out, trace = run(model)
    assert out.source == "model" and out.attempts == 2
    assert "9.1" in model.prompts[1]  # the verifier's feedback names the bad claim
    assert [t.outcome for t in trace if t.stage == "verifier"] == ["rejected", "ok"]


def test_twice_rejected_falls_back_to_template():
    out, trace = run(FakeModel("Rating 9.1", "Now Halden's record 9.5"))
    assert out.source == "template" and out.text.startswith("Varenne 7.2 -> 8.7")
    assert any(t.stage == "template" for t in trace)


@pytest.mark.parametrize("failure", [RuntimeError("model down"), "hang"])
def test_model_failure_recovers_with_template(monkeypatch, failure):
    monkeypatch.setattr(pipeline, "MODEL_TIMEOUT_S", 0.2)
    out, trace = run(FakeModel(failure))
    assert out.source == "template" and out.verdict.ok
    assert trace[0].outcome in ("error", "timeout")


def test_model_switched_off_uses_template():
    out, trace = run(None)
    assert out.source == "template"
    assert trace[0].outcome == "skipped"


def test_a_bad_template_never_airs():
    out, trace = run(None, make_job(template="Varenne 7.2 -> 9.9 in 2 minutes"))
    assert out is None
    assert any(t.outcome == "blocked" for t in trace)


def test_reviewer_rejection_triggers_rewrite_and_names_the_claim():
    model = FakeModel("Varenne's goal and assist lift him to 8.7.", "Varenne's goal lifts him to 8.7.")
    reviewer = FakeModel('{"ok": false, "claim": "assist"}', '{"ok": true}')
    trace = []
    out = asyncio.run(pipeline.explain(make_job(), model, ROSTER, trace.append, reviewer))
    assert out.source == "model" and out.attempts == 2
    assert "assist" in model.prompts[1]
    assert [t.outcome for t in trace if t.stage == "reviewer"] == ["rejected", "ok"]


def test_reviewer_fails_closed():
    trace = []
    out = asyncio.run(pipeline.explain(make_job(), FakeModel("Varenne lifts to 8.7.", "Varenne, 8.7."),
                                       ROSTER, trace.append, FakeModel("not json", "still not json")))
    assert out.source == "template"  # the model line never aired
