# app/routes/quota.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.jsonlogic_local import jsonLogic
from ..db import get_db

# Schemas
from ..schemas.quota import (
    QuotaCreate,
    QuotaCell,
    QuotaWithCells,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
)

# Service layer
from ..services import quota as quota_service


router = APIRouter(prefix="/quotas", tags=["quotas"])


# ------------------------------------------------------------
# Helper: Convert cell SQLAlchemy objects → Pydantic Models
# ------------------------------------------------------------
def to_quota_cell_model(cell) -> QuotaCell:
    return QuotaCell(
        id=cell.id,
        quota_id=cell.quota_id,
        label=cell.label,
        cap=cell.cap,
        count=cell.count,
        condition=cell.condition,
        is_enabled=cell.is_enabled,
        created_at=cell.created_at,
        updated_at=cell.updated_at,
    )


# ------------------------------------------------------------
# Create Quota
# ------------------------------------------------------------
@router.post("", response_model=QuotaWithCells)
async def create_quota_endpoint(
    payload: QuotaCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new quota along with its cells.
    """
    try:
        created = await quota_service.create_quota(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")

    # Fetch updated version with cells
    rc = await quota_service.fetch_quota_with_cells(db, created.id)

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
        cells=[to_quota_cell_model(c) for c in cells],
    )


# ------------------------------------------------------------
# List quotas by survey
# ------------------------------------------------------------
@router.get("/by-survey/{survey_id}", response_model=list[QuotaWithCells])
async def list_by_survey(
    survey_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all enabled quotas for a survey.
    """
    quota_ids = await quota_service.fetch_quota_ids_by_survey(db, survey_id)
    results = []

    for qid in quota_ids:
        rc = await quota_service.fetch_quota_with_cells(db, qid)
        quota = rc["quota"]
        cells = rc["cells"]

        results.append(
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
                cells=[to_quota_cell_model(c) for c in cells],
            )
        )

    return results


# ------------------------------------------------------------
# Evaluate Quota
# ------------------------------------------------------------
@router.post("/{quota_id}/evaluate", response_model=QuotaEvaluateResult)
async def evaluate_quota_endpoint(
    quota_id: str,
    payload: QuotaEvaluateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluate JSONLogic rules for a quota and determine if the respondent is allowed.
    """
    rc = await quota_service.evaluate_quota(db, quota_id, payload.facts)
    if not rc:
        raise HTTPException(status_code=404, detail="Quota not found")

    quota_row, cells = rc

    matched_cells = []
    blocked = False
    reason = None

    for cell in cells:
        if not cell.is_enabled:
            continue

        try:
            if jsonLogic(cell.condition, payload.facts):
                matched_cells.append(cell.id)

                # capacity check
                if quota_row.stop_condition == "greater":
                    if cell.count >= cell.cap:
                        blocked = True
                        reason = f"Cell '{cell.label}' full"
                        break
                else:  # equal logic
                    if cell.count == cell.cap:
                        blocked = True
                        reason = f"Cell '{cell.label}' full"
                        break

        except Exception:
            # Skip invalid rules instead of failing entire evaluation
            continue

    return QuotaEvaluateResult(
        matched_cells=matched_cells,
        blocked=blocked,
        reason=reason,
        action=quota_row.when_met if blocked else None,
        action_payload=quota_row.action_payload if blocked else None,
    )


# ------------------------------------------------------------
# Increment Quota
# ------------------------------------------------------------
@router.post("/{quota_id}/increment")
async def increment_quota_endpoint(
    quota_id: str,
    payload: QuotaIncrementRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Increment quota counters for matched cells.
    Uses service-layer logic to avoid race conditions.
    """
    return await quota_service.increment_quota(db, quota_id, payload)
