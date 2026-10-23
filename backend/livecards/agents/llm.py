"""Model access: Foundry-hosted models through Microsoft Agent Framework.

Agents are created lazily and only if Foundry is configured, so everything still runs
(on templates) without Azure: tests, CI, and the demo when the model is switched off.
"""

from __future__ import annotations

import os
from functools import cache
from pathlib import Path
from typing import Any, Protocol

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class RunsPrompt(Protocol):
    async def run(self, prompt: str) -> Any: ...  # result has `.text`


def load_env() -> None:
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


@cache
def _credential():
    from azure.identity import (
        AzureCliCredential,
        ChainedTokenCredential,
        EnvironmentCredential,
        ManagedIdentityCredential,
    )

    # A service principal (AZURE_CLIENT_ID/TENANT_ID/CLIENT_SECRET) in Container Apps, which
    # works on every environment type; managed identity where available; az login locally.
    return ChainedTokenCredential(EnvironmentCredential(), ManagedIdentityCredential(),
                                  AzureCliCredential())


def foundry_configured() -> bool:
    load_env()
    return bool(os.environ.get("FOUNDRY_PROJECT_ENDPOINT") and os.environ.get("FOUNDRY_MODEL"))


def make_agent(name: str, instructions: str, model_env: str = "FOUNDRY_MODEL",
               tools: list | None = None) -> RunsPrompt | None:
    """An Agent Framework agent on a Foundry deployment, or None if Foundry isn't set up."""
    if not foundry_configured():
        return None
    from agent_framework import Agent
    from agent_framework.foundry import FoundryChatClient

    model = os.environ.get(model_env) or os.environ["FOUNDRY_MODEL"]
    client = FoundryChatClient(project_endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
                               model=model, credential=_credential())
    return Agent(client=client, name=name, instructions=instructions, tools=tools)
