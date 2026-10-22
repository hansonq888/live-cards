"""Overlay cues: everything on screen, as timed machine-readable JSON for a rendering partner."""

from __future__ import annotations

import json
from pathlib import Path

from livecards.agents.pipeline import Explained
from livecards.contracts import Moment, OverlayCue

DURATION = {"goal": 8.0, "rating_upgrade": 6.0, "rating_downgrade": 6.0, "fastest_sprint": 5.0,
            "sprint": 4.0, "big_chance": 5.0, "momentum_swing": 6.0, "attr_upgrade": 5.0,
            "attr_downgrade": 5.0, "streak": 4.0, "card": 5.0, "substitution": 5.0,
            "distance_milestone": 3.0}
CUE_TYPE = {"rating_upgrade": "card_upgrade", "rating_downgrade": "card_downgrade",
            "attr_upgrade": "card_upgrade", "attr_downgrade": "card_downgrade",
            "fastest_sprint": "alert_sprint", "sprint": "alert_sprint", "streak": "alert_streak",
            "distance_milestone": "alert_distance", "goal": "goal", "big_chance": "big_chance",
            "momentum_swing": "team_momentum", "card": "discipline", "substitution": "substitution"}


def make_cue(seq: int, moment: Moment, explained: Explained, ring_target: str | None) -> OverlayCue:
    return OverlayCue(
        cue=f"o-{seq:04d}",
        start=moment.t,
        duration=DURATION.get(moment.type, 4.0),
        type=CUE_TYPE.get(moment.type, moment.type),
        player=moment.player,
        ring=moment.player is not None and moment.player == ring_target,
        text={"casual": explained.text},
        lang="en",
        evidence=moment.evidence,
    )


def write_schema(path: Path) -> None:
    """Publish the cue contract as JSON Schema (docs/overlay-cue.schema.json)."""
    schema = OverlayCue.model_json_schema()
    schema["$id"] = "https://github.com/livecards/overlay-cue.schema.json"
    schema["description"] = (
        "A timed overlay instruction. `start` and `duration` are match seconds from kickoff; "
        "`text` holds one verified line per audience; `evidence` lists the event ids (or "
        "trk-<player>-<tenths> tracking refs) every claim in `text` rests on.")
    path.write_text(json.dumps(schema, indent=2) + "\n")
