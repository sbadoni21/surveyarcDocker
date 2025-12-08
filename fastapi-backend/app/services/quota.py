# app/services/quota.py
import json
import logging
from typing import Any
from sqlalchemy import text
from fastapi import HTTPException

logger = logging.getLogger(__name__)


async def create_quota(db, payload: Any):
    """
    Insert quota + cells using AsyncSession.
    Expects payload to be a Pydantic model (QuotaCreate) or dict-like.
    Returns the inserted quota row (RowMapping).
    """
    org_id = getattr(payload, "org_id", None)
    survey_id = getattr(payload, "survey_id", None)
    name = getattr(payload, "name", None)

    if not org_id:
        raise HTTPException(status_code=422, detail="org_id is required")
    if not survey_id:
        raise HTTPException(status_code=422, detail="survey_id is required")
    if not name:
        raise HTTPException(status_code=422, detail="name is required")

    insert_sql = text(
        """
      INSERT INTO survey_quotas
        (org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload)
      VALUES (:org_id, :survey_id, :name, :description, :is_enabled, :stop_condition, :when_met, :action_payload)
      RETURNING id, org_id, survey_id, name, description, is_enabled, stop_condition, when_met, action_payload, created_at, updated_at
    """
    )

    # prepare action_payload as JSON string
    action_payload_obj = getattr(payload, "action_payload", {}) or {}
    try:
        action_payload_json = json.dumps(action_payload_obj)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"action_payload is not JSON-serializable: {e}")

    try:
        # Execute the quota insert (await the execute call)
        res = await db.execute(
            insert_sql,
            {
                "org_id": org_id,
                "survey_id": survey_id,
                "name": name,
                "description": getattr(payload, "description", "") or "",
                "is_enabled": bool(getattr(payload, "is_enabled", True)),
                "stop_condition": getattr(payload, "stop_condition", "greater"),
                "when_met": getattr(payload, "when_met", "close_survey"),
                # pass JSON as string (no ::json in SQL text)
                "action_payload": action_payload_json,
            },
        )

        # DO NOT await res.first() — call synchronous accessor on Result
        quota_row = res.first()
        if not quota_row:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Quota insert returned no row")

        quota_id = quota_row.id

        # insert cells
        cells_list = getattr(payload, "cells", None) or []
        if not isinstance(cells_list, (list, tuple)):
            await db.rollback()
            raise HTTPException(status_code=422, detail="cells must be a list")

        insert_cell_sql = text(
            """
          INSERT INTO survey_quota_cells (quota_id, label, cap, condition, is_enabled)
          VALUES (:qid, :label, :cap, :cond, :enabled)
        """
        )

        for c in cells_list:
            if isinstance(c, dict):
                label = c.get("label")
                cap = c.get("cap", 0)
                cond_obj = c.get("condition", {}) or {}
                enabled = bool(c.get("is_enabled", True))
            else:
                label = getattr(c, "label", None)
                cap = getattr(c, "cap", 0)
                cond_obj = getattr(c, "condition", {}) or {}
                enabled = bool(getattr(c, "is_enabled", True))

            if not label:
                await db.rollback()
                raise HTTPException(status_code=422, detail="Each cell must have a label")

            try:
                cond_json = json.dumps(cond_obj)
            except Exception as e:
                await db.rollback()
                raise HTTPException(status_code=422, detail=f"Cell condition is not JSON-serializable: {e}")

            await db.execute(
                insert_cell_sql,
                {
                    "qid": str(quota_id),
                    "label": label,
                    "cap": int(cap or 0),
                    "cond": cond_json,
                    "enabled": enabled,
                },
            )

        # commit transaction
        await db.commit()
        return quota_row

    except HTTPException:
        # already a controlled error; ensure rollback
        try:
            await db.rollback()
        except Exception:
            logger.exception("rollback failed after HTTPException")
        raise

    except Exception as e:
        # safe rollback + helpful log + raise HTTPException
        try:
            await db.rollback()
        except Exception:
            logger.exception("rollback failed after unexpected exception")
        logger.exception("create_quota failed")
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")


async def fetch_quota_with_cells(db, quota_id):
    """
    Return {"quota": RowMapping, "cells": [RowMapping,...]} or None
    """
    q = await db.execute(
        text(
            """
      SELECT id, org_id, survey_id, name, description, is_enabled,
             stop_condition, when_met, action_payload, created_at, updated_at
      FROM survey_quotas
      WHERE id = :qid
    """
        ),
        {"qid": str(quota_id)},
    )
    quota = q.first()
    if not quota:
        return None

    cells_res = await db.execute(
        text(
            """
      SELECT id, quota_id, label, cap, count, condition, is_enabled,
             created_at, updated_at
      FROM survey_quota_cells
      WHERE quota_id = :qid
      ORDER BY created_at ASC
    """
        ),
        {"qid": str(quota_id)},
    )
    cells = cells_res.fetchall()
    return {"quota": quota, "cells": cells}


async def list_quotas_by_survey(db, survey_id: str):
    ids_res = await db.execute(
        text(
            "SELECT id FROM survey_quotas WHERE survey_id = :sid AND is_enabled = TRUE ORDER BY created_at ASC"
        ),
        {"sid": survey_id},
    )
    ids = [r.id for r in ids_res.fetchall()]
    out = []
    for qid in ids:
        rc = await fetch_quota_with_cells(db, qid)
        out.append(rc)
    return out


async def evaluate_quota(db, quota_id, facts: dict):
    rc = await fetch_quota_with_cells(db, quota_id)
    if not rc:
        return None
    return rc["quota"], rc["cells"]


async def increment_cell_safe(db, cell_id, quota_id, survey_id, respondent_id, reason, metadata):
    """
    Call DB function quota_cell_increment_safe — returns its row result.
    """
    res = await db.execute(
        text(
            """
      SELECT * FROM quota_cell_increment_safe(:cell_id, :quota_id, :survey_id, :respondent_id, :reason, :meta)
    """
        ),
        {
            "cell_id": str(cell_id),
            "quota_id": str(quota_id),
            "survey_id": survey_id,
            "respondent_id": str(respondent_id) if respondent_id else None,
            "reason": reason,
            "meta": metadata or {},
        },
    )
    return res.first()
