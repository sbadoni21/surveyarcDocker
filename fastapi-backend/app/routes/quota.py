# app/routes/quota.py
import logging
import inspect
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..utils.jsonlogic_local import jsonLogic
from ..db import get_db

from ..schemas.quota import (
    QuotaCreate,
    QuotaCell,
    Quota,
    QuotaWithCells,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
)

from ..services.quota import (
    create_quota as create_quota_service,
    fetch_quota_with_cells as fetch_quota_with_cells_service,
    list_quotas_by_survey as list_quotas_by_survey_service,
    evaluate_quota as evaluate_quota_service,
    increment_cell_safe as increment_cell_safe_service,
)

logger = logging.getLogger("quota_routes")
router = APIRouter(prefix="/quotas", tags=["quotas"])

# sanity checks on import
def _check_service_callable(name, fn):
    if fn is None:
        logger.error("Service import check FAILED: %s is None", name)
        return False
    if not callable(fn):
        logger.error("Service import check FAILED: %s is not callable (type=%s)", name, type(fn))
        return False
    logger.info("Service %s imported from %s; iscoroutinefunction=%s", name, getattr(fn, "__module__", "<unknown>"), inspect.iscoroutinefunction(fn))
    return True

_checks = {
    "create_quota_service": _check_service_callable("create_quota_service", create_quota_service),
    "fetch_quota_with_cells_service": _check_service_callable("fetch_quota_with_cells_service", fetch_quota_with_cells_service),
    "evaluate_quota_service": _check_service_callable("evaluate_quota_service", evaluate_quota_service),
    "increment_cell_safe_service": _check_service_callable("increment_cell_safe_service", increment_cell_safe_service),
}

if not all(_checks.values()):
    missing = [k for k, ok in _checks.items() if not ok]
    msg = f"Service import issues detected for: {', '.join(missing)}. See server logs for details."
    logger.error(msg)
    raise RuntimeError(msg)


@router.post("", response_model=QuotaWithCells)
async def create_quota_endpoint(payload: QuotaCreate, db: AsyncSession = Depends(get_db)):
    try:
        row = await create_quota_service(db, payload)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed creating quota")
        raise HTTPException(status_code=500, detail=f"Failed to create quota: {e}")

    rc = await fetch_quota_with_cells_service(db, row.id)
    if not rc:
        raise HTTPException(status_code=500, detail="Failed to fetch created quota")

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
    try:
        # payload is QuotaIncrementRequest (Pydantic)
        # call helper increment function. increment_cell_safe returns row with ok/new_count/cap or raises.
        res = await increment_cell_safe_service(db, payload.matched_cell_id, quota_id, payload.respondent_id, payload.reason, payload.metadata)
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Increment failed")
        raise HTTPException(status_code=500, detail=str(e))
