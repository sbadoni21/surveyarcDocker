import os
import requests

MAILER_URL = os.getenv("MAILER_URL", "http://localhost:4001/send")

def send_via_mailer(to: list[str], subject: str, html: str):
    """
    Sends an email via the Node mail-relay server.
    Expects the Node relay to accept JSON:
        { to: [...], subject: "...", html: "..." }
    """
    if not to:
        print("[Mailer] No recipients → skipping send")
        return

    payload = {"to": to, "subject": subject, "html": html}

    try:
        r = requests.post(MAILER_URL, json=payload, timeout=5)
        if r.status_code == 200:
            print(f"[Mailer] ✅ Sent email → {to}")
        else:
            print(f"[Mailer] ⚠️ Mail relay responded {r.status_code}: {r.text}")
    except Exception as e:
        print(f"[Mailer] ❌ Failed to reach relay at {MAILER_URL}: {e}")
