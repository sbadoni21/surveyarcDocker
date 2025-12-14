"""
Utility functions for handling question translations
Decipher / Qualtrics level implementation
"""

from typing import Dict, Any
import copy
from ..models.questions import Question


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
        "statement": ["text"],
        "redirect": ["buttonText"],

        # =========================
        # BASIC INPUTS
        # =========================
        "long_text": ["placeholder"],
        "short_text": ["placeholder"],
        "number": ["placeholder"],
        "date": ["placeholder"],
        "contact_email": ["placeholder"],
        "contact_phone": ["placeholder"],
        "contact_address": ["placeholder"],
        "contact_website": ["placeholder"],

        # =========================
        # CHOICE BASED
        # =========================
        "multiple_choice": ["choices", "placeholder"],
        "checkbox": ["options", "placeholder"],
        "dropdown": ["options", "placeholder"],
        "picture_choice": ["images"],
        "yes_no": ["yesLabel", "noLabel"],
        "legal": ["statement"],

        # =========================
        # SCALES & RATINGS
        # =========================
        "nps": ["minLabel", "maxLabel"],
        "rating": [],  # only top label
        "likert": ["labels"],
        "smiley_rating": ["labels"],
        "opinion_scale": ["minLabel", "maxLabel"],
        "slider": ["prefix", "suffix", "anchors"],

        # =========================
        # GRIDS
        # =========================
        "table_grid": ["rows", "columns"],
        "multi_grid": ["rows", "columns"],
        "matrix_rating": [
            "rows",
            "columns",
            "lowLabel",
            "highLabel",
            "neutralLabel",
        ],

        # =========================
        # ADVANCED
        # =========================
        "semantic_diff": ["items"],
        "side_by_side": [
            "leftLabel",
            "rightLabel",
            "attributes",
            "leftBiasLabel",
            "rightBiasLabel",
            "neutralLabel",
        ],
        "comparison_grid": ["attributes", "brands", "noneLabel"],
        "segmentation_selector": ["segments"],
        "persona_quiz": ["personas", "items"],

        # =========================
        # MONADIC / CONCEPT
        # =========================
        "monadic_test": ["stimulusLabel"],
        "sequential_monadic": ["stimulusLabel"],
        "forced_exposure": ["instruction"],

        # =========================
        # RESEARCH
        # =========================
        "gabor_granger": [
            "productName",
            "likertOptions",
            "yesLabel",
            "noLabel",
        ],
        "price_sensitivity": [
            "tooCheapLabel",
            "cheapLabel",
            "expensiveLabel",
            "tooExpensiveLabel",
        ],
        "conjoint": ["attributes"],
        "maxdiff": ["items"],
        "turf": ["items"],
        "ranking": ["items"],
        "weighted_multi": ["options"],
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
