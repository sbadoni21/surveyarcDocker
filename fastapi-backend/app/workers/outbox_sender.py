from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from ..db import SessionLocal
from ..models.outbox import Outbox

def send_email(to: list[str], subject: str, html: str):
    # TODO: integrate with your provider (SES, SendGrid, Mailgun, SMTP)
    pass

def process_one(session: Session, ob: Outbox):
    kind = ob.kind
    payload = ob.payload
    # Build recipients + subject/html based on kind/payload
    # ...
    # send_email(to, subject, html)
    ob.sent_at = datetime.utcnow().replace(tzinfo=timezone.utc)

def run_once(max_batch: int = 100):
    with SessionLocal() as session:
        rows = session.execute(
            select(Outbox).where(Outbox.sent_at.is_(None)).order_by(Outbox.id.asc()).limit(max_batch)
        ).scalars().all()
        for ob in rows:
            try:
                process_one(session, ob)
                session.commit()
            except Exception:
                session.rollback()

if __name__ == "__main__":
    run_once()
