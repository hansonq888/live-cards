"""Cut the final video from an edit list (video/edl.json).

Each entry: {"src": "out/card-hook.mp4" | "takes/journey.mov", "in": 0.0, "dur": 6.0,
             "frame": "PLAYS" | null, "kind": "screen" | "face" | "card",
             "vo": "takes/vo-3.m4a" | null, "keep_audio": false}
Screen takes and face clips go inside the themed frame (frame.py); cards play as they are.
Voice-over clips play from the start of their segment. Output: out/fifth-official-demo.mp4

    cd backend && uv run --with playwright==1.48.0 --with pillow python ../video/assemble.py
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent


def run(*args: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def main() -> None:
    edl = json.loads((HERE / "edl.json").read_text())
    tmp = Path(tempfile.mkdtemp())
    parts = []
    for i, e in enumerate(edl):
        src = HERE / e["src"]
        cut = tmp / f"cut{i:02d}.mp4"
        # 1. the picture: trimmed, 1080p, 30 fps, framed unless it's a card
        audio = ["-c:a", "aac"] if e.get("keep_audio") or e.get("kind") == "face" else ["-an"]
        run("-ss", str(e.get("in", 0)), "-t", str(e["dur"]), "-i", str(src),
            "-vf", "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
            *audio, "-c:v", "libx264", "-crf", "18", str(cut))
        if e.get("kind") in ("screen", "face"):
            subprocess.run(["uv", "run", "--with", "playwright==1.48.0", "--with", "pillow", "python",
                            str(HERE / "frame.py"), str(cut), e.get("frame") or "", e["kind"]], check=True,
                           cwd=HERE.parent / "backend")
            cut = HERE / "out" / f"framed-{cut.stem}.mp4"
        # 2. the sound: the voice-over clip (or the take's own audio for face clips), padded to length
        seg = tmp / f"seg{i:02d}.mp4"
        if e.get("vo"):
            run("-i", str(cut), "-i", str(HERE / e["vo"]), "-filter_complex",
                f"[1:a]apad,atrim=0:{e['dur']},aresample=48000[a]", "-map", "0:v", "-map", "[a]",
                "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-t", str(e["dur"]), str(seg))
        elif e.get("keep_audio") or e.get("kind") == "face":
            run("-i", str(cut), "-af", "aresample=48000", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", str(seg))
        else:
            run("-i", str(cut), "-f", "lavfi", "-t", str(e["dur"]), "-i", "anullsrc=r=48000:cl=stereo",
                "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", str(seg))
        parts.append(seg)
    lst = tmp / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    out = HERE / "out" / "fifth-official-demo.mp4"
    run("-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-crf", "18", "-c:a", "aac",
        "-movflags", "+faststart", str(out))
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)],
                         capture_output=True, text=True).stdout.strip()
    print(f"-> {out}  ({float(dur):.1f} s)")


if __name__ == "__main__":
    main()
