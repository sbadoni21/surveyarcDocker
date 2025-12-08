# app/services/quota.py
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID
from fastapi import HTTPException

logger = logging.getLogger(__name__)

async def create_quota(db: AsyncSession, payload):
    """
    Insert quota and its cells. payload is a Pydantic QuotaCreate or dict-like.
    Returns the inserted quota row mapping.
    """
    org_id = getattr(payload, "org_id", None)
    survey_id = getattr(payload, "survey_id", None)

    if not org_id:
        raise HTTPException(status_code=422, detail="org_id is required")
    if not survey_id:
        raise HTTPException(status_code=422, detail="survey_id is required")
    name = getattr(payload, "name", None)
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    insert_sql = text("""
      INSERT INTO survey_quotas
        (org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload)
      VALUES (:org_id, :survey_id, :name, :description, :is_enabled, :stop_condition, :when_met, :action_payload)
      RETURNING id, org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload, created_at, updated_at
    """)

    try:
        res = await db.execute(insert_sql, {
            "org_id": org_id,
            "survey_id": survey_id,
            "name": name,
            "description": getattr(payload, "description", "") or "",
            "is_enabled": bool(getattr(payload, "is_enabled", True)),
            "stop_condition": getattr(payload, "stop_condition", "greater"),
            "when_met": getattr(payload, "when_met", "close_survey"),
            "action_payload": getattr(payload, "action_payload", {}) or {}
        })
        quota_row = res.first()
        if not quota_row:
            raise HTTPException(status_code=500, detail="Quota insert returned no row")

        quota_id = quota_row.id

        cells_list = getattr(payload, "cells", None) or []
        if not isinstance(cells_list, (list, tuple)):
            raise HTTPException(status_code=422, detail="cells must be a list")

        for c in cells_list:
            if isinstance(c, dict):
                label = c.get("label")
                cap = int(c.get("cap", 0))
                cond = c.get("condition", {}) or {}
                enabled = bool(c.get("is_enabled", True))
            else:
                label = getattr(c, "label", None)
                cap = int(getattr(c, "cap", 0) or 0)
                cond = getattr(c, "condition", {}) or {}
                enabled = bool(getattr(c, "is_enabled", True))

            if not label:
                raise HTTPException(status_code=422, detail="Each cell must have a label")

            await db.execute(text("""
              INSERT INTO survey_quota_cells (quota_id, label, cap, condition, is_enabled)
              VALUES (:qid, :label, :cap, :cond, :enabled)
            """), {
                "qid": str(quota_id),
                "label": label,
                "cap": cap,
                "cond": cond,
                "enabled": enabled
            })

        await db.commit()
        return quota_row

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("create_quota failed")
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")


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


async def list_quotas_by_survey(db: AsyncSession, survey_id: str):
    ids_res = await db.execute(text("SELECT id FROM survey_quotas WHERE survey_id = :sid AND is_enabled = TRUE ORDER BY created_at ASC"),
                              {"sid": survey_id})
    ids = [r.id for r in ids_res.fetchall()]
    out = []
    for qid in ids:
        rc = await fetch_quota_with_cells(db, qid)
        out.append(rc)
    return out


async def evaluate_quota(db: AsyncSession, quota_id: UUID, facts: dict):
    rc = await fetch_quota_with_cells(db, quota_id)
    if not rc:
        return None
    return rc["quota"], rc["cells"]


async def increment_cell_safe(db: AsyncSession, cell_id: UUID, quota_id: UUID, survey_id: str,
                              respondent_id, reason, metadata):
    # Calls DB function quota_cell_increment_safe
    try:
        res = await db.execute(text("""
          SELECT * FROM quota_cell_increment_safe(:cell_id, :quota_id, :survey_id, :respondent_id, :reason, :meta)
        """), {
            "cell_id": str(cell_id),
            "quota_id": str(quota_id),
            "survey_id": survey_id,
            "respondent_id": str(respondent_id) if respondent_id else None,
            "reason": reason,
            "meta": metadata or {}
        })
        return res.first()
    except Exception:
        logger.exception("increment_cell_safe failed")
        raise
