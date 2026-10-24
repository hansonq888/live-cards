"""Track players through a real clip for the Vision view (processed offline, played back in sync).

Pretrained YOLO finds people, ByteTrack keeps each one's identity from frame to frame, and the
shirt colour decides the team by majority vote over the whole track (so it doesn't flicker).
People not standing on the grass (bench, spectators) are dropped.

    uv run python track_clip.py ../web/public/vision/clip.mp4 ../web/public/vision/tracks.json
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict

import cv2
import numpy as np
from ultralytics import YOLO


def shirt(img: np.ndarray, box: list[float]) -> str:
    """'light' or 'dark' kit from the upper body, or 'other' (keepers, referees)."""
    x1, y1, x2, y2 = (int(v) for v in box)
    h, w = y2 - y1, x2 - x1
    torso = img[max(0, y1 + int(h * 0.18)): max(0, y1 + int(h * 0.5)),
                max(0, x1 + int(w * 0.2)): max(0, x2 - int(w * 0.2))]
    if torso.size == 0:
        return "other"
    hsv = cv2.cvtColor(torso, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(int)
    hsv = hsv[~((hsv[:, 0] > 35) & (hsv[:, 0] < 90) & (hsv[:, 1] > 60))]  # drop grass
    if len(hsv) < 4:
        return "other"
    # Bright, unsaturated pixels are a white kit; dark pixels a navy one. (Thresholds suit this
    # clip's green-tinted grade: whites read about V 140-160 here.)
    light = float(((hsv[:, 2] > 125) & (hsv[:, 1] < 70)).mean())
    dark = float((hsv[:, 2] < 100).mean())
    if max(light, dark) < 0.3:
        return "other"
    return "light" if light > dark else "dark"


def on_grass(img: np.ndarray, box: list[float]) -> bool:
    """Is the ground just below this person's feet green?"""
    x1, _, x2, y2 = (int(v) for v in box)
    h = img.shape[0]
    patch = img[min(h - 1, y2 + 2): min(h, y2 + 10), max(0, x1): max(0, x2)]
    if patch.size == 0:
        return True  # feet at the frame edge: keep
    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV).reshape(-1, 3)
    return float(((hsv[:, 0] > 30) & (hsv[:, 0] < 90) & (hsv[:, 1] > 40)).mean()) > 0.5


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out")
    ap.add_argument("--model", default="yolov8s.pt")
    ap.add_argument("--imgsz", type=int, default=1280)
    a = ap.parse_args()
    model = YOLO(a.model)
    cap = cv2.VideoCapture(a.video)
    fps = cap.get(cv2.CAP_PROP_FPS)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames, votes = [], defaultdict(Counter)
    i = 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        r = model.track(img, persist=True, tracker="bytetrack.yaml", imgsz=a.imgsz, conf=0.15,
                        classes=[0, 32], verbose=False)[0]
        people, ball = [], None
        if r.boxes.id is not None:
            for box, tid, cls, conf in zip(r.boxes.xyxy.tolist(), r.boxes.id.int().tolist(),
                                           r.boxes.cls.int().tolist(), r.boxes.conf.tolist(),
                                           strict=True):
                if cls == 32:
                    if ball is None or conf > ball[2]:
                        ball = [round((box[0] + box[2]) / 2), round((box[1] + box[3]) / 2), conf]
                elif on_grass(img, box):
                    votes[tid][shirt(img, box)] += 1
                    people.append([tid, *(round(v) for v in box)])
        frames.append({"t": round(i / fps, 3), "p": people, "b": ball[:2] if ball else None})
        i += 1
    team = {tid: c.most_common(1)[0][0] for tid, c in votes.items()}
    # Short-lived tracks are usually flicker; keep tracks seen in at least half a second.
    seen = Counter(p[0] for f in frames for p in f["p"])
    keep = {tid for tid, n in seen.items() if n >= fps / 2}
    for f in frames:
        f["p"] = [p + [team[p[0]]] for p in f["p"] if p[0] in keep]
    counts = Counter(team[t] for t in keep)
    json.dump({"fps": fps, "w": w, "h": h, "frames": frames,
               "summary": {"tracks": len(keep), "teams": dict(counts),
                           "ball_frames": sum(f["b"] is not None for f in frames),
                           "frames": len(frames)}},
              open(a.out, "w"), separators=(",", ":"))
    print(json.dumps({"frames": len(frames), "tracks": len(keep), "teams": dict(counts),
                      "avg_players_per_frame": round(np.mean([len(f["p"]) for f in frames]), 1),
                      "ball_frames": sum(f["b"] is not None for f in frames)}))


if __name__ == "__main__":
    main()
