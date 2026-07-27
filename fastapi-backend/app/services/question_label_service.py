import re
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.questions import Question

LABEL_REGEX = re.compile(r"^([A-Za-z]+)(\d+)$")
SERIAL_LABEL_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]*$")


def generate_internal_question_id(prefix="ques") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def normalize_and_validate_serial_label(serial_label: str) -> str:
    serial = str(serial_label or "").strip()
    if not serial:
        raise ValueError("serial_label cannot be empty")
    if not SERIAL_LABEL_PATTERN.match(serial):
        raise ValueError(
            "serial_label must start with a letter and contain only letters, numbers, or underscores"
        )
    return serial

def generate_next_serial_label(db: Session, survey_id: str, prefix="Q") -> str:
    rows = (
        db.query(Question.serial_label)
        .filter(
            Question.survey_id == survey_id,
            Question.serial_label.isnot(None),
            Question.serial_label.like(f"{prefix}%"),
        )
        .all()
    )

    nums = []
    for (label,) in rows:
        m = LABEL_REGEX.match(label)
        if m and m.group(1) == prefix:
            nums.append(int(m.group(2)))

    next_num = max(nums, default=0) + 1
    return f"{prefix}{next_num}"
