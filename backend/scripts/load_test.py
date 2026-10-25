"""Load test: how many viewers can one server process stream live, in real time?

Each viewer is a WebSocket to /ws/live, and each gets its own live session (its own engine,
auto-director and replay clock), exactly as a browser does. For every concurrency level we hold
N viewers for a fixed window and measure, per viewer:

- real-time ratio: match seconds received per wall-clock second (1.00 = keeping up);
- frame gaps: time between position frames (the server aims for one every 50 ms);
- connections that failed or dropped.

Run a server with AI calls off (no model cost, and it isolates the streaming path), then:

    FOUNDRY_PROJECT_ENDPOINT= uv run uvicorn livecards.server.app:app --port 8020
    uv run python scripts/load_test.py --url ws://127.0.0.1:8020 --levels 25 50 100 200 --hold 20

Writes docs/load-test.md and docs/load-test.json.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import subprocess
import time
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parents[2]


def pct(xs: list[float], q: float) -> float:
    if not xs:
        return float("nan")
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(q * len(xs)))]


async def viewer(url: str, start: float, hold: float, ready: asyncio.Event) -> dict:
    gaps: list[float] = []
    first = last_t = None
    t0 = last_arrival = None
    frames = 0
    try:
        async with websockets.connect(f"{url}/ws/live?speed=1&start={start}", max_size=None,
                                      open_timeout=30) as ws:
            await ready.wait()  # every viewer starts the measured window together
            warm = time.monotonic() + 2.0  # drain frames queued before the window opened
            while time.monotonic() < warm:
                await asyncio.wait_for(ws.recv(), timeout=10)
            t0 = time.monotonic()
            while time.monotonic() - t0 < hold:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if msg.get("type") != "frame":
                    continue
                arrival = time.monotonic()
                if last_arrival is not None:
                    gaps.append((arrival - last_arrival) * 1000)
                last_arrival = arrival
                first = msg["t"] if first is None else first
                last_t = msg["t"]
                frames += 1
        wall = time.monotonic() - t0
        ratio = (last_t - first) / wall if frames > 1 and wall > 0 else 0.0
        return {"ok": True, "ratio": ratio, "gaps": gaps, "frames": frames}
    except Exception as e:  # noqa: BLE001 - any failure counts as a failed viewer
        return {"ok": False, "error": type(e).__name__}


def cpu_seconds(port: int) -> float | None:
    """Total CPU time used so far by the process listening on the port (via lsof + ps)."""
    try:
        pid = subprocess.run(["lsof", "-ti", f"tcp:{port}", "-sTCP:LISTEN"], capture_output=True,
                             text=True).stdout.split()[0]
        out = subprocess.run(["ps", "-o", "time=", "-p", pid], capture_output=True, text=True).stdout.strip()
        parts = [float(x) for x in out.replace("-", ":").split(":")]
        sec = 0.0
        for x in parts:
            sec = sec * 60 + x
        return sec
    except (IndexError, ValueError):
        return None


async def level(url: str, n: int, hold: float, port: int) -> dict:
    ready = asyncio.Event()
    # Stagger the openings a little, like real viewers, then measure them all at once.
    tasks = []
    for k in range(n):
        tasks.append(asyncio.create_task(viewer(url, 1500 + (k % 30) * 60, hold, ready)))
        await asyncio.sleep(0.01)
    await asyncio.sleep(2.0)
    ready.set()
    await asyncio.sleep(2.0)  # the viewers' warm-up
    c0, w0 = cpu_seconds(port), time.monotonic()
    await asyncio.sleep(hold * 0.8)
    c1, w1 = cpu_seconds(port), time.monotonic()
    cpu = round(100 * (c1 - c0) / (w1 - w0), 1) if c0 is not None and c1 is not None else None
    rows = await asyncio.gather(*tasks)
    ok = [r for r in rows if r["ok"]]
    gaps = [g for r in ok for g in r["gaps"]]
    ratios = [r["ratio"] for r in ok]
    return {
        "viewers": n, "connected": len(ok), "failed": n - len(ok),
        "realtime_ratio_median": round(statistics.median(ratios), 3) if ratios else None,
        "realtime_ratio_min": round(min(ratios), 3) if ratios else None,
        "frame_gap_ms_p50": round(pct(gaps, 0.50), 1), "frame_gap_ms_p95": round(pct(gaps, 0.95), 1),
        "frame_gap_ms_p99": round(pct(gaps, 0.99), 1),
        "frames_per_viewer_per_s": round(statistics.mean(r["frames"] for r in ok) / hold, 1) if ok else 0,
        "server_cpu_pct": cpu,
    }


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="ws://127.0.0.1:8020")
    ap.add_argument("--levels", type=int, nargs="+", default=[25, 50, 100, 200])
    ap.add_argument("--hold", type=float, default=20.0)
    args = ap.parse_args()
    port = int(args.url.rsplit(":", 1)[1])
    results = []
    for n in args.levels:
        r = await level(args.url, n, args.hold, port)
        print(json.dumps(r))
        results.append(r)
        await asyncio.sleep(3)  # let the server settle between levels
    (ROOT / "docs" / "load-test.json").write_text(json.dumps(results, indent=2))
    md = ["# Load test", "",
          ("One server process (uvicorn, one worker) on a laptop, AI calls off. Every viewer is a "
           "WebSocket with its own live session: its own engine, auto-director and replay clock. "
           f"Each level holds its viewers for {args.hold:.0f} s after a 2 s warm-up. Server CPU is "
           "measured over the window (100% = one core). Generated by "
           "`backend/scripts/load_test.py`."), "",
          "| Viewers | Connected | Real-time ratio (median / worst) | Frame gap p50 / p95 / p99 | Frames per viewer per s | Server CPU |",
          "|---|---|---|---|---|---|"]
    for r in results:
        md.append(f"| {r['viewers']} | {r['connected']} | {r['realtime_ratio_median']} / {r['realtime_ratio_min']} | "
                  f"{r['frame_gap_ms_p50']} / {r['frame_gap_ms_p95']} / {r['frame_gap_ms_p99']} ms | "
                  f"{r['frames_per_viewer_per_s']} | {r['server_cpu_pct']}% |")
    md += ["", "A real-time ratio of 1.00 means the match plays at true speed for that viewer; "
           "below 1 the server can no longer keep every session's clock up."]
    (ROOT / "docs" / "load-test.md").write_text("\n".join(md) + "\n")


if __name__ == "__main__":
    asyncio.run(main())
