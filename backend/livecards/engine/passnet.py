"""Pass network: who passes to whom, and where each player tends to be.

For each team: every player's average position over the minutes they played (in the team's
own attacking frame, so both sides attack to the right), how many completed passes they were
involved in, and the number of completed passes between each pair (both directions summed).
"""

from __future__ import annotations

from collections import Counter

import numpy as np

from livecards.sim.match import Match


def pass_network(match: Match, min_pair: int = 3) -> dict:
    meta = match.meta
    dirs = {meta.home.code: meta.home.attack_dir, meta.away.code: meta.away.attack_dir}
    team_of = {p.id: p.team for p in meta.players}

    # Average position per player: sum over frames for every lineup they appear in.
    sums: dict[str, np.ndarray] = {}
    counts: Counter[str] = Counter()
    for li, ids in enumerate(match.lineups):
        rows = match.lineup_idx == li
        n = int(rows.sum())
        if not n:
            continue
        xy = match.pos[rows, :, :2].sum(axis=0)
        for k, pid in enumerate(ids):
            sums[pid] = sums.get(pid, np.zeros(2)) + xy[k]
            counts[pid] += n

    pairs: Counter[tuple[str, str]] = Counter()
    involved: Counter[str] = Counter()
    for e in match.events:
        if e.type == "pass" and e.outcome == "complete" and e.player and e.receiver:
            pairs[tuple(sorted((e.player, e.receiver)))] += 1
            involved[e.player] += 1
            involved[e.receiver] += 1

    out = {}
    for code in (meta.home.code, meta.away.code):
        d = dirs[code]
        nodes = []
        for pid, n in counts.items():
            if team_of.get(pid) != code or n < 60 * 10 * 5:  # at least ~5 minutes on the pitch
                continue
            x, y = sums[pid] / n
            nodes.append({"id": pid, "x": round(float(x * d), 1), "y": round(float(y * d), 1),
                          "passes": involved[pid]})
        ids = {nd["id"] for nd in nodes}
        edges = [{"a": a, "b": b, "n": n} for (a, b), n in pairs.most_common()
                 if a in ids and b in ids and n >= min_pair]
        out[code] = {"nodes": nodes, "edges": edges}
    return out
