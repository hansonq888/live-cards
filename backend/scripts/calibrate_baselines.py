"""Calibrate role baselines (mean, sd per metric) on synthetic matches.

Attributes compare a player with what their role typically does *in this synthetic
league*, so the baselines are measured from the simulator rather than guessed.

    uv run python scripts/calibrate_baselines.py --seeds 1-8
"""

from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict

from livecards.engine.attributes import ATTRIBUTE_METRICS, BASELINES_PATH, raw_value
from livecards.engine.engine import MatchEngine
from livecards.replay import run_engine
from livecards.sim.simulator import simulate

MIN_MINUTES = 60
RATE_KEYS = {m.key for ms in ATTRIBUTE_METRICS.values() for m in ms if m.kind == "rate"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", default="1-8")
    a, b = (int(x) for x in ap.parse_args().seeds.split("-"))
    samples: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    for seed in range(a, b + 1):
        match = simulate(seed)
        engine = run_engine(match, MatchEngine(match.meta, compute_attrs=False))
        for ps in engine.players.values():
            if ps.stats.minutes < MIN_MINUTES:
                continue
            for metrics in ATTRIBUTE_METRICS.values():
                for m in metrics:
                    samples[ps.meta.role][m.key].append(raw_value(ps.stats, m.key))
        print(f"seed {seed}: score {match.score()}")
    roles = {}
    for role, ms in sorted(samples.items()):
        roles[role] = {}
        for key, vals in sorted(ms.items()):
            mean = statistics.fmean(vals)
            sd = statistics.pstdev(vals) if len(vals) > 1 else 0.0
            # Don't let sd collapse for rare events: one tackle shouldn't be worth +6.
            floor = max(0.15 * abs(mean), 1.5 if key in RATE_KEYS else 0.5)
            roles[role][key] = [round(mean, 3), round(max(sd, floor), 3)]
    BASELINES_PATH.write_text(json.dumps(
        {"source": f"synthetic seeds {a}-{b}, players with {MIN_MINUTES}+ minutes",
         "roles": roles}, indent=1))
    print(f"wrote {BASELINES_PATH}")


if __name__ == "__main__":
    main()
