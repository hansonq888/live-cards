"""Ask, measured: a bank of analyst questions run through the real Q&A agent at full time.

For each question we know whether it should be answered (and which tools can answer it) or
refused (the future, other seasons, things the data doesn't hold). Every answer still goes
through the verifier and the reviewer, so an unsupported claim can only reach the screen if both
miss it. Writes docs/qa-evaluation.md and docs/qa-evaluation.json.

    uv run --extra agents python scripts/qa_eval.py
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from livecards.agents.qa import ask
from livecards.agents.reviewer import make_reviewer
from livecards.replay import run_engine
from livecards.server.session import load_match

ROOT = Path(__file__).resolve().parents[2]

# (question, expected: "answer" or "refuse", tools that can answer it)
BANK: list[tuple[str, str, set[str]]] = [
    ("How many shots has Varenne taken?", "answer", {"player_card", "plays", "compare_players"}),
    ("What is Okelani's top speed?", "answer", {"player_card", "leaders", "compare_players"}),
    ("How many tackles has Whitcombe won?", "answer", {"player_card", "period_stats"}),
    ("How far has Hearne run?", "answer", {"player_card", "leaders"}),
    ("What is Marchbanks' rating?", "answer", {"player_card", "rating_breakdown"}),
    ("Why did Varenne's rating go up?", "answer", {"rating_breakdown"}),
    ("Why is Hearne's rating low?", "answer", {"rating_breakdown", "player_card"}),
    ("Who has been the fastest player?", "answer", {"leaders"}),
    ("Who has run the most?", "answer", {"leaders"}),
    ("Who has the most interceptions?", "answer", {"leaders"}),
    ("Who has the highest rating?", "answer", {"leaders"}),
    ("Which shots were saved?", "answer", {"plays"}),
    ("List Halden's shots.", "answer", {"plays"}),
    ("What was the best chance that didn't go in?", "answer", {"plays"}),
    ("How many goals were scored?", "answer", {"team_state", "plays"}),
    ("How was the latest goal built?", "answer", {"play_breakdown"}),
    ("How was Varenne's goal built?", "answer", {"play_breakdown"}),
    ("How many passes led to Halden's goal?", "answer", {"play_breakdown"}),
    ("Did the long ball before Varenne's goal create space?", "answer", {"play_breakdown"}),
    ("What is xG?", "answer", {"stat_definition"}),
    ("What does pass difficulty mean?", "answer", {"stat_definition"}),
    ("How is space control calculated?", "answer", {"stat_definition"}),
    ("What counts as a sprint?", "answer", {"stat_definition"}),
    ("How is the player rating calculated?", "answer", {"stat_definition"}),
    ("Compare Varenne and Halden.", "answer", {"compare_players"}),
    ("Who has passed better, Dravet or Castagne?", "answer", {"compare_players"}),
    ("Varenne vs Okelani: who has run further?", "answer", {"compare_players"}),
    ("How has Hearne done since the 60th minute?", "answer", {"period_stats", "rating_breakdown"}),
    ("What did Varenne do in the first half?", "answer", {"period_stats"}),
    ("How many shots did Halden have after minute 45?", "answer", {"period_stats", "plays"}),
    ("What's the score?", "answer", {"team_state"}),
    ("Who had more possession?", "answer", {"team_state"}),
    ("¿Quién ha sido el jugador más rápido?", "answer", {"leaders"}),
    ("Qui a marqué le premier but ?", "answer", {"plays", "recent_moments", "play_breakdown"}),
    ("Quanto correu o Hearne?", "answer", {"player_card", "leaders"}),
    ("Who will win the league?", "refuse", set()),
    ("How many goals did Varenne score last season?", "refuse", set()),
    ("What is Varenne's salary?", "refuse", set()),
    ("Will Halden score again?", "refuse", set()),
    ("Who is the best striker in the world?", "refuse", set()),
    ("What did the manager say at half-time?", "refuse", set()),
    ("How many yellow cards did the referee give last week?", "refuse", set()),
]


async def main() -> None:
    match = load_match(7)
    engine = run_engine(match)
    roster = {n for p in match.meta.players for n in (p.name, p.short)}
    reviewer = make_reviewer()
    sem = asyncio.Semaphore(3)

    async def one(q: str, expect: str, ok_tools: set[str]) -> dict:
        async with sem:
            a = await ask(q, engine, roster, reviewer, match=match)
        answered = a.source == "model"
        return {"question": q, "expected": expect, "answered": answered, "text": a.text,
                "tools": a.tools, "right_tool": bool(set(a.tools) & ok_tools) if ok_tools else None,
                "ms": a.ms, "problems": a.problems, "actions": [x["label"] for x in a.actions]}

    rows = await asyncio.gather(*(one(q, e, t) for q, e, t in BANK))
    should = [r for r in rows if r["expected"] == "answer"]
    must_refuse = [r for r in rows if r["expected"] == "refuse"]
    answered = [r for r in should if r["answered"]]
    pct = lambda n, d: round(100 * n / d) if d else 0
    lat = sorted(r["ms"] for r in rows)
    res = {
        "questions": len(rows),
        "answerable_answered_pct": pct(len(answered), len(should)),
        "right_tool_pct": pct(sum(1 for r in should if r["right_tool"]), len(should)),
        "must_refuse_refused_pct": pct(sum(1 for r in must_refuse if not r["answered"]), len(must_refuse)),
        "blocked_by_checks": sum(1 for r in rows if r["problems"] and r["problems"] != ["outside the match data"]),
        "refused_by_scope_guard": sum(1 for r in rows if r["problems"] == ["outside the match data"]),
        "latency_ms_p50": lat[len(lat) // 2], "latency_ms_p95": lat[int(len(lat) * 0.95)],
        "rows": rows,
    }
    (ROOT / "docs" / "qa-evaluation.json").write_text(json.dumps(res, indent=2, ensure_ascii=False))
    md = ["# Ask, measured", "",
          (f"{len(rows)} questions an analyst or fan might ask, run through the real Q&A agent "
           "(Microsoft Foundry, Agent Framework tools) at full time. Every answer passed the code "
           "verifier and the reviewer before it counted."), "",
          "| | |", "|---|---|",
          f"| Answerable questions answered | **{res['answerable_answered_pct']}%** ({len(answered)}/{len(should)}) |",
          f"| ...using a right tool | {res['right_tool_pct']}% |",
          f"| Questions it must refuse, refused | **{res['must_refuse_refused_pct']}%** ({len(must_refuse)} questions) |",
          f"| Refused in code before any model ran (future, other seasons, money, opinions) | {res['refused_by_scope_guard']} |",
          f"| Answers blocked by the verifier or reviewer, then refused | {res['blocked_by_checks']} |",
          f"| Latency p50 / p95 | {res['latency_ms_p50'] / 1000:.1f} s / {res['latency_ms_p95'] / 1000:.1f} s |",
          "", "## Every question", "", "| Question | Expected | Result | Tools | Answer |", "|---|---|---|---|---|"]
    for r in rows:
        result = ("answered" if r["answered"] else "refused") + ("" if (r["answered"] == (r["expected"] == "answer")) else " ✗")
        md.append(f"| {r['question']} | {r['expected']} | {result} | {', '.join(r['tools'])} | {r['text'].replace('|', '/')} |")
    (ROOT / "docs" / "qa-evaluation.md").write_text("\n".join(md) + "\n")
    print(json.dumps({k: v for k, v in res.items() if k != "rows"}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
