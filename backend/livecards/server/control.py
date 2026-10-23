"""Control plane: what the broadcaster allows on air, shared by every viewer session.

- Kill switches per feature (AI lines, personalization, Ask, alerts, auto-director).
- Insight allowlist: which moment types may produce on-screen lines.
- Approval mode: "auto" airs verified AI lines at once; "manual" holds each one for an
  operator (human in the loop). Unanswered requests expire and never air.
- Every decision lands in the audit log and is pushed to connected consoles.
"""

from __future__ import annotations

import asyncio
import contextlib
from dataclasses import asdict, dataclass, field

from livecards.server.audit import AuditLog, SqliteAuditLog

APPROVAL_TIMEOUT_S = 25.0
FEATURES = ("ai_lines", "personalization", "ask", "alerts", "director")
INSIGHTS = ("goal", "rating_upgrade", "rating_downgrade", "attr_upgrade", "attr_downgrade",
            "fastest_sprint", "sprint", "streak", "big_chance", "momentum_swing", "card",
            "substitution", "distance_milestone")


@dataclass
class Controls:
    features: dict[str, bool] = field(default_factory=lambda: dict.fromkeys(FEATURES, True))
    allow: dict[str, bool] = field(default_factory=lambda: dict.fromkeys(INSIGHTS, True))
    approval: str = "auto"  # auto | manual

    def feature(self, name: str) -> bool:
        return self.features.get(name, True)

    def allowed(self, moment_type: str) -> bool:
        return self.allow.get(moment_type, True)


class ControlPlane:
    def __init__(self, audit: AuditLog | None = None) -> None:
        self.controls = Controls()
        self.audit: AuditLog = audit or SqliteAuditLog()
        self.subscribers: set[asyncio.Queue] = set()
        self.pending: dict[int, asyncio.Future] = {}

    # ---- consoles -------------------------------------------------------------------
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self.subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subscribers.discard(q)

    def publish(self, msg: dict) -> None:
        for q in list(self.subscribers):
            with contextlib.suppress(asyncio.QueueFull):
                q.put_nowait(msg)

    def snapshot(self) -> dict:
        return {"type": "console_hello", "controls": asdict(self.controls),
                "recent": self.audit.recent(150), "counts": self.audit.counts(),
                "pending": self.audit.recent(50, kind="pending")}

    def update(self, patch: dict) -> None:
        c = self.controls
        for k, v in (patch.get("features") or {}).items():
            if k in c.features:
                c.features[k] = bool(v)
        for k, v in (patch.get("allow") or {}).items():
            if k in c.allow:
                c.allow[k] = bool(v)
        if patch.get("approval") in ("auto", "manual"):
            c.approval = patch["approval"]
        self.publish({"type": "controls", "controls": asdict(c)})

    # ---- audit ------------------------------------------------------------------------
    def record(self, **entry) -> dict:
        row = self.audit.add(**entry)
        self.publish({"type": "audit", "entry": row, "counts": self.audit.counts()})
        return row

    # ---- human in the loop ------------------------------------------------------------
    async def request_approval(self, **entry) -> bool:
        """Hold a verified line for an operator. True = air it."""
        row = self.audit.add(kind="pending", **entry)
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self.pending[row["id"]] = fut
        self.publish({"type": "pending", "entry": row, "timeout_s": APPROVAL_TIMEOUT_S})
        try:
            approved = await asyncio.wait_for(fut, APPROVAL_TIMEOUT_S)
        except TimeoutError:
            self._settle(row["id"], "expired", "system")
            return False
        finally:
            self.pending.pop(row["id"], None)
        return approved

    def decide(self, entry_id: int, approve: bool, operator: str = "operator") -> None:
        fut = self.pending.get(entry_id)
        if fut is None or fut.done():
            return
        self._settle(entry_id, "approved" if approve else "rejected", operator)
        fut.set_result(approve)

    def _settle(self, entry_id: int, decision: str, operator: str) -> None:
        row = self.audit.decide(entry_id, decision, operator)
        self.publish({"type": "decided", "id": entry_id, "decision": decision, "entry": row,
                      "counts": self.audit.counts()})


_plane: ControlPlane | None = None


def plane() -> ControlPlane:
    global _plane
    if _plane is None:
        _plane = ControlPlane()
    return _plane
