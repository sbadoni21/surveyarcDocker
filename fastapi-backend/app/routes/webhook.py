from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models.webhook import Webhook
from ..schemas.webhook import WebhookCreate, WebhookUpdate, WebhookOut
from typing import List

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Create webhook
@router.post("/", response_model=WebhookOut)
def create_webhook(data: WebhookCreate, db: Session = Depends(get_db)):
    existing = db.query(Webhook).filter(Webhook.hook_id == data.hook_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Webhook already exists")
    webhook = Webhook(
        hook_id=data.hook_id,
        org_id=data.org_id,
        name=data.name,
        url=data.url,
        events=data.events
    )
    db.add(webhook)
    db.commit()
    db.refresh(webhook)
    return webhook

# Get webhook
@router.get("/{hook_id}", response_model=WebhookOut)
def get_webhook(hook_id: str, db: Session = Depends(get_db)):
    webhook = db.query(Webhook).filter(Webhook.hook_id == hook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return webhook

# Update webhook
@router.patch("/{hook_id}", response_model=WebhookOut)
def update_webhook(hook_id: str, data: WebhookUpdate, db: Session = Depends(get_db)):
    webhook = db.query(Webhook).filter(Webhook.hook_id == hook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    for key, value in data.dict(exclude_unset=True).items():
        setattr(webhook, key, value)
    db.commit()
    db.refresh(webhook)
    return webhook

# Delete webhook
@router.delete("/{hook_id}")
def delete_webhook(hook_id: str, db: Session = Depends(get_db)):
    webhook = db.query(Webhook).filter(Webhook.hook_id == hook_id).first()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    db.delete(webhook)
    db.commit()
    return {"detail": "Webhook deleted"}
