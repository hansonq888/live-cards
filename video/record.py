"""Render the title cards in cards.html to 1080p MP4s, frame by frame (exact timing).

    cd backend && uv run --with playwright==1.48.0 python ../video/record.py [scene ...]
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
SCENES = {"hook": 8.0, "three": 6.0, "numbers": 9.0, "end": 6.0}
FPS = 30


def main() -> None:
    names = sys.argv[1:] or list(SCENES)
    (HERE / "out").mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        for name in names:
            tmp = Path(tempfile.mkdtemp())
            page.goto(f"{(HERE / 'cards.html').as_uri()}?s={name}&capture=1")
            page.evaluate("document.fonts.ready")
            time.sleep(1.0)
            frames = int(SCENES[name] * FPS)
            for i in range(frames):
                page.evaluate(f"window.seek({i / FPS})")
                page.screenshot(path=str(tmp / f"{i:05d}.png"))
            out = HERE / "out" / f"card-{name}.mp4"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS), "-i",
                            str(tmp / "%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
                            "-movflags", "+faststart", str(out)], check=True)
            shutil.rmtree(tmp)
            print(f"{name}: {frames} frames -> {out}")
        browser.close()


if __name__ == "__main__":
    main()
