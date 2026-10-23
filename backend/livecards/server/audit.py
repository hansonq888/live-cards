"""Audit log: every line that aired, was blocked, or waited for a human, with its evidence.

SQLite locally; the same interface is backed by Azure Cosmos DB in the cloud deployment.
"""

from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from pathlib import Path
from typing import Protocol

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "audit.db"
FIELDS = ("id", "ts", "match_t", "session", "kind", "moment", "moment_type", "player", "text",
          "source", "stage", "reason", "evidence", "decision", "operator", "lang")


class AuditLog(Protocol):
    def add(self, **entry) -> dict: ...
    def decide(self, entry_id: int, decision: str, operator: str) -> dict | None: ...
    def recent(self, limit: int = 100, kind: str | None = None) -> list[dict]: ...
    def counts(self) -> dict[str, int]: ...


class SqliteAuditLog:
    """kind: aired | blocked | pending | rejected_by_operator | expired | answer | redteam"""

    def __init__(self, path: Path | str | None = None) -> None:
        path = Path(path or os.environ.get("AUDIT_DB", DEFAULT_PATH))
        if str(path) != ":memory:":
            path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(path), check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        self.db.execute("""CREATE TABLE IF NOT EXISTS audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, match_t REAL, session TEXT,
            kind TEXT, moment TEXT, moment_type TEXT, player TEXT, text TEXT, source TEXT,
            stage TEXT, reason TEXT, evidence TEXT, decision TEXT, operator TEXT, lang TEXT)""")
        self.db.execute("CREATE INDEX IF NOT EXISTS audit_kind ON audit(kind)")
        self.db.commit()

    def _row(self, r: sqlite3.Row) -> dict:
        d = dict(r)
        d["evidence"] = json.loads(d["evidence"] or "[]")
        return d

    def add(self, **entry) -> dict:
        entry.setdefault("ts", time.time())
        entry["evidence"] = json.dumps(list(entry.get("evidence") or []))
        cols = [k for k in FIELDS if k != "id" and k in entry]
        with self.lock:
            cur = self.db.execute(
                f"INSERT INTO audit ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
                [entry[c] for c in cols])
            self.db.commit()
            row = self.db.execute("SELECT * FROM audit WHERE id = ?", (cur.lastrowid,)).fetchone()
        return self._row(row)

    def decide(self, entry_id: int, decision: str, operator: str) -> dict | None:
        with self.lock:
            self.db.execute("UPDATE audit SET decision = ?, operator = ? WHERE id = ?",
                            (decision, operator, entry_id))
            self.db.commit()
            row = self.db.execute("SELECT * FROM audit WHERE id = ?", (entry_id,)).fetchone()
        return self._row(row) if row else None

    def recent(self, limit: int = 100, kind: str | None = None) -> list[dict]:
        q, args = "SELECT * FROM audit", []
        if kind:
            q, args = q + " WHERE kind = ?", [kind]
        with self.lock:
            rows = self.db.execute(q + " ORDER BY id DESC LIMIT ?", [*args, limit]).fetchall()
        return [self._row(r) for r in rows]

    def counts(self) -> dict[str, int]:
        with self.lock:
            rows = self.db.execute("SELECT kind, COUNT(*) n FROM audit GROUP BY kind").fetchall()
        return {r["kind"]: r["n"] for r in rows}
