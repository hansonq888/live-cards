"""Pure metric formulas. Every number on screen traces back to a function here.

Coordinates are converted to an "attack frame" (x toward the goal the team attacks)
with `attack_dir` = +1 for the home side and -1 for the away side.
"""

from __future__ import annotations

import math

from livecards.contracts import GOAL_HALF_WIDTH, HALF_LENGTH

SPRINT_KMH = 25.2  # sprint: at least 1 s at or above this speed
HIGH_INTENSITY_KMH = 19.8  # high-intensity run: at least 1 s at or above this speed
ALERT_SPRINT_KMH = 32.0  # on-screen sprint alert
FINAL_THIRD_X = HALF_LENGTH - 35.0  # attack-frame x where the final third starts (17.5)
FORWARD_PASS_M = 5.0  # progress toward goal for a pass to count as forward
BIG_CHANCE_XG = 0.30


def kmh(mps: float) -> float:
    return mps * 3.6


def to_attack(x: float, y: float, attack_dir: int) -> tuple[float, float]:
    return x * attack_dir, y * attack_dir


def xg(x: float, y: float, attack_dir: int) -> float:
    """Chance quality (0-1) from shot distance and the angle the goal mouth subtends.

    logistic(-1.1 + 1.6 * angle_rad - 0.075 * distance_m)
    e.g. penalty spot ~0.31, 6 m central ~0.57, 25 m central ~0.08.
    """
    ax, ay = to_attack(x, y, attack_dir)
    dx, dy = HALF_LENGTH - ax, ay
    dist = math.hypot(dx, dy)
    angle = math.atan2(2 * GOAL_HALF_WIDTH * dx, dx * dx + dy * dy - GOAL_HALF_WIDTH**2)
    if angle < 0:
        angle += math.pi
    return round(1 / (1 + math.exp(-(-1.1 + 1.6 * angle - 0.075 * dist))), 3)


def shot_distance(x: float, y: float, attack_dir: int) -> float:
    ax, ay = to_attack(x, y, attack_dir)
    return round(math.hypot(HALF_LENGTH - ax, ay), 1)


def pass_distance(x: float, y: float, end_x: float, end_y: float) -> float:
    return round(math.hypot(end_x - x, end_y - y), 1)


def pass_progress(x: float, end_x: float, attack_dir: int) -> float:
    """Metres gained toward the opponent goal."""
    return round((end_x - x) * attack_dir, 1)


def pass_difficulty(x: float, y: float, end_x: float, end_y: float, attack_dir: int,
                    under_pressure: bool, kind: str | None = None) -> float:
    """Pass difficulty on a 1-10 scale.

    1 + min(4, distance/10) + min(2, progress/15) + 1.5 if under pressure
      + 1.0 if it ends in the final third + 0.5 for a cross or through ball
    """
    d = pass_distance(x, y, end_x, end_y)
    prog = max(0.0, pass_progress(x, end_x, attack_dir))
    score = 1.0 + min(4.0, d / 10) + min(2.0, prog / 15)
    if under_pressure:
        score += 1.5
    if end_x * attack_dir >= FINAL_THIRD_X:
        score += 1.0
    if kind in ("cross", "through"):
        score += 0.5
    return round(min(10.0, score), 1)


def in_own_half(x: float, attack_dir: int) -> bool:
    return x * attack_dir < 0
