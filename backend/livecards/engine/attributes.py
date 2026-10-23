"""Card attributes (1-99): a pre-match base, moved by live performance against a role baseline.

    attribute = clamp(base + round(8 * sum_i(w_i * z_i)), 1, 99), with the adjustment capped at +/-20
    z_i = clip((value_i - role_mean_i) / role_sd_i, -2.5, 2.5)

Values are shrunk toward the role mean early in a match so one early event can't swing
a card: per-90 rates use a 30-minute prior and ratios a small prior sample.
Pace is a capability: top speed and sprints can lift it, but not sprinting doesn't lower
it (tiredness shows up in Engine instead).
Role baselines are calibrated on synthetic matches (scripts/calibrate_baselines.py).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from livecards.engine.stats import PlayerStats

SCALE = 8.0
MAX_ADJ = 20
Z_CLIP = 2.5
PRIOR_MINUTES = 30.0
PRIOR_PASSES = 10.0
BASELINES_PATH = Path(__file__).with_name("baselines.json")


@dataclass(frozen=True)
class Metric:
    key: str
    weight: float
    kind: str  # rate (per 90) | lift (per-90 rate that can only raise) | ratio | peak
    label: str


ATTRIBUTE_METRICS: dict[str, list[Metric]] = {
    "pace": [
        Metric("top_speed_kmh", 0.6, "peak", "top speed (km/h)"),
        Metric("sprints", 0.4, "lift", "sprints"),
    ],
    "passing": [
        Metric("pass_pct", 0.4, "ratio", "pass completion %"),
        Metric("forward_passes", 0.3, "rate", "forward passes"),
        Metric("avg_difficulty", 0.3, "ratio", "average pass difficulty"),
    ],
    "threat": [
        Metric("shots", 0.3, "rate", "shots"),
        Metric("xg", 0.4, "rate", "chance quality (xG)"),
        Metric("chances_created", 0.3, "rate", "chances created"),
    ],
    "defending": [
        Metric("tackles_won", 0.35, "rate", "tackles won"),
        Metric("interceptions", 0.35, "rate", "interceptions"),
        Metric("pressures_won", 0.3, "rate", "pressures that won the ball"),
    ],
    "engine": [
        Metric("distance_per_min", 0.6, "ratio", "distance per minute (m)"),
        Metric("hi_runs", 0.4, "rate", "high-intensity runs"),
    ],
}


def raw_value(stats: PlayerStats, key: str) -> float:
    """Unshrunk metric value: per-90 for rates, the ratio itself otherwise."""
    if key == "pass_pct":
        return stats.pass_pct
    if key == "avg_difficulty":
        return stats.avg_difficulty
    if key == "distance_per_min":
        return stats.distance_m / stats.minutes if stats.minutes else 0.0
    if key == "top_speed_kmh":
        return stats.top_speed_kmh
    count = float(getattr(stats, key))
    return count * 90 / stats.minutes if stats.minutes else 0.0


def shrunk_value(stats: PlayerStats, m: Metric, mean: float) -> float:
    mins = stats.minutes
    if m.key == "pass_pct":
        return (stats.passes_completed * 100 + mean * PRIOR_PASSES) / (stats.passes + PRIOR_PASSES)
    if m.key == "avg_difficulty":
        return (stats.difficulty_sum + mean * PRIOR_PASSES) / (stats.passes + PRIOR_PASSES)
    if m.key == "distance_per_min":
        return (stats.distance_m + mean * PRIOR_MINUTES) / (mins + PRIOR_MINUTES)
    if m.key == "top_speed_kmh":
        return stats.top_speed_kmh
    count = float(getattr(stats, m.key))
    return (count + mean * PRIOR_MINUTES / 90) / (mins + PRIOR_MINUTES) * 90


@cache
def load_baselines() -> dict[str, dict[str, tuple[float, float]]]:
    data = json.loads(BASELINES_PATH.read_text())
    return {role: {k: (v[0], v[1]) for k, v in ms.items()} for role, ms in data["roles"].items()}


def z_scores(stats: PlayerStats, role: str,
             model: dict[str, list[Metric]] | None = None) -> dict[str, dict[str, float]]:
    base = load_baselines()[role]
    out: dict[str, dict[str, float]] = {}
    for attr, metrics in (model or ATTRIBUTE_METRICS).items():
        out[attr] = {}
        for m in metrics:
            mean, sd = base[m.key]
            z = (shrunk_value(stats, m, mean) - mean) / sd
            if m.kind in ("peak", "lift"):
                z = max(0.0, z)
            out[attr][m.key] = max(-Z_CLIP, min(Z_CLIP, z))
    return out


def compute_attributes(stats: PlayerStats, role: str, base_attrs: dict[str, int],
                       model: dict[str, list[Metric]] | None = None) -> dict[str, int]:
    metrics_by_attr = model or ATTRIBUTE_METRICS
    zs = z_scores(stats, role, metrics_by_attr)
    out = {}
    for attr, metrics in metrics_by_attr.items():
        adj = round(SCALE * sum(m.weight * zs[attr][m.key] for m in metrics))
        adj = max(-MAX_ADJ, min(MAX_ADJ, adj))
        out[attr] = max(1, min(99, base_attrs[attr] + adj))
    return out
