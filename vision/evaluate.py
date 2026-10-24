"""Measure the vision layer against the simulator's ground truth.

For every captured frame (capture.py): run the layer, match detections to the players that are
really in the picture, and score detection, team split and pitch position in metres.

    uv run python evaluate.py --data data/synthetic --model yolov8s.pt
"""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

import cv2
import numpy as np
from scipy.optimize import linear_sum_assignment
from ultralytics import YOLO

from livevision import Detection, homography, place, to_pitch

ROOT = Path(__file__).resolve().parents[1]
# Pitch markings a line and ellipse finder could locate: line intersections (corners, box
# and goal-area corners, halfway line ends, centre spot) and points around the centre circle.
MARKINGS = sorted({(sx * x, sy * y) for sx in (-1, 1) for sy in (-1, 1)
                   for x, y in [(52.5, 34.0), (52.5, 20.16), (36.0, 20.16), (52.5, 9.16),
                                (47.0, 9.16), (0.0, 34.0), (0.0, 0.0)]}
                  | {(round(9.15 * np.cos(a), 2), round(9.15 * np.sin(a), 2))
                     for a in np.radians(np.arange(0, 360, 30))})
DRAW = {"RIV": (46, 16, 200), "NGT": (216, 78, 29), "GK": (24, 197, 245), None: (200, 200, 200)}


def degrade(img: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """A low-bitrate stream: half resolution and back, motion blur, sensor noise, JPEG q35."""
    h, w = img.shape[:2]
    out = cv2.resize(cv2.resize(img, (w // 2, h // 2), interpolation=cv2.INTER_AREA), (w, h))
    out = cv2.filter2D(out, -1, np.full((1, 5), 1 / 5))  # horizontal pan blur
    out = np.clip(out + rng.normal(0, 6, out.shape), 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 35])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def visible(truth: dict, w: int, h: int) -> list[dict]:
    out = []
    for p in truth["players"]:
        fx, fy = p["foot"]
        if 0 <= fx < w and 0 <= fy < h:
            p["px_h"] = fy - p["head"][1]
            p["label"] = "GK" if p["role"] == "GK" else p["team"]
            out.append(p)
    return out


def match(players: list[dict], dets: list[Detection]) -> list[tuple[dict, Detection]]:
    """One detection per player by foot-point distance, gated by the player's size."""
    if not players or not dets:
        return []
    cost = np.full((len(players), len(dets)), 1e6)
    for i, p in enumerate(players):
        gate = max(12.0, 0.45 * p["px_h"])
        for j, d in enumerate(dets):
            dist = float(np.hypot(d.foot[0] - p["foot"][0], d.foot[1] - p["foot"][1]))
            if dist <= gate:
                cost[i, j] = dist
    rows, cols = linear_sum_assignment(cost)
    return [(players[i], dets[j]) for i, j in zip(rows, cols, strict=True) if cost[i, j] < 1e6]


def band(px_h: float) -> str:
    return "near (>60 px tall)" if px_h > 60 else "mid (35-60 px)" if px_h >= 35 else "far (<35 px)"


def minimap(img: np.ndarray, pairs: list[tuple[dict, Detection]]) -> None:
    """Inset: true positions (rings) and where the vision layer put them (dots)."""
    w, h, ox, oy, s = 262, 170, 14, img.shape[0] - 184, 2.4
    cv2.rectangle(img, (ox, oy), (ox + w, oy + h), (30, 70, 34), -1)
    cv2.rectangle(img, (ox + 4, oy + 4), (ox + w - 4, oy + h - 4), (235, 235, 235), 1)
    cv2.line(img, (ox + w // 2, oy + 4), (ox + w // 2, oy + h - 4), (235, 235, 235), 1)

    def at(x: float, y: float) -> tuple[int, int]:
        return int(ox + w / 2 + x * s), int(oy + h / 2 - y * s)
    for p, d in pairs:
        col = DRAW[d.team]
        cv2.circle(img, at(p["x"], p["y"]), 5, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.line(img, at(p["x"], p["y"]), at(*d.pitch), (255, 255, 255), 1, cv2.LINE_AA)
        cv2.circle(img, at(*d.pitch), 3, col, -1, cv2.LINE_AA)
    cv2.putText(img, "o truth   * vision", (ox + 8, oy + h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4,
                (255, 255, 255), 1, cv2.LINE_AA)


def annotate(img: np.ndarray, dets: list[Detection],
             pairs: list[tuple[dict, Detection]]) -> np.ndarray:
    out = img.copy()
    for d in dets:
        x1, y1, x2, y2 = (int(v) for v in d.box)
        col = DRAW[d.team] if d.kind == "person" else (255, 255, 255)
        cv2.rectangle(out, (x1, y1), (x2, y2), col, 2)
        if d.kind == "person" and d.pitch:
            cv2.putText(out, f"{d.pitch[0]:.0f},{d.pitch[1]:.0f}", (x1, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.38, (255, 255, 255), 1, cv2.LINE_AA)
    minimap(out, pairs)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/synthetic")
    ap.add_argument("--model", default="yolov8s.pt")
    ap.add_argument("--device", default=None, help="cpu, mps or cuda (default: auto)")
    ap.add_argument("--sample", default="f031")
    ap.add_argument("--degrade", action="store_true", help="simulate a low-bitrate stream")
    ap.add_argument("--calib", choices=["camera", "markings"], default="camera",
                    help="camera: tracked broadcast head; markings: from pitch lines in shot")
    ap.add_argument("--calib-noise", type=float, default=0.0,
                    help="pixel error (sd) on the calibration points, like imperfect line finding")
    ap.add_argument("--out", default=str(ROOT / "docs" / "vision-results.json"))
    a = ap.parse_args()
    model = YOLO(a.model)
    if a.device:
        model.to(a.device)
    frames = sorted(Path(a.data).glob("f*.json"))
    rng = np.random.default_rng(7)
    fallback = 0
    n_true = n_det = n_hit = 0
    team_ok = team_n = 0
    errs: list[float] = []
    by_band: dict[str, list[int]] = {}
    ball_seen = ball_n = 0
    ms: list[float] = []
    for i, jf in enumerate(frames):
        truth = json.loads(jf.read_text())
        img = cv2.imread(str(jf.with_suffix(".png")))
        if a.degrade:
            img = degrade(img, rng)
        h, w = img.shape[:2]
        # Exact camera model from the renderer; the "markings" mode then sees only what's in shot.
        exact = homography([tuple(lm["px"]) for lm in truth["landmarks"]],
                           [(lm["x"], lm["y"]) for lm in truth["landmarks"]])
        marks = truth["landmarks"]
        if a.calib == "markings":
            inv = np.linalg.inv(exact)
            seen = [{"x": x, "y": y, "px": to_pitch(inv, (x, y))} for x, y in MARKINGS]
            seen = [m for m in seen if 0 <= m["px"][0] < w and 0 <= m["px"][1] < h]
            hull = cv2.convexHull(np.float32([(m["x"], m["y"]) for m in seen])) if seen else None
            if hull is not None and len(seen) >= 4 and cv2.contourArea(hull) >= 100:
                marks = seen
            else:  # too few markings in shot, or all on one line
                fallback += 1
        H = homography([tuple(np.add(lm["px"], rng.normal(0, a.calib_noise, 2)))
                        if a.calib_noise else tuple(lm["px"]) for lm in marks],
                       [(lm["x"], lm["y"]) for lm in marks])
        t0 = time.perf_counter()
        dets = place(model, img, H)
        if i:  # skip the first call (model warm-up)
            ms.append((time.perf_counter() - t0) * 1000)
        people = [d for d in dets if d.kind == "person"]
        players = visible(truth, w, h)
        pairs = match(players, people)
        n_true += len(players)
        n_det += len(people)
        n_hit += len(pairs)
        for p in players:
            b = by_band.setdefault(band(p["px_h"]), [0, 0])
            b[0] += 1
        for p, d in pairs:
            by_band[band(p["px_h"])][1] += 1
            team_n += 1
            team_ok += d.team == p["label"]
            errs.append(float(np.hypot(d.pitch[0] - p["x"], d.pitch[1] - p["y"])))
        bx, by = truth["ball_px"]
        if 0 <= bx < w and 0 <= by < h:
            ball_n += 1
            ball_seen += any(np.hypot(d.centre[0] - bx, d.centre[1] - by) < 12
                             for d in dets if d.kind == "ball")
        if jf.stem == a.sample and not a.degrade and not a.calib_noise:
            cv2.imwrite(str(ROOT / "docs" / "media" / "vision-sample.jpg"),
                        annotate(img, dets, pairs), [cv2.IMWRITE_JPEG_QUALITY, 88])
    errs.sort()
    res = {
        "model": a.model, "calibration": a.calib, "degraded": a.degrade,
        "calib_noise_px": a.calib_noise,
        "frames": len(frames), "players_in_frame": n_true,
        "person_detections": n_det, "matched": n_hit,
        "recall": round(n_hit / n_true, 3), "precision": round(n_hit / n_det, 3) if n_det else None,
        "recall_by_size": {k: {"players": v[0], "recall": round(v[1] / v[0], 3)}
                           for k, v in sorted(by_band.items())},
        "team_accuracy": round(team_ok / team_n, 3) if team_n else None,
        "position_error_m": {"median": round(statistics.median(errs), 2),
                             "p90": round(errs[int(len(errs) * 0.9)], 2),
                             "max": round(errs[-1], 2)},
        "ball_detected": f"{ball_seen}/{ball_n}",
        "frames_without_enough_markings": fallback if a.calib == "markings" else None,
        "ms_per_frame_median": round(statistics.median(ms), 1) if ms else None,
        "device": str(model.device),
    }
    Path(a.out).write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
