# app/crud/quota.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import UUID
from fastapi import HTTPException
import uuid
import logging

logger = logging.getLogger(__name__)


def _to_uuid_or_raise(val, name):
    """Try to convert val to UUID; raise HTTPException(422) on failure."""
    if val is None:
        raise HTTPException(status_code=422, detail=f"{name} is required")
    try:
        return uuid.UUID(str(val))
    except Exception:
        raise HTTPException(status_code=422, detail=f"{name} must be a valid UUID (got: {val})")


async def create_quota(db: AsyncSession, payload):
    """
    INSERT quota and cells. `payload` is Pydantic QuotaCreate instance or dict-like.
    Returns inserted quota row (RowMapping).
    """
    # validate required ids first so we fail early with helpful message
    try:
        org_uuid = _to_uuid_or_raise(getattr(payload, "org_id", None), "org_id")
        survey_uuid = _to_uuid_or_raise(getattr(payload, "survey_id", None), "survey_id")
    except HTTPException:
        # re-raise so calling route sees 422
        raise

    # optional question_id: try to coerce if present, otherwise None
    question_id_val = getattr(payload, "question_id", None)
    question_uuid = None
    if question_id_val:
        try:
            question_uuid = uuid.UUID(str(question_id_val))
        except Exception:
            # If your system uses non-UUID question ids, change this behavior.
            raise HTTPException(status_code=422, detail=f"question_id must be a valid UUID (got: {question_id_val})")

    sql = text("""
      INSERT INTO survey_quotas
        (org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload)
      VALUES (:org_id, :survey_id, :name, :description, :is_enabled, :stop_condition, :when_met, :action_payload)
      RETURNING id, org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload, created_at, updated_at
    """)

    try:
        res = await db.execute(sql, {
            "org_id": str(org_uuid),
            "survey_id": str(survey_uuid),
            "name": getattr(payload, "name", None),
            "description": getattr(payload, "description", None),
            "is_enabled": bool(getattr(payload, "is_enabled", True)),
            "stop_condition": getattr(payload, "stop_condition", "greater"),
            "when_met": getattr(payload, "when_met", "close_survey"),
            "action_payload": getattr(payload, "action_payload", {}) or {}
        })
        quota_row = res.first()
        if not quota_row:
            raise HTTPException(status_code=500, detail="Quota insert returned no row")

        qid = quota_row.id

        # insert cells (payload.cells may be list of pydantic objects or dicts)
        cells_list = getattr(payload, "cells", None) or []
        if not isinstance(cells_list, (list, tuple)):
            raise HTTPException(status_code=422, detail="cells must be a list")

        for c in cells_list:
            # support both dict-like and attr-like objects
            if isinstance(c, dict):
                label = c.get("label")
                cap = c.get("cap", 0)
                cond = c.get("condition", {})
                enabled = bool(c.get("is_enabled", True))
            else:
                label = getattr(c, "label", None)
                cap = getattr(c, "cap", 0)
                cond = getattr(c, "condition", {}) or {}
                enabled = bool(getattr(c, "is_enabled", True))

            if not label:
                raise HTTPException(status_code=422, detail="Each cell must have a label")

            await db.execute(text("""
              INSERT INTO survey_quota_cells (quota_id, label, cap, condition, is_enabled)
              VALUES (:qid, :label, :cap, :cond, :enabled)
            """), {"qid": str(qid), "label": label, "cap": int(cap), "cond": cond or {}, "enabled": enabled})

        await db.commit()
        return quota_row
    except HTTPException:
        # re-raise validation errors
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to create quota")
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {str(e)}")


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
