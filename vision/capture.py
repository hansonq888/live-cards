"""Capture a clean synthetic broadcast feed with ground truth, for measuring the vision layer.

Loads the viewer in capture mode (no ring, trail or graphics), pauses at a series of match
times, and saves the rendered frame plus where every player and the ball really are: pitch
metres from the simulator and the pixels the renderer drew them at.

    uv run python capture.py --base http://localhost:5180 --out data/synthetic
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist"]
HIDE_GRAPHICS = ("body * { visibility: hidden !important; } "
                 "canvas { visibility: visible !important; }")
# Ground-plane landmarks (pitch metres): corners, halfway line, penalty and goal areas.
LANDMARKS = [(x, y) for x in (-52.5, -36.0, -47.0, 0.0, 47.0, 36.0, 52.5)
             for y in (-34.0, -20.16, -9.16, 0.0, 9.16, 20.16, 34.0)]
# Spread across the match: open play, attacks both ways, set pieces, the hero goal.
DEFAULT_TIMES = [130, 610, 905, 1340, 1755, 1790, 2400, 2890, 3260, 3700, 3925, 3938,
                 4300, 4710, 5030, 5180, 5215, 5300]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5180")
    ap.add_argument("--out", default="data/synthetic")
    ap.add_argument("--times", default=",".join(map(str, DEFAULT_TIMES)))
    ap.add_argument("--per-start", type=int, default=3, help="frames per start, 2 s apart")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        for start in (float(x) for x in a.times.split(",")):
            page.goto(f"{a.base}/?capture=1&start={start}")
            page.wait_for_function("() => window.__livecards && window.__livecards.truth()",
                                   timeout=60_000)
            page.add_style_tag(content=HIDE_GRAPHICS)
            time.sleep(1.5)
            for _ in range(a.per_start):
                page.keyboard.press(" ")  # pause, so the frame and the truth agree exactly
                time.sleep(0.6)
                truth = page.evaluate("() => window.__livecards.truth()")
                truth["landmarks"] = [{"x": x, "y": y, "px": page.evaluate(
                    "([x, y]) => window.__livecards.project(x, y, 0)", [x, y])}
                    for x, y in LANDMARKS]
                truth["ball_px"] = page.evaluate(
                    "([x, y, z]) => window.__livecards.project(x, y, z)", truth["ball"])
                name = f"f{n:03d}"
                page.locator("canvas").first.screenshot(path=str(out / f"{name}.png"))
                (out / f"{name}.json").write_text(json.dumps(truth))
                n += 1
                page.keyboard.press(" ")  # play on
                time.sleep(2.0)
        browser.close()
    print(f"{n} frames -> {out}")


if __name__ == "__main__":
    main()
