import os, json, urllib.request

MAILER_URL       = os.getenv("MAILER_URL", "https://surveyarcdocker-ktno.onrender.com/send")
MAILER_URL_KINDS = os.getenv("MAILER_URL_KINDS", "https://surveyarcdocker-ktno.onrender.com/send/from-payload")
MAIL_API_TOKEN   = os.getenv("MAIL_API_TOKEN", "supersecrettoken")
FROM_ADDRESS     = os.getenv("FROM_ADDRESS")  # optional default From

def _post_json(url: str, data: dict, bearer: str | None = None, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, method="POST")
    req.add_header("Content-Type", "application/json")
    if bearer:
        req.add_header("Authorization", f"Bearer {bearer}")
    body = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, body, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))

def send_email(to: list[str], subject: str, html: str, cc: list[str] | None = None, bcc: list[str] | None = None) -> dict:
    payload = {"to": to, "subject": subject, "html": html}
    if FROM_ADDRESS: payload["from"] = FROM_ADDRESS
    if cc:  payload["cc"]  = cc
    if bcc: payload["bcc"] = bcc
    return _post_json(MAILER_URL, payload, bearer=MAIL_API_TOKEN)

def send_from_payload(kind: str, payload: dict) -> dict:
    return _post_json(MAILER_URL_KINDS, {"kind": kind, "payload": payload}, bearer=MAIL_API_TOKEN)
