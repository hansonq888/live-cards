"""Space control: which team would win the race to each part of the pitch.

A simplified time-to-reach model, in the spirit of published pitch-control models (Spearman,
2017; Fernández & Bornn, 2018), not a reproduction of either. For every cell of a grid over the
pitch, each player's arrival time is a reaction time spent carrying on at their current
velocity, then a straight run at top speed. A team's time is its fastest player's; the cell's
control is a logistic of the difference between the two teams' times, so a cell both teams
reach at the same moment is 50/50 and a clear head start is near-certain.

Everything here is deterministic numpy: the numbers the breakdown shows ("Riverside control
410 m² of the final third, +120 m² since the last touch") come from these functions.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from livecards.contracts import HALF_LENGTH, HALF_WIDTH

REACTION_S = 0.7  # time before a player changes course
MAX_SPEED = 7.0  # m/s, a typical top running speed
SIGMA_S = 0.45  # spread of the logistic: how decisive a time advantage is
CELL_M = 3.0  # grid resolution


@dataclass
class ControlMap:
    """Probability that team A controls each cell. Rows run along y, columns along x."""

    p: np.ndarray  # (rows, cols) in [0, 1]
    xs: np.ndarray  # (cols,) cell-centre x
    ys: np.ndarray  # (rows,) cell-centre y
    cell: float

    @property
    def cell_area(self) -> float:
        return self.cell * self.cell

    def area(self, mask: np.ndarray | None = None, team_a: bool = True) -> float:
        """Expected m² controlled by team A (or B), optionally inside a mask of cells."""
        p = self.p if team_a else 1.0 - self.p
        if mask is not None:
            p = p * mask
        return float(p.sum() * self.cell_area)


def grid(cell: float = CELL_M) -> tuple[np.ndarray, np.ndarray]:
    xs = np.arange(-HALF_LENGTH + cell / 2, HALF_LENGTH, cell)
    ys = np.arange(-HALF_WIDTH + cell / 2, HALF_WIDTH, cell)
    return xs, ys


def arrival_times(pos: np.ndarray, vel: np.ndarray, xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """(players, rows, cols) seconds for each player to reach each cell centre."""
    if len(pos) == 0:
        return np.full((1, len(ys), len(xs)), np.inf)
    start = pos + vel * REACTION_S  # where they'll be when they react
    dx = xs[None, None, :] - start[:, 0, None, None]
    dy = ys[None, :, None] - start[:, 1, None, None]
    return REACTION_S + np.hypot(dx, dy) / MAX_SPEED


def control(pos_a: np.ndarray, vel_a: np.ndarray, pos_b: np.ndarray, vel_b: np.ndarray,
            cell: float = CELL_M) -> ControlMap:
    """Control map for team A against team B. Positions and velocities are (n, 2) arrays."""
    xs, ys = grid(cell)
    ta = arrival_times(pos_a, vel_a, xs, ys).min(axis=0)
    tb = arrival_times(pos_b, vel_b, xs, ys).min(axis=0)
    with np.errstate(invalid="ignore"):
        p = 1.0 / (1.0 + np.exp(-(tb - ta) / SIGMA_S))
    p = np.nan_to_num(p, nan=0.5)
    return ControlMap(p=p, xs=xs, ys=ys, cell=cell)


def final_third(cm: ControlMap, attack_dir: int) -> np.ndarray:
    """Mask of the final third of the pitch for a team attacking toward `attack_dir`."""
    zone = cm.xs * attack_dir >= HALF_LENGTH - 35.0
    return np.broadcast_to(zone[None, :], cm.p.shape).astype(float)


def ahead_of(cm: ControlMap, ball_x: float, attack_dir: int) -> np.ndarray:
    """Mask of cells between the ball and the goal the team attacks."""
    ahead = (cm.xs - ball_x) * attack_dir > 0
    return np.broadcast_to(ahead[None, :], cm.p.shape).astype(float)


def snapshot(pos: np.ndarray, prev: np.ndarray, dt: float, ids: list[str], team: str,
             ball_x: float, attack_dir: int) -> dict:
    """Control for `team` at one frame: the map (quantised for the viewer) and the space it
    controls in the final third, where attacks are won. `pos`/`prev` are (22, >=2) arrays for this frame and the one
    before; `ids` gives each row's player id."""
    vel = (pos[:, :2] - prev[:, :2]) / dt if dt > 0 else np.zeros((len(pos), 2))
    mine = np.array([pid.startswith(team) for pid in ids])
    cm = control(pos[mine, :2], vel[mine], pos[~mine, :2], vel[~mine])
    mask = final_third(cm, attack_dir)
    return {
        "cols": len(cm.xs), "rows": len(cm.ys), "cell": cm.cell,
        "grid": (cm.p.ravel() * 255).round().astype(int).tolist(),  # 0-255, row-major
        "final_third_m2": round(cm.area(mask)),
        "total_m2": round(cm.area()),
    }
