# app/services/http_mailer.py
import os
import requests

MAILER_URL        = os.getenv("MAILER_URL", "https://surveyarcdocker-ktno.onrender.com/send")
MAILER_URL_KINDS  = os.getenv("MAILER_URL_KINDS", "https://surveyarcdocker-ktno.onrender.com/send/from-payload")
MAIL_API_TOKEN    = os.getenv("MAIL_API_TOKEN", "supersecrettoken")
FROM_ADDRESS      = os.getenv("FROM_ADDRESS")  # optional

_DEFAULT_TIMEOUT = float(os.getenv("MAILER_TIMEOUT", "8"))

def headers():
    h = {"Content-Type": "application/json"}
    if MAIL_API_TOKEN:
        h["Authorization"] = f"Bearer {MAIL_API_TOKEN}"
    return h

def send_via_mailer(to, subject, html, cc=None, bcc=None, reply_to=None):
    if not to:
        raise ValueError("No recipients provided")

    payload = {"to": to, "subject": subject, "html": html}
    if FROM_ADDRESS: payload["from"] = FROM_ADDRESS
    if cc:           payload["cc"] = cc
    if bcc:          payload["bcc"] = bcc
    if reply_to:     payload["replyTo"] = reply_to

    r = requests.post(MAILER_URL, json=payload, headers=headers(), timeout=_DEFAULT_TIMEOUT)
    r.raise_for_status()  # <-- critical: bubble up failures
    return r.json() if r.headers.get("content-type","").startswith("application/json") else {"ok": True}

def send_from_payload(kind: str, payload: dict):
    r = requests.post(MAILER_URL_KINDS, json={"kind": kind, "payload": payload},
                      headers=headers(), timeout=_DEFAULT_TIMEOUT)
    r.raise_for_status()
    return r.json() if r.headers.get("content-type","").startswith("application/json") else {"ok": True}
