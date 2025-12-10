# app/routes/quota_routes.py
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.quota import (
    QuotaCreate,
    QuotaWithCells,
    Quota,
    QuotaCell,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
    QuotaUpdate,
)
from app.services.quota import (
    create_quota,
    fetch_quota_with_cells,
    list_quotas_by_survey,
    evaluate_quota,
    increment_cell_safe,
    update_quota,
    delete_quota,
)

router = APIRouter(prefix="/quotas", tags=["quotas"])


# ---------- CREATE ----------
@router.post("", response_model=QuotaWithCells)
def create_quota_endpoint(
    payload: QuotaCreate,
    db: Session = Depends(get_db),
):
    quota = create_quota(db, payload)
    if not quota:
        raise HTTPException(status_code=500, detail="Failed to create quota")

    return QuotaWithCells(
        id=quota.id,
        org_id=quota.org_id,
        survey_id=quota.survey_id,
        question_id=quota.question_id,
        name=quota.name,
        description=quota.description,
        is_enabled=quota.is_enabled,
        quota_type=quota.quota_type,
        stop_condition=quota.stop_condition,
        when_met=quota.when_met,
        action_payload=quota.action_payload,
        metadata=quota.quota_metadata,
        created_at=quota.created_at,
        updated_at=quota.updated_at,
        cells=[
            QuotaCell(
                id=c.id,
                quota_id=c.quota_id,
                label=c.label,
                cap=c.cap,
                count=c.count,
                condition=c.condition,
                is_enabled=c.is_enabled,
                target_option_id=c.target_option_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in (quota.cells or [])
        ],
    )


# ---------- GET SINGLE QUOTA ----------
@router.get("/{quota_id}", response_model=QuotaWithCells)
def get_quota_endpoint(
    quota_id: UUID,
    db: Session = Depends(get_db),
):
    quota = fetch_quota_with_cells(db, quota_id)
    if not quota:
        raise HTTPException(status_code=404, detail="Quota not found")

    return QuotaWithCells(
        id=quota.id,
        org_id=quota.org_id,
        survey_id=quota.survey_id,
        question_id=quota.question_id,
        name=quota.name,
        description=quota.description,
        is_enabled=quota.is_enabled,
        quota_type=quota.quota_type,
        stop_condition=quota.stop_condition,
        when_met=quota.when_met,
        action_payload=quota.action_payload,
        metadata=quota.quota_metadata,
        created_at=quota.created_at,
        updated_at=quota.updated_at,
        cells=[
            QuotaCell(
                id=c.id,
                quota_id=c.quota_id,
                label=c.label,
                cap=c.cap,
                count=c.count,
                condition=c.condition,
                is_enabled=c.is_enabled,
                target_option_id=c.target_option_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in (quota.cells or [])
        ],
    )


# ---------- LIST BY SURVEY ----------
@router.get("/by-survey/{survey_id}", response_model=List[QuotaWithCells])
def list_quotas_for_survey_endpoint(
    survey_id: str,
    db: Session = Depends(get_db),
):
    quotas = list_quotas_by_survey(db, survey_id)
    out: List[QuotaWithCells] = []

    for quota in quotas:
        out.append(
            QuotaWithCells(
                id=quota.id,
                org_id=quota.org_id,
                survey_id=quota.survey_id,
                question_id=quota.question_id,
                name=quota.name,
                description=quota.description,
                is_enabled=quota.is_enabled,
                quota_type=quota.quota_type,
                stop_condition=quota.stop_condition,
                when_met=quota.when_met,
                action_payload=quota.action_payload,
                metadata=quota.quota_metadata,
                created_at=quota.created_at,
                updated_at=quota.updated_at,
                cells=[
                    QuotaCell(
                        id=c.id,
                        quota_id=c.quota_id,
                        label=c.label,
                        cap=c.cap,
                        count=c.count,
                        condition=c.condition,
                        is_enabled=c.is_enabled,
                        target_option_id=c.target_option_id,
                        created_at=c.created_at,
                        updated_at=c.updated_at,
                    )
                    for c in (quota.cells or [])
                ],
            )
        )

    return out


# ---------- EVALUATE ----------
@router.post("/{quota_id}/evaluate", response_model=QuotaEvaluateResult)
def evaluate_quota_endpoint(
    quota_id: UUID,
    payload: QuotaEvaluateRequest,
    db: Session = Depends(get_db),
):
    quota, cells = evaluate_quota(db, quota_id, payload.facts)

    # For now: simply say "not blocked" but return all matched cell ids
    matched_ids = [c.id for c in cells if c.is_enabled]

    return QuotaEvaluateResult(
        matched_cells=matched_ids,
        blocked=False,
        reason=None,
        action=None,
        action_payload=None,
    )


# ---------- INCREMENT ----------
@router.post("/{quota_id}/increment")
def increment_quota_endpoint(
    quota_id: UUID,
    payload: QuotaIncrementRequest,
    db: Session = Depends(get_db),
):
    row = increment_cell_safe(
        db=db,
        cell_id=payload.matched_cell_id,
        quota_id=quota_id,
        survey_id="",
        respondent_id=payload.respondent_id,
        reason=payload.reason,
        metadata=payload.metadata or {},
    )
    if not row:
        raise HTTPException(status_code=500, detail="Increment failed")

    return {"ok": True, "result": dict(row)}


# ---------- UPDATE ----------
@router.put("/{quota_id}", response_model=QuotaWithCells)
def update_quota_endpoint(
    quota_id: UUID,
    payload: QuotaUpdate,
    db: Session = Depends(get_db),
):
    quota = update_quota(db, quota_id, payload)
    if not quota:
        raise HTTPException(status_code=404, detail="Quota not found")

    return QuotaWithCells(
        id=quota.id,
        org_id=quota.org_id,
        survey_id=quota.survey_id,
        question_id=quota.question_id,
        name=quota.name,
        description=quota.description,
        is_enabled=quota.is_enabled,
        quota_type=quota.quota_type,
        stop_condition=quota.stop_condition,
        when_met=quota.when_met,
        action_payload=quota.action_payload,
        metadata=quota.quota_metadata,
        created_at=quota.created_at,
        updated_at=quota.updated_at,
        cells=[
            QuotaCell(
                id=c.id,
                quota_id=c.quota_id,
                label=c.label,
                cap=c.cap,
                count=c.count,
                condition=c.condition,
                is_enabled=c.is_enabled,
                target_option_id=c.target_option_id,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in (quota.cells or [])
        ],
    )


# ---------- DELETE ----------
@router.delete("/{quota_id}")
def delete_quota_endpoint(
    quota_id: UUID,
    db: Session = Depends(get_db),
):
    ok = delete_quota(db, quota_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Quota not found")

    return {"ok": True}
