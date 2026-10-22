"""Command line: simulate a match and replay it through the stats engine.

    livecards simulate --seed 7 --out ../data/match-7
    livecards replay --seed 7 --speed 20 --follow RIV-09 --follow RIV-07
    livecards replay --seed 7 --speed 0 --from 64 --to 68      # 0 = as fast as possible
"""

from __future__ import annotations

import argparse
import asyncio
import time
from pathlib import Path

from rich.console import Console
from rich.table import Table

from livecards.contracts import Moment
from livecards.engine.engine import MatchEngine
from livecards.replay import feed, stream, ticks
from livecards.sim.match import Match
from livecards.sim.simulator import simulate

console = Console(highlight=False)

STYLE = {
    "goal": "bold white on red", "big_chance": "bold yellow", "fastest_sprint": "bold cyan",
    "sprint": "cyan", "streak": "magenta", "rating_upgrade": "bold green",
    "rating_downgrade": "bold red", "attr_upgrade": "green", "attr_downgrade": "red",
    "momentum_swing": "bold blue", "card": "yellow", "substitution": "dim",
    "distance_milestone": "dim",
}


def clock(t: float) -> str:
    return f"{int(t // 60):02d}:{int(t % 60):02d}"


def print_moment(m: Moment, engine: MatchEngine) -> None:
    who = ""
    if m.player:
        p = engine.players[m.player]
        who = f"[bold]{p.meta.short}[/] ({m.player}, {engine.card(m.player).rating:.1f}) "
    ev = ", ".join(m.evidence[:4]) + (" ..." if len(m.evidence) > 4 else "")
    console.print(f"[dim]{clock(m.t)}[/] [{STYLE.get(m.type, '')}]{m.type:>18}[/] "
                  f"{who}{m.template}  [dim]imp {m.importance:.2f} | {ev}[/]")


def print_card(engine: MatchEngine, pid: str) -> None:
    c = engine.card(pid)
    p = engine.players[pid]
    s = p.stats.public()
    attrs = "  ".join(f"{k[:3].upper()} {v}" for k, v in c.attrs.items())
    console.print(f"      [on grey15] CARD {p.meta.short} #{p.meta.number} {p.meta.position} | "
                  f"[bold]{c.rating:.1f}[/] | {attrs} | {s['distance_km']} km, top "
                  f"{s['top_speed_kmh']} km/h, passes {s['passes_completed']}/{s['passes']}, "
                  f"shots {s['shots']} [/]")


def print_team(engine: MatchEngine) -> None:
    ts = engine.team_state()
    h, a = engine.home, engine.away
    console.print(f"      [blue]TEAM {h} {ts.score[h]}-{ts.score[a]} {a} | possession "
                  f"{ts.possession[h]:.0f}% (last 5' {ts.possession_5m[h]:.0f}%) | momentum "
                  f"{ts.momentum:+.2f} | chaos {ts.chaos}/100[/]")


def cmd_simulate(args: argparse.Namespace) -> None:
    t0 = time.time()
    m = simulate(args.seed)
    m.save(Path(args.out))
    console.print(f"simulated seed {args.seed} in {time.time() - t0:.1f}s: {len(m)} frames, "
                  f"{len(m.events)} events, score {m.score()} -> {args.out}")


def cmd_replay(args: argparse.Namespace) -> None:
    match = Match.load(Path(args.data)) if args.data else simulate(args.seed)
    engine = MatchEngine(match.meta)
    follow = args.follow or ["RIV-07", "RIV-09"]
    start, end = args.start * 60, args.end * 60

    def on_tick(t: float, moments: list[Moment]) -> None:
        if t < start:
            return
        for m in moments:
            if m.importance >= args.min_importance or m.player in follow:
                print_moment(m, engine)
                if m.player in follow and m.type in ("rating_upgrade", "attr_upgrade", "goal",
                                                     "rating_downgrade", "fastest_sprint"):
                    print_card(engine, m.player)
        if args.cards_every and int(t * 10) % (args.cards_every * 600) == 0 and t > 0:
            console.rule(f"{clock(t)}", style="dim")
            print_team(engine)
            for pid in follow:
                print_card(engine, pid)

    console.rule(f"{match.meta.home.name} v {match.meta.away.name} at {match.meta.venue} "
                 f"(synthetic, seed {match.meta.seed})")
    if args.speed <= 0:
        for tick in ticks(match, 0, end):
            on_tick(tick.t, feed(engine, match, tick))
    else:
        async def live() -> None:
            # Fast-forward the engine to the start, then replay in real time.
            for tick in ticks(match, 0, start):
                feed(engine, match, tick)
            async for tick in stream(match, args.speed, start, end):
                on_tick(tick.t, feed(engine, match, tick))
        asyncio.run(live())
    console.rule("summary")
    print_team(engine)
    table = Table("player", "pos", "rating", "PAC", "PAS", "THR", "DEF", "ENG", "km", "top km/h")
    for pid, ps in sorted(engine.players.items(), key=lambda kv: -kv[1].rating.value):
        if ps.stats.minutes < 1:
            continue
        c = engine.card(pid)
        table.add_row(f"{ps.meta.short} ({pid})", ps.meta.role, f"{c.rating:.1f}",
                      *(str(c.attrs[k]) for k in ("pace", "passing", "threat", "defending", "engine")),
                      f"{ps.stats.distance_m / 1000:.1f}", f"{ps.stats.top_speed_kmh:.1f}")
    console.print(table)


def main() -> None:
    ap = argparse.ArgumentParser(prog="livecards")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("simulate", help="simulate a match and save it")
    s.add_argument("--seed", type=int, default=7)
    s.add_argument("--out", default="../data/match-7")
    s.set_defaults(func=cmd_simulate)
    r = sub.add_parser("replay", help="replay a match through the stats engine")
    r.add_argument("--seed", type=int, default=7)
    r.add_argument("--data", help="load a saved match instead of simulating")
    r.add_argument("--speed", type=float, default=0, help="1-20x live; 0 = as fast as possible")
    r.add_argument("--follow", action="append", help="player ids whose cards to print")
    r.add_argument("--from", dest="start", type=float, default=0, help="start minute")
    r.add_argument("--to", dest="end", type=float, default=90, help="end minute")
    r.add_argument("--min-importance", type=float, default=0.45)
    r.add_argument("--cards-every", type=int, default=15, help="minutes between card printouts")
    r.set_defaults(func=cmd_replay)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
