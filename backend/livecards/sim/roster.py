"""Fictional clubs, players and formations.

Every name here is invented. Do not add real clubs, players, crests or sponsors.
Formation spots are in the team's *attack frame*: x toward the opponent goal,
y positive on the team's left. `to_world` maps them onto the pitch.
"""

from __future__ import annotations

from livecards.contracts import MatchMeta, PlayerMeta, TeamMeta

ATTRS = ("pace", "passing", "threat", "defending", "engine")

# (number, full name, short name, role, position label, formation spot or None for subs,
#  base attrs pace/passing/threat/defending/engine)
_RIV = [
    (1, "Tomas Brennick", "Brennick", "GK", "Goalkeeper", (-48, 0), (45, 62, 20, 70, 50)),
    (2, "Aaron Fell", "Fell", "FB", "Right Back", (-30, -24), (78, 66, 45, 72, 80)),
    (5, "Callum Ferreday", "Ferreday", "CB", "Centre Back", (-35, -9), (62, 68, 35, 80, 70)),
    (4, "Idris Kante-Moore", "Kante-Moore", "CB", "Centre Back", (-35, 9), (66, 64, 38, 78, 68)),
    (3, "Joel Penhallow", "Penhallow", "FB", "Left Back", (-30, 24), (76, 68, 48, 70, 78)),
    (6, "Rui Calderinha", "Calderinha", "DM", "Defensive Midfield", (-20, 0), (60, 76, 45, 74, 82)),
    (8, "Sami Dravet", "Dravet", "CM", "Central Midfield", (-9, -12), (68, 78, 60, 62, 84)),
    (10, "Noel Whitcombe", "Whitcombe", "CM", "Central Midfield", (-7, 12), (66, 80, 66, 58, 80)),
    (7, "Tayo Okelani", "Okelani", "W", "Right Wing", (6, -26), (90, 72, 74, 40, 78)),
    (9, "Luca Varenne", "Varenne", "ST", "Striker", (9, 0), (74, 64, 80, 36, 70)),
    (11, "Ezra Halloway", "Halloway", "W", "Left Wing", (6, 26), (84, 70, 70, 38, 72)),
    (14, "Kit Marchbanks", "Marchbanks", "W", "Left Wing", None, (86, 68, 72, 40, 76)),
    (16, "Owen Treharne", "Treharne", "CM", "Central Midfield", None, (64, 74, 55, 64, 78)),
    (12, "Ben Aldous", "Aldous", "GK", "Goalkeeper", None, (42, 58, 20, 66, 48)),
]

_NGT = [
    (1, "Pieter Vos", "Vos", "GK", "Goalkeeper", (-48, 0), (44, 64, 20, 72, 50)),
    (2, "Diego Almara", "Almara", "FB", "Right Back", (-30, -24), (76, 64, 44, 72, 78)),
    (4, "Henrik Solberg", "Solberg", "CB", "Centre Back", (-35, -9), (60, 66, 36, 81, 68)),
    (5, "Bram Eikelboom", "Eikelboom", "CB", "Centre Back", (-35, 9), (64, 70, 34, 77, 66)),
    (3, "Matty Quarles", "Quarles", "FB", "Left Back", (-30, 24), (78, 66, 46, 68, 80)),
    (6, "Yusuf Benali", "Benali", "DM", "Defensive Midfield", (-19, -7), (62, 76, 42, 76, 80)),
    (8, "Declan Hearne", "Hearne", "DM", "Defensive Midfield", (-19, 7), (64, 74, 48, 72, 86)),
    (7, "Andres Pilar", "Pilar", "W", "Right Wing", (0, -24), (86, 72, 70, 42, 76)),
    (10, "Jules Castagne", "Castagne", "AM", "Attacking Midfield", (2, 0), (70, 82, 74, 44, 74)),
    (11, "Rhys Penberthy", "Penberthy", "W", "Left Wing", (0, 24), (84, 68, 68, 40, 74)),
    (9, "Viktor Halden", "Halden", "ST", "Striker", (12, 0), (72, 62, 82, 38, 70)),
    (17, "Leon Asquith", "Asquith", "CM", "Central Midfield", None, (66, 72, 56, 64, 80)),
    (19, "Marco Benedetti", "Benedetti", "ST", "Striker", None, (74, 60, 76, 34, 72)),
    (13, "Sven Ilves", "Ilves", "GK", "Goalkeeper", None, (40, 56, 20, 68, 46)),
]

HOME = TeamMeta(
    code="RIV", name="Riverside FC", color="#c8102e", secondary="#ffffff",
    attack_dir=1, formation="4-3-3",
)
AWAY = TeamMeta(
    code="NGT", name="Northgate Athletic", color="#1d4ed8", secondary="#0b1a3a",
    attack_dir=-1, formation="4-2-3-1",
)
VENUE = "Harbour Lane"

FORMATION_SPOTS: dict[str, tuple[float, float]] = {}


def _players(team: TeamMeta, rows: list) -> list[PlayerMeta]:
    out = []
    for number, name, short, role, pos, spot, attrs in rows:
        pid = f"{team.code}-{number:02d}"
        if spot is not None:
            FORMATION_SPOTS[pid] = spot
        out.append(
            PlayerMeta(
                id=pid, team=team.code, number=number, name=name, short=short, role=role,
                position=pos, starter=spot is not None, base_attrs=dict(zip(ATTRS, attrs)),
            )
        )
    return out


def build_match_meta(seed: int) -> MatchMeta:
    players = _players(HOME, _RIV) + _players(AWAY, _NGT)
    return MatchMeta(
        match_id=f"syn-{seed}", seed=seed, venue=VENUE, home=HOME, away=AWAY, players=players,
    )


def spot_for(pid: str, replacing: str | None = None) -> tuple[float, float]:
    """Formation spot for a player; a substitute takes the spot of who they replace."""
    if pid in FORMATION_SPOTS:
        return FORMATION_SPOTS[pid]
    if replacing is None:
        raise KeyError(pid)
    FORMATION_SPOTS[pid] = FORMATION_SPOTS[replacing]
    return FORMATION_SPOTS[pid]
