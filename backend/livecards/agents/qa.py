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
from livecards.agents.verifier import Verdict, build_bundle, check, extract_numbers
from livecards.engine import metrics as mx
from livecards.engine.buildup import build_up
from livecards.engine.engine import MatchEngine
from livecards.engine.rating import LABELS
from livecards.engine.registry import REGISTRY
from livecards.engine.space import add_space
from livecards.sim.match import Match

QA_TIMEOUT_S = 12.0
INSTRUCTIONS = """You answer fans' and analysts' questions about a live match, using ONLY your tools.
- Always call a tool first; never answer from memory. The match is in progress: you only know
  what has happened so far.
- Pick the right tool: plays and play_breakdown for attacks and how goals were built,
  stat_definition for what a stat means, compare_players for "X vs Y", period_stats for
  "since minute N" or "in the first half".
- Answer in 1-3 short sentences, in the language of the question.
- Every number you write must come from a tool result, written as digits. Use surnames.
- For one player's own numbers use player_card (leaders only lists the top 3).
- Say "highest xG", "most" or "fastest", never "best" or "worst": those are opinions.
- If the tools don't contain the answer, say exactly: "I can't verify that from the match data."
- If the question is about the future, other matches or seasons, money, or opinions ("best in
  the world"), reply with exactly that sentence and nothing else: no partial answer."""

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
    # What the viewer can do next, derived from the tools used (never from the model's text):
    # open a play, jump to a moment, follow a player. And a table for comparisons.
    actions: list[dict] = field(default_factory=list)
    table: dict | None = None


class MatchTools:
    """Read-only tools over the engine. Every call is recorded as evidence."""

    def __init__(self, engine: MatchEngine, match: Match | None = None) -> None:
        self.engine = engine
        self.match = match  # tracking frames, for space control in play breakdowns
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

    def _dirs(self) -> dict[str, int]:
        m = self.engine.meta
        return {m.home.code: m.home.attack_dir, m.away.code: m.away.attack_dir}

    def _shots(self) -> list:
        return [e for e in self.engine.events.values() if e.type == "shot"]

    def plays(self, player: Annotated[str, "player name, or 'all'"] = "all",
              outcome: Annotated[str, "goal, saved, off_target, blocked, or 'any'"] = "any",
              min_xg: Annotated[float, "only chances at least this good, 0 to 1"] = 0.0) -> str:
        """Every attack so far that ended in a shot: who, when, the outcome and its xG. Each has a
        play_id to pass to play_breakdown."""
        pid = None if player.lower() == "all" else self._find(player)
        if player.lower() != "all" and pid is None:
            return self._record("plays", {"error": f"no player named {player}"})
        dirs = self._dirs()
        rows = [{"play_id": e.id, "minute": e.minute, "player": self.engine.players[e.player].meta.name,
                 "outcome": (e.outcome or "").replace("_", " "), "xg": mx.xg(e.x, e.y, dirs[e.team])}
                for e in self._shots()
                if (pid is None or e.player == pid) and (outcome == "any" or e.outcome == outcome)]
        rows = [r for r in rows if r["xg"] >= min_xg]
        return self._record("plays", {"plays": rows[-12:], "count": len(rows),
                                      "evidence": [r["play_id"] for r in rows[-12:]]})

    def play_breakdown(self, play: Annotated[str, "a play_id from plays, a player's name for "
                                                  "their latest shot, or 'latest goal'"]) -> str:
        """How one attack was built, touch by touch: each pass's distance, difficulty (1-10),
        ground gained and pressure, sprints, the shot's xG, and the attacking team's space in the
        final third at each touch (from space control)."""
        shots = self._shots()
        ev = self.engine.events.get(play)
        if ev is None or ev.type not in ("shot", "goal"):
            if play.lower().startswith("latest goal"):
                ev = next((e for e in reversed(shots) if e.outcome == "goal"), None)
            else:
                pid = self._find(play)
                ev = next((e for e in reversed(shots) if e.player == pid), None) if pid else None
        if ev is None:
            return self._record("play_breakdown", {"error": f"no play found for {play}"})
        if ev.type == "shot" and ev.outcome == "goal":
            ev = next((e for e in self.engine.events.values() if e.type == "goal"
                       and e.player == ev.player and e.t >= ev.t), ev)
        b = build_up(list(self.engine.events.values()), ev, self.engine.meta, self.engine.moments)
        if b is None:
            return self._record("play_breakdown", {"error": "no build-up found"})
        if self.match is not None:
            add_space(b, self.match, self.engine.meta)
        steps = []
        for st in b["steps"]:
            row = {"seconds_before_shot": round(st["t"] - b["goal_t"], 1), "what": st["text"]}
            a = st.get("args") or {}
            for k in ("difficulty", "gain", "pressure", "xg"):
                if k in a and a[k] is not None:
                    row["gained_m" if k == "gain" else k] = a[k]
            if st.get("space"):
                row["final_third_space_m2"] = st["space"]["final_third_m2"]
                if st["space"]["gain_m2"] is not None:
                    row["space_change_m2"] = st["space"]["gain_m2"]
            steps.append(row)
        return self._record("play_breakdown", {
            "play_id": b["goal"], "kind": b["kind"], "team": self.engine.meta.team(b["team"]).name,
            "summary": b["facts"], "steps": steps,
            "evidence": [e for st in b["steps"] for e in st["evidence"][:1]]})

    def stat_definition(self, stat: Annotated[str, "the stat, e.g. xG, pass difficulty, space "
                                                   "control, sprints, rating"]) -> str:
        """What a stat means, how Live Cards calculates it, and its settings (from the registry)."""
        q = stat.lower().replace(" ", "_")
        st = next((d for d in REGISTRY if q in (d.id, d.name.lower().replace(" ", "_"))
                   or q in d.id or d.id in q or q in d.name.lower()), None)
        if st is None:
            return self._record("stat_definition", {"error": f"unknown stat {stat}",
                                                    "known": [d.name for d in REGISTRY]})
        return self._record("stat_definition", {"stat": st.name, "meaning": st.plain,
                                                "how": st.how, "settings": st.settings,
                                                "note": st.note, "evidence": []})

    def compare_players(self, a: Annotated[str, "first player's name"],
                        b: Annotated[str, "second player's name"]) -> str:
        """Two players side by side: rating, goals, shots, xG, passing, defending, running."""
        rows = {}
        for name in (a, b):
            pid = self._find(name)
            if pid is None:
                return self._record("compare_players", {"error": f"no player named {name}"})
            ps = self.engine.players[pid]
            s = ps.stats.public()
            rows[ps.meta.name] = {"rating": round(ps.rating.value, 1), "goals": s["goals"],
                                  "shots": s["shots"], "xg": round(s["xg"], 2),
                                  "passes_completed": s["passes_completed"], "pass_pct": s["pass_pct"],
                                  "tackles_won": s["tackles_won"], "interceptions": s["interceptions"],
                                  "distance_km": s["distance_km"], "top_speed_kmh": s["top_speed_kmh"]}
        return self._record("compare_players", {"players": rows, "evidence": []})

    def period_stats(self, player: Annotated[str, "player name"],
                     from_minute: Annotated[int, "start minute"] = 0,
                     to_minute: Annotated[int, "end minute"] = 90) -> str:
        """What a player did between two minutes: shots, goals, passes, tackles, interceptions
        and how much their rating changed."""
        pid = self._find(player)
        if pid is None:
            return self._record("period_stats", {"error": f"no player named {player}"})
        t0, t1 = from_minute * 60, min(to_minute * 60, self.engine.t)
        evs = [e for e in self.engine.events.values() if e.player == pid and t0 <= e.t <= t1]
        count = lambda ty, out=None: sum(1 for e in evs if e.type == ty and (out is None or e.outcome == out))
        ps = self.engine.players[pid]
        change = round(sum(x.delta for x in ps.rating.ledger if t0 <= x.t <= t1), 2)
        return self._record("period_stats", {
            **self._who(pid), "from_minute": from_minute, "to_minute": int(t1 // 60),
            "shots": count("shot"), "goals": count("goal"),
            "passes_completed": count("pass", "complete"), "passes": count("pass"),
            "tackles_won": count("tackle", "won"), "interceptions": count("interception"),
            "rating_change": change, "evidence": [e.id for e in evs][-10:]})

    def all(self) -> list:
        return [self.player_card, self.rating_breakdown, self.recent_moments, self.team_state,
                self.leaders, self.plays, self.play_breakdown, self.stat_definition,
                self.compare_players, self.period_stats]

    def actions(self) -> tuple[list[dict], dict | None]:
        """Next steps for the viewer, from what the tools returned: plays to open, moments to
        jump to, players to follow, and a comparison table."""
        acts: list[dict] = []
        table = None
        seen: set[str] = set()

        def add(a: dict) -> None:
            key = json.dumps(a, sort_keys=True)
            if key not in seen and len(acts) < 4:
                seen.add(key)
                acts.append(a)
        for tool, r in self.calls:
            if "error" in r:
                continue
            if tool == "play_breakdown":
                add({"type": "play", "id": r["play_id"], "label": f"Open this play ({r['kind']})"})
            elif tool == "plays":
                for row in r["plays"][-3:]:
                    add({"type": "play", "id": row["play_id"],
                         "label": f"{row['player'].split()[-1]} {row['minute']}′ · {row['outcome']}"})
            elif tool == "recent_moments":
                for m in r["moments"][-2:]:
                    add({"type": "moment", "minute": m["minute"], "label": f"Jump to {m['minute']}′"})
            elif tool in ("player_card", "rating_breakdown", "period_stats"):
                pid = self._find(r["player"])
                if pid:
                    add({"type": "player", "id": pid, "label": f"Follow {r['player'].split()[-1]}"})
            elif tool == "compare_players":
                names = list(r["players"])
                keys = list(r["players"][names[0]])
                table = {"columns": ["", *[n.split()[-1] for n in names]],
                         "rows": [[k.replace("_", " "), *[r["players"][n][k] for n in names]] for k in keys]}
        return acts, table

    # -- what the answer may use --
    def facts(self) -> tuple[dict, set[str], list[str]]:
        """What an answer may say: every number the tools returned (including number words in
        definitions, and percentages as fractions), every player they named, and superlatives
        only where a tool ranked something."""
        numbers: dict = {}
        names: set[str] = set()
        evidence: list[str] = []
        text = json.dumps([r for _, r in self.calls], ensure_ascii=False)
        for i, m in enumerate(re.finditer(r"-?\d+(?:\.\d+)?", text)):
            numbers[f"n{i}"] = float(m.group(0))
        for i, (_, v) in enumerate(extract_numbers(text, "en")):  # "ten times a second", "third"
            numbers[f"w{i}"] = v
        for i, v in enumerate(_percentages([r for _, r in self.calls])):  # "87%" claims 0.87
            numbers[f"p{i}"] = v
        for p in self.engine.meta.players:
            if p.name in text or re.search(rf"\b{re.escape(p.short)}\b", text):
                names |= {p.name, p.short}
        for tool, r in self.calls:
            evidence += [e for e in r.get("evidence", []) if e not in evidence]
            if tool in ("leaders", "plays", "compare_players") and "error" not in r:
                numbers["is_leader_stat"] = 1  # a ranking or comparison was computed
                if r.get("stat") == "top_speed_kmh":
                    numbers["fastest_of_match"] = 1
        return numbers, names, evidence


def _percentages(node) -> list[float]:
    """Values under keys that are percentages, as fractions (the verifier reads "87%" as 0.87)."""
    out: list[float] = []
    if isinstance(node, dict):
        for k, v in node.items():
            if "pct" in k:  # a percentage, or a dict of them per team
                vals = [v] if isinstance(v, (int, float)) else list(v.values()) if isinstance(v, dict) else []
                out += [round(x / 100, 3) for x in vals if isinstance(x, (int, float)) and not isinstance(x, bool)]
            else:
                out += _percentages(v)
    elif isinstance(node, list):
        for v in node:
            out += _percentages(v)
    return out


def make_qa_agent(tools: MatchTools) -> RunsPrompt | None:
    return make_agent("MatchQA", INSTRUCTIONS, tools=tools.all())


REFUSAL = "I can't verify that from the match data."
# Questions the match data can never answer: the future, other matches or seasons, money, and
# opinions. Caught in code before any model runs, so no partial answer can slip through.
OUT_OF_SCOPE = re.compile(
    r"\bwill\b.*\b(score|win|lose|happen|be)\b|\bnext (match|game|season|week)\b|"
    r"\blast (season|week|year|match|game)\b|\b(salary|wage|contract|transfer|worth)\b|"
    r"\b(in the world|of all time|greatest|ever)\b|"
    r"\b(manager|coach|referee) (said|say|told)\b|\bsay at half-?time\b|"
    r"\b(temporada pasada|próxima temporada|salario|saison dernière|salaire|temporada passada|salário)\b",
    re.IGNORECASE)
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
              reviewer: RunsPrompt | None, agent_factory=make_qa_agent,
              match: Match | None = None) -> Answer:
    t0 = time.perf_counter()
    feedback = None
    problems: list[str] = []
    tools = MatchTools(engine, match)
    if OUT_OF_SCOPE.search(question):
        return Answer(question, REFUSAL, True, "refusal", [], [], 0.0, ["outside the match data"])
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
        if text.startswith("I can't verify"):  # a refusal needs no evidence
            return Answer(question, REFUSAL, True, "refusal", [], [c for c, _ in tools.calls],
                          round((time.perf_counter() - t0) * 1000), [])
        if not tools.calls:
            feedback, problems = "you did not call a tool", ["no tool was called"]
            continue
        numbers, names, evidence = tools.facts()
        verdict: Verdict = check(text, build_bundle(numbers, names), roster, lang)
        if verdict.ok and reviewer is not None:
            r = await review(reviewer, text, {"tool_results": [r for _, r in tools.calls]})
            if not r.ok:
                verdict = Verdict(False, [r.reason()], verdict.checked + 1)
        if verdict.ok:
            actions, table = tools.actions()
            return Answer(question, text, True, "model", evidence[:12],
                          list(dict.fromkeys(c for c, _ in tools.calls)),
                          round((time.perf_counter() - t0) * 1000), actions=actions, table=table)
        feedback, problems = verdict.reason(), verdict.problems
    return Answer(question, REFUSAL, True, "refusal", [], [c for c, _ in tools.calls],
                  round((time.perf_counter() - t0) * 1000), problems)
