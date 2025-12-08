# app/services/salesforce_service.py
import os
import requests
from typing import Any, Dict, List, Tuple
import json
SALESFORCE_TOKEN_URL = os.getenv(
    "SALESFORCE_TOKEN_URL", "https://login.salesforce.com/services/oauth2/token"
)
SALESFORCE_CLIENT_ID = os.getenv("SALESFORCE_CLIENT_ID","3MVG9rZjd7MXFdLiiqARG.kHAwcV7PsBUxN4ia7eh11v3v_RqwgFaW_vXHgwxp3PfEdJeznDbiPxNuGkDodFA" )
SALESFORCE_CLIENT_SECRET = os.getenv("SALESFORCE_CLIENT_SECRET", "24B9DA49DE3C0B7E3D745F10E80E801748B86853D2FF4613F89073BCDC2522DE")
SALESFORCE_USERNAME = os.getenv("SALESFORCE_USERNAME","shivam521@agentforce.com")
SALESFORCE_PASSWORD = os.getenv("SALESFORCE_PASSWORD","Uk097188@")
# optional: if you ever need to append token separately
SALESFORCE_SECURITY_TOKEN = os.getenv("SALESFORCE_SECURITY_TOKEN", "")
# NEW — full Apex path for Accounts API
APEX_ACCOUNTS_PATH = os.getenv(
    "SALESFORCE_APEX_ACCOUNTS_PATH", "/services/apexrest/surveyarc/accounts"
)

# path to your Apex REST class
APEX_CONTACTS_PATH = os.getenv(
    "SALESFORCE_APEX_CONTACTS_PATH", "/services/apexrest/surveyarc/contacts"
)


class SalesforceService:
    API_VERSION = "v57.0"  # adjust if needed

    @classmethod
    def get_access_token(cls) -> Tuple[str, str]:
        """
        Get OAuth access token + instance_url from Salesforce using password flow.
        This matches what you already have working in Postman.
        """
        if not all(
            [SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME, SALESFORCE_PASSWORD]
        ):
            raise RuntimeError("Missing Salesforce credentials in environment variables")

        data = {
            "grant_type": "password",
            "client_id": SALESFORCE_CLIENT_ID,
            "client_secret": SALESFORCE_CLIENT_SECRET,
            "username": SALESFORCE_USERNAME,
            # You can do PASSWORD + SECURITY_TOKEN if needed:
            "password": SALESFORCE_PASSWORD + SALESFORCE_SECURITY_TOKEN,
        }

        resp = requests.post(SALESFORCE_TOKEN_URL, data=data)
        if not resp.ok:
            raise RuntimeError(f"Salesforce OAuth failed: {resp.status_code} {resp.text}")

        payload = resp.json()
        access_token = payload.get("access_token")
        instance_url = payload.get("instance_url")

        if not access_token or not instance_url:
            raise RuntimeError(f"Salesforce OAuth missing token or instance_url: {payload}")

        return access_token, instance_url

    @classmethod
    def call_salesforce(cls, method: str, url: str, token: str, **kwargs) -> Dict[str, Any]:
        headers = kwargs.pop("headers", {})
        headers.setdefault("Authorization", f"Bearer {token}")
        headers.setdefault("Content-Type", "application/json")

        resp = requests.request(method, url, headers=headers, **kwargs)
        if not resp.ok:
            raise RuntimeError(f"Salesforce call failed: {resp.status_code} {resp.text}")
        if resp.text:
            return resp.json()
        return {}

    # ---------- Contacts via your Apex REST ----------
    @classmethod
    def get_contacts_from_apex(cls, limit: int = 50) -> List[Dict[str, Any]]:
        access_token, instance_url = cls.get_access_token()
        url = f"{instance_url}{APEX_CONTACTS_PATH}"
        payload = {"limit": limit}

        data = cls.call_salesforce("POST", url, access_token, json=payload)
        # assuming Apex returns a JSON array of contacts
        if isinstance(data, list):
            return data
        # if wrapped, adjust here
        return data.get("items", [])
    # ---------- Accounts via Apex + Contacts ----------
    @classmethod
    def get_accounts_from_apex(cls, limit: int = 50) -> List[Dict[str, Any]]:
        access_token, instance_url = cls.get_access_token()
        path = APEX_ACCOUNTS_PATH.rstrip("/")  # 🔥 remove trailing slash if exists
        url = f"{instance_url}{path}?limit={limit}"
        return cls.call_salesforce("GET", url, access_token)
# app/services/salesforce_service.py (or wherever it lives)

    @classmethod
    def get_account_with_contacts(cls, account_id: str) -> Dict[str, Any]:
        access_token, instance_url = cls.get_access_token()
        print(f"Fetching account with ID: {account_id}")
        print(f"Using Apex Accounts path: {instance_url}")

        path_acc = APEX_ACCOUNTS_PATH.rstrip("/")
        url_acc = f"{instance_url}{path_acc}/{account_id}"
        print(f"Fetching account from URL: {url_acc}")

        # 🔹 This is currently coming back as a *string* with JSON
        raw = cls.call_salesforce("GET", url_acc, access_token)
        print(f"Fetched account data (raw): {raw!r}")

        # ✅ Normalize to dict
        data: Dict[str, Any] | None = None

        if isinstance(raw, dict):
            data = raw
        elif isinstance(raw, str):
            try:
                data = json.loads(raw)
            except Exception as e:
                print(f"❌ Failed to json.loads Salesforce response: {e}")
                data = None
        else:
            print(f"⚠️ Unexpected type from Salesforce: {type(raw)}")

        if not data or not isinstance(data, dict):
            print("⚠️ No data or non-dict payload from Salesforce after normalization")
            return {}

        # At this point data looks like:
        # { "contacts": [...], "account": {...} }
        account = data.get("account") or {}
        contacts = data.get("contacts", []) or []

        if not isinstance(account, dict):
            print("⚠️ 'account' field is not a dict in payload")
            return {}

        # optional safety check
        if not account.get("id"):
            print(f"⚠️ Account payload missing 'id': {account}")
            # you can choose to still return or treat as not found
            # return {}
        
        if not isinstance(contacts, list):
            print("⚠️ 'contacts' field is not a list, coercing to []")
            contacts = []

        print(f"[SF get_account_with_contacts] Unwrapped account: {account}")
        print(f"[SF get_account_with_contacts] Unwrapped contacts: {contacts}")

        return {
            "account": account,
            "contacts": contacts,
        }
    @classmethod
    def query(cls, soql: str) -> Dict[str, Any]:
            access_token, instance_url = cls.get_access_token()
            url = f"{instance_url}/services/data/{cls.API_VERSION}/query"
            params = {"q": soql}
            return cls.call_salesforce("GET", url, access_token, params=params)

        # ---------- Contacts via SOQL (if you prefer direct) ----------
    @classmethod
    def get_contacts_via_soql(cls, limit: int = 50) -> List[Dict[str, Any]]:
            soql = f"""
                SELECT Id, FirstName, LastName, Email, Account.Name 
                FROM Contact 
                WHERE Email != null 
                LIMIT {limit}
            """
            data = cls.query(soql)
            return data.get("records", [])

    @classmethod
    def get_contact_by_id(cls, contact_id: str) -> Dict[str, Any]:
            soql = f"""
                SELECT Id, FirstName, LastName, Email, Account.Name 
                FROM Contact 
                WHERE Id = '{contact_id}' 
                LIMIT 1
            """
            data = cls.query(soql)
            records = data.get("records", [])
            return records[0] if records else {}

        # ---------- Accounts / Leads / etc ----------
   
    @classmethod
    def get_accounts(cls, limit: int = 50) -> List[Dict[str, Any]]:
            soql = f"""
                SELECT Id, Name, Industry, Phone, Website, Type 
                FROM Account 
                LIMIT {limit}
            """
            data = cls.query(soql)
            return data.get("records", [])

    @classmethod
    def update_contact(cls, contact_id: str, fields: Dict[str, Any]) -> Dict[str, Any]:
            """
            Update a Salesforce Contact using the REST sObject API.
            `fields` is a partial dict: {"FirstName": "...", "LastName": "...", "Email": "..."}
            """
            access_token, instance_url = cls.get_access_token()
            url = f"{instance_url}/services/data/{cls.API_VERSION}/sobjects/Contact/{contact_id}"

            # Salesforce PATCH sObject returns empty body on success
            resp = requests.patch(url, json=fields, headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            })
            if not resp.ok:
                raise RuntimeError(f"Salesforce update_contact failed: {resp.status_code} {resp.text}")

            # Re-fetch the updated contact so we can return data
            return cls.get_contact_by_id(contact_id)

    @classmethod
    def delete_contact(cls, contact_id: str) -> None:
            """
            Delete a Salesforce Contact using REST sObject API.
            """
            access_token, instance_url = cls.get_access_token()
            url = f"{instance_url}/services/data/{cls.API_VERSION}/sobjects/Contact/{contact_id}"

            resp = requests.delete(url, headers={
                "Authorization": f"Bearer {access_token}",
            })
            if resp.status_code == 204:
                return
            if not resp.ok:
                raise RuntimeError(f"Salesforce delete_contact failed: {resp.status_code} {resp.text}")
   
    @classmethod
    def get_leads(cls, limit: int = 50) -> List[Dict[str, Any]]:
            soql = f"""
                SELECT Id, FirstName, LastName, Company, Email, Status 
                FROM Lead 
                LIMIT {limit}
            """
            data = cls.query(soql)
            return data.get("records", [])
