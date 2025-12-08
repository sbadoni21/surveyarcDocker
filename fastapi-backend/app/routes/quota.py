# app/routes/quota.py
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..utils.jsonlogic_local import jsonLogic
from ..db import get_db

# Pydantic schemas
from ..schemas.quota import (
    QuotaCreate,
    QuotaCell,
    Quota,
    QuotaWithCells,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
)

# Import service functions explicitly (avoid package import shortcuts)
from ..services.quota import (
    create_quota as create_quota_service,
    fetch_quota_with_cells as fetch_quota_with_cells_service,
    list_quotas_by_survey as list_quotas_by_survey_service,
    evaluate_quota as evaluate_quota_service,
    increment_cell_safe as increment_cell_safe_service,
)

logger = logging.getLogger("quota_routes")
router = APIRouter(prefix="/quotas", tags=["quotas"])


@router.post("", response_model=QuotaWithCells)
async def create_quota_endpoint(payload: QuotaCreate, db: AsyncSession = Depends(get_db)):
    try:
        row = await create_quota_service(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed creating quota")
        # expose a helpful 500 during dev — change in prod if needed
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")

    rc = await fetch_quota_with_cells_service(db, row.id)
    quota = rc["quota"]
    cells = rc["cells"]

    cell_models = []
    for c in cells:
        cell_models.append(
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
        )

    q = QuotaWithCells(
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
        cells=cell_models,
    )
    return q


@router.get("/by-survey/{survey_id}", response_model=list[QuotaWithCells])
async def list_by_survey_endpoint(survey_id: str, db: AsyncSession = Depends(get_db)):
    ids_res = await db.execute(
        "SELECT id FROM survey_quotas WHERE survey_id = :sid AND is_enabled = TRUE ORDER BY created_at ASC",
        {"sid": survey_id},
    )
    ids = [r.id for r in ids_res.fetchall()]
    out = []
    for qid in ids:
        rc = await fetch_quota_with_cells_service(db, qid)
        quota = rc["quota"]
        cells = rc["cells"]
        cell_models = []
        for c in cells:
            cell_models.append(
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
            )
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
                cells=cell_models,
            )
        )
    return out


@router.post("/{quota_id}/evaluate", response_model=QuotaEvaluateResult)
async def evaluate_quota_endpoint(quota_id: str, payload: QuotaEvaluateRequest, db: AsyncSession = Depends(get_db)):
    rc = await evaluate_quota_service(db, quota_id, payload.facts)
    if not rc:
        raise HTTPException(status_code=404, detail="Quota not found")
    quota_row, cells = rc
    matched = []
    blocked = False
    reason = None
    for c in cells:
        if not c.is_enabled:
            continue
        try:
            if jsonLogic(c.condition, payload.facts):
                matched.append(c.id)
                if quota_row.stop_condition == "greater":
                    if c.count >= c.cap:
                        blocked = True
                        reason = f"Cell '{c.label}' full"
                        break
                else:
                    if c.count == c.cap:
                        blocked = True
                        reason = f"Cell '{c.label}' full"
                        break
        except Exception:
            continue
    action = quota_row.when_met if blocked else None
    return QuotaEvaluateResult(
        matched_cells=matched,
        blocked=blocked,
        reason=reason,
        action=action,
        action_payload=quota_row.action_payload if blocked else None,
    )


@router.post("/{quota_id}/increment")
async def increment_endpoint(quota_id: str, payload: QuotaIncrementRequest, db: AsyncSession = Depends(get_db)):
    # wrap service call to produce clear errors and logging
    try:
        res = await increment_cell_safe_service(db, quota_id, payload)
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Increment failed")
        raise HTTPException(status_code=500, detail=str(e))
