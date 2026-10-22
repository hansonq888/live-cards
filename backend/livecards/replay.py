"""Replay a simulated match as a live stream: events and frames in time order.

`stream()` is the in-process stand-in for Event Hubs: the same ordering contract
(events at time t arrive before the frame at time t) holds for the cloud feed.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Callable, Iterator
from dataclasses import dataclass

from livecards.contracts import Event
from livecards.engine.engine import MatchEngine
from livecards.sim.match import Match


@dataclass
class Tick:
    i: int  # frame index
    t: float
    events: list[Event]


def ticks(match: Match, start: float = 0.0, end: float | None = None) -> Iterator[Tick]:
    """Yield one Tick per frame with the events that happened since the previous frame."""
    events = match.events
    j = 0
    end = match.meta.duration if end is None else end
    for i in range(len(match)):
        t = float(match.times[i])
        batch = []
        while j < len(events) and events[j].t <= t + 1e-6:
            batch.append(events[j])
            j += 1
        if t < start:
            continue
        if t >= end:
            break
        yield Tick(i, t, batch)


def positions(match: Match, i: int) -> Iterator[tuple[str, float, float, float]]:
    ids = match.ids_at(i)
    p = match.pos[i]
    for k, pid in enumerate(ids):
        yield pid, float(p[k, 0]), float(p[k, 1]), float(p[k, 2])


def feed(engine: MatchEngine, match: Match, tick: Tick) -> list:
    """Push one tick through the engine; returns the moments it produced."""
    out = []
    for e in tick.events:
        out.extend(engine.on_event(e))
    out.extend(engine.on_positions(tick.t, positions(match, tick.i)))
    return out


def run_engine(match: Match, engine: MatchEngine | None = None,
               on_tick: Callable[[Tick, list], None] | None = None) -> MatchEngine:
    """Run a whole match through the engine as fast as possible."""
    engine = engine or MatchEngine(match.meta)
    for tick in ticks(match):
        moments = feed(engine, match, tick)
        if on_tick:
            on_tick(tick, moments)
    return engine


async def stream(match: Match, speed: float = 1.0, start: float = 0.0,
                 end: float | None = None) -> AsyncIterator[Tick]:
    """Replay in wall-clock time at `speed`x (1x-20x for the demo; larger for tests)."""
    t0_wall = time.monotonic()
    for tick in ticks(match, start, end):
        due = t0_wall + (tick.t - start) / speed
        delay = due - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)
        yield tick
