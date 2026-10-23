"""Red team: a corrupted first draft must never air; both layers get exercised."""

import asyncio

from livecards.agents import pipeline
from livecards.agents.redteam import FAKE_EVENTS, RedTeamAgent, corrupt
from tests.test_pipeline import ROSTER, FakeModel, make_job


def test_corrupt_number_and_event():
    assert corrupt("Varenne lifts to 8.7.", "number") == "Varenne lifts to 11.0."
    lie = corrupt("Varenne lifts to 8.7.", "event")
    assert lie.startswith("Varenne lifts to 8.7, ") and any(w in lie for w in FAKE_EVENTS)


def test_number_lie_blocked_by_verifier():
    attacker = RedTeamAgent(FakeModel("Varenne's goal lifts him to 8.7.", "Varenne's goal lifts him to 8.7."), "number")
    trace = []
    out = asyncio.run(pipeline.explain(make_job(), attacker, ROSTER, trace.append,
                                       FakeModel('{"ok": true}', '{"ok": true}')))
    assert out.text == "Varenne's goal lifts him to 8.7." and out.attempts == 2
    first = next(t for t in trace if t.outcome == "rejected")
    assert first.stage == "verifier" and "11.0" in first.detail


def test_event_lie_passes_code_but_reviewer_blocks():
    attacker = RedTeamAgent(FakeModel("Varenne's goal lifts him to 8.7.", "Varenne's goal lifts him to 8.7."), "event")
    reviewer = FakeModel('{"ok": false, "claim": "assist"}', '{"ok": true}')
    trace = []
    out = asyncio.run(pipeline.explain(make_job(), attacker, ROSTER, trace.append, reviewer))
    assert out.attempts == 2 and out.text == "Varenne's goal lifts him to 8.7."
    assert next(t.outcome for t in trace if t.stage == "verifier") == "ok"
    assert next(t for t in trace if t.outcome == "rejected").stage == "reviewer"
