from __future__ import annotations
import time, traceback, logging
import sqlalchemy as sa
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..db import SessionLocal
from ..models.outbox import Outbox
from .http_mailer import send_via_mailer  # Node relay

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

UTC = timezone.utc

def _uniq(seq):
    return sorted({x for x in (seq or []) if x})

def process_one(session: Session, ob: Outbox):
    k = ob.kind
    p = ob.payload or {}

    to, subject, html = [], "", ""

    if k == "ticket.created":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("requester", []) or [])
                   + (r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or []))
        subject = f"[TKT-{p.get('number')}] New ticket created: {p.get('subject')}"
        html = (
            f"<h2>New ticket created</h2>"
            f"<p><strong>Ticket:</strong> TKT-{p.get('number')}</p>"
            f"<p><strong>Subject:</strong> {p.get('subject')}</p>"
            f"<p><strong>Priority:</strong> {p.get('priority')}</p>"
            f"<p><strong>Severity:</strong> {p.get('severity')}</p>"
            f"<hr/>"
            f"<p><strong>First response due:</strong> {p.get('first_response_due_at') or '-'}<br/>"
            f"<strong>Resolution due:</strong> {p.get('resolution_due_at') or '-'}</p>"
        )

    elif k == "sla.assigned":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or [])
                   + (r.get("requester", []) or []))
        subject = f"[TKT-{p.get('number','?')}] SLA assigned"
        html = f"<p>SLA assigned to ticket {p.get('ticket_id')}.</p>"

    elif k == "sla.warn":
        to = _uniq(p.get("notify", []) or [])
        frac = int(float(p.get("fraction", 0)) * 100)
        subject = f"[SLA Warning] {p.get('dimension')} at {frac}%"
        html = f"<p>Ticket {p.get('ticket_id')} is {p.get('dimension')} {frac}% to target.</p>"

    elif k == "sla.breach":
        r = p.get("recipients", {}) or {}
        to = _uniq((r.get("assignee", []) or [])
                   + (r.get("team", []) or [])
                   + (r.get("watchers", []) or [])
                   + (r.get("requester", []) or []))
        subject = f"[SLA Breach] {p.get('dimension')} — Ticket {p.get('ticket_id')}"
        html = f"<p>SLA <strong>{p.get('dimension')}</strong> breached for ticket {p.get('ticket_id')}.</p>"

    else:
        # Unknown kind: mark as sent to avoid poison messages
        logger.warning(f"Unknown outbox kind: {k}")
        ob.sent_at = datetime.now(tz=UTC)
        return

    if not to:
        logger.info(f"No recipients for outbox {ob.id}, marking as sent")
        ob.sent_at = datetime.now(tz=UTC)
        return


    # Try the mailer; let exceptions bubble to caller so we don't mark sent on failures
    logger.info(f"Sending email for outbox {ob.id} to {len(to)} recipients")
    send_via_mailer(to=to, subject=subject, html=html)
    ob.sent_at = datetime.now(tz=UTC)
    logger.info(f"Successfully sent outbox {ob.id}")

def run_forever(poll_interval: float = 2.0, batch: int = 25):
    logger.info(f"Starting outbox processor (poll_interval={poll_interval}s, batch={batch})")
    
    while True:
        try:
            did_work = False
            with SessionLocal() as session:
                # TAKE A LOCK to prevent double-send with multiple workers
                rows = (
                    session.execute(
                        sa.select(Outbox)
                        .where(Outbox.sent_at.is_(None))
                        .order_by(Outbox.id.asc())
                        .with_for_update(skip_locked=True)
                        .limit(batch)
                    )
                    .scalars()
                    .all()
                )

                if rows:
                    logger.info(f"Processing {len(rows)} outbox messages")

                for ob in rows:
                    try:
                        process_one(session, ob)
                        session.commit()
                        did_work = True
                    except Exception as e:
                        session.rollback()
                        logger.error(f"Error processing outbox {ob.id}: {e}")
                        logger.error(traceback.format_exc())
                        
                        # Update error tracking if columns exist
                        try:
                            session.execute(
                                sa.text("UPDATE outbox SET attempts = attempts + 1, last_error = :err WHERE id = :id"),
                                {"err": str(e)[:5000], "id": ob.id}
                            )
                            session.commit()
                        except Exception as update_err:
                            logger.warning(f"Could not update error tracking: {update_err}")
                            session.rollback()
            
            if not did_work:
                time.sleep(poll_interval)
                
        except KeyboardInterrupt:
            logger.info("Shutting down outbox processor")
            break
        except Exception as e:
            logger.error(f"Unexpected error in main loop: {e}")
            logger.error(traceback.format_exc())
            time.sleep(poll_interval)
