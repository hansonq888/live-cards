"""Cost meter: tokens and price per agent, kept apart per viewer session."""

import asyncio

from livecards.agents import meter


class FakeResult:
    def __init__(self, tin, tout):
        self.text = "ok"
        self.usage_details = {"input_token_count": tin, "output_token_count": tout}


class FakeAgent:
    def __init__(self, tin, tout):
        self.tin, self.tout = tin, tout

    async def run(self, prompt, **kw):
        return FakeResult(self.tin, self.tout)


def test_price_uses_the_model_rates():
    assert meter.price("gpt-4.1-mini", 1_000_000, 0) == 0.40
    assert meter.price("gpt-5-mini-2025", 0, 1_000_000) == 2.00
    assert meter.price("unknown", 10, 10) == 0.0


def test_each_session_gets_its_own_ledger():
    agent = meter.Metered(FakeAgent(1000, 200), "Explainer", "gpt-4.1-mini")
    a, b = meter.Ledger(), meter.Ledger()

    async def viewer(ledger, n):
        meter.current.set(ledger)
        for _ in range(n):
            await agent.run("x")
        meter.cache_hit()

    async def main():
        await asyncio.gather(viewer(a, 3), viewer(b, 1))
    asyncio.run(main())
    sa, sb = a.summary(), b.summary()
    assert sa["calls"] == 3 and sb["calls"] == 1
    assert sa["tokens"] == 3 * 1200 and sa["cache_hits"] == 1 and sa["cache_pct"] == 25
    assert abs(sa["usd"] - 3 * meter.price("gpt-4.1-mini", 1000, 200)) < 1e-4
    assert sa["by_agent"]["Explainer"]["calls"] == 3
