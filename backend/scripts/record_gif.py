"""Record a GIF (or, with an .mp4 --out, a small looping video) of the live app for the README
and the Learn lessons (headless Chromium + ffmpeg).

    uv run --with playwright==1.48.0 python scripts/record_gif.py \
        --url "$BASE/?page=analyse&showme=e-1666" --wait .sm-hud --clip .an-stage \
        --seconds 16 --out ../docs/media/hero.gif
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist"]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--seconds", type=float, default=14)
    ap.add_argument("--fps", type=float, default=8)
    ap.add_argument("--width", type=int, default=960)
    ap.add_argument("--warmup", type=float, default=4)
    ap.add_argument("--js", default="", help="script to run after warm-up (e.g. set a language)")
    ap.add_argument("--wait", default=".card, .acard", help="selector to wait for before warm-up")
    ap.add_argument("--clip", default="", help="only record this element (CSS selector)")
    ap.add_argument("--click", default="", help="click this element after warm-up (e.g. a breakdown touch)")
    ap.add_argument("--css", default="", help="extra CSS for the recording (e.g. hide controls)")
    ap.add_argument("--after", default="", help="script to run after the click (e.g. slow the replay)")
    ap.add_argument("--out-fps", type=float, default=0, help="encode at this rate (time-lapse/slow-mo)")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    tmp = Path(tempfile.mkdtemp())
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(a.url)
        page.wait_for_selector(a.wait, timeout=90_000)
        if a.js:
            page.evaluate(a.js)
        if a.css:
            page.add_style_tag(content=a.css)
        time.sleep(a.warmup)
        if a.click:
            page.locator(a.click).first.click(force=True)
        if a.after:
            time.sleep(0.3)
            page.evaluate(a.after)
        n, t0 = 0, time.monotonic()
        while time.monotonic() - t0 < a.seconds:
            due = t0 + n / a.fps
            if (wait := due - time.monotonic()) > 0:
                time.sleep(wait)
            target = page.locator(a.clip) if a.clip else page
            target.screenshot(path=str(tmp / f"{n:04d}.png"))
            n += 1
        browser.close()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    fps = a.out_fps or n / a.seconds
    vf = f"fps={fps:.2f},scale={a.width}:-2:flags=lanczos"
    if out.suffix == ".mp4":  # small, loopable, plays inline in a <video muted loop>
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{fps:.2f}", "-i",
                        str(tmp / "%04d.png"), "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-crf", "26", "-movflags", "+faststart", "-an", str(out)], check=True)
        shutil.rmtree(tmp)
        print(f"{n} frames, {out.stat().st_size / 1e6:.1f} MB -> {out}")
        return
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{fps:.2f}", "-i",
                    str(tmp / "%04d.png"), "-vf", f"{vf},palettegen=stats_mode=diff",
                    str(tmp / "palette.png")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", f"{fps:.2f}", "-i",
                    str(tmp / "%04d.png"), "-i", str(tmp / "palette.png"), "-lavfi",
                    f"{vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4", str(out)],
                   check=True)
    shutil.rmtree(tmp)
    print(f"{n} frames, {out.stat().st_size / 1e6:.1f} MB -> {out}")


if __name__ == "__main__":
    main()
