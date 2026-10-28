"""Put a take inside the themed frame (frame.html): brand gradient, lime bolt, section label.

    cd backend && uv run --with playwright==1.48.0 --with pillow python ../video/frame.py \
        takes/3.mov PLAYS [screen|face]
Writes out/framed-<name>.mp4 (1080p, 30 fps, audio kept).
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent


def main() -> None:
    src, label = Path(sys.argv[1]), sys.argv[2]
    kind = sys.argv[3] if len(sys.argv) > 3 else "screen"
    src = src if src.is_absolute() else HERE / src
    tmp = Path(tempfile.mkdtemp())
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": 1920, "height": 1080})
        page.goto(f"{(HERE / 'frame.html').as_uri()}?label={label}&kind={kind}")
        page.evaluate("document.fonts.ready")
        time.sleep(1.2)
        page.screenshot(path=str(tmp / "bg.png"))
        hole = page.evaluate("window.hole")
        b.close()
    w, h = hole["w"], hole["h"]
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], 22, fill=255)
    mask.save(tmp / "mask.png")
    out = HERE / "out" / f"framed-{src.stem}.mp4"
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                         capture_output=True, text=True, check=True).stdout.strip()
    # Fill the window (crop any non-16:9 edges), round the corners, lay it on the frame.
    vf = (f"[1:v]fps=30,scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},format=rgba[v];"
          f"[2:v]format=gray[m];[v][m]alphamerge[vr];[0:v][vr]overlay={hole['x']}:{hole['y']}:shortest=1,format=yuv420p")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", dur, "-i", str(tmp / "bg.png"), "-i", str(src),
                    "-loop", "1", "-t", dur, "-i", str(tmp / "mask.png"), "-filter_complex", vf, "-map", "1:a?",
                    "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-movflags", "+faststart", str(out)], check=True)
    print("->", out)


if __name__ == "__main__":
    main()
