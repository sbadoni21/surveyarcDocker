# app/routes/salesforce_routes.py
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Dict, Any
from ..services.salesforce_service import SalesforceService
from ..schemas.salesforce import (
    SalesforceContact,
    SalesforceContactList,
    SalesforceGenericRecord,
    SalesforceListResponse,
    SalesforceContactUpdate,   # <-- add import
    SalesforceAccount,
    SalesforceAccountWithContacts,
    SalesforceContactMini

)

router = APIRouter(prefix="/salesforce", tags=["Salesforce"])


# ---------- CONTACTS LIST (via Apex or SOQL) ----------
@router.get("/contacts", response_model=SalesforceContactList)
def list_contacts(
    limit: int = Query(50, ge=1, le=500),
    use_apex: bool = Query(True, description="Use Apex REST instead of SOQL"),
):
    try:
        if use_apex:
            raw_contacts = SalesforceService.get_contacts_from_apex(limit=limit)
        else:
            raw_contacts = SalesforceService.get_contacts_via_soql(limit=limit)

        items: List[SalesforceContact] = []
        for r in raw_contacts:
            items.append(
                SalesforceContact(
                    id=r.get("id") or r.get("Id"),
                    firstName=r.get("firstName") or r.get("FirstName"),
                    lastName=r.get("lastName") or r.get("LastName"),
                    email=r.get("email") or r.get("Email"),
                    accountName=r.get("accountName")
                    or (r.get("Account") or {}).get("Name")
                    if r.get("Account")
                    else None,
                    raw=r,
                )
            )

        return SalesforceContactList(total=len(items), items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- SINGLE CONTACT BY ID ----------
@router.get("/contacts/{contact_id}", response_model=SalesforceContact)
def get_contact(contact_id: str):
    try:
        r = SalesforceService.get_contact_by_id(contact_id)
        if not r:
            raise HTTPException(status_code=404, detail="Contact not found")

        return SalesforceContact(
            id=r.get("Id"),
            firstName=r.get("FirstName"),
            lastName=r.get("LastName"),
            email=r.get("Email"),
            accountName=(r.get("Account") or {}).get("Name")
            if r.get("Account")
            else None,
            raw=r,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.get("/accounts", response_model=SalesforceListResponse)
def list_accounts_apex(limit: int = Query(50, ge=1, le=500)):
    try:
        records = SalesforceService.get_accounts_from_apex(limit=limit)
        items = [
            SalesforceGenericRecord(
                id=r.get("id") or r.get("Id"),
                name=r.get("name") or r.get("Name"),
                raw=r,
            )
            for r in records
        ]
        return SalesforceListResponse(total=len(items), items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/accounts/{account_id}", response_model=SalesforceAccountWithContacts)
def get_account_with_contacts(account_id: str):
    try:
        data = SalesforceService.get_account_with_contacts(account_id)
        if not data:
            raise HTTPException(status_code=404, detail="Account not found")

        acc = data.get("account")
        cons = data.get("contacts", [])

        return SalesforceAccountWithContacts(
            account=SalesforceAccount(
                id=acc.get("id"),
                name=acc.get("name"),
                type=acc.get("type"),
                website=acc.get("website"),
                phone=acc.get("phone"),
                raw=acc,
            ),
            contacts=[
                SalesforceContactMini(
                    id=c.get("id"),
                    firstName=c.get("firstName"),
                    lastName=c.get("lastName"),
                    email=c.get("email"),
                )
                for c in cons
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- LEADS LIST ----------
@router.get("/leads", response_model=SalesforceListResponse)
def list_leads(limit: int = Query(50, ge=1, le=500)):
    try:
        records = SalesforceService.get_leads(limit=limit)
        items: List[SalesforceGenericRecord] = []
        for r in records:
            items.append(
                SalesforceGenericRecord(
                    id=r.get("Id"),
                    name=(r.get("FirstName") or "") + " " + (r.get("LastName") or ""),
                    raw=r,
                )
            )
        return SalesforceListResponse(total=len(items), items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------- UPDATE CONTACT ----------
@router.patch("/contacts/{contact_id}", response_model=SalesforceContact)
def update_contact(contact_id: str, payload: SalesforceContactUpdate):
  try:
      # build field map in Salesforce field names
      fields: Dict[str, Any] = {}
      if payload.firstName is not None:
          fields["FirstName"] = payload.firstName
      if payload.lastName is not None:
          fields["LastName"] = payload.lastName
      if payload.email is not None:
          fields["Email"] = payload.email

      if not fields:
          raise HTTPException(status_code=400, detail="No fields to update")

      r = SalesforceService.update_contact(contact_id, fields)
      if not r:
          raise HTTPException(status_code=404, detail="Contact not found")

      return SalesforceContact(
          id=r.get("Id"),
          firstName=r.get("FirstName"),
          lastName=r.get("LastName"),
          email=r.get("Email"),
          accountName=(r.get("Account") or {}).get("Name")
          if r.get("Account")
          else None,
          raw=r,
      )
  except HTTPException:
      raise
  except Exception as e:
      raise HTTPException(status_code=500, detail=str(e))


# ---------- DELETE CONTACT ----------
@router.delete("/contacts/{contact_id}", status_code=204)
def delete_contact(contact_id: str):
    try:
        # optionally check existence first
        r = SalesforceService.get_contact_by_id(contact_id)
        if not r:
            raise HTTPException(status_code=404, detail="Contact not found")

        SalesforceService.delete_contact(contact_id)
        # 204 No Content
        return
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get(
    "/accounts/{account_id}/contacts",
    response_model=SalesforceContactList,
)
def list_contacts_under_account(account_id: str):
    """
    Return only the contacts that belong to a given Salesforce Account.
    Uses Apex REST: /services/apexrest/surveyarc/accounts/{account_id}
    """
    try:
        data = SalesforceService.get_account_with_contacts(account_id)
        if not data:
            raise HTTPException(status_code=404, detail="Account not found")

        contacts = data.get("contacts", []) or []

        items: List[SalesforceContact] = []
        for c in contacts:
            items.append(
                SalesforceContact(
                    id=c.get("id"),
                    firstName=c.get("firstName"),
                    lastName=c.get("lastName"),
                    email=c.get("email"),
                    accountName=None,  # already filtered by account
                    raw=c,
                )
            )

        return SalesforceContactList(total=len(items), items=items)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
