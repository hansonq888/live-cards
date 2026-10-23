"""Red team: deliberately corrupt the Explainer's first draft to show the safety layers work.

Two kinds of lie, so both layers are exercised in front of an audience:
  number  - a figure the evidence doesn't contain      -> caught by the code verifier
  event   - an action that didn't happen, no numbers    -> passes code, caught by the reviewer
The corrupted draft goes through the normal workflow; nothing is special-cased downstream.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from livecards.agents.llm import RunsPrompt

FAKE_EVENTS = ["capped by an assist", "after a goal-line clearance", "after winning a penalty"]


@dataclass
class _Res:
    text: str


def corrupt(text: str, mode: str) -> str:
    text = text.rstrip(". ")
    if mode == "number":
        m = re.search(r"\d+(?:\.\d+)?", text)
        if m:
            v = float(m.group(0))
            fake = f"{v + 2.3:.1f}" if "." in m.group(0) else str(int(v) + 3)
            return text[:m.start()] + fake + text[m.end():] + "."
        return text + ", now rated 9.6."
    return f"{text}, {FAKE_EVENTS[len(text) % len(FAKE_EVENTS)]}."


@dataclass
class RedTeamAgent:
    """Wraps the real Explainer: the first draft is corrupted, rewrites are honest."""

    real: RunsPrompt
    mode: str  # number | event
    injected: str = ""
    calls: int = 0
    seen: list[str] = field(default_factory=list)

    async def run(self, prompt: str, **kw: Any) -> Any:
        self.calls += 1
        res = await self.real.run(prompt, **kw)
        if self.calls == 1:
            self.injected = corrupt(res.text or "", self.mode)
            return _Res(self.injected)
        return res
