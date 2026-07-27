# app/core/firebase_admin.py
import json
import os
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, auth as _admin_auth


def initialize_firebase():
    """Initialize Firebase Admin SDK from env JSON or a local credential file."""
    if firebase_admin._apps:
        print("ℹ️ Firebase Admin already initialized")
        return

    base_dir = Path(__file__).resolve().parent.parent
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    cred_path = Path(
        os.getenv(
            "FIREBASE_SERVICE_ACCOUNT_PATH",
            str(base_dir / "credentials" / "firebase_service_account.json"),
        )
    )

    try:
        if raw:
            service_account_dict = json.loads(raw)

            if "private_key" in service_account_dict:
                service_account_dict["private_key"] = service_account_dict["private_key"].replace(
                    "\\n", "\n"
                )
            cred = credentials.Certificate(service_account_dict)
            print("✅ Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON")
        else:
            if not cred_path.exists():
                print(
                    "⚠️ Firebase service account credentials not found. "
                    "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
                )
                return
            cred = credentials.Certificate(str(cred_path))
            print(f"✅ Firebase Admin initialized from file: {cred_path}")

        # Initialize with database URL if provided
        database_url = os.getenv("FIREBASE_DATABASE_URL")
        if database_url:
            firebase_admin.initialize_app(cred, {
                'databaseURL': database_url
            })
        else:
            firebase_admin.initialize_app(cred)

    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
    except Exception as e:
        print(f"❌ Failed to initialize Firebase Admin: {e}")
        import traceback
        traceback.print_exc()


# Initialize on import
try:
    initialize_firebase()
except Exception as e:
    print(f"❌ Critical error during Firebase initialization: {e}")

# Export firebase_admin.auth as admin_auth
admin_auth = _admin_auth
__all__ = ["admin_auth"]
