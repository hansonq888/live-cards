"""Play breakdown: an attack, step by step, from the event data.

Walks back from a goal (or any shot) through the attacking team's uninterrupted possession to
where they won the ball, and adds any sprint alerts along the way. Each step carries its own
stats (distance, difficulty, ground gained, pressure, speed, xG) so a viewer can study it.
Every caption and number comes from the engine, so it's verified by construction; the AI only
writes the one-line story on top.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from livecards.contracts import Event, MatchMeta, Moment
from livecards.engine import metrics as mx

WIN_TYPES = {"interception", "recovery"}


@dataclass
class Step:
    t: float
    kind: str  # win | pass | sprint | shot | goal
    player: str
    text: str
    evidence: list[str]
    args: dict = field(default_factory=dict)  # for rendering the caption in other languages


def _zone(x: float, attack_dir: int) -> str:
    ax = x * attack_dir
    if ax < -17.5:
        return "deep in their own half"
    if ax < 0:
        return "in their own half"
    if ax < mx.FINAL_THIRD_X:
        return "in midfield"
    return "in the final third"


def _zone_key(x: float, attack_dir: int) -> str:
    ax = x * attack_dir
    return "deep_own" if ax < -17.5 else "own" if ax < 0 else "mid" if ax < mx.FINAL_THIRD_X else "final"


OUTCOME = {"saved": "saved", "off_target": "off target", "blocked": "blocked"}


def build_up(events: list[Event], goal: Event, meta: MatchMeta,
             moments: list[Moment]) -> dict | None:
    """Break down the play that ended in `goal`: a goal event, or a shot that didn't go in."""
    team, scorer = goal.team, goal.player
    dirs = {meta.home.code: meta.home.attack_dir, meta.away.code: meta.away.attack_dir}
    d = dirs[team]
    short = {p.id: p.short for p in meta.players}
    scored = goal.type == "goal"
    before = [e for e in events if e.t <= goal.t and e.id != goal.id]
    if scored:
        shot = next((e for e in reversed(before) if e.type == "shot" and e.player == scorer), None)
        if shot is None:
            return None
    else:
        shot, before = goal, before + [goal]
    chain: list[Event] = []
    for e in reversed(before[:before.index(shot)]):
        if e.type in ("pressure", "foul", "card", "substitution"):
            continue
        if e.type == "possession_change":
            if e.team == team:
                continue  # the change that started this possession: the win is the event before
            break
        if e.team != team or e.type in ("kickoff", "goal", "shot", "half_end"):
            break
        if e.type == "pass" and e.outcome != "complete":
            break
        if e.type == "tackle" and e.outcome != "won":
            continue
        chain.append(e)
        if e.type in WIN_TYPES or (e.type == "tackle" and e.outcome == "won"):
            break
    chain.reverse()
    steps: list[Step] = []
    passes = 0
    for e in chain:
        who = short[e.player]
        if e.type == "pass":
            passes += 1
            dist = mx.pass_distance(e.x, e.y, e.end_x, e.end_y)
            label = {"long": "long ball", "cross": "cross", "through": "through ball"}.get(e.kind or "", "pass")
            speed = f" at {e.speed_kmh:.0f} km/h" if e.kind in ("long", "cross") and e.speed_kmh else ""
            steps.append(Step(e.t, "pass", e.player,
                              f"{who} → {short[e.receiver]}: {dist:.0f} m {label}{speed}", [e.id],
                              {"from": who, "to": short[e.receiver], "m": round(dist),
                               "kind": e.kind or "ground",
                               "kmh": round(e.speed_kmh) if speed else None,
                               "difficulty": mx.pass_difficulty(e.x, e.y, e.end_x, e.end_y, d,
                                                                bool(e.under_pressure), e.kind),
                               "gain": round(max(0.0, mx.pass_progress(e.x, e.end_x, d))),
                               "pressure": bool(e.under_pressure),
                               "x": e.x, "y": e.y, "end_x": e.end_x, "end_y": e.end_y}))
        else:
            victim = f" from {short[e.target]}" if e.type == "tackle" and e.target else ""
            steps.append(Step(e.t, "win", e.player, f"{who} wins it{victim} {_zone(e.x, d)}", [e.id],
                              {"name": who, "from": short.get(e.target) if victim else None,
                               "zone": _zone_key(e.x, d), "x": e.x, "y": e.y}))
    start_t = steps[0].t if steps else shot.t
    for m in moments:
        if m.type in ("fastest_sprint", "sprint") and m.team == team and start_t <= m.t <= goal.t:
            label = " (fastest of the match)" if m.type == "fastest_sprint" else ""
            steps.append(Step(m.t, "sprint", m.player,
                              f"{short[m.player]} sprints at {m.facts['speed_kmh']:.1f} km/h{label}",
                              list(m.evidence),
                              {"name": short[m.player], "kmh": round(float(m.facts["speed_kmh"]), 1),
                               "fastest": m.type == "fastest_sprint"}))
    q = mx.xg(shot.x, shot.y, d)
    dist_m = round(mx.shot_distance(shot.x, shot.y, d))
    steps.append(Step(shot.t, "shot", scorer, f"{short[scorer]} shoots from {dist_m} m, xG {q:.2f}",
                      [shot.id], {"name": short[scorer], "m": dist_m, "xg": q,
                                  "kmh": round(shot.speed_kmh) if shot.speed_kmh else None,
                                  "pressure": bool(shot.under_pressure),
                                  "x": shot.x, "y": shot.y, "goal_x": 52.5 * d}))
    if scored:
        steps.append(Step(goal.t, "goal", scorer,
                          f"GOAL at {shot.speed_kmh:.0f} km/h" if shot.speed_kmh else "GOAL",
                          [goal.id], {"kmh": round(shot.speed_kmh) if shot.speed_kmh else None}))
    else:
        steps.append(Step(shot.t + 0.5, "end", scorer,
                          OUTCOME.get(shot.outcome or "", shot.outcome or "").capitalize(), [shot.id],
                          {"outcome": shot.outcome}))
    steps.sort(key=lambda s: s.t)
    zone = _zone(chain[0].x, d) if chain else "near goal"
    duration = round(goal.t - start_t)
    involved = sorted({s.player for s in steps})
    facts = {"passes": passes, "seconds": duration, "players_involved": len(involved),
             "xg": q, "shot_speed_kmh": shot.speed_kmh or 0, "won_ball": zone,
             "scorer": next(p.name for p in meta.players if p.id == scorer)}
    if not scored:
        facts["outcome"] = OUTCOME.get(shot.outcome or "", shot.outcome or "")
    return {
        "goal": goal.id, "kind": "goal" if scored else "chance",
        "team": team, "scorer": scorer, "start_t": start_t, "goal_t": goal.t,
        "steps": [asdict(s) for s in steps], "facts": facts, "players": involved,
        "story_args": {"passes": passes, "seconds": duration, "zone": _zone_key(chain[0].x, d)
                       if chain else "final", "xg": q},
        "story": f"{passes} pass{'es' if passes != 1 else ''} in {duration} s: won {zone}, "
                 + (f"finished from xG {q:.2f}" if scored
                    else f"a chance of xG {q:.2f}, {facts['outcome']}"),
    }
