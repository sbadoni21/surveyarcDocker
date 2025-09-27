# app/services/redis_sla_service.py
from __future__ import annotations

import os, json, datetime as dt
from typing import Any, Optional

import redis

# Simple self-managed client. If you already have a shared Redis client, swap this.
_redis_client: Optional[redis.Redis] = None

def _get_client() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = redis.from_url(url, decode_responses=True)
    return _redis_client

def _dumps(obj: Any) -> str:
    def default(o):
        if isinstance(o, (dt.datetime, dt.date)):
            return o.isoformat()
        return str(o)
    return json.dumps(obj, default=default)

def _loads(s: str) -> Any:
    try:
        return json.loads(s)
    except Exception:
        return None

# ----------------------- Keys -----------------------
def _key_sla(sla_id: str) -> str:
    return f"sla:{sla_id}"

def _key_ticket_sla(ticket_id: str) -> str:
    return f"ticket_sla:{ticket_id}"

# ----------------------- SLA object -----------------
def cache_sla(sla_id: str, dto: dict, ttl_seconds: int = 600) -> None:
    r = _get_client()
    r.set(_key_sla(sla_id), _dumps(dto), ex=ttl_seconds)

def get_sla(sla_id: str) -> Optional[dict]:
    r = _get_client()
    raw = r.get(_key_sla(sla_id))
    return _loads(raw) if raw else None

def invalidate_sla(sla_id: str) -> None:
    r = _get_client()
    r.delete(_key_sla(sla_id))

# -------------------- Ticket SLA status -------------
def cache_ticket_sla_status(ticket_id: str, dto: dict, ttl_seconds: int = 300) -> None:
    r = _get_client()
    r.set(_key_ticket_sla(ticket_id), _dumps(dto), ex=ttl_seconds)

def get_ticket_sla_status(ticket_id: str) -> Optional[dict]:
    r = _get_client()
    raw = r.get(_key_ticket_sla(ticket_id))
    return _loads(raw) if raw else None

def invalidate_ticket_sla_status(ticket_id: str) -> None:
    r = _get_client()
    r.delete(_key_ticket_sla(ticket_id))
