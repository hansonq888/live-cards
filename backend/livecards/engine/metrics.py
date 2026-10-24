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
# xG: logistic(XG_INTERCEPT + XG_ANGLE * angle_rad + XG_DISTANCE * distance_m)
XG_INTERCEPT, XG_ANGLE, XG_DISTANCE = -1.1, 1.6, -0.075
# Pass difficulty (1-10): capped points for distance and ground gained, plus fixed extras.
PD_DIST_PER_POINT, PD_DIST_CAP = 10.0, 4.0  # one point per 10 m, at most 4
PD_GAIN_PER_POINT, PD_GAIN_CAP = 15.0, 2.0  # one point per 15 m gained, at most 2
PD_PRESSURE, PD_FINAL_THIRD, PD_CROSS_OR_THROUGH = 1.5, 1.0, 0.5


def kmh(mps: float) -> float:
    return mps * 3.6


def to_attack(x: float, y: float, attack_dir: int) -> tuple[float, float]:
    return x * attack_dir, y * attack_dir


def xg(x: float, y: float, attack_dir: int) -> float:
    """Chance quality (0-1) from shot distance and the angle the goal mouth subtends.

    logistic(-1.1 + 1.6 * angle_rad - 0.075 * distance_m)
    e.g. penalty spot 0.29, 6 m central 0.55, 25 m central 0.075.
    """
    ax, ay = to_attack(x, y, attack_dir)
    dx, dy = HALF_LENGTH - ax, ay
    dist = math.hypot(dx, dy)
    angle = math.atan2(2 * GOAL_HALF_WIDTH * dx, dx * dx + dy * dy - GOAL_HALF_WIDTH**2)
    if angle < 0:
        angle += math.pi
    return round(1 / (1 + math.exp(-(XG_INTERCEPT + XG_ANGLE * angle + XG_DISTANCE * dist))), 3)


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
    score = (1.0 + min(PD_DIST_CAP, d / PD_DIST_PER_POINT)
             + min(PD_GAIN_CAP, prog / PD_GAIN_PER_POINT))
    if under_pressure:
        score += PD_PRESSURE
    if end_x * attack_dir >= FINAL_THIRD_X:
        score += PD_FINAL_THIRD
    if kind in ("cross", "through"):
        score += PD_CROSS_OR_THROUGH
    return round(min(10.0, score), 1)


def in_own_half(x: float, attack_dir: int) -> bool:
    return x * attack_dir < 0
