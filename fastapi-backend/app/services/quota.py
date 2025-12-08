# app/services/quota.py
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.quota import SurveyQuota, SurveyQuotaCell

logger = logging.getLogger(__name__)


def create_quota(db: Session, payload: Any) -> SurveyQuota:
    """
    Insert quota + cells using sync Session.
    payload: Pydantic QuotaCreate or dict-like.
    Returns persisted SurveyQuota instance.
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

    question_id = getattr(payload, "question_id", None)
    quota_type = getattr(payload, "quota_type", "hard")
    is_enabled = bool(getattr(payload, "is_enabled", True))
    stop_condition = getattr(payload, "stop_condition", "greater")
    when_met = getattr(payload, "when_met", "close_survey")
    description = getattr(payload, "description", "") or ""

    action_payload = getattr(payload, "action_payload", {}) or {}
    metadata = getattr(payload, "metadata", {}) or {}
    cells_list = getattr(payload, "cells", None) or []

    if not isinstance(cells_list, (list, tuple)):
        raise HTTPException(status_code=422, detail="cells must be a list")

    try:
        quota = SurveyQuota(
            org_id=org_id,
            survey_id=survey_id,
            question_id=question_id,
            name=name,
            description=description,
            is_enabled=is_enabled,
            quota_type=quota_type,
            stop_condition=stop_condition,
            when_met=when_met,
            action_payload=action_payload,
            quota_metadata=metadata,
        )
        db.add(quota)
        db.flush()  # get quota.id

        for c in cells_list:
            if isinstance(c, dict):
                label = c.get("label")
                cap = c.get("cap", 0)
                cond_obj = c.get("condition", {}) or {}
                enabled = bool(c.get("is_enabled", True))
                target_option_id = c.get("target_option_id")
            else:
                label = getattr(c, "label", None)
                cap = getattr(c, "cap", 0)
                cond_obj = getattr(c, "condition", {}) or {}
                enabled = bool(getattr(c, "is_enabled", True))
                target_option_id = getattr(c, "target_option_id", None)

            if not label:
                db.rollback()
                raise HTTPException(
                    status_code=422,
                    detail="Each cell must have a label",
                )

            cell = SurveyQuotaCell(
                quota_id=quota.id,
                label=label,
                cap=int(cap or 0),
                count=0,
                condition=cond_obj,
                is_enabled=enabled,
                target_option_id=target_option_id,
            )
            db.add(cell)

        db.commit()
        db.refresh(quota)
        return quota

    except HTTPException:
        try:
            db.rollback()
        except Exception:
            logger.exception("rollback failed after HTTPException")
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            logger.exception("rollback failed after unexpected exception")
        logger.exception("create_quota failed")
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")


def fetch_quota_with_cells(db: Session, quota_id: UUID) -> Optional[SurveyQuota]:
    quota = (
        db.query(SurveyQuota)
        .filter(SurveyQuota.id == quota_id)
        .first()
    )
    return quota


def list_quotas_by_survey(db: Session, survey_id: str) -> List[SurveyQuota]:
    return (
        db.query(SurveyQuota)
        .filter(SurveyQuota.survey_id == survey_id)
        .order_by(SurveyQuota.created_at.asc())
        .all()
    )


def evaluate_quota(
    db: Session, quota_id: UUID, facts: Dict
) -> Tuple[SurveyQuota, List[SurveyQuotaCell]]:
    """
    For now: just returns quota + cells. You can plug your own matching logic.
    """
    quota = fetch_quota_with_cells(db, quota_id)
    if not quota:
        raise HTTPException(status_code=404, detail="Quota not found")

    return quota, list(quota.cells or [])


def increment_cell_safe(
    db: Session,
    cell_id: UUID,
    quota_id: UUID,
    survey_id: str,
    respondent_id: Optional[UUID],
    reason: str,
    metadata: Optional[dict],
):
    """
    Call DB function quota_cell_increment_safe — returns its row result.

    You must have this Postgres function defined separately.
    """
    res = db.execute(
        text(
            """
            SELECT *
            FROM quota_cell_increment_safe(
              :cell_id,
              :quota_id,
              :survey_id,
              :respondent_id,
              :reason,
              :meta
            )
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
    row = res.first()
    db.commit()
    return row
