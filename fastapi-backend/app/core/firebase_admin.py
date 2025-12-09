# app/core/firebase_admin.py
import os
import json
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, auth as _admin_auth


def initialize_firebase():
    """Initialize Firebase Admin SDK with either a path or inline JSON."""
    # If already initialized, don't do it again
    if firebase_admin._apps:
        print("ℹ️ Firebase Admin already initialized")
        return

    # Base dir: .../app
    BASE_DIR = Path(__file__).resolve().parent.parent

    # 1) Prefer env var if present, otherwise use local credentials file
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if raw:
        raw = raw.strip().strip('"').strip("'")
    else:
        # default: app/credentials/firebase_service_account.json
        raw = str(BASE_DIR / "credentials" / "firebase_service_account.json")

    try:
        # If it looks like JSON, parse it
        if raw.lstrip().startswith("{"):
            service_account_dict = json.loads(raw)
            cred = credentials.Certificate(service_account_dict)
            print("✅ Firebase Admin initialized from JSON in env")
        else:
            cred_path = Path(raw)
            if not cred_path.exists():
                print(f"❌ Firebase service account file not found at: {cred_path}")
                return
            cred = credentials.Certificate(str(cred_path))
            print(f"✅ Firebase Admin initialized from file: {cred_path}")

        firebase_admin.initialize_app(cred)

    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in FIREBASE_SERVICE_ACCOUNT_PATH: {e}")
    except Exception as e:
        print(f"❌ Failed to initialize Firebase Admin: {e}")


# Initialize on import
try:
    initialize_firebase()
except Exception as e:
    print(f"❌ Critical error during Firebase initialization: {e}")

# Export firebase_admin.auth as admin_auth
admin_auth = _admin_auth
__all__ = ["admin_auth"]
