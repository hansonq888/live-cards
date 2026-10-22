"""Smoke test: call a Microsoft Foundry model through Microsoft Agent Framework.

Runs a tiny Explainer agent on the real hero moment from the stats engine and prints the
reply and latency. See docs/azure-setup.md for the setup steps.

    cp .env.example .env            # fill in FOUNDRY_PROJECT_ENDPOINT and FOUNDRY_MODEL
    uv sync --extra agents
    az login
    uv run python scripts/foundry_smoke.py            # or --browser to sign in without the CLI
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from pathlib import Path

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential, InteractiveBrowserCredential

from livecards.replay import run_engine
from livecards.sim.simulator import simulate

ENV = Path(__file__).resolve().parents[1] / ".env"

INSTRUCTIONS = """You explain live football player-card changes for a TV overlay.
Write ONE sentence of at most 18 words. Use only the facts given; never add a number
that is not in the facts. No hashtags, no emojis."""


def hero_moment() -> dict:
    engine = run_engine(simulate(7))
    goal = next(m for m in engine.moments if m.type == "goal" and m.player == "RIV-09")
    up = next(m for m in engine.moments if m.type == "rating_upgrade" and m.player == "RIV-09"
              and m.t == goal.t)
    p = engine.meta.player("RIV-09")
    return {"player": p.name, "position": p.position, "goal": goal.facts,
            "rating": {"from": up.facts["from"], "to": up.facts["to"]},
            "evidence": goal.evidence}


async def main(browser: bool) -> None:
    if ENV.exists():
        for line in ENV.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    endpoint, model = os.environ.get("FOUNDRY_PROJECT_ENDPOINT"), os.environ.get("FOUNDRY_MODEL")
    if not endpoint or not model:
        raise SystemExit("Set FOUNDRY_PROJECT_ENDPOINT and FOUNDRY_MODEL in backend/.env")
    credential = InteractiveBrowserCredential() if browser else AzureCliCredential()
    agent = Agent(
        client=FoundryChatClient(project_endpoint=endpoint, model=model, credential=credential),
        name="Explainer",
        instructions=INSTRUCTIONS,
    )
    facts = hero_moment()
    print("facts:", json.dumps(facts))
    for i in range(3):  # first call includes connection and token setup
        t0 = time.perf_counter()
        result = await agent.run(f"Explain this rating change for a casual fan:\n{json.dumps(facts)}")
        print(f"[{(time.perf_counter() - t0) * 1000:.0f} ms] {result.text}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser", action="store_true", help="sign in with a browser, not az CLI")
    asyncio.run(main(ap.parse_args().browser))
