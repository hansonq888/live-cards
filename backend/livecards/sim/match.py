"""A simulated match: metadata, events and compact 10 fps tracking data."""

from __future__ import annotations

import gzip
import json
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from livecards.contracts import Ball, Event, Frame, MatchMeta, PlayerPos


@dataclass
class Match:
    meta: MatchMeta
    events: list[Event]
    times: np.ndarray  # (N,) seconds
    ball: np.ndarray  # (N, 3) x, y, z
    pos: np.ndarray  # (N, 22, 3) x, y, speed (m/s)
    lineups: list[list[str]]  # distinct slot->player id layouts
    lineup_idx: np.ndarray  # (N,) index into `lineups`

    def __len__(self) -> int:
        return len(self.times)

    def frame(self, i: int) -> Frame:
        ids = self.lineups[self.lineup_idx[i]]
        p = self.pos[i]
        bx, by, bz = self.ball[i]
        return Frame(
            t=round(float(self.times[i]), 1),
            ball=Ball(x=round(float(bx), 2), y=round(float(by), 2), z=round(float(bz), 2)),
            players=[
                PlayerPos(id=pid, x=round(float(p[k, 0]), 2), y=round(float(p[k, 1]), 2),
                          v=round(float(p[k, 2]), 2))
                for k, pid in enumerate(ids)
            ],
        )

    def iter_frames(self) -> Iterator[Frame]:
        for i in range(len(self)):
            yield self.frame(i)

    def ids_at(self, i: int) -> list[str]:
        return self.lineups[self.lineup_idx[i]]

    def score(self) -> dict[str, int]:
        s = {self.meta.home.code: 0, self.meta.away.code: 0}
        for e in self.events:
            if e.type == "goal" and e.team:
                s[e.team] += 1
        return s

    # ---- persistence -------------------------------------------------------------
    def save(self, out: Path) -> None:
        out.mkdir(parents=True, exist_ok=True)
        (out / "meta.json").write_text(self.meta.model_dump_json(indent=2))
        with (out / "events.jsonl").open("w") as f:
            for e in self.events:
                f.write(e.model_dump_json(exclude_none=True) + "\n")
        np.savez_compressed(out / "tracking.npz", times=self.times, ball=self.ball, pos=self.pos,
                            lineup_idx=self.lineup_idx)
        (out / "lineups.json").write_text(json.dumps(self.lineups))

    def export_frames_jsonl(self, path: Path) -> None:
        """Write frames in the public contract format (large: ~40 MB gzipped per match)."""
        with gzip.open(path, "wt") as f:
            for fr in self.iter_frames():
                f.write(fr.model_dump_json() + "\n")

    @classmethod
    def load(cls, src: Path) -> Match:
        meta = MatchMeta.model_validate_json((src / "meta.json").read_text())
        events = [Event.model_validate_json(line) for line in (src / "events.jsonl").open()]
        z = np.load(src / "tracking.npz")
        lineups = json.loads((src / "lineups.json").read_text())
        return cls(meta, events, z["times"], z["ball"], z["pos"], lineups, z["lineup_idx"])
