# app/crud/quota.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID


async def create_quota(db: AsyncSession, payload):
    """
    INSERT quota and cells. `payload` is Pydantic QuotaCreate instance or dict-like.
    Returns inserted quota row (RowMapping).
    """
    sql = text("""
      INSERT INTO survey_quotas
        (org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload)
      VALUES (:org_id, :survey_id, :name, :description, :is_enabled, :stop_condition, :when_met, :action_payload)
      RETURNING id, org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload, created_at, updated_at
    """)
    res = await db.execute(sql, {
        "org_id": str(payload.org_id),
        "survey_id": str(payload.survey_id),
        "name": payload.name,
        "description": payload.description,
        "is_enabled": payload.is_enabled,
        "stop_condition": payload.stop_condition,
        "when_met": payload.when_met,
        "action_payload": payload.action_payload
    })
    quota_row = res.first()
    qid = quota_row.id
    # insert cells
    for c in payload.cells:
        await db.execute(text("""
          INSERT INTO survey_quota_cells (quota_id, label, cap, condition, is_enabled)
          VALUES (:qid, :label, :cap, :cond, :enabled)
        """), {"qid": str(qid), "label": c.label, "cap": c.cap, "cond": c.condition, "enabled": c.is_enabled})
    await db.commit()
    return quota_row

async def fetch_quota_with_cells(db: AsyncSession, quota_id: UUID):
    q = await db.execute(text("""
      SELECT id, org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload, created_at, updated_at
      FROM survey_quotas WHERE id = :qid
    """), {"qid": str(quota_id)})
    quota = q.first()
    if not quota:
        return None
    cells_res = await db.execute(text("""
      SELECT id, quota_id, label, cap, count, condition, is_enabled, created_at, updated_at
      FROM survey_quota_cells WHERE quota_id = :qid ORDER BY created_at ASC
    """), {"qid": str(quota_id)})
    cells = cells_res.fetchall()
    return {"quota": quota, "cells": cells}

async def list_quotas_by_survey(db: AsyncSession, survey_id: UUID):
    ids_res = await db.execute(text("SELECT id FROM survey_quotas WHERE survey_id = :sid AND is_enabled = TRUE ORDER BY created_at ASC"),
                              {"sid": str(survey_id)})
    ids = [r.id for r in ids_res.fetchall()]
    out = []
    for qid in ids:
        rc = await fetch_quota_with_cells(db, qid)
        out.append(rc)
    return out

async def evaluate_quota(db: AsyncSession, quota_id: UUID, facts: dict):
    """
    Fetch quota and cells — JSON-Logic evaluation will be performed in router using jsonLogic.
    Return (quota_row, cells)
    """
    rc = await fetch_quota_with_cells(db, quota_id)
    if not rc:
        return None
    quota_row = rc["quota"]
    cells = rc["cells"]
    return quota_row, cells

async def increment_cell_safe(db: AsyncSession, cell_id: UUID, quota_id: UUID, survey_id: UUID, respondent_id, reason, metadata):
    """
    Calls DB function quota_cell_increment_safe — returns its row result.
    """
    res = await db.execute(text("""
      SELECT * FROM quota_cell_increment_safe(:cell_id, :quota_id, :survey_id, :respondent_id, :reason, :meta)
    """), {
        "cell_id": str(cell_id),
        "quota_id": str(quota_id),
        "survey_id": str(survey_id),
        "respondent_id": str(respondent_id) if respondent_id else None,
        "reason": reason,
        "meta": metadata or {}
    })
    return res.first()
