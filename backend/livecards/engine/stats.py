"""Per-player live statistics (counters only; formulas live in metrics.py)."""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class PlayerStats:
    touches: int = 0
    passes: int = 0
    passes_completed: int = 0
    forward_passes: int = 0
    difficulty_sum: float = 0.0
    passes_under_pressure_completed: int = 0
    pass_distance_sum: float = 0.0
    shots: int = 0
    shots_on_target: int = 0
    goals: int = 0
    assists: int = 0
    xg: float = 0.0
    chances_created: int = 0
    tackles_won: int = 0
    tackles_lost: int = 0
    interceptions: int = 0
    pressures: int = 0
    pressures_won: int = 0
    fouls: int = 0
    yellow_cards: int = 0
    turnovers: int = 0
    turnovers_own_half: int = 0
    distance_m: float = 0.0
    top_speed_kmh: float = 0.0
    sprints: int = 0
    hi_runs: int = 0
    seconds_played: float = 0.0
    max_shot_kmh: float = 0.0

    @property
    def minutes(self) -> float:
        return self.seconds_played / 60

    @property
    def pass_pct(self) -> float:
        return 100.0 * self.passes_completed / self.passes if self.passes else 0.0

    @property
    def avg_difficulty(self) -> float:
        return self.difficulty_sum / self.passes if self.passes else 0.0

    def snapshot(self) -> dict[str, float]:
        return asdict(self)

    def public(self) -> dict[str, float]:
        """Display-ready values (rounded) for cards and evidence bundles."""
        d = {k: (round(v, 2) if isinstance(v, float) else v) for k, v in asdict(self).items()}
        d["distance_km"] = round(self.distance_m / 1000, 2)
        d["pass_pct"] = round(self.pass_pct, 1)
        d["avg_difficulty"] = round(self.avg_difficulty, 1)
        d["minutes"] = round(self.minutes, 1)
        return d
