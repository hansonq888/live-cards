"""Evaluate the safety layers and the agents.

Part 1 (safety): a labelled set built from real match moments. Correct lines (English,
Spanish, French) must pass; planted lies must be blocked. Each layer is scored alone and
together:
  number        a figure changed                 (the code verifier's job)
  word_number   a wrong number written in words  (code)
  wrong_player  another player's name            (code)
  superlative   an unsupported superlative       (code)
  invented      an event that never happened     (the reviewer's job: no number is wrong)

Part 2 (Foundry): Microsoft Foundry's built-in evaluators on the real Explainer output
(groundedness against the facts, fluency, coherence) and on the Q&A agent (intent
resolution, task adherence, tool-call accuracy). Runs are logged to the Foundry project.

    uv run python scripts/evaluate.py            # both parts
    uv run python scripts/evaluate.py --safety   # part 1 only
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import re
import time
from collections import defaultdict
from pathlib import Path

from livecards.agents.explainer import INSTRUCTIONS, ExplainJob, job_for
from livecards.agents.llm import make_agent, make_client
from livecards.agents.reviewer import make_reviewer, review
from livecards.agents.verifier import check
from livecards.engine.engine import MatchEngine
from livecards.replay import feed, ticks
from livecards.sim.simulator import simulate

OUT_JSON = Path(__file__).resolve().parents[2] / "docs" / "evaluation-results.json"
OUT_MD = Path(__file__).resolve().parents[2] / "docs" / "evaluation.md"
TYPES = {"goal", "rating_upgrade", "fastest_sprint", "big_chance", "attr_upgrade"}
rng = random.Random(7)

# ---- correct lines, written from the facts -----------------------------------------------


def supported(job: ExplainJob, short: str) -> list[tuple[str, str]]:
    f, t = job.facts, job.moment.type
    assist = str(f.get("assist", "")).split(" ")[-1]
    out: list[tuple[str, str]] = []
    if t == "goal":
        d, k = round(float(f["distance_m"])), round(float(f["speed_kmh"]))
        out += [("en", f"{short} scores from {d} m" + (f", assisted by {assist}." if assist else ".")),
                ("en", f"{short} finishes at {k} km/h to make it {f['score']}."),
                ("es", f"Gol de {short} desde {d} m" + (f", con asistencia de {assist}." if assist else ".")),
                ("fr", f"But de {short} à {k} km/h.")]
    elif t == "rating_upgrade":
        out += [("en", f"{short}'s rating climbs from {f['from']} to {f['to']}."),
                ("en", f"{short} rises to {f['to']} after a {f['top_reason']}."),
                ("es", f"La nota de {short} sube de {f['from']} a {f['to']}."),
                ("fr", f"La note de {short} passe de {f['from']} à {f['to']}.")]
    elif t == "fastest_sprint":
        k = f["speed_kmh"]
        out += [("en", f"{short} hits {k} km/h, the fastest sprint of the match."),
                ("en", f"{short} reaches a top speed of {k} km/h."),
                ("es", f"{short} alcanza {k} km/h, el sprint más rápido del partido.")]
    elif t == "big_chance":
        out += [("en", f"Big chance for {short} from {round(float(f['distance_m']))} m, xG {f['xg']}."),
                ("fr", f"Grosse occasion pour {short} à {round(float(f['distance_m']))} m.")]
    elif t == "attr_upgrade":
        out += [("en", f"{short}'s {f['attr']} rises from {f['from']} to {f['to']}.")]
    return out


# ---- lies, planted into correct lines -------------------------------------------------------

INVENTED = {"en": [", with a header", ", from a corner", ", after a goal-line clearance",
                   ", after winning a penalty"],
            "es": [", de cabeza", ", tras un saque de esquina"],
            "fr": [", de la tête", ", sur corner"]}
SUPERLATIVE = {"en": ", the best performance of his career", "es": ", un récord del partido",
               "fr": ", un record pour lui"}
WORD_NUMBER = {"en": " in the seventy-seventh minute", "es": " en el minuto setenta y siete",
               "fr": " à la soixante-dix-septième minute"}


def mutate(kind: str, text: str, lang: str, short: str, others: list[str]) -> str | None:
    body = text.rstrip(".")
    if kind == "number":
        m = list(re.finditer(r"\d+(?:\.\d+)?", text))
        if not m:
            return None
        n = rng.choice(m)
        v = float(n.group(0))
        new = f"{v + 1.3:.1f}" if "." in n.group(0) else str(int(v) + 3)
        return text[:n.start()] + new + text[n.end():]
    if kind == "word_number":
        return body + WORD_NUMBER[lang] + "."
    if kind == "wrong_player":
        return text.replace(short, rng.choice(others), 1) if short in text else None
    if kind == "superlative":
        return body + SUPERLATIVE[lang] + "."
    if kind == "invented":
        return body + rng.choice(INVENTED[lang]) + "."
    return None


def build_dataset():
    match = simulate(7)
    engine = MatchEngine(match.meta)
    roster = {n for p in match.meta.players for n in (p.name, p.short)}
    shorts = {p.id: p.short for p in match.meta.players}
    cases, jobs = [], []
    for tick in ticks(match):
        for m in feed(engine, match, tick):
            if m.type in TYPES and m.player and m.importance >= 0.4:
                jobs.append(job_for(m, engine))
    jobs = jobs[:40]
    for job in jobs:
        short = shorts[job.moment.player]
        others = [s for s in shorts.values() if s != short]
        for lang, text in supported(job, short):
            cases.append({"job": job, "lang": lang, "text": text, "kind": "supported", "label": True})
            for kind in ("number", "word_number", "wrong_player", "superlative", "invented"):
                bad = mutate(kind, text, lang, short, others)
                if bad and bad != text:
                    cases.append({"job": job, "lang": lang, "text": bad, "kind": kind, "label": False})
    return cases, jobs, roster, match


async def run_safety(cases, roster) -> dict:
    reviewer = make_reviewer()
    sem = asyncio.Semaphore(3)  # realistic concurrency (a goal fires a handful of lines)

    async def judge(c):
        code = check(c["text"], c["job"].bundle(), roster, c["lang"]).ok
        rev = None
        if reviewer is not None:
            async with sem:
                r = await review(reviewer, c["text"], c["job"].facts)
            rev = r.ok
        c["code_ok"], c["review_ok"] = code, rev
        c["both_ok"] = code and (rev if rev is not None else True)

    t0 = time.perf_counter()
    await asyncio.gather(*(judge(c) for c in cases))
    by = defaultdict(lambda: defaultdict(int))
    for c in cases:
        k = c["kind"]
        by[k]["n"] += 1
        for gate in ("code_ok", "review_ok", "both_ok"):
            if c[gate] is None:
                continue
            # For lies, "caught" = blocked. For correct lines, "passed" = allowed.
            good = c[gate] if c["label"] else not c[gate]
            by[k][gate] += good
    lies = [c for c in cases if not c["label"]]
    return {
        "cases": len(cases), "lies": len(lies), "seconds": round(time.perf_counter() - t0, 1),
        "by_kind": {k: dict(v) for k, v in by.items()},
        "unsupported_aired": sum(c["both_ok"] for c in lies),
        "supported_blocked": sum(not c["both_ok"] for c in cases if c["label"]),
        "examples_blocked_by_reviewer_only": [c["text"] for c in lies if c["code_ok"] and c["review_ok"] is False][:4],
        "examples_aired": [c["text"] for c in lies if c["both_ok"]][:6],
        "examples_false_reject": [c["text"] for c in cases if c["label"] and not c["both_ok"]][:6],
    }


async def run_foundry(jobs, match) -> dict:
    """Microsoft Foundry built-in evaluators on the Explainer's real output and the Q&A agent."""
    from agent_framework import EvalItem, Message, evaluate_agent
    from agent_framework.foundry import FoundryEvals

    from livecards.agents.qa import MatchTools, make_qa_agent

    explainer = make_agent("Explainer", INSTRUCTIONS)
    items = []
    for job in jobs[:15]:
        res = await explainer.run(job.prompt())
        items.append(EvalItem(conversation=[Message("user", [job.prompt()]),
                                            Message("assistant", [res.text])],
                              context=json.dumps(job.facts, ensure_ascii=False)))
    judge = make_client()  # the evaluator's LLM judge: our Foundry deployment
    explain_eval = FoundryEvals(client=judge, evaluators=["groundedness", "fluency", "coherence"])
    r1 = await explain_eval.evaluate(items, eval_name="Live Cards: Explainer (grounded in facts)")

    engine = MatchEngine(match.meta)
    for tick in ticks(match, 0, 3960):
        feed(engine, match, tick)
    qa = make_qa_agent(MatchTools(engine))
    r2 = await evaluate_agent(
        agent=qa, eval_name="Live Cards: Q&A agent",
        queries=["Why did Varenne's rating jump?", "Who has been the fastest player so far?",
                 "How is Hearne doing?", "Who controls the game right now?",
                 "Who has run the most distance?"],
        evaluators=FoundryEvals(client=judge, evaluators=["intent_resolution", "task_adherence",
                                                          "tool_call_accuracy"]))

    def summary(r):
        d = {k: getattr(r, k, None) for k in ("status", "passed", "failed", "total", "report_url",
                                              "portal_url", "url")}
        per = getattr(r, "per_evaluator", None) or getattr(r, "scores", None)
        if per:
            d["per_evaluator"] = per if isinstance(per, dict) else str(per)
        return {k: v for k, v in d.items() if v is not None} or {"raw": str(r)[:2000]}

    return {"explainer": summary(r1), "qa_agent": [summary(r) for r in r2]}


def write_report(safety: dict, foundry: dict | None) -> None:
    OUT_JSON.write_text(json.dumps({"safety": safety, "foundry": foundry}, indent=2, default=str))
    rows = []
    names = {"supported": "Correct lines (must pass)", "number": "Changed number",
             "word_number": "Wrong number in words", "wrong_player": "Wrong player",
             "superlative": "Unsupported superlative", "invented": "Invented event"}
    for k in ("supported", "number", "word_number", "wrong_player", "superlative", "invented"):
        v = safety["by_kind"].get(k)
        if not v:
            continue
        pct = lambda g: f"{100 * v.get(g, 0) / v['n']:.0f}%" if v["n"] else "–"
        rows.append(f"| {names[k]} | {v['n']} | {pct('code_ok')} | {pct('review_ok')} | {pct('both_ok')} |")
    md = [
        "# Evaluation", "",
        "Generated by `backend/scripts/evaluate.py` (raw numbers in `evaluation-results.json`).", "",
        "## Safety layers", "",
        (f"{safety['cases']} lines built from real match moments in English, Spanish and French: "
        f"correct lines, and {safety['lies']} with a planted lie. For correct lines the score is "
        "the share allowed through; for lies, the share blocked."), "",
        "| Case | n | Code verifier | Reviewer (gpt-5-mini) | Both (what airs) |",
        "|---|---|---|---|---|", *rows, "",
        (f"**Unsupported lines that would have aired: {safety['unsupported_aired']} of {safety['lies']}.** "
        f"Correct lines blocked (they fall back to the stats line instead): "
        f"{safety['supported_blocked']}."), "",
    ]
    if safety["examples_blocked_by_reviewer_only"]:
        md += ["Lies only the reviewer caught (every number in them was right):", ""]
        md += [f"- {t}" for t in safety["examples_blocked_by_reviewer_only"]] + [""]
    if safety["examples_aired"]:
        md += ["Lies that got through (known gaps):", ""] + [f"- {t}" for t in safety["examples_aired"]] + [""]
    if foundry and "error" not in foundry:
        md += ["## Microsoft Foundry evaluators", "",
               ("Foundry's built-in judges, run through Agent Framework (`FoundryEvals`), logged "
               "to the project. The Explainer is scored on its raw output, before our checks: "
               "this is why nothing raw airs."), "",
               "| Agent | Evaluator | Passed |", "|---|---|---|"]
        for label, res in (("Explainer (raw)", foundry["explainer"]),
                           *(("Q&A agent", r) for r in foundry["qa_agent"])):
            for ev, v in (res.get("per_evaluator") or {}).items():
                md.append(f"| {label} | {ev.replace('_', ' ')} | {v['passed']} / {v['passed'] + v['failed']} |")
        md += [""] + [f"- Report: {r.get('report_url')}" for r in (foundry["explainer"], *foundry["qa_agent"])
                      if r.get("report_url")] + [""]
    elif foundry:
        md += ["## Microsoft Foundry evaluators", "", f"Not run: {foundry['error']}", ""]
    OUT_MD.write_text("\n".join(md))


async def main(safety_only: bool, foundry_only: bool = False) -> None:
    cases, jobs, roster, match = build_dataset()
    print(f"{len(cases)} cases from {len(jobs)} moments")
    if foundry_only and OUT_JSON.exists():
        safety = json.loads(OUT_JSON.read_text())["safety"]
    else:
        safety = await run_safety(cases, roster)
    print(json.dumps({k: v for k, v in safety.items() if not k.startswith("examples")}, indent=1))
    foundry = None
    if not safety_only:
        try:
            foundry = await run_foundry(jobs, match)
            print(json.dumps(foundry, indent=1, default=str)[:3000])
        except Exception as exc:  # noqa: BLE001 - report what failed rather than lose part 1
            foundry = {"error": f"{type(exc).__name__}: {exc}"[:500]}
            print(foundry)
    write_report(safety, foundry)
    print(f"wrote {OUT_MD}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--safety", action="store_true", help="part 1 only")
    ap.add_argument("--foundry", action="store_true", help="part 2 only (reuse part 1 results)")
    a = ap.parse_args()
    asyncio.run(main(a.safety, a.foundry))
