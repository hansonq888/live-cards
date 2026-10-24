"""Vision layer: find players and the ball in a broadcast frame and place them on the pitch.

Pretrained YOLO (no training) finds people and the ball; kit colour splits the teams; a
ground-plane homography turns each player's feet into pitch metres, the same coordinates the
simulator and the stats engine use. Output is the engine's position-frame contract, so a match
without a tracking system could feed Live Cards from its broadcast picture.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# Kit hues (OpenCV H, 0-180): Riverside red, Northgate blue, goalkeeper yellow.
KITS = {"RIV": (0, 175), "NGT": (112,), "GK": (25,)}


@dataclass
class Detection:
    box: tuple[float, float, float, float]  # x1, y1, x2, y2 in pixels
    conf: float
    kind: str  # "person" | "ball"
    team: str | None = None
    pitch: tuple[float, float] | None = None  # metres, once placed

    @property
    def foot(self) -> tuple[float, float]:
        x1, _, x2, y2 = self.box
        return (x1 + x2) / 2, y2

    @property
    def centre(self) -> tuple[float, float]:
        x1, y1, x2, y2 = self.box
        return (x1 + x2) / 2, (y1 + y2) / 2


def detect(model, img: np.ndarray, conf: float = 0.15, imgsz: int = 1280) -> list[Detection]:
    """People and the ball from one frame (COCO classes 0 and 32)."""
    r = model.predict(img, conf=conf, imgsz=imgsz, classes=[0, 32], verbose=False)[0]
    out = []
    for box, c, cls in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist(),
                           strict=True):
        out.append(Detection(tuple(box), float(c), "ball" if int(cls) == 32 else "person"))
    return out


def kit_team(img: np.ndarray, d: Detection) -> str | None:
    """Team from the shirt: the dominant saturated, non-grass hue in the upper body."""
    x1, y1, x2, y2 = (int(round(v)) for v in d.box)
    h, w = y2 - y1, x2 - x1
    torso = img[max(0, y1 + int(h * 0.15)): max(0, y1 + int(h * 0.55)),
                max(0, x1 + int(w * 0.15)): max(0, x2 - int(w * 0.15))]
    if torso.size == 0:
        return None
    hsv = cv2.cvtColor(torso, cv2.COLOR_BGR2HSV).reshape(-1, 3).astype(int)
    grass = (hsv[:, 0] > 35) & (hsv[:, 0] < 90)
    keep = hsv[(hsv[:, 1] > 90) & (hsv[:, 2] > 60) & ~grass]
    if len(keep) < 3:
        return None
    hue = np.median(keep[:, 0])

    def dist(target: int) -> float:
        d = abs(hue - target)
        return min(d, 180 - d)
    return min(KITS, key=lambda k: min(dist(t) for t in KITS[k]))


def homography(pixels: list[tuple[float, float]], metres: list[tuple[float, float]]) -> np.ndarray:
    """Image -> pitch mapping of the grass plane from 4+ known points (a calibrated camera,
    or pitch-line intersections found in the picture)."""
    H, _ = cv2.findHomography(np.float32(pixels), np.float32(metres))
    return H


def to_pitch(H: np.ndarray, px: tuple[float, float]) -> tuple[float, float]:
    p = H @ np.array([px[0], px[1], 1.0])
    return float(p[0] / p[2]), float(p[1] / p[2])


def place(model, img: np.ndarray, H: np.ndarray) -> list[Detection]:
    """The whole layer for one frame: detect, split teams, place on the pitch."""
    dets = detect(model, img)
    for d in dets:
        if d.kind == "person":
            d.team = kit_team(img, d)
            d.pitch = to_pitch(H, d.foot)
        else:
            d.pitch = to_pitch(H, d.foot)
    return dets
