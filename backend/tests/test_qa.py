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


# -- the analyst tools: deterministic queries over the engine --------------------------------

def _tools(played, match):
    from livecards.agents.qa import MatchTools
    return MatchTools(played, match)


def test_plays_filters_and_gives_ids(played, match):
    import json
    t = _tools(played, match)
    goals = json.loads(t.plays(outcome="goal"))
    assert goals["count"] == 3 and all(p["outcome"] == "goal" for p in goals["plays"])
    mine = json.loads(t.plays(player="Varenne"))
    assert mine["plays"] and all(p["player"].endswith("Varenne") for p in mine["plays"])


def test_play_breakdown_has_touch_stats_and_space(played, match):
    import json
    t = _tools(played, match)
    b = json.loads(t.play_breakdown("latest goal"))
    assert b["kind"] == "goal" and b["steps"]
    assert any("difficulty" in s for s in b["steps"]) and any("final_third_space_m2" in s for s in b["steps"])
    acts, _ = t.actions()
    assert acts[0]["type"] == "play" and acts[0]["id"] == b["play_id"]


def test_stat_definition_reads_the_registry(played, match):
    import json

    from livecards.engine import metrics as mx
    d = json.loads(_tools(played, match).stat_definition("xG"))
    assert d["stat"].startswith("Expected goals") and d["settings"]["intercept"] == mx.XG_INTERCEPT
    assert "error" in json.loads(_tools(played, match).stat_definition("vibes"))


def test_compare_players_builds_a_table(played, match):
    import json
    t = _tools(played, match)
    r = json.loads(t.compare_players("Varenne", "Halden"))
    assert len(r["players"]) == 2
    _, table = t.actions()
    assert table["columns"][1:] == ["Varenne", "Halden"] and len(table["rows"]) == 10


def test_period_stats_counts_only_the_window(played, match):
    import json
    t = _tools(played, match)
    whole = json.loads(t.period_stats("Varenne", 0, 90))
    late = json.loads(t.period_stats("Varenne", 60, 90))
    assert late["passes"] <= whole["passes"] and whole["goals"] == 1


@pytest.mark.parametrize("q", ["Will Halden score again?", "How many goals did Varenne score last season?",
                               "What is Varenne's salary?", "Who is the best striker in the world?",
                               "What did the manager say at half-time?"])
def test_out_of_scope_questions_are_refused_before_any_model(q, played):
    import asyncio

    from livecards.agents.qa import REFUSAL, ask

    def boom(_tools):
        raise AssertionError("no model should run")
    a = asyncio.run(ask(q, played, set(), None, agent_factory=boom))
    assert a.text == REFUSAL and a.source == "refusal"


def test_in_scope_question_is_not_caught_by_the_guard():
    from livecards.agents.qa import OUT_OF_SCOPE
    for q in ("How was the latest goal built?", "Who has been the fastest player?", "What is xG?",
              "Compare Varenne and Halden", "Who had more possession?"):
        assert not OUT_OF_SCOPE.search(q), q
