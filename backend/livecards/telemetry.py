"""Tracing: every moment's path through the agents, in Azure Application Insights.

Agent Framework already emits OpenTelemetry spans for agent runs and model calls; this
routes them (and our own spans for each moment, answer and personalization) to App
Insights when APPLICATIONINSIGHTS_CONNECTION_STRING is set. Locally it's a no-op.
"""

from __future__ import annotations

import contextlib
import logging
import os

from opentelemetry import trace

tracer = trace.get_tracer("livecards")
log = logging.getLogger("livecards")


def configure() -> bool:
    conn = os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING")
    if not conn:
        return False
    from azure.monitor.opentelemetry import configure_azure_monitor

    configure_azure_monitor(connection_string=conn,
                            resource_attributes={"service.name": "livecards"})
    with contextlib.suppress(Exception):
        from agent_framework.observability import enable_instrumentation

        enable_instrumentation()
    log.info("tracing to Application Insights")
    return True
