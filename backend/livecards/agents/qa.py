"""Ask: fans' questions answered from the match data, verified before display.

The Q&A agent (Agent Framework, Foundry) can only answer through tools over the live engine
state at the current match time, so it can't see the future and can't invent stats. Every
number in the answer must appear in what the tools returned, the reviewer audits the claims,
and if the answer can't be verified the fan sees "I can't verify that" instead of a guess.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import dataclass, field
from typing import Annotated

from livecards.agents.llm import RunsPrompt, make_agent
from livecards.agents.reviewer import review
from livecards.agents.verifier import Verdict, build_bundle, check
from livecards.engine.engine import MatchEngine
from livecards.engine.rating import LABELS

QA_TIMEOUT_S = 12.0
INSTRUCTIONS = """You answer football fans' questions about a live match, using ONLY your tools.
- Always call a tool first; never answer from memory. The match is in progress: you only know
  what has happened so far.
- Answer in 1-2 short sentences, in the language of the question.
- Every number you write must come from a tool result, written as digits. Use surnames.
- If the tools don't contain the answer, say exactly: "I can't verify that from the match data."
- No predictions, opinions about the future, or claims about seasons or careers."""

LEADER_STATS = {"rating", "top_speed_kmh", "distance_km", "shots", "goals", "passes_completed",
                "tackles_won", "interceptions", "chances_created", "sprints"}


@dataclass
class Answer:
    question: str
    text: str
    verified: bool
    source: str  # model | refusal
    evidence: list[str]
    tools: list[str]
    ms: float
    problems: list[str] = field(default_factory=list)


class MatchTools:
    """Read-only tools over the engine. Every call is recorded as evidence."""

    def __init__(self, engine: MatchEngine) -> None:
        self.engine = engine
        self.calls: list[tuple[str, dict]] = []

    # -- helpers --
    def _find(self, name: str) -> str | None:
        q = name.strip().lower()
        for p in self.engine.meta.players:
            if q in (p.name.lower(), p.short.lower(), p.id.lower()) or q in p.name.lower():
                return p.id
        return None

    def _record(self, tool: str, result: dict) -> str:
        self.calls.append((tool, result))
        return json.dumps(result, ensure_ascii=False)

    def _who(self, pid: str) -> dict:
        p = self.engine.players[pid].meta
        return {"player": p.name, "team": self.engine.meta.team(p.team).name, "position": p.position}

    # -- tools (docstrings are the tool descriptions the model sees) --
    def player_card(self, player: Annotated[str, "player surname or full name"]) -> str:
        """A player's live card: rating, attributes and match stats so far."""
        pid = self._find(player)
        if pid is None:
            return self._record("player_card", {"error": f"no player named {player}"})
        ps = self.engine.players[pid]
        s = ps.stats.public()
        out = {**self._who(pid), "minute": int(self.engine.t // 60),
               "rating": round(ps.rating.value, 1), "attributes": dict(ps.attrs),
               "stats": {k: s[k] for k in ("goals", "assists", "shots", "shots_on_target",
                                            "passes_completed", "passes", "pass_pct",
                                            "chances_created", "tackles_won", "interceptions",
                                            "distance_km", "top_speed_kmh", "sprints")},
               "last_change": ps.last_reason, "evidence": ps.last_evidence[:8]}
        return self._record("player_card", out)

    def rating_breakdown(self, player: Annotated[str, "player surname or full name"],
                         since_minute: Annotated[int, "only changes from this minute on"] = 0) -> str:
        """Every change to a player's rating, with the event behind it. Use for 'why' questions."""
        pid = self._find(player)
        if pid is None:
            return self._record("rating_breakdown", {"error": f"no player named {player}"})
        ps = self.engine.players[pid]
        entries = [{"minute": int(e.t // 60), "reason": LABELS[e.kind], "change": e.delta,
                    "event": e.event_id} for e in ps.rating.ledger if e.t >= since_minute * 60]
        return self._record("rating_breakdown", {**self._who(pid), "start": 6.0,
                                                 "rating_now": round(ps.rating.value, 1),
                                                 "changes": entries[-15:],
                                                 "evidence": [e["event"] for e in entries[-15:]]})

    def recent_moments(self, player: Annotated[str, "player name, or 'all'"] = "all",
                       minutes: Annotated[int, "how far back"] = 15) -> str:
        """Key moments (goals, sprints, upgrades, chances) in the last N minutes."""
        pid = None if player.lower() == "all" else self._find(player)
        since = self.engine.t - minutes * 60
        ms = [m for m in self.engine.moments if m.t >= since and m.importance >= 0.4
              and (pid is None or m.player == pid)][-10:]
        return self._record("recent_moments", {
            "moments": [{"minute": m.minute, "type": m.type.replace("_", " "),
                         "summary": m.template, "evidence": m.evidence[:4]} for m in ms],
            "evidence": [e for m in ms for e in m.evidence[:4]]})

    def team_state(self) -> str:
        """Score, possession (whole match and last 5 minutes), momentum and control vs chaos."""
        ts = self.engine.team_state()
        return self._record("team_state", {
            "minute": int(self.engine.t // 60), "score": ts.score, "possession_pct": ts.possession,
            "possession_last_5_min_pct": ts.possession_5m, "momentum": ts.momentum,
            "chaos_0_to_100": ts.chaos, "evidence": []})

    def leaders(self, stat: Annotated[str, "one of: " + ", ".join(sorted(LEADER_STATS))]) -> str:
        """The top 3 players so far for a stat, e.g. who is fastest or who has run furthest."""
        if stat not in LEADER_STATS:
            return self._record("leaders", {"error": f"unknown stat {stat}"})
        rows = []
        for pid, ps in self.engine.players.items():
            if ps.stats.minutes < 1:
                continue
            s = ps.stats.public()
            rows.append((ps.rating.value if stat == "rating" else s[stat], pid))
        rows.sort(reverse=True)
        top = [{**self._who(pid), stat: round(v, 2)} for v, pid in rows[:3]]
        return self._record("leaders", {"stat": stat, "top": top, "evidence": []})

    def all(self) -> list:
        return [self.player_card, self.rating_breakdown, self.recent_moments, self.team_state,
                self.leaders]

    # -- what the answer may use --
    def facts(self) -> tuple[dict, set[str], list[str]]:
        numbers: dict = {}
        names: set[str] = set()
        evidence: list[str] = []
        text = json.dumps([r for _, r in self.calls], ensure_ascii=False)
        for i, m in enumerate(re.finditer(r"-?\d+(?:\.\d+)?", text)):
            numbers[f"n{i}"] = float(m.group(0))
        for p in self.engine.meta.players:
            if p.name in text:
                names |= {p.name, p.short}
        for tool, r in self.calls:
            evidence += [e for e in r.get("evidence", []) if e not in evidence]
            if tool == "leaders" and "top" in r:  # a ranking was computed: superlatives are facts
                numbers["is_leader_stat"] = 1
                if r.get("stat") == "top_speed_kmh":
                    numbers["fastest_of_match"] = 1
        return numbers, names, evidence


def make_qa_agent(tools: MatchTools) -> RunsPrompt | None:
    return make_agent("MatchQA", INSTRUCTIONS, tools=tools.all())


REFUSAL = "I can't verify that from the match data."
LANG_NAMES = {"en": "English", "es": "Spanish", "fr": "French", "pt": "Portuguese", "ar": "Arabic"}
_LANG_HINTS = {
    "es": r"[¿¡ñ]|\b(qué|quién|cómo|por qué|cuántos?|jugador|partido|ha|está)\b",
    "fr": r"\b(pourquoi|qui|comment|combien|joueur|match|est-ce|a-t-il|il a)\b",
    "pt": r"\b(quem|porque|por que|como|quantos?|jogador|partida|está|ele)\b|ã|õ",
}


def detect_language(text: str) -> str:
    """Cheap and deterministic: the answer must come back in the fan's language."""
    if re.search(r"[\u0600-\u06FF]", text):
        return "ar"
    low = text.lower()
    scores = {lang: len(re.findall(pat, low)) for lang, pat in _LANG_HINTS.items()}
    lang, hits = max(scores.items(), key=lambda kv: kv[1])
    return lang if hits else "en"


async def ask(question: str, engine: MatchEngine, roster: set[str],
              reviewer: RunsPrompt | None, agent_factory=make_qa_agent) -> Answer:
    t0 = time.perf_counter()
    feedback = None
    problems: list[str] = []
    tools = MatchTools(engine)
    agent = agent_factory(tools)
    if agent is None:
        return Answer(question, REFUSAL, True, "refusal", [], [], 0.0, ["model off"])
    lang = detect_language(question)
    for _attempt in range(2):
        prompt = f"{question}\n\n(Answer in {LANG_NAMES[lang]}.)"
        if feedback:
            prompt += (f"\n(Your previous answer was rejected by the fact checker: {feedback}. "
                       "Answer again using only tool results.)")
        try:
            res = await asyncio.wait_for(agent.run(prompt), QA_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 - any failure becomes a refusal
            problems = [f"model error: {type(exc).__name__}"]
            break
        text = " ".join((res.text or "").split())
        if not tools.calls:
            feedback, problems = "you did not call a tool", ["no tool was called"]
            continue
        if text.startswith("I can't verify"):
            return Answer(question, REFUSAL, True, "refusal", [], [c for c, _ in tools.calls],
                          round((time.perf_counter() - t0) * 1000), [])
        numbers, names, evidence = tools.facts()
        verdict: Verdict = check(text, build_bundle(numbers, names), roster, lang)
        if verdict.ok and reviewer is not None:
            r = await review(reviewer, text, {"tool_results": [r for _, r in tools.calls]})
            if not r.ok:
                verdict = Verdict(False, [r.reason()], verdict.checked + 1)
        if verdict.ok:
            return Answer(question, text, True, "model", evidence[:12],
                          list(dict.fromkeys(c for c, _ in tools.calls)),
                          round((time.perf_counter() - t0) * 1000))
        feedback, problems = verdict.reason(), verdict.problems
    return Answer(question, REFUSAL, True, "refusal", [], [c for c, _ in tools.calls],
                  round((time.perf_counter() - t0) * 1000), problems)
