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


class CosmosAuditLog:
    """Azure Cosmos DB backend (same interface). Writes go through a background thread so a
    slow database write never stalls the live stream; signs in with managed identity."""

    def __init__(self, endpoint: str, database: str = "livecards", container: str = "audit",
                 credential=None) -> None:
        import itertools
        import queue

        from azure.cosmos import CosmosClient

        if credential is None:
            from livecards.agents.llm import _credential

            credential = _credential()
        # The database and container are created by the deployment (management plane); with
        # keyless (Entra ID) access the app only reads and writes data.
        client = CosmosClient(endpoint, credential=credential)
        self.c = client.get_database_client(database).get_container_client(container)
        self._seq = itertools.count()
        self._q: queue.Queue = queue.Queue()
        self._cache: dict[int, dict] = {}
        q = "SELECT c.kind, COUNT(1) AS n FROM c WHERE c.pk = 'audit' GROUP BY c.kind"
        # Counts are read once, then kept in memory: the console asks on every write.
        self._counts = {i["kind"]: i["n"] for i in self.c.query_items(q, partition_key="audit")}
        threading.Thread(target=self._writer, daemon=True).start()

    def _writer(self) -> None:
        while True:
            item = self._q.get()
            try:
                self.c.upsert_item(item)
            except Exception:  # noqa: BLE001 - the audit write is retried once, then logged
                try:
                    self.c.upsert_item(item)
                except Exception as exc:  # noqa: BLE001
                    import logging

                    logging.getLogger("livecards").warning("audit write failed: %s", exc)

    def _item(self, row: dict) -> dict:
        return {**row, "id": str(row["id"]), "pk": "audit"}

    def _row(self, item: dict) -> dict:
        row = {k: item.get(k) for k in FIELDS}
        row["id"] = int(item["id"])
        row["evidence"] = list(item.get("evidence") or [])
        return row

    def add(self, **entry) -> dict:
        entry.setdefault("ts", time.time())
        row = {k: entry.get(k) for k in FIELDS}
        row["id"] = int(entry["ts"] * 1000) * 100 + next(self._seq) % 100
        row["evidence"] = list(entry.get("evidence") or [])
        self._cache[row["id"]] = row
        if len(self._cache) > 2000:
            self._cache.pop(next(iter(self._cache)))
        self._counts[row["kind"]] = self._counts.get(row["kind"], 0) + 1
        self._q.put(self._item(row))
        return row

    def decide(self, entry_id: int, decision: str, operator: str) -> dict | None:
        row = self._cache.get(entry_id)
        if row is None:
            try:
                row = self._row(self.c.read_item(str(entry_id), partition_key="audit"))
            except Exception:  # noqa: BLE001
                return None
        row = {**row, "decision": decision, "operator": operator}
        self._cache[entry_id] = row
        self._q.put(self._item(row))
        return row

    def recent(self, limit: int = 100, kind: str | None = None) -> list[dict]:
        q = "SELECT * FROM c WHERE c.pk = 'audit'" + (" AND c.kind = @k" if kind else "")
        q += " ORDER BY c.ts DESC OFFSET 0 LIMIT @n"
        params = [{"name": "@n", "value": limit}] + ([{"name": "@k", "value": kind}] if kind else [])
        items = self.c.query_items(q, parameters=params, partition_key="audit")
        rows = [self._row(i) for i in items]
        # Include writes still in flight, so a console sees its own latest actions.
        known = {r["id"] for r in rows}
        fresh = [r for i, r in self._cache.items() if i not in known and (not kind or r["kind"] == kind)]
        return sorted(rows + fresh, key=lambda r: -r["id"])[:limit]

    def counts(self) -> dict[str, int]:
        return dict(self._counts)


def audit_from_env() -> AuditLog:
    """Cosmos DB when COSMOS_ENDPOINT is set (the cloud deployment), SQLite otherwise."""
    endpoint = os.environ.get("COSMOS_ENDPOINT")
    if endpoint:
        return CosmosAuditLog(endpoint)
    return SqliteAuditLog()
