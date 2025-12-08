# app/routes/quota_routes.py
from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..schemas.quota import (
    QuotaCreate,
    QuotaWithCells,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
    Quota,
    QuotaCell,
)
from ..services.quota import (
    create_quota,
    fetch_quota_with_cells,
    list_quotas_by_survey,
    evaluate_quota,
    increment_cell_safe,
)

router = APIRouter(prefix="/quotas", tags=["quotas"])


@router.post("", response_model=QuotaWithCells)
def create_quota_endpoint(
    payload: QuotaCreate,
    db: Session = Depends(get_db),
):
    quota_row = create_quota(db, payload)
    rc = fetch_quota_with_cells(db, quota_row.id)
    if not rc:
        raise HTTPException(
            status_code=500, detail="Failed to load quota after creation"
        )

    quota = rc["quota"]
    cells = rc["cells"]

    return QuotaWithCells(
        id=quota.id,
        org_id=quota.org_id,
        survey_id=quota.survey_id,
        name=quota.name,
        description=quota.description,
        is_enabled=quota.is_enabled,
        stop_condition=quota.stop_condition,
        when_met=quota.when_met,
        action_payload=quota.action_payload,
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
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in cells
        ],
    )


@router.get("/{quota_id}", response_model=QuotaWithCells)
def get_quota(
    quota_id: UUID,
    db: Session = Depends(get_db),
):
    rc = fetch_quota_with_cells(db, quota_id)
    if not rc:
        raise HTTPException(status_code=404, detail="Quota not found")

    quota = rc["quota"]
    cells = rc["cells"]

    return QuotaWithCells(
        id=quota.id,
        org_id=quota.org_id,
        survey_id=quota.survey_id,
        name=quota.name,
        description=quota.description,
        is_enabled=quota.is_enabled,
        stop_condition=quota.stop_condition,
        when_met=quota.when_met,
        action_payload=quota.action_payload,
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
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in cells
        ],
    )


@router.get("/by-survey/{survey_id}", response_model=List[QuotaWithCells])
def list_quotas_for_survey(
    survey_id: str,
    db: Session = Depends(get_db),
):
    rows = list_quotas_by_survey(db, survey_id)
    out: List[QuotaWithCells] = []

    for rc in rows:
        quota = rc["quota"]
        cells = rc["cells"]
        out.append(
            QuotaWithCells(
                id=quota.id,
                org_id=quota.org_id,
                survey_id=quota.survey_id,
                name=quota.name,
                description=quota.description,
                is_enabled=quota.is_enabled,
                stop_condition=quota.stop_condition,
                when_met=quota.when_met,
                action_payload=quota.action_payload,
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
                      created_at=c.created_at,
                      updated_at=c.updated_at,
                  )
                  for c in cells
                ],
            )
        )
    return out


@router.post("/{quota_id}/evaluate", response_model=QuotaEvaluateResult)
def evaluate_quota_endpoint(
    quota_id: UUID,
    body: QuotaEvaluateRequest,
    db: Session = Depends(get_db),
):
    res = evaluate_quota(db, quota_id, body.facts)
    if not res:
        raise HTTPException(status_code=404, detail="Quota not found")

    quota, cells = res

    # 🔴 NOTE: This is placeholder logic!
    # You should implement real match logic based on `facts` + `condition`.
    matched_cells_ids = [c.id for c in cells if c.is_enabled]

    blocked = False
    reason = None
    action = None
    action_payload = quota.action_payload or {}

    return QuotaEvaluateResult(
        matched_cells=matched_cells_ids,
        blocked=blocked,
        reason=reason,
        action=action,
        action_payload=action_payload,
    )


@router.post("/{quota_id}/increment")
def increment_quota_cell_endpoint(
    quota_id: UUID,
    body: QuotaIncrementRequest,
    db: Session = Depends(get_db),
):
    row = increment_cell_safe(
        db=db,
        cell_id=body.matched_cell_id,
        quota_id=quota_id,
        survey_id="",  # fill if you want or fetch from quota
        respondent_id=body.respondent_id,
        reason=body.reason,
        metadata=body.metadata,
    )
    if not row:
        raise HTTPException(
            status_code=500, detail="Failed to increment quota cell"
        )
    return {"ok": True, "result": dict(row)}
