"""
Translation Management API Endpoints
Clean, collision-free implementation for question & translation management
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

from ..db import get_db
from ..models.questions import Question
from ..models.user import User
from ..schemas.questions import (
    QuestionCreate,
    QuestionUpdate,
    QuestionOut,
    BulkQuestionsRequest,
    InitializeTranslationRequest,
    InitializeTranslationResponse,
    ResyncTranslationResponse
)
from ..services.redis_question_service import RedisQuestionService
from ..policies.auth import get_current_user
from ..utils.translation_utils import (
    apply_translation,
    merge_translations,
    create_blank_translation_structure,
    get_translatable_config_fields,
)

# ============================================================
# ROUTER
# ============================================================
from ..services.question_label_service import generate_next_serial_label


router = APIRouter(prefix="/questions", tags=["Questions"])

# ============================================================
# SCHEMAS
# ============================================================

class TranslationContent(BaseModel):
    label: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class TranslationUpdate(BaseModel):
    translations: Dict[str, TranslationContent]


class LocaleTranslation(BaseModel):
    locale: str
    label: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


# ============================================================
# SURVEY-LEVEL (MOST SPECIFIC – ALWAYS FIRST)
# ============================================================

@router.get("/surveys/{survey_id}/questions", response_model=List[QuestionOut])
def get_survey_questions(
    survey_id: str,
    locale: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    if not questions:
        return []

    result = []
    for q in questions:
        qd = q.to_dict()
        if locale:
            qd = apply_translation(qd, locale)
        result.append(qd)

    RedisQuestionService.cache_questions_list(
        survey_id,
        [q.to_dict() for q in questions]
    )
    return result


@router.get("/surveys/{survey_id}/translations/coverage")
def survey_translation_coverage(
    survey_id: str,
    db: Session = Depends(get_db),
):
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    if not questions:
        raise HTTPException(404, "No questions found")

    locale_map: Dict[str, int] = {}
    for q in questions:
        for locale in (q.translations or {}).keys():
            locale_map[locale] = locale_map.get(locale, 0) + 1

    total = len(questions)
    return {
        "survey_id": survey_id,
        "total_questions": total,
        "coverage": {
            k: {
                "count": v,
                "percentage": round(v / total * 100, 2),
            }
            for k, v in locale_map.items()
        },
    }


@router.post(
    "/surveys/{survey_id}/translations/initialize",
    response_model=InitializeTranslationResponse
)
def initialize_survey_translations(
    payload: InitializeTranslationRequest,
    db: Session = Depends(get_db),
):
    """Initialize translations for all questions in a survey"""
    questions = db.query(Question).filter(
        Question.survey_id == payload.survey_id
    ).all()

    if not questions:
        raise HTTPException(404, "No questions found")

    updated = 0
    for q in questions:
        translations = q.translations or {}

        # Skip if translation already exists
        if payload.locale in translations:
            continue

        # Create the translation structure with source values
        translations[payload.locale] = create_blank_translation_structure(
            q, payload.locale
        )
        
        # Mark as modified for SQLAlchemy
        from sqlalchemy.orm.attributes import flag_modified
        q.translations = translations
        flag_modified(q, "translations")
        
        q.updated_at = datetime.now(timezone.utc)
        updated += 1

    db.commit()

    return {
        "success": True,
        "locale": payload.locale,
        "questions_updated": updated,
        "message": f"Initialized {payload.locale} translations for {updated} questions",
    }


# ============================================================
# QUESTION CRUD
# ============================================================

@router.post("/", response_model=QuestionOut)
def create_question(
    data: QuestionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = Question(**data.dict(exclude_unset=True))
def create_question(data: QuestionCreate, db: Session = Depends(get_db)):
    serial_label = data.serial_label

    # ✅ Auto-generate if not provided
    if not serial_label:
        serial_label = generate_next_serial_label(db, data.survey_id, prefix="Q")

    # ❌ Check uniqueness
    exists = (
        db.query(Question)
        .filter(
            Question.survey_id == data.survey_id,
            Question.serial_label == serial_label,
        )
        .first()
    )
    if exists:
        raise HTTPException(409, detail="serial_label already exists in this survey")

    q = Question(
        question_id=data.question_id,
        survey_id=data.survey_id,
        org_id=data.org_id,
        project_id=data.project_id,
        type=data.type,

        label=data.label,
        serial_label=serial_label,   # ✅

        required=data.required if data.required is not None else True,
        description=data.description or "",
        config=data.config or {},
        logic=data.logic or [],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(q)
    db.commit()
    db.refresh(q)

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    RedisQuestionService.remove_from_list(q.survey_id)

    return q.to_dict()


@router.get("/{question_id}", response_model=QuestionOut)
def get_question(
    question_id: str,
    locale: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
    RedisQuestionService.cache_question(q.survey_id, q)
    RedisQuestionService.cache_questions_list(q.survey_id, [q])

    return q

@router.get("/{survey_id}", response_model=List[QuestionOut])
def get_all_questions(survey_id: str, db: Session = Depends(get_db)):
    # Try to get from cache
    cached = RedisQuestionService.get_questions_for_survey(survey_id)
    if cached is not None:  # Explicitly check for None, not just falsy
        print(f"[API] Returning {len(cached)} questions from cache for survey {survey_id}")
        return cached

    # Cache miss or expired - fetch from DB
    print(f"[API] Cache miss for survey {survey_id}, fetching from DB")
    rows = db.query(Question).filter(Question.survey_id == survey_id).all()
    
    # Cache the results if we got any
    if rows:
        print(f"[API] Caching {len(rows)} questions for survey {survey_id}")
        RedisQuestionService.cache_questions_list(survey_id, rows)
    
    return rows

@router.get("/{survey_id}/{question_id}", response_model=QuestionOut)
def get_question(survey_id: str, question_id: str, db: Session = Depends(get_db)):
    cached = RedisQuestionService.get_question(survey_id, question_id)
    if cached is not None:
        return cached

    q = (
        db.query(Question)
        .filter(Question.survey_id == survey_id, Question.question_id == question_id)
        .first()
    )
    if not q:
        raise HTTPException(404, "Question not found")

    qd = q.to_dict()
    if locale:
        qd = apply_translation(qd, locale)
    return qd


@router.patch("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: str,
    data: QuestionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
@router.patch("/{survey_id}/{question_id}", response_model=QuestionOut)
def update_question(survey_id: str, question_id: str, data: QuestionUpdate, db: Session = Depends(get_db)):
    q = (
        db.query(Question)
        .filter(
            Question.survey_id == survey_id,
            Question.question_id == question_id,
        )
        .first()
    )
    if not q:
        raise HTTPException(404, "Question not found")

    for k, v in data.dict(exclude_unset=True).items():
    if data.serial_label:
        dup = (
            db.query(Question)
            .filter(
                Question.survey_id == survey_id,
                Question.serial_label == data.serial_label,
                Question.question_id != question_id,
            )
            .first()
        )
        if dup:
            raise HTTPException(409, detail="serial_label already exists")

    updates = data.dict(exclude_unset=True)
    for k, v in updates.items():
        setattr(q, k, v)

    q.updated_at = datetime.now(timezone.utc)

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    RedisQuestionService.remove_from_list(q.survey_id)

    return q.to_dict()

    RedisQuestionService.cache_question(survey_id, q)
    return q

@router.delete("/{question_id}")
def delete_question(
    question_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    survey_id = q.survey_id
    db.delete(q)
    db.commit()

    RedisQuestionService.invalidate_question(survey_id, question_id)
    RedisQuestionService.remove_from_list(survey_id)
    return {"success": True}


# ============================================================
# QUESTION TRANSLATIONS
# ============================================================

@router.get("/{question_id}/translated")
def get_translated_question(
    question_id: str,
    locale: str = Query("en"),
    db: Session = Depends(get_db),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    qd = apply_translation(q.to_dict(), locale)
    qd["locale"] = locale
    return qd


@router.get("/{question_id}/translations")
def get_question_translations(
    question_id: str,
    db: Session = Depends(get_db),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    return {
        "question_id": question_id,
        "translations": q.translations or {},
        "available_locales": list((q.translations or {}).keys()),
    }


@router.get("/{question_id}/translations/blank/{locale}")
def get_blank_translation(
    question_id: str,
    locale: str,
    db: Session = Depends(get_db),
):
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    return {
        "question_id": question_id,
        "locale": locale,
        "structure": create_blank_translation_structure(q, locale),
        "translatable_fields": get_translatable_config_fields(q.type),
    }


@router.put("/{question_id}/translations")
def update_translations(
    question_id: str,
    payload: TranslationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update multiple locale translations at once"""
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    translations = q.translations or {}
    
    # Iterate through incoming translations
    for locale, content in payload.translations.items():
        # Initialize locale if it doesn't exist - COPY from source
        if locale not in translations:
            translations[locale] = create_blank_translation_structure(q, locale)
        
        # Convert Pydantic model to dict and exclude None values
        incoming = content.dict(exclude_none=True)
        
        # Update each field - SKIP EMPTY VALUES
        if "label" in incoming and incoming["label"] and incoming["label"].strip():
            translations[locale]["label"] = incoming["label"]
        
        if "description" in incoming and incoming["description"] and incoming["description"].strip():
            translations[locale]["description"] = incoming["description"]
        
        if "config" in incoming:
            if "config" not in translations[locale]:
                translations[locale]["config"] = {}
            
            for key, value in incoming["config"].items():
                # Only update if value is not empty
                if value is not None and str(value).strip():
                    translations[locale]["config"][key] = value
    
    # Mark as modified for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    q.translations = translations
    flag_modified(q, "translations")
    
    q.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    return {"success": True, "translations": translations}


@router.put("/{question_id}/translations/{locale}")
def update_locale_translation(
    question_id: str,
    locale: str,
    payload: LocaleTranslation,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update a single locale translation"""
    if payload.locale != locale:
        raise HTTPException(400, "Locale mismatch")

    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    translations = q.translations or {}
    
    # Initialize locale if it doesn't exist - COPY from source
    if locale not in translations:
        translations[locale] = create_blank_translation_structure(q, locale)
    
    # Get incoming data (exclude locale field and None values)
    incoming = payload.dict(exclude={"locale"}, exclude_none=True)
    
    # Merge the translations properly - SKIP EMPTY VALUES
    if "label" in incoming and incoming["label"] and incoming["label"].strip():
        translations[locale]["label"] = incoming["label"]
    
    if "description" in incoming and incoming["description"] and incoming["description"].strip():
        translations[locale]["description"] = incoming["description"]
    
    if "config" in incoming:
        if "config" not in translations[locale]:
            translations[locale]["config"] = {}
        
        # Merge config fields - SKIP EMPTY VALUES
        for key, value in incoming["config"].items():
            if value is not None and str(value).strip():
                translations[locale]["config"][key] = value
    
    # Mark as modified for SQLAlchemy to detect changes
    from sqlalchemy.orm.attributes import flag_modified
    q.translations = translations
    flag_modified(q, "translations")
    
    q.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    return {
        "success": True, 
        "locale": locale,
        "translation": translations[locale]
    }


@router.post("/{question_id}/translations/{locale}/initialize")
def initialize_question_locale(
    question_id: str,
    locale: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Initialize a specific locale for a question by copying source values"""
    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")
    
    translations = q.translations or {}
    
    # Check if already exists
    if locale in translations:
        return {
            "success": True,
            "message": f"Locale '{locale}' already exists",
            "translation": translations[locale]
        }
    
    # Create new translation with copied values
    translations[locale] = create_blank_translation_structure(q, locale)
    
    # Mark as modified for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    q.translations = translations
    flag_modified(q, "translations")
    
    q.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)
    
    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    
    return {
        "success": True,
        "message": f"Locale '{locale}' initialized successfully",
        "translation": translations[locale]
    }


@router.delete("/{question_id}/translations/{locale}")
def delete_locale_translation(
    question_id: str,
    locale: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if locale == "en":
        raise HTTPException(400, "Cannot delete primary language")

    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    translations = q.translations or {}
    if locale not in translations:
        raise HTTPException(404, f"Translation for '{locale}' not found")
    
    translations.pop(locale, None)

    from sqlalchemy.orm.attributes import flag_modified
    q.translations = translations
    flag_modified(q, "translations")
    
    q.updated_at = datetime.now(timezone.utc)
    db.commit()

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    return {"success": True, "locale": locale, "message": f"Deleted {locale} translation"}


@router.delete("/{question_id}/translations")
def delete_all_translations(
    question_id: str,
    confirm: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not confirm:
        raise HTTPException(400, "confirm=true required")

    q = db.query(Question).filter(Question.question_id == question_id).first()
    if not q:
        raise HTTPException(404, "Question not found")

    from sqlalchemy.orm.attributes import flag_modified
    q.translations = {}
    flag_modified(q, "translations")
    
    q.updated_at = datetime.now(timezone.utc)
    db.commit()

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    return {"success": True, "message": "All translations deleted"}


# ============================================================
# BULK
# ============================================================

@router.post("/bulk", response_model=List[QuestionOut])
def get_bulk_questions(
    data: BulkQuestionsRequest,
    db: Session = Depends(get_db),
):
    if not data.question_ids:
        return []

    rows = db.query(Question).filter(
        Question.question_id.in_(data.question_ids)
    ).all()

    result = []
    for q in rows:
        qd = q.to_dict()
        if data.locale:
            qd = apply_translation(qd, data.locale)
        result.append(qd)

    return result
@router.post(
    "/surveys/{survey_id}/translations/resync",
    response_model=ResyncTranslationResponse
)
def resync_survey_translations(
    survey_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Backfill missing translations for newly added questions
    without touching existing translations.
    """

    questions = (
        db.query(Question)
        .filter(Question.survey_id == survey_id)
        .all()
    )

    if not questions:
        raise HTTPException(404, "No questions found")

    # 1️⃣ Collect all locales used in survey
    all_locales = set()
    for q in questions:
        for locale in (q.translations or {}).keys():
            all_locales.add(locale)

    if not all_locales:
        return {
            "success": True,
            "survey_id": survey_id,
            "locales": [],
            "questions_updated": 0,
        }

    updated = 0

    from sqlalchemy.orm.attributes import flag_modified

    # 2️⃣ Backfill missing locales per question
    for q in questions:
        translations = q.translations or {}
        changed = False

        for locale in all_locales:
            if locale not in translations:
                translations[locale] = create_blank_translation_structure(
                    q, locale
                )
                changed = True

        if changed:
            q.translations = translations
            flag_modified(q, "translations")
            q.updated_at = datetime.now(timezone.utc)
            updated += 1

            RedisQuestionService.invalidate_question(
                q.survey_id, q.question_id
            )

    db.commit()

    RedisQuestionService.remove_from_list(survey_id)

    return {
        "success": True,
        "survey_id": survey_id,
        "locales": sorted(all_locales),
        "questions_updated": updated,
    }
