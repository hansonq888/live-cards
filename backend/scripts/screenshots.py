"""README screenshots, driven in headless Chromium against a running local app.

    uv run --with playwright==1.48.0 python scripts/screenshots.py --base http://localhost:5180
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist"]
OUT = Path(__file__).resolve().parents[2] / "docs" / "media"

SET_SELECT = """([sel, i, v]) => { const el = document.querySelectorAll(sel)[i];
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('change', {bubbles: true})); }"""


def tab(page, name: str) -> None:
    page.locator(".tabs button", has_text=name).first.click()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:5180")
    base = ap.parse_args().base
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        console = b.new_page(viewport={"width": 1440, "height": 900})
        console.goto(f"{base}/?view=console")

        # Studio + Analyst + your model, just after the hero goal.
        s = b.new_page(viewport={"width": 1600, "height": 900})
        s.goto(f"{base}/?view=studio&start=3942")
        s.wait_for_selector(".card", timeout=60_000)
        time.sleep(12)  # play through the goal so its lines are explained in this session
        s.evaluate(SET_SELECT, ["header .profile select", 0, "analyst"])
        tab(s, "Model")
        s.wait_for_selector(".ym-w")
        s.evaluate("""() => { const row = [...document.querySelectorAll('.ym-w')]
              .find(l => l.textContent.includes('pass completed under pressure'));
            const inp = row.querySelector('input');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, '0');
            inp.dispatchEvent(new Event('input', {bubbles: true})); }""")
        s.locator(".ym-actions button", has_text="Run my model").click()
        s.wait_for_selector(".ac-compare", timeout=60_000)
        time.sleep(1.5)
        s.locator(".fan-bar button.round, .controls button").first.click()  # pause
        time.sleep(1)
        s.screenshot(path=str(OUT / "studio-analyst.png"))

        # Red team, after the goal (needs an explained moment).
        s.locator(".controls button", has_text="Play").first.click()
        s.locator(".controls button.danger").click()
        s.wait_for_selector(".rt-ok", timeout=60_000)
        time.sleep(1.5)
        s.screenshot(path=str(OUT / "redteam.png"))

        # Fans tab: the same moment for four fans (Spanish viewer).
        f = b.new_page(viewport={"width": 1600, "height": 900})
        f.goto(f"{base}/?view=studio&start=3940")
        f.wait_for_selector(".card", timeout=60_000)
        f.evaluate(SET_SELECT, ["header .profile select", 1, "es"])
        tab(f, "Fans")
        f.wait_for_selector(".fan:not(.base)", timeout=90_000)
        time.sleep(2)
        f.screenshot(path=str(OUT / "fans-es.png"))

        # Console with the audit log the sessions above produced.
        time.sleep(1)
        console.screenshot(path=str(OUT / "console.png"))
        b.close()
    print("wrote", sorted(x.name for x in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
