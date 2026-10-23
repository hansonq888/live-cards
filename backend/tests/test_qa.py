"""Ask: answers must come from tools, pass the verifier, or become a refusal."""

import asyncio

import pytest

from livecards.agents.qa import REFUSAL, MatchTools, ask, detect_language
from livecards.engine.engine import MatchEngine
from livecards.replay import feed, ticks


@pytest.fixture(scope="module")
def engine(match):
    e = MatchEngine(match.meta)
    for tick in ticks(match, 0, 3960):
        feed(e, match, tick)
    return e


@pytest.fixture(scope="module")
def roster(match):
    return {n for p in match.meta.players for n in (p.name, p.short)}


class ScriptedQA:
    """Fake tool-using agent: calls the named tool, then replies with a scripted text."""

    def __init__(self, tools: MatchTools, plan):
        self.tools, self.plan = tools, list(plan)

    async def run(self, prompt, **_):
        tool, args, text = self.plan.pop(0)
        if tool:
            getattr(self.tools, tool)(**args)
        return type("R", (), {"text": text(self.tools) if callable(text) else text})()


def run(engine, roster, plan, question="Who is fastest?"):
    return asyncio.run(ask(question, engine, roster, None,
                           agent_factory=lambda tools: ScriptedQA(tools, plan)))


def test_answer_from_tool_numbers_is_verified(engine, roster):
    def text(tools):
        top = tools.calls[-1][1]["top"][0]
        return f"{top['player']} is fastest at {top['top_speed_kmh']} km/h."
    a = run(engine, roster, [("leaders", {"stat": "top_speed_kmh"}, text)])
    assert a.verified and a.source == "model" and "Okelani" in a.text and a.tools == ["leaders"]


def test_invented_number_is_rewritten_then_refused(engine, roster):
    a = run(engine, roster, [("leaders", {"stat": "top_speed_kmh"}, "Okelani hit 41.2 km/h."),
                             ("leaders", {"stat": "top_speed_kmh"}, "Okelani hit 39.9 km/h.")])
    assert a.text == REFUSAL and any("41.2" in p or "39.9" in p for p in a.problems)


def test_answer_without_a_tool_call_is_refused(engine, roster):
    a = run(engine, roster, [(None, {}, "Okelani is fast."), (None, {}, "Trust me.")])
    assert a.text == REFUSAL


def test_breakdown_carries_event_evidence(engine, roster):
    def text(tools):
        return f"Varenne's rating is {tools.calls[-1][1]['rating_now']} after his goal."
    a = run(engine, roster, [("rating_breakdown", {"player": "Varenne"}, text)],
            "Why did Varenne's rating jump?")
    assert a.verified and a.evidence and all(e.startswith("e-") for e in a.evidence)


def test_tools_never_see_the_future(engine):
    t = MatchTools(engine)
    t.rating_breakdown("Marchbanks")  # scores at 87', after the engine's current time (66')
    assert all(c["minute"] <= 66 for c in t.calls[-1][1]["changes"])


@pytest.mark.parametrize("q,lang", [("Who is fastest?", "en"), ("¿Quién ha corrido más?", "es"),
                                    ("Pourquoi sa note a-t-elle monté ?", "fr"),
                                    ("Quem é o jogador mais rápido?", "pt"),
                                    ("من هو الأسرع؟", "ar")])
def test_language_detection(q, lang):
    assert detect_language(q) == lang
