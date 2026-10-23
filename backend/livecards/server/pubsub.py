"""Console fan-out over Azure Web PubSub.

Console events (audit entries, approval requests, decisions, control changes) are broadcast
to every connected console through Web PubSub, so any number of consoles stay in sync
without holding a socket to the app. Sends go through a background thread so the live
stream never waits on the network. Without WEBPUBSUB_ENDPOINT the app falls back to its
own /ws/console socket.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import threading

HUB = "console"
log = logging.getLogger("livecards")


class ConsoleBroadcast:
    def __init__(self, endpoint: str) -> None:
        from azure.messaging.webpubsubservice import WebPubSubServiceClient

        from livecards.agents.llm import _credential

        self.client = WebPubSubServiceClient(endpoint=endpoint, hub=HUB, credential=_credential())
        self.q: queue.Queue = queue.Queue(maxsize=2000)
        threading.Thread(target=self._sender, daemon=True).start()

    def _sender(self) -> None:
        while True:
            msg = self.q.get()
            try:
                self.client.send_to_all(json.loads(json.dumps(msg, default=str)),
                                        content_type="application/json")
            except Exception as exc:  # noqa: BLE001 - a dropped console update is not fatal
                log.warning("web pubsub send failed: %s", exc)

    def publish(self, msg: dict) -> None:
        try:
            self.q.put_nowait(msg)
        except queue.Full:
            log.warning("web pubsub queue full; dropping a console update")

    def client_url(self, minutes: int = 60) -> str:
        return self.client.get_client_access_token(minutes_to_expire=minutes)["url"]


_broadcast: ConsoleBroadcast | None = None
_checked = False


def broadcast() -> ConsoleBroadcast | None:
    global _broadcast, _checked
    if not _checked:
        _checked = True
        endpoint = os.environ.get("WEBPUBSUB_ENDPOINT")
        if endpoint:
            try:
                _broadcast = ConsoleBroadcast(endpoint)
            except Exception as exc:  # noqa: BLE001
                log.warning("web pubsub unavailable (%s); consoles use the app socket", exc)
    return _broadcast
