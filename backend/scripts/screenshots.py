"""README screenshots, driven in headless Chromium against a running app (the live site gives
the real AI lines and agent traces).

    uv run --with playwright==1.48.0 python scripts/screenshots.py --base https://<your-app>
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist"]
OUT = Path(__file__).resolve().parents[2] / "docs" / "media"


def shot(page, name: str, selector: str | None = None) -> None:
    (page.locator(selector).first if selector else page).screenshot(path=str(OUT / f"{name}.png"))
    print("saved", name)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(args=ARGS)
        page = b.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1)

        page.goto(f"{a.base}/")
        page.wait_for_selector(".lp-bust", timeout=60_000)
        page.evaluate("document.fonts.ready")
        time.sleep(2)
        shot(page, "home")

        # Show me: the hero goal replayed on the tactics board, mid-move.
        page.goto(f"{a.base}/?page=analyse&showme=e-1666")
        page.wait_for_selector(".sm-hud", timeout=90_000)
        for _ in range(60):
            if "long ball" in (page.locator(".sm-cap").inner_text() or ""):
                break
            time.sleep(0.5)
        time.sleep(1.2)
        shot(page, "showme", ".an-stage")

        # Follow a player with every ring coloured by work rate.
        page.goto(f"{a.base}/?page=analyse&start=3000")
        page.wait_for_selector(".board-mini", timeout=90_000)
        time.sleep(3)
        page.locator(".board-mini").click()
        time.sleep(1.5)
        box = page.locator(".board-main canvas").bounding_box()
        for _ in range(4):
            page.mouse.click(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
            time.sleep(2.5)
            if page.locator(".follow-card").count():
                break
        page.locator(".board-mini-back").click()
        time.sleep(1)
        page.mouse.move(500, 300)
        page.locator(".sc-toggle").click()
        page.locator(".sc-opts button", has_text="Engine").click()
        time.sleep(2)
        page.mouse.move(1300, 880)
        time.sleep(1)
        page.screenshot(path=str(OUT / "follow.png"), clip={"x": 0, "y": 64, "width": 1440, "height": 640})
        print("saved follow")
        page.locator(".stat-chips .sc-x").click()

        # Agents tab: play into the 65' goal, then plant a lie and let the checks catch it.
        page.goto(f"{a.base}/?page=analyse&start=3900")
        page.wait_for_selector(".bd-tabs", timeout=90_000)
        page.locator(".bd-tabs button", has_text="Agents").click()
        time.sleep(35)
        page.locator(".at-red").click()
        for _ in range(60):
            if page.locator(".at-row.red").count():
                break
            time.sleep(1)
        time.sleep(1)
        page.locator(".board.all").scroll_into_view_if_needed()
        if page.locator(".an-pip-close").count():
            page.locator(".an-pip-close").click()  # keep the corner video out of the shot
            time.sleep(0.5)
        shot(page, "agents", ".board.all")

        page.goto(f"{a.base}/?page=play&play=e-1666")
        page.wait_for_selector(".sp-step", timeout=90_000)
        time.sleep(3)
        page.locator(".sp-step").nth(2).scroll_into_view_if_needed()
        time.sleep(2.5)
        shot(page, "story")

        page.goto(f"{a.base}/?page=players")
        page.wait_for_selector(".lu-p", timeout=60_000)
        time.sleep(1.5)
        page.mouse.wheel(0, 380)
        time.sleep(1)
        shot(page, "players")

        page.goto(f"{a.base}/?page=learn#xg")
        page.wait_for_selector(".xt-pitch", timeout=60_000)
        time.sleep(1.5)
        bb = page.locator(".xt-pitch").bounding_box()
        page.mouse.click(bb["x"] + bb["width"] * 0.55, bb["y"] + bb["height"] * 0.22)
        time.sleep(1.2)
        shot(page, "learn")

        page.goto(f"{a.base}/?view=console")
        time.sleep(6)
        shot(page, "console")
        b.close()


if __name__ == "__main__":
    main()
