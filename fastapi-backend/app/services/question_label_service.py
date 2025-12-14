import re
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..models.questions import Question

LABEL_REGEX = re.compile(r"^([A-Za-z]+)(\d+)$")

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
