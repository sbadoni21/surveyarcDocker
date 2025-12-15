"""
Translation Management API Endpoints
Clean, collision-free implementation for question & translation management
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import UploadFile, File, Form
from fastapi.responses import StreamingResponse
from io import BytesIO

from ..db import get_db
from ..models.questions import Question
from ..models.user import User
from ..schemas.questions import (
    QuestionCreate,
    CSVUploadResponse,
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
    from ..models.survey import Survey
    
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    
    if not questions:
        raise HTTPException(404, "No questions found")

    locale_map: Dict[str, int] = {}
    for q in questions:
        for locale in (q.translations or {}).keys():
            locale_map[locale] = locale_map.get(locale, 0) + 1

    total = len(questions)
    
    # Get locales from survey metadata
    survey_locales = (survey.meta_data or {}).get("locales", []) if survey else []
    
    return {
        "survey_id": survey_id,
        "total_questions": total,
        "available_locales": survey_locales,
        "coverage": {
            k: {
                "count": v,
                "percentage": round(v / total * 100, 2),
            }
            for k, v in locale_map.items()
        },
    }
# In your questions.py routes file

@router.post(
    "/surveys/{survey_id}/translations/initialize",
    response_model=InitializeTranslationResponse
)
def initialize_survey_translations(
    payload: InitializeTranslationRequest,
    db: Session = Depends(get_db),
):
    """Initialize translations for all questions in a survey"""
    from ..models.survey import Survey
    
    # Get survey first
    survey = db.query(Survey).filter(Survey.survey_id == payload.survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")
    
    # Get all questions
    questions = db.query(Question).filter(
        Question.survey_id == payload.survey_id
    ).all()

    if not questions:
        raise HTTPException(404, "No questions found")

    updated = 0
    from sqlalchemy.orm.attributes import flag_modified
    
    for q in questions:
        translations = q.translations or {}

        # 1️⃣ ALWAYS ensure "en" exists first
        if "en" not in translations:
            translations["en"] = create_blank_translation_structure(q, "en")
            updated += 1

        # 2️⃣ Add the requested locale (skip if already exists)
        if payload.locale != "en" and payload.locale not in translations:
            translations[payload.locale] = create_blank_translation_structure(q, payload.locale)
            updated += 1
        
        # Mark as modified for SQLAlchemy
        q.translations = translations
        flag_modified(q, "translations")
        q.updated_at = datetime.now(timezone.utc)

    db.commit()

    # 3️⃣ Update survey metadata with available locales
    all_locales = set(["en"])  # Always include English
    for q in questions:
        if q.translations:
            all_locales.update(q.translations.keys())
    
    # Update survey meta_data
    meta_data = survey.meta_data or {}
    meta_data["locales"] = sorted(list(all_locales))
    
    survey.meta_data = meta_data
    flag_modified(survey, "meta_data")
    survey.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(survey)

    # Invalidate caches
    from ..services.redis_survey_service import RedisSurveyService
    RedisSurveyService.invalidate_survey(payload.survey_id)
    RedisQuestionService.remove_from_list(payload.survey_id)

    return {
        "success": True,
        "locale": payload.locale,
        "questions_updated": updated,
        "message": f"Initialized {payload.locale} translations for {updated} questions. Available locales: {', '.join(sorted(all_locales))}",
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
    if not q:
        raise HTTPException(404, "Question not found")

    qd = q.to_dict()
    print(qd)
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
    if not q:
        raise HTTPException(404, "Question not found")

    for k, v in data.dict(exclude_unset=True).items():
        setattr(q, k, v)

    q.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(q)

    RedisQuestionService.invalidate_question(q.survey_id, q.question_id)
    RedisQuestionService.remove_from_list(q.survey_id)

    return q.to_dict()


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
    from ..models.survey import Survey
    from sqlalchemy.orm.attributes import flag_modified

    # Get survey
    survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
    if not survey:
        raise HTTPException(404, "Survey not found")

    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    if not questions:
        raise HTTPException(404, "No questions found")

    # 1️⃣ Collect all locales used in survey
    all_locales = set(["en"])  # Always include English
    for q in questions:
        for locale in (q.translations or {}).keys():
            all_locales.add(locale)

    if len(all_locales) == 1:  # Only "en"
        return {
            "success": True,
            "survey_id": survey_id,
            "locales": ["en"],
            "questions_updated": 0,
        }

    updated = 0

    # 2️⃣ Backfill missing locales per question
    for q in questions:
        translations = q.translations or {}
        changed = False

        # Ensure "en" exists first
        if "en" not in translations:
            translations["en"] = create_blank_translation_structure(q, "en")
            changed = True

        # Add other locales
        for locale in all_locales:
            if locale != "en" and locale not in translations:
                translations[locale] = create_blank_translation_structure(q, locale)
                changed = True

        if changed:
            q.translations = translations
            flag_modified(q, "translations")
            q.updated_at = datetime.now(timezone.utc)
            updated += 1

            RedisQuestionService.invalidate_question(q.survey_id, q.question_id)

    db.commit()

    # 3️⃣ Update survey metadata
    meta_data = survey.meta_data or {}
    meta_data["locales"] = sorted(list(all_locales))
    
    survey.meta_data = meta_data
    flag_modified(survey, "meta_data")
    survey.updated_at = datetime.now(timezone.utc)
    db.commit()

    # Invalidate caches
    from ..services.redis_survey_service import RedisSurveyService
    RedisSurveyService.invalidate_survey(survey_id)
    RedisQuestionService.remove_from_list(survey_id)

    return {
        "success": True,
        "survey_id": survey_id,
        "locales": sorted(all_locales),
        "questions_updated": updated,
    }

@router.post(
    "/surveys/{survey_id}/translations/upload-csv",
    response_model=CSVUploadResponse
)
async def upload_translation_csv(
    survey_id: str,
    file: UploadFile = File(...),
    dry_run: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Upload CSV file with translations for bulk update
    
    Expected CSV format:
    ```
    Resource,Type,en,es,fr
    Q198246,label,What is your favorite fruit?,¿Cuál es tu fruta favorita?,Quel est votre fruit préféré?
    Q198246,description,Help text here,Texto de ayuda,Texte d'aide
    Q198246,config.placeholder,Select option,Selecciona opción,Sélectionnez
    Q734976,label,Enter your thoughts,Ingresa tus comentarios,Entrez vos pensées
    ```
    
    Parameters:
    - file: CSV file upload
    - dry_run: If true, validate only without saving
    - survey_id: Target survey
    
    Returns summary of upload operation
    """
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    # Read file content
    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
    except Exception as e:
        raise HTTPException(400, f"Failed to read CSV file: {str(e)}")
    
    # Import the utility function
    from ..utils.translation_utils import process_csv_translation_upload
    
    # Process upload
    result = process_csv_translation_upload(
        csv_content=csv_content,
        survey_id=survey_id,
        db=db,
        dry_run=dry_run
    )
    
    if not result["success"]:
        raise HTTPException(400, result.get("error", "Upload failed"))
    
    return result


# ============================================================
# CSV DOWNLOAD/EXPORT ENDPOINT
# ============================================================

@router.get("/surveys/{survey_id}/translations/export-csv")
def export_translation_csv(
    survey_id: str,
    include_values: bool = True,
    locales: Optional[str] = Query(None, description="Comma-separated locales, e.g., 'en,es,fr'"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Download CSV template for translation upload
    
    Parameters:
    - survey_id: Target survey
    - include_values: If true, include existing translations (default: true)
    - locales: Comma-separated list of locales to include (optional)
    
    Returns CSV file download
    """
    
    from ..utils.translation_utils import generate_translation_csv_template
    
    # Parse locales
    target_locales = None
    if locales:
        target_locales = [l.strip() for l in locales.split(",") if l.strip()]
    
    # Generate CSV
    csv_content = generate_translation_csv_template(
        survey_id=survey_id,
        db=db,
        include_values=include_values,
        target_locales=target_locales
    )
    
    # Return as downloadable file
    output = BytesIO()
    output.write(csv_content.encode('utf-8'))
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=translations_{survey_id}.csv"
        }
    )


# ============================================================
# CSV VALIDATION ENDPOINT (DRY RUN)
# ============================================================

@router.post("/surveys/{survey_id}/translations/validate-csv")
async def validate_translation_csv(
    survey_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Validate CSV file without applying changes
    Same as upload with dry_run=true
    """
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "File must be a CSV")
    
    try:
        content = await file.read()
        csv_content = content.decode('utf-8')
    except Exception as e:
        raise HTTPException(400, f"Failed to read CSV file: {str(e)}")
    
    from ..utils.translation_utils import process_csv_translation_upload
    
    result = process_csv_translation_upload(
        csv_content=csv_content,
        survey_id=survey_id,
        db=db,
        dry_run=True  # Always dry run for validation
    )
    
    return {
        **result,
        "message": "Validation complete. Use /upload-csv with dry_run=false to apply changes."
    }

