from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from ..utils.jsonlogic_local import jsonLogic
from ..db import get_db
from ..models.quota import SurveyQuota, SurveyQuotaCell, SurveyQuotaEvent
# import Pydantic schemas (types) you declared
from ..schemas.quota import (
    QuotaCreate,
    QuotaCell,
    Quota,
    QuotaWithCells,
    QuotaEvaluateRequest,
    QuotaEvaluateResult,
    QuotaIncrementRequest,
)
# import crud functions (adjust path if your crud is somewhere else)
from ..services.quota import create_quota,fetch_quota_with_cells, list_quotas_by_survey, evaluate_quota

router = APIRouter(prefix="/quotas", tags=["quotas"])


@router.post("", response_model=QuotaWithCells)
async def create_quota(payload: QuotaCreate, db: AsyncSession = Depends(get_db)):
    """
    Create a new quota and its cells.
    """
    row = await create_quota(db, payload)
    # fetch fresh
    rc = await fetch_quota_with_cells(db, row.id)
    quota = rc["quota"]
    cells = rc["cells"]

    # convert to Pydantic response shape
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
async def list_by_survey(survey_id: str, db: AsyncSession = Depends(get_db)):
    ids_res = await db.execute(
        "SELECT id FROM survey_quotas WHERE survey_id = :sid AND is_enabled = TRUE ORDER BY created_at ASC",
        {"sid": survey_id},
    )
    ids = [r.id for r in ids_res.fetchall()]
    out = []
    for qid in ids:
        rc = await fetch_quota_with_cells(db, qid)
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
async def evaluate_quota(quota_id: str, payload: QuotaEvaluateRequest, db: AsyncSession = Depends(get_db)):
    rc = await evaluate_quota(db, quota_id, payload.facts)
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
            # evaluate JSONLogic condition
            if jsonLogic(c.condition, payload.facts):
                matched.append(c.id)
                # check capacity depending on stop_condition
                if quota_row.stop_condition == "greater":
                    if c.count >= c.cap:
                        blocked = True
                        reason = f"Cell '{c.label}' full"
                        break
                else:  # equal
                    if c.count == c.cap:
                        blocked = True
                        reason = f"Cell '{c.label}' full"
                        break
        except Exception:
            # invalid rule -> skip this cell
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
async def increment(quota_id: str, payload: QuotaIncrementRequest, db: AsyncSession = Depends(get_db)):
    # We need the survey_id from the quota
    qres = await db.execute("SELECT survey_id FROM survey_quotas WHERE id = :qid", {"qid": quota_id})
    qrow = qres.first()
    if not qrow:
        raise HTTPException(status_code=404, detail="Quota not found")
    survey_id = qrow.survey_id

    # find quota_id for the cell (payload gives matched_cell_id)
    cres = await db.execute("SELECT quota_id FROM survey_quota_cells WHERE id = :cid", {"cid": str(payload.matched_cell_id)})
    crow = cres.first()
    if not crow:
        raise HTTPException(status_code=404, detail="Cell not found")
    cell_quota_id = crow.quota_id

    # call stored function (quota_cell_increment_safe)
    res = await db.execute(
        "SELECT * FROM quota_cell_increment_safe(:cell_id, :quota_id, :survey_id, :respondent_id, :reason, :meta)",
        {
            "cell_id": str(payload.matched_cell_id),
            "quota_id": str(cell_quota_id),
            "survey_id": str(survey_id),
            "respondent_id": str(payload.respondent_id) if payload.respondent_id else None,
            "reason": payload.reason,
            "meta": payload.metadata or {},
        },
    )
    row = res.first()
    if not row:
        raise HTTPException(status_code=400, detail="Increment failed")
    return {"ok": row.ok, "new_count": row.new_count, "cap": row.cap}
