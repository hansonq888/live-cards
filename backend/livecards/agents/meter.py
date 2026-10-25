"""Cost meter: every model call's tokens and an estimated price, per agent, per viewer session.

Every agent made by `make_agent` is wrapped in `Metered`, which reads the token counts the
model API reports back (Agent Framework's `usage_details`) and adds them to the ledger of the
session that made the call. The session is found through a context variable, so concurrent
viewers never mix their counts; a server-wide ledger sums everything.

Prices are list prices per million tokens, kept in one place and shown wherever a cost is shown;
tokens are exact, dollars are an estimate.
"""

from __future__ import annotations

import contextvars
from dataclasses import dataclass, field
from typing import Any

# USD per 1M tokens (input, output), list prices as of October 2026. Estimates.
PRICES: dict[str, tuple[float, float]] = {
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-5-mini": (0.25, 2.00),
}
PRICES_AS_OF = "October 2026 list prices"

# Our Foundry deployment names and the model behind each (see docs/azure-setup.md).
DEPLOYMENTS: dict[str, str] = {"explainer-mini": "gpt-4.1-mini", "reasoner-mini": "gpt-5-mini"}


def base_model(name: str) -> str:
    return DEPLOYMENTS.get(name, name)


def price(model: str, tokens_in: int, tokens_out: int) -> float:
    model = base_model(model)
    p_in, p_out = next((v for k, v in PRICES.items() if model.startswith(k)), (0.0, 0.0))
    return (tokens_in * p_in + tokens_out * p_out) / 1_000_000


@dataclass
class Line:
    calls: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    usd: float = 0.0
    model: str = ""


@dataclass
class Ledger:
    agents: dict[str, Line] = field(default_factory=dict)
    cache_hits: int = 0  # model calls saved by reusing a verified line or translation

    def record(self, agent: str, model: str, tokens_in: int, tokens_out: int) -> None:
        line = self.agents.setdefault(agent, Line(model=base_model(model)))
        line.calls += 1
        line.tokens_in += tokens_in
        line.tokens_out += tokens_out
        line.usd += price(model, tokens_in, tokens_out)

    def summary(self) -> dict:
        calls = sum(a.calls for a in self.agents.values())
        return {
            "calls": calls,
            "tokens": sum(a.tokens_in + a.tokens_out for a in self.agents.values()),
            "usd": round(sum(a.usd for a in self.agents.values()), 4),
            "cache_hits": self.cache_hits,
            "cache_pct": round(100 * self.cache_hits / (calls + self.cache_hits)) if calls + self.cache_hits else 0,
            "prices": PRICES_AS_OF,
            "by_agent": {k: {"calls": v.calls, "tokens": v.tokens_in + v.tokens_out, "usd": round(v.usd, 4),
                             "model": v.model} for k, v in sorted(self.agents.items(), key=lambda kv: -kv[1].usd)},
        }


SERVER = Ledger()  # every session, since the process started
current: contextvars.ContextVar[Ledger | None] = contextvars.ContextVar("ledger", default=None)


def cache_hit(n: int = 1) -> None:
    SERVER.cache_hits += n
    if (ledger := current.get()) is not None:
        ledger.cache_hits += n


def _usage(result: Any) -> tuple[int, int]:
    u = getattr(result, "usage_details", None) or {}
    get = u.get if isinstance(u, dict) else (lambda k, d=None: getattr(u, k, d))
    return int(get("input_token_count") or 0), int(get("output_token_count") or 0)


class Metered:
    """Wraps an agent: same `run`, plus a ledger entry for every call."""

    def __init__(self, agent: Any, name: str, model: str) -> None:
        self._agent, self.name, self.model = agent, name, model

    async def run(self, prompt: str, **kw: Any) -> Any:
        result = await self._agent.run(prompt, **kw)
        tin, tout = _usage(result)
        SERVER.record(self.name, self.model, tin, tout)
        if (ledger := current.get()) is not None:
            ledger.record(self.name, self.model, tin, tout)
        return result

    def __getattr__(self, item: str) -> Any:
        return getattr(self._agent, item)
