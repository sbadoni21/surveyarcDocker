"""
Utility functions for handling question translations
Decipher / Qualtrics level implementation
"""

from typing import Dict, Any, List, Tuple
import copy
from ..models.questions import Question
import csv
from sqlalchemy.orm import Session
from ..models.questions import Question

from io import StringIO

# ============================================================
# CONFIG FIELDS THAT REQUIRE TRANSLATION (BY QUESTION TYPE)
# ============================================================

def get_translatable_config_fields(question_type: str) -> list:
    return {
        # =========================
        # SCREEN / FLOW QUESTIONS
        # =========================
        "welcome_screen": ["title", "description"],
        "end_screen": ["title", "description"],
        "statement": ["text","title","description"],
        "redirect": ["buttonText","title","description"],
        "auto_sum":["itemDescriptions","title","description","label","items"],

        # =========================
        # BASIC INPUTS
        # =========================
        "long_text": ["placeholder","title","description"],
        "short_text": ["placeholder","title","description"],
        "number": ["placeholder","title","description"],
        "date": ["placeholder","title","description"],
        "contact_email": ["placeholder","title","description"],
        "contact_phone": ["placeholder","title","description"],
        "contact_address": ["placeholder","title","description"],
        "contact_website": ["placeholder","title","description"],

        # =========================
        # CHOICE BASED
        # =========================
        "multiple_choice": ["options", "choices", "placeholder"],
        "checkbox": ["options", "placeholder","description","label"],
        "dropdown": ["options", "placeholder", "description","label"],
        "picture_choice": ["images","title","description"],
        "yes_no": ["yesLabel", "noLabel","title","description"],
        "legal": ["statement","title","description"],

        # =========================
        # SCALES & RATINGS
        # =========================
        "nps": ["minLabel", "maxLabel","title","description"],
        "rating": ["title","description"],  # only top label
        "likert": ["labels","title","description"],
        "smiley_rating": ["labels","title","description"],
        "opinion_scale": ["minLabel", "maxLabel","title","description"],
        "slider": ["prefix", "suffix", "anchors","title","description"],

        # =========================
        # GRIDS
        # =========================
        "table_grid": ["rows", "columns","title","description"],
        "multi_grid": ["rows", "columns","title","description"],
        "matrix_rating": [
            "rows",
            "columns",
            "lowLabel",
            "highLabel",
            "neutralLabel",
            "title","description"
        ],

        # =========================
        # ADVANCED
        # =========================
        "semantic_diff": ["items","title","description"],
        "side_by_side": [
            "leftLabel",
            "rightLabel",
            "attributes",
            "leftBiasLabel",
            "rightBiasLabel",
            "neutralLabel",
            "title","description"
        ],
        "comparison_grid": ["attributes", "brands", "noneLabel","title","description"],
        "segmentation_selector": ["segments","title","description"],
        "persona_quiz": ["personas", "items","title","description"],

        # =========================
        # MONADIC / CONCEPT
        # =========================
        "monadic_test": ["stimulusLabel","title","description"],
        "sequential_monadic": ["stimulusLabel","title","description"],
        "forced_exposure": ["instruction","title","description"],

        # =========================
        # RESEARCH
        # =========================
        "gabor_granger": [
            "productName",
            "likertOptions",
            "yesLabel",
            "noLabel","title","description"
        ],
        "price_sensitivity": ["description","label",
            "tooCheapLabel",
            "cheapLabel",
            "expensiveLabel",
            "tooExpensiveLabel",
        ],
        "conjoint": ["attributes", "description","label"],
        "maxdiff": ["items", "description","label"],
        "turf": ["items","title","description"],
        "ranking": ["items","title","description"],
        "weighted_multi": ["options","title","description"],
    }.get(question_type, [])

# ============================================================
# APPLY TRANSLATION TO A SINGLE CONFIG FIELD
# ============================================================

def translate_config_field(
    field_name: str,
    field_value: Any,
    translation_config: Dict[str, Any]
) -> Any:
    """
    Translate a specific config field safely
    """

    if not translation_config or field_name not in translation_config:
        return field_value

    translated = translation_config[field_name]

    # -----------------------
    # LIST HANDLING
    # -----------------------
    if isinstance(field_value, list):

        # List[str]
        if all(isinstance(v, str) for v in field_value):
            if isinstance(translated, list) and len(translated) == len(field_value):
                return translated
            return field_value

        # List[dict]
        if (
            isinstance(translated, list)
            and len(translated) == len(field_value)
            and all(isinstance(v, dict) for v in field_value)
        ):
            merged_list = []
            for original, trans in zip(field_value, translated):
                merged = copy.deepcopy(original)
                if isinstance(trans, dict):
                    merged.update(trans)
                merged_list.append(merged)
            return merged_list

    # -----------------------
    # STRING HANDLING
    # -----------------------
    if isinstance(field_value, str):
        if isinstance(translated, str) and translated.strip():
            return translated
        return field_value

    return field_value


# ============================================================
# APPLY TRANSLATION TO A QUESTION
# ============================================================

def apply_translation(question_dict: dict, locale: str) -> dict:
    if not locale or locale == "en":
        return question_dict

    translations = question_dict.get("translations") or {}
    if locale not in translations:
        return question_dict

    translated = copy.deepcopy(question_dict)
    locale_data = translations[locale]

    # ---------- LABEL ----------
    if locale_data.get("label"):
        translated["label"] = locale_data["label"]

    if locale_data.get("description"):
        translated["description"] = locale_data["description"]
    if "serial_label" in question_dict:
        translated["serial_label"] = question_dict["serial_label"]

    # ---------- CONFIG ----------
    if "config" in locale_data:
        cfg_translation = locale_data["config"]
        cfg = translated.get("config") or {}
        fields = get_translatable_config_fields(translated.get("type"))

        for field in fields:
            if field not in cfg:
                continue

            original = cfg[field]
            translated_value = cfg_translation.get(field)

            # string
            if isinstance(original, str) and isinstance(translated_value, str):
                if translated_value.strip():
                    cfg[field] = translated_value

            # list
            elif isinstance(original, list) and isinstance(translated_value, list):
                merged = []
                for o, t in zip(original, translated_value):
                    if isinstance(o, dict) and isinstance(t, dict):
                        m = o.copy()
                        m.update({k: v for k, v in t.items() if v})
                        merged.append(m)
                    else:
                        merged.append(t or o)
                cfg[field] = merged

            # dict
            elif isinstance(original, dict) and isinstance(translated_value, dict):
                merged = original.copy()
                merged.update({k: v for k, v in translated_value.items() if v})
                cfg[field] = merged

        translated["config"] = cfg

    return translated


# ============================================================
# MERGE TRANSLATIONS (PATCH / UPDATE)
# ============================================================

def merge_translations(existing: Dict, incoming: Dict) -> Dict:
    merged = copy.deepcopy(existing) if existing else {}

    for locale, data in incoming.items():
        merged.setdefault(locale, {})

        # Preserve existing fields
        existing_locale = merged[locale]

        for key in ["label", "description"]:
            if key in data:
                existing_locale[key] = data[key]

        if "config" in data:
            existing_locale.setdefault("config", {})
            for cfg_key, cfg_val in data["config"].items():
                existing_locale["config"][cfg_key] = cfg_val

    return merged


# ============================================================
# CREATE BLANK TRANSLATION STRUCTURE
# ============================================================

def create_blank_translation_structure(question, locale: str) -> dict:
    """
    Initialize translations by COPYING source (EN) values,
    not empty strings.
    """

    translation = {
        "label": question.label or "",
        "description": question.description or "",
        "config": {},
    }

    config = question.config or {}
    fields = get_translatable_config_fields(question.type)

    for field in fields:
        if field not in config:
            continue

        value = config[field]

        # ---------- STRING ----------
        if isinstance(value, str):
            translation["config"][field] = value

        # ---------- LIST ----------
        elif isinstance(value, list):

            # list[str]
            if all(isinstance(v, str) for v in value):
                translation["config"][field] = value.copy()

            # list[dict]
            elif all(isinstance(v, dict) for v in value):
                copied_items = []
                for item in value:
                    copied = {}

                    # preserve system keys
                    for k in ["id", "value", "icon", "colorTag"]:
                        if k in item:
                            copied[k] = item[k]

                    # copy translatable text keys
                    for k in [
                        "label",
                        "description",
                        "left",
                        "right",
                        "name",
                        "instruction",
                        "stimulusLabel",
                        "text",
                        "title",
                    ]:
                        if k in item:
                            copied[k] = item[k]

                    copied_items.append(copied)

                translation["config"][field] = copied_items

        # ---------- DICT ----------
        elif isinstance(value, dict):
            copied_dict = {}
            for k, v in value.items():
                copied_dict[k] = v if isinstance(v, str) else v
            translation["config"][field] = copied_dict

    return translation


# ============================================================
# CSV PARSING & VALIDATION
# ============================================================

def parse_translation_csv(csv_content: str) -> Tuple[List[Dict], List[str]]:
    """
    Parse CSV content and return structured translation data
    
    Expected CSV format:
    Resource,Type,en,es,fr,...
    Q198246,label,What is your favorite fruit?,¿Cuál es tu fruta favorita?,Quel est votre fruit préféré?
    Q198246,description,,,
    Q198246,config.placeholder,Select an option,Selecciona una opción,Sélectionnez une option
    
    Returns:
        - List of translation records
        - List of detected locales (excluding 'en')
    """
    
    reader = csv.DictReader(StringIO(csv_content))
    records = []
    all_locales = set()
    
    for row in reader:
        resource = row.get("Resource", "").strip()
        field_type = row.get("Type", "").strip()
        
        if not resource or not field_type:
            continue
        
        # Extract locale columns (all columns except Resource and Type)
        locale_data = {}
        for key, value in row.items():
            if key not in ["Resource", "Type"] and value and value.strip():
                locale_data[key] = value.strip()
                if key != "en":
                    all_locales.add(key)
        
        records.append({
            "question_id": resource,
            "field_type": field_type,
            "translations": locale_data
        })
    
    return records, sorted(list(all_locales))


# ============================================================
# TRANSLATION APPLICATION
# ============================================================

def apply_csv_translations_to_question(
    question: Question,
    csv_records: List[Dict],
    locales: List[str],
    db: Session
) -> Dict[str, Any]:
    """
    Apply CSV translations to a specific question
    
    Args:
        question: Question object to update
        csv_records: Parsed CSV records for this question
        locales: List of target locales
        db: Database session
    
    Returns:
        Update summary with counts and errors
    """
    
    from sqlalchemy.orm.attributes import flag_modified
    
    translations = question.translations or {}
    updates_made = 0
    errors = []
    
    # 1️⃣ Ensure base structure exists for all locales
    if "en" not in translations:
        translations["en"] = create_blank_translation_structure(question, "en")
    
    for locale in locales:
        if locale not in translations:
            translations[locale] = create_blank_translation_structure(question, locale)
    
    # 2️⃣ Process each CSV record for this question
    for record in csv_records:
        if record["question_id"] != question.question_id:
            continue
        
        field_type = record["field_type"]
        locale_values = record["translations"]
        
        # 3️⃣ Determine field path
        if field_type in ["label", "description"]:
            # Top-level fields
            for locale, value in locale_values.items():
                if locale in translations and value:
                    translations[locale][field_type] = value
                    updates_made += 1
        
        elif field_type.startswith("config."):
            # Config fields (e.g., config.placeholder, config.yesLabel)
            config_field = field_type.replace("config.", "")
            
            for locale, value in locale_values.items():
                if locale not in translations:
                    continue
                
                if "config" not in translations[locale]:
                    translations[locale]["config"] = {}
                
                if value:
                    translations[locale]["config"][config_field] = value
                    updates_made += 1
        
        elif field_type.startswith("config.") and "[" in field_type:
            # Array/list config fields (e.g., config.options[0], config.choices[1])
            # Format: config.options[0] or config.choices[2].label
            try:
                field_parts = field_type.replace("config.", "").split("[")
                array_field = field_parts[0]
                index_part = field_parts[1].split("]")[0]
                index = int(index_part)
                
                # Check if there's a nested property (e.g., .label)
                nested_prop = None
                if "." in field_parts[1]:
                    nested_prop = field_parts[1].split(".")[1]
                
                for locale, value in locale_values.items():
                    if locale not in translations:
                        continue
                    
                    if "config" not in translations[locale]:
                        translations[locale]["config"] = {}
                    
                    if array_field not in translations[locale]["config"]:
                        translations[locale]["config"][array_field] = []
                    
                    # Ensure array is large enough
                    while len(translations[locale]["config"][array_field]) <= index:
                        translations[locale]["config"][array_field].append({})
                    
                    if value:
                        if nested_prop:
                            if not isinstance(translations[locale]["config"][array_field][index], dict):
                                translations[locale]["config"][array_field][index] = {}
                            translations[locale]["config"][array_field][index][nested_prop] = value
                        else:
                            translations[locale]["config"][array_field][index] = value
                        
                        updates_made += 1
                        
            except (ValueError, IndexError, KeyError) as e:
                errors.append(f"Error parsing {field_type}: {str(e)}")
        
        else:
            errors.append(f"Unknown field type: {field_type}")
    
    # 4️⃣ Save changes
    if updates_made > 0:
        question.translations = translations
        flag_modified(question, "translations")
    
    return {
        "question_id": question.question_id,
        "updates_made": updates_made,
        "errors": errors
    }


# ============================================================
# BULK UPLOAD PROCESSOR
# ============================================================

def process_csv_translation_upload(
    csv_content: str,
    survey_id: str,
    db: Session,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Process entire CSV upload for a survey
    
    Args:
        csv_content: Raw CSV string content
        survey_id: Target survey ID
        db: Database session
        dry_run: If True, don't commit changes (validation only)
    
    Returns:
        Summary of the upload operation
    """
    
    from datetime import datetime, timezone
    
    # 1️⃣ Parse CSV
    try:
        records, detected_locales = parse_translation_csv(csv_content)
    except Exception as e:
        return {
            "success": False,
            "error": f"CSV parsing failed: {str(e)}",
            "details": []
        }
    
    if not records:
        return {
            "success": False,
            "error": "No valid records found in CSV",
            "details": []
        }
    
    # 2️⃣ Get all unique question IDs from CSV
    question_ids = list(set(r["question_id"] for r in records))
    
    # 3️⃣ Fetch questions from database
    questions = db.query(Question).filter(
        Question.survey_id == survey_id,
        Question.question_id.in_(question_ids)
    ).all()
    
    question_map = {q.question_id: q for q in questions}
    
    # 4️⃣ Validate all questions exist
    missing = [qid for qid in question_ids if qid not in question_map]
    if missing:
        return {
            "success": False,
            "error": f"Questions not found: {', '.join(missing)}",
            "detected_locales": detected_locales,
            "details": []
        }
    
    # 5️⃣ Apply translations
    results = []
    total_updates = 0
    
    for question_id in question_ids:
        question = question_map[question_id]
        question_records = [r for r in records if r["question_id"] == question_id]
        
        result = apply_csv_translations_to_question(
            question,
            question_records,
            detected_locales,
            db
        )
        
        results.append(result)
        total_updates += result["updates_made"]
        
        # Update timestamp
        if not dry_run and result["updates_made"] > 0:
            question.updated_at = datetime.now(timezone.utc)
    
    # 6️⃣ Commit or rollback
    if not dry_run:
        db.commit()
        
        # Invalidate caches
        from ..services.redis_question_service import RedisQuestionService
        for qid in question_ids:
            RedisQuestionService.invalidate_question(survey_id, qid)
        RedisQuestionService.remove_from_list(survey_id)
    else:
        db.rollback()
    
    # 7️⃣ Update survey metadata with new locales
    if not dry_run and detected_locales:
        from ..models.survey import Survey
        from sqlalchemy.orm.attributes import flag_modified
        
        survey = db.query(Survey).filter(Survey.survey_id == survey_id).first()
        if survey:
            meta_data = survey.meta_data or {}
            existing_locales = set(meta_data.get("locales", ["en"]))
            existing_locales.update(detected_locales)
            
            meta_data["locales"] = sorted(list(existing_locales))
            survey.meta_data = meta_data
            flag_modified(survey, "meta_data")
            survey.updated_at = datetime.now(timezone.utc)
            db.commit()
    
    return {
        "success": True,
        "dry_run": dry_run,
        "detected_locales": detected_locales,
        "questions_processed": len(question_ids),
        "total_updates": total_updates,
        "details": results
    }


# ============================================================
# CSV EXPORT (DOWNLOAD TEMPLATE)
# ============================================================

def generate_translation_csv_template(
    survey_id: str,
    db: Session,
    include_values: bool = True,
    target_locales: List[str] = None
) -> str:
    """
    Generate CSV template for translation upload
    
    Args:
        survey_id: Survey ID
        db: Database session
        include_values: If True, include existing translations
        target_locales: List of locales to include (default: all existing + en)
    
    Returns:
        CSV string content
    """
    
    questions = db.query(Question).filter(Question.survey_id == survey_id).all()
    
    if not questions:
        return "Resource,Type,en\n"
    
    # Determine locales
    if not target_locales:
        all_locales = set(["en"])
        for q in questions:
            if q.translations:
                all_locales.update(q.translations.keys())
        target_locales = sorted(list(all_locales))
    
    # Build CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["Resource", "Type"] + target_locales)
    
    # Each question
    for q in questions:
        translations = q.translations or {}
        
        # Label row
        label_row = [q.question_id, "label"]
        for locale in target_locales:
            if include_values and locale in translations:
                label_row.append(translations[locale].get("label", ""))
            else:
                label_row.append("")
        writer.writerow(label_row)
        
        # Description row
        desc_row = [q.question_id, "description"]
        for locale in target_locales:
            if include_values and locale in translations:
                desc_row.append(translations[locale].get("description", ""))
            else:
                desc_row.append("")
        writer.writerow(desc_row)
        
        # Config fields
        from .translation_utils import get_translatable_config_fields
        config_fields = get_translatable_config_fields(q.type)
        
        for field in config_fields:
            config_row = [q.question_id, f"config.{field}"]
            
            for locale in target_locales:
                value = ""
                if include_values and locale in translations:
                    config = translations[locale].get("config", {})
                    if field in config:
                        field_value = config[field]
                        # Handle arrays/lists
                        if isinstance(field_value, list):
                            value = str(field_value)  # Simplified for template
                        else:
                            value = str(field_value)
                
                config_row.append(value)
            
            writer.writerow(config_row)
    
    return output.getvalue()