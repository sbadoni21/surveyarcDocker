# app/middleware/request_context.py
import uuid
from typing import Optional
from fastapi import Request

# Header names we’ll accept from upstream (e.g., Next.js, gateways)
HDR_REQ_ID  = "x-request-id"
HDR_TRACE   = "x-trace-id"
HDR_CORR    = "x-correlation-id"
HDR_SESS    = "x-session-id"
HDR_PARENT  = "x-parent-log-id"
HDR_TENANT  = "x-tenant-id"

def _gen() -> str:
    return uuid.uuid4().hex

async def request_context_middleware(request: Request, call_next):
    # Prefer incoming headers; otherwise generate
    req_id  = request.headers.get(HDR_REQ_ID) or _gen()
    trace   = request.headers.get(HDR_TRACE) or req_id
    corr    = request.headers.get(HDR_CORR)  or trace
    sess    = request.headers.get(HDR_SESS)
    parent  = request.headers.get(HDR_PARENT)
    tenant  = request.headers.get(HDR_TENANT)

    # IP address
    xff = request.headers.get("x-forwarded-for")
    ip  = (xff.split(",")[0].strip() if xff else None) or (request.client.host if request.client else None)

    # User agent
    ua = request.headers.get("user-agent")

    # Stash on request.state for easy access
    st = request.state
    st.request_id     = req_id
    st.trace_id       = trace
    st.correlation_id = corr
    st.session_id     = sess
    st.parent_log_id  = parent
    st.tenant_id      = tenant
    st.ip             = ip
    st.ua             = ua

    # Also echo request-id back (useful to clients/logs)
    response = await call_next(request)
    response.headers[HDR_REQ_ID] = req_id
    response.headers[HDR_TRACE]  = trace
    response.headers[HDR_CORR]   = corr
    return response
