# app/models/audit_event.py
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from ..db import Base

class AuditEvent(Base):
    __tablename__ = "audit_events"
    log_id         = sa.Column(sa.String, primary_key=True)
    version        = sa.Column(sa.Integer, nullable=False, server_default="1")

    org_id         = sa.Column(sa.String, index=True, nullable=False)
    tenant_id      = sa.Column(sa.String)

    actor_id       = sa.Column(sa.String)
    actor_email    = sa.Column(sa.String)
    actor_role     = sa.Column(sa.String)

    entity_type    = sa.Column(sa.String, index=True, nullable=False)
    entity_id      = sa.Column(sa.String, index=True, nullable=False)
    entity_human   = sa.Column(sa.String)

    event_type     = sa.Column(sa.String, index=True, nullable=False)
    severity       = sa.Column(sa.String, nullable=False, server_default="info")
    channel        = sa.Column(sa.String, nullable=False, server_default="write")
    status         = sa.Column(sa.String, nullable=False, server_default="success")

    source         = sa.Column(sa.String)
    request_id     = sa.Column(sa.String)
    session_id     = sa.Column(sa.String)
    trace_id       = sa.Column(sa.String)
    correlation_id = sa.Column(sa.String)
    parent_log_id  = sa.Column(sa.String)

    ip_address     = sa.Column(sa.String)
    user_agent     = sa.Column(sa.String)

    occurred_at    = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    received_at    = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)

    before         = sa.Column(JSONB)
    after          = sa.Column(JSONB)
    meta           = sa.Column(JSONB)
    tags           = sa.Column(JSONB, nullable=True, default=list)  # <-- change this

    redacted       = sa.Column(sa.Boolean, nullable=False, server_default=sa.text("false"))
    dedupe_hash    = sa.Column(sa.String)
