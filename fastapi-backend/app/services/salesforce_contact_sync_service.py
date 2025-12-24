# ============================================
# SALESFORCE CONTACT + LIST SYNC SERVICE
# ============================================

from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from typing import Dict, Set

from ..models.contact import (
    Contact,
    ContactEmail,
    ContactType,
    ContactList,
    list_members,
)
from ..services.salesforce_service import SalesforceService
from ..utils.id_generator import generate_id


# ============================================================
# CONTACT SYNC
# ============================================================

def sync_salesforce_contact_to_internal(
    sf_contact: Dict,
    org_id: str,
    session: Session
) -> Contact:
    sf_id = sf_contact.get("id") or sf_contact.get("Id")
    first_name = sf_contact.get("firstName") or sf_contact.get("FirstName") or ""
    last_name = sf_contact.get("lastName") or sf_contact.get("LastName") or ""
    email = sf_contact.get("email") or sf_contact.get("Email")

    if not email:
        raise ValueError(f"Salesforce contact {sf_id} missing email")

    email = email.strip().lower()
    name = f"{first_name} {last_name}".strip() or "Unknown"

    # --------------------------------------------------
    # 1️⃣ Match by Salesforce ID
    # --------------------------------------------------
    existing = session.query(Contact).filter(
        Contact.salesforce_id == sf_id,
        Contact.org_id == org_id,
        Contact.deleted_at.is_(None)
    ).first()

    if existing:
        existing.name = name
        existing.updated_at = datetime.now(timezone.utc)

        existing.meta = existing.meta or {}
        existing.meta["salesforce_synced_at"] = datetime.now(timezone.utc).isoformat()

        _sync_contact_email(existing, email, org_id, session)
        session.flush()
        return existing

    # --------------------------------------------------
    # 2️⃣ Match by email
    # --------------------------------------------------
    email_rec = session.query(ContactEmail).filter(
        ContactEmail.email_lower == email,
        ContactEmail.status == "active"
    ).first()

    if email_rec:
        existing = session.query(Contact).filter(
            Contact.contact_id == email_rec.contact_id,
            Contact.org_id == org_id,
            Contact.deleted_at.is_(None)
        ).first()

        if existing:
            existing.salesforce_id = sf_id
            existing.name = name
            existing.updated_at = datetime.now(timezone.utc)

            existing.meta = existing.meta or {}
            existing.meta["salesforce_linked_at"] = datetime.now(timezone.utc).isoformat()

            session.flush()
            return existing

    # --------------------------------------------------
    # 3️⃣ Create new contact
    # --------------------------------------------------
    new_contact = Contact(
        contact_id=generate_id(),
        org_id=org_id,
        name=name,
        contact_type=ContactType.email,
        primary_identifier=email,
        salesforce_id=sf_id,
        status="active",
        meta={
            "source": "salesforce",
            "salesforce_synced_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    session.add(new_contact)
    session.flush()

    session.add(
        ContactEmail(
            id=generate_id(),
            contact_id=new_contact.contact_id,
            email=email,
            email_lower=email,
            is_primary=True,
            status="active",
        )
    )

    session.flush()
    return new_contact


# ============================================================
# EMAIL SYNC (FIXED)
# ============================================================

def _sync_contact_email(
    contact: Contact,
    email: str,
    org_id: str,
    session: Session
):
    email = email.lower()

    existing = session.query(ContactEmail).filter(
        ContactEmail.contact_id == contact.contact_id,
        ContactEmail.email_lower == email,
        ContactEmail.status == "active"
    ).first()

    if existing:
        if not existing.is_primary:
            existing.is_primary = True
        return

    # demote old primary if exists
    current_primary = session.query(ContactEmail).filter(
        ContactEmail.contact_id == contact.contact_id,
        ContactEmail.is_primary.is_(True),
        ContactEmail.status == "active"
    ).first()

    if current_primary:
        current_primary.is_primary = False

    session.add(
        ContactEmail(
            id=generate_id(),
            contact_id=contact.contact_id,
            email=email,
            email_lower=email,
            is_primary=True,
            status="active",
        )
    )


# ============================================================
# LIST SYNC (FIXED & COMPLETE)
# ============================================================

def sync_salesforce_list(
    list_id: str,
    org_id: str,
    db: Session
):
    contact_list = db.query(ContactList).filter(
        ContactList.list_id == list_id,
        ContactList.org_id == org_id,
        ContactList.deleted_at.is_(None)
    ).first()

    if not contact_list:
        raise ValueError("List not found")

    meta = contact_list.meta_data or {}

    if meta.get("source") != "salesforce":
        raise ValueError("This list is not Salesforce-synced")

    sf_account_id = meta.get("salesforce_account_id")
    if not sf_account_id:
        raise ValueError("Missing Salesforce account ID")

    # --------------------------------------------------
    # 1️⃣ Fetch Salesforce contacts
    # --------------------------------------------------
    account_data = SalesforceService.get_account_with_contacts(sf_account_id)
    sf_contacts = account_data.get("contacts", []) or []

    synced_contact_ids: Set[str] = set()

    # --------------------------------------------------
    # 2️⃣ Sync contacts
    # --------------------------------------------------
    for sf_contact in sf_contacts:
        try:
            contact = sync_salesforce_contact_to_internal(
                sf_contact, org_id, db
            )
            synced_contact_ids.add(contact.contact_id)
        except Exception:
            continue

    # --------------------------------------------------
    # 3️⃣ Existing list members
    # --------------------------------------------------
    existing_members = {
        r[0]
        for r in db.execute(
            select(list_members.c.contact_id)
            .where(list_members.c.list_id == list_id)
        ).all()
    }

    # --------------------------------------------------
    # 4️⃣ Add missing contacts
    # --------------------------------------------------
    to_add = synced_contact_ids - existing_members
    for cid in to_add:
        db.execute(
            list_members.insert().values(
                list_id=list_id,
                contact_id=cid
            )
        )

    # --------------------------------------------------
    # 5️⃣ Update metadata
    # --------------------------------------------------
    meta["last_synced_at"] = datetime.now(timezone.utc).isoformat()
    meta["last_sync_counts"] = {
        "salesforce_contacts": len(sf_contacts),
        "added": len(to_add),
    }

    contact_list.meta_data = meta
    db.commit()

    return {
        "salesforce_contacts": len(sf_contacts),
        "added_to_list": len(to_add),
        "total_in_list": len(existing_members | synced_contact_ids),
    }
