"""Control plane and audit log: kill switches, allowlist, human approval, persistence."""

import asyncio

from livecards.server.audit import SqliteAuditLog
from livecards.server.control import ControlPlane


def make():
    return ControlPlane(SqliteAuditLog(":memory:"))


def test_audit_round_trip_keeps_evidence(tmp_path):
    log = SqliteAuditLog(tmp_path / "a.db")
    row = log.add(kind="aired", text="Varenne scores", evidence=["e-1", "e-2"], player="RIV-09")
    assert row["evidence"] == ["e-1", "e-2"] and row["id"] == 1
    again = SqliteAuditLog(tmp_path / "a.db")  # persisted across restarts
    assert again.recent(5)[0]["text"] == "Varenne scores"
    assert again.counts() == {"aired": 1}


def test_kill_switch_and_allowlist_updates_are_published():
    p = make()
    q = p.subscribe()
    p.update({"features": {"ai_lines": False}, "allow": {"streak": False}, "approval": "manual",
              "features_unknown": {"x": 1}})
    assert not p.controls.feature("ai_lines") and not p.controls.allowed("streak")
    assert p.controls.allowed("goal") and p.controls.approval == "manual"
    assert q.get_nowait()["type"] == "controls"


def test_operator_approval_airs_the_line():
    p = make()

    async def main():
        task = asyncio.create_task(p.request_approval(text="Varenne scores", player="RIV-09"))
        await asyncio.sleep(0.01)
        (entry_id,) = p.pending
        p.decide(entry_id, True, "producer")
        return await task
    assert asyncio.run(main()) is True
    row = p.audit.recent(1)[0]
    assert row["decision"] == "approved" and row["operator"] == "producer"


def test_rejected_and_expired_lines_never_air(monkeypatch):
    from livecards.server import control
    p = make()

    async def reject():
        task = asyncio.create_task(p.request_approval(text="a"))
        await asyncio.sleep(0.01)
        p.decide(next(iter(p.pending)), False)
        return await task

    assert asyncio.run(reject()) is False
    monkeypatch.setattr(control, "APPROVAL_TIMEOUT_S", 0.05)
    assert asyncio.run(p.request_approval(text="b")) is False
    decisions = {r["text"]: r["decision"] for r in p.audit.recent(5)}
    assert decisions == {"a": "rejected", "b": "expired"}
