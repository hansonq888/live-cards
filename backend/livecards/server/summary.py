"""Post-match summary for the platform's light pages (Home, Learn, Players).

One full engine run over the match, cached: the final cards, every player's stats, and every
attack that ended in a shot. The pages read this instead of a live stream, so they load at once.
Same engine, same numbers as the live views.
"""

from __future__ import annotations

from functools import cache

from livecards.engine import metrics as mx
from livecards.engine.registry import REGISTRY
from livecards.replay import run_engine
from livecards.server.session import load_match

STAT_KEYS = ("minutes", "distance_km", "top_speed_kmh", "sprints", "hi_runs", "passes",
             "passes_completed", "pass_pct", "avg_difficulty", "forward_passes", "shots",
             "shots_on_target", "xg", "goals", "chances_created", "tackles_won", "interceptions",
             "pressures_won")


@cache
def summary(seed: int = 7) -> dict:
    match = load_match(seed)
    engine = run_engine(match)
    meta = match.meta
    dirs = {meta.home.code: meta.home.attack_dir, meta.away.code: meta.away.attack_dir}
    plays = [{"id": e.id, "t": e.t, "minute": e.minute, "player": e.player, "team": e.team,
              "outcome": e.outcome, "xg": mx.xg(e.x, e.y, dirs[e.team]),
                 "ax": round(e.x * dirs[e.team], 1), "ay": round(e.y * dirs[e.team], 1)}
             for e in engine.events.values() if e.type == "shot"]
    players = []
    for p in meta.players:
        ps = engine.players[p.id]
        if ps.stats.minutes <= 0:
            continue
        stats = ps.stats.public()
        players.append({
            "id": p.id, "name": p.name, "short": p.short, "team": p.team, "number": p.number,
            "position": p.position, "role": p.role, "rating": engine.card(p.id).rating,
            "attrs": dict(ps.attrs) or dict(p.base_attrs),
            "stats": {k: stats[k] for k in STAT_KEYS if k in stats},
            "plays": [x["id"] for x in plays if x["player"] == p.id],
        })
    goals = [x for x in plays if x["outcome"] == "goal"]
    # Team totals for the match page: from the engine's team state, plus sums of player stats.
    ts = engine.team_state()
    team: dict[str, dict] = {}
    for code in (meta.home.code, meta.away.code):
        ps = [engine.players[p.id].stats for p in meta.players if p.team == code]
        passes = sum(x.passes for x in ps)
        done = sum(x.passes_completed for x in ps)
        team[code] = {"possession": round(ts.possession[code], 1), "xg": round(ts.xg[code], 2),
                      "shots": ts.shots[code], "shots_on_target": ts.shots_on_target[code],
                      "passes": passes, "pass_pct": round(100 * done / passes, 1) if passes else 0,
                      "tackles_won": sum(x.tackles_won for x in ps),
                      "interceptions": sum(x.interceptions for x in ps),
                      "distance_km": round(sum(x.distance_m for x in ps) / 1000, 1)}
    # The match's key events, for the timeline: goals, cards and substitutions.
    events = []
    for e in engine.events.values():
        if e.type == "goal":
            events.append({"minute": e.minute, "t": e.t, "type": "goal", "team": e.team, "player": e.player})
        elif e.type == "card":
            events.append({"minute": e.minute, "t": e.t, "type": e.kind or "yellow", "team": e.team, "player": e.player})
        elif e.type == "substitution":
            events.append({"minute": e.minute, "t": e.t, "type": "sub", "team": e.team, "player": e.player_in, "off": e.player})
    hero = next((g for g in goals if g["player"] == "RIV-09"), goals[0] if goals else None)
    return {
        "meta": meta.model_dump(), "score": engine.score, "plays": plays, "players": players,
        "team": team, "events": sorted(events, key=lambda x: x["t"]),
        # A real play from this match to show each stat on (Learn page), per the registry.
        "examples": {st.id: (max(plays, key=lambda x: x["xg"])["id"] if st.example == "max_xg"
                             else hero["id"] if hero else None) if plays else None
                     for st in REGISTRY},
    }
