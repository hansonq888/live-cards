"""Match feed over Azure Event Hubs: the simulator publishes, the engine ingests.

Messages (all on one partition key per match, so order is kept):
  meta    match metadata, lineups, and how many messages make up the match
  events  up to 200 events
  frames  50 tracking frames (5 s at 10 fps), zlib-compressed
Bodies are zlib-compressed JSON; every message carries `match_id` and `seq` properties so a
reader can de-duplicate replays and tell when it has the whole match.
"""

from __future__ import annotations

import json
import logging
import os
import time
import zlib

import numpy as np

from livecards.contracts import Event, MatchMeta
from livecards.sim.match import Match

FRAMES_PER_MSG = 50
EVENTS_PER_MSG = 200
log = logging.getLogger("livecards")


def encode(match: Match) -> list[tuple[str, dict]]:
    out: list[tuple[str, dict]] = []
    for k in range(0, len(match.events), EVENTS_PER_MSG):
        out.append(("events", {"events": [e.model_dump(exclude_none=True)
                                          for e in match.events[k:k + EVENTS_PER_MSG]]}))
    for i in range(0, len(match), FRAMES_PER_MSG):
        j = min(i + FRAMES_PER_MSG, len(match))
        out.append(("frames", {"i0": i, "times": np.round(match.times[i:j], 1).tolist(),
                               "ball": np.round(match.ball[i:j], 2).tolist(),
                               "pos": np.round(match.pos[i:j], 2).tolist(),
                               "lineup_idx": match.lineup_idx[i:j].tolist()}))
    meta = {"meta": match.meta.model_dump(), "lineups": match.lineups, "n_frames": len(match),
            "n_msgs": len(out) + 1}
    return [("meta", meta), *out]


def decode(messages: list[tuple[str, dict]]) -> Match:
    meta = next(p for k, p in messages if k == "meta")
    n = meta["n_frames"]
    times = np.zeros(n)
    ball = np.zeros((n, 3), dtype=np.float32)
    pos = np.zeros((n, 22, 3), dtype=np.float32)
    lineup_idx = np.zeros(n, dtype=np.int16)
    events: list[Event] = []
    for kind, p in messages:
        if kind == "events":
            events += [Event.model_validate(e) for e in p["events"]]
        elif kind == "frames":
            i, j = p["i0"], p["i0"] + len(p["times"])
            times[i:j], ball[i:j], pos[i:j] = p["times"], p["ball"], p["pos"]
            lineup_idx[i:j] = p["lineup_idx"]
    events.sort(key=lambda e: (e.t, int(e.id.split("-")[1])))
    return Match(MatchMeta.model_validate(meta["meta"]), events, times, ball, pos,
                 meta["lineups"], lineup_idx)


def _body(kind: str, payload: dict) -> bytes:
    return zlib.compress(json.dumps(payload, separators=(",", ":")).encode(), 6)


def publish(match: Match, namespace: str, hub: str, credential) -> int:
    """Simulator side: send the whole match into Event Hubs. Returns messages sent."""
    from azure.eventhub import EventData, EventHubProducerClient

    msgs = encode(match)
    mid = match.meta.match_id
    with EventHubProducerClient(namespace, hub, credential) as producer:
        batch = producer.create_batch(partition_key=mid)
        for seq, (kind, payload) in enumerate(msgs):
            ev = EventData(_body(kind, payload))
            ev.properties = {"match_id": mid, "seq": seq, "kind": kind}
            try:
                batch.add(ev)
            except ValueError:  # batch full: send it and start another
                producer.send_batch(batch)
                batch = producer.create_batch(partition_key=mid)
                batch.add(ev)
        producer.send_batch(batch)
    return len(msgs)


def ingest(match_id: str, namespace: str, hub: str, credential, timeout_s: float = 60) -> Match | None:
    """Engine side: read the match back from Event Hubs. None if it isn't complete in time."""
    import threading

    from azure.eventhub import EventHubConsumerClient

    got: dict[int, tuple[str, dict]] = {}
    need: list[int] = []
    done = threading.Event()
    client = EventHubConsumerClient(namespace, hub, "$Default", credential)

    def prop(props: dict, key: str):
        v = props.get(key.encode(), props.get(key))
        return v.decode() if isinstance(v, bytes) else v

    def on_batch(_ctx, batch) -> None:
        for ev in batch:
            if prop(ev.properties, "match_id") != match_id:
                continue
            kind = prop(ev.properties, "kind")
            payload = json.loads(zlib.decompress(b"".join(ev.body)))
            got[int(prop(ev.properties, "seq"))] = (kind, payload)
            if kind == "meta":
                need[:] = [payload["n_msgs"]]
        if need and len(got) >= need[0]:
            done.set()

    # Closing the client from inside its own callback deadlocks, so receive on a worker
    # thread and stop it from here.
    worker = threading.Thread(target=lambda: client.receive_batch(
        on_event_batch=on_batch, starting_position="-1", max_batch_size=300, max_wait_time=3),
        daemon=True)
    worker.start()
    done.wait(timeout_s)
    client.close()
    worker.join(10)
    if not need or len(got) < need[0]:
        return None
    return decode([got[s] for s in sorted(got)])


def load_via_event_hubs(seed: int, simulate_fn) -> Match | None:
    """Ingest the match from Event Hubs, publishing it first if the feed is empty."""
    namespace, hub = os.environ.get("EVENTHUB_NAMESPACE"), os.environ.get("EVENTHUB_NAME")
    if not namespace or not hub:
        return None
    from livecards.agents.llm import _credential

    cred = _credential()
    mid = f"syn-{seed}"
    try:
        t0 = time.monotonic()
        match = ingest(mid, namespace, hub, cred, timeout_s=25)
        if match is None:
            n = publish(simulate_fn(seed), namespace, hub, cred)
            log.info("published %s to Event Hubs in %d messages", mid, n)
            match = ingest(mid, namespace, hub, cred, timeout_s=90)
        if match is not None:
            log.info("ingested %s from Event Hubs in %.1fs", mid, time.monotonic() - t0)
        return match
    except Exception as exc:  # noqa: BLE001 - the demo must never depend on the feed
        log.warning("Event Hubs feed unavailable (%s); simulating locally", exc)
        return None
