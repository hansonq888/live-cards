"""Reviewer: a reasoning model audits claims that code can't check.

The deterministic verifier guarantees numbers, names and superlatives. This agent
(gpt-5-mini, low reasoning effort) reads the line against the facts and rejects claimed
events or actions the facts don't support: "an assist" that never happened, "a save",
a tackle. It can add a rejection, never overrule one from code, and it fails closed:
if it errors or times out, the line does not air.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass

from livecards.agents.llm import RunsPrompt, make_agent

REVIEW_TIMEOUT_S = 6.0
INSTRUCTIONS = """You audit one line of live football copy against the facts. Reply with JSON only:
{"ok": true} or {"ok": false, "claim": "<the unsupported claim, quoted from the line>"}.
Reject only claims of events or actions that the facts do not support (for example an assist,
a save or a tackle that is not in the facts). Paraphrase is fine: an interception may be called
winning or recovering the ball. Wording, tone, partisanship, language and omissions are fine."""


@dataclass
class Review:
    ok: bool
    claim: str = ""
    error: str = ""

    def reason(self) -> str:
        return f"unsupported claim '{self.claim}'" if self.claim else self.error


def make_reviewer() -> RunsPrompt | None:
    return make_agent("Reviewer", INSTRUCTIONS, "FOUNDRY_REASONER_MODEL")


def parse(text: str) -> Review:
    m = re.search(r"\{.*\}", text or "", re.DOTALL)
    if not m:
        return Review(False, error="reviewer reply was not JSON")
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return Review(False, error="reviewer reply was not JSON")
    return Review(bool(data.get("ok")), str(data.get("claim", "")))


async def review(agent: RunsPrompt, line: str, facts: dict) -> Review:
    """Fails closed: any error or timeout is a rejection."""
    try:
        res = await asyncio.wait_for(
            agent.run(f"Facts: {json.dumps(facts, ensure_ascii=False)}\nLine: {line}",
                      options={"reasoning": {"effort": "low"}}),
            REVIEW_TIMEOUT_S)
    except TimeoutError:
        return Review(False, error="reviewer timed out")
    except Exception as exc:  # noqa: BLE001 - fail closed on any model failure
        return Review(False, error=f"reviewer error: {type(exc).__name__}")
    return parse(res.text)
