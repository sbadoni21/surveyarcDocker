from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class WebhookBase(BaseModel):
    name: str
    url: str
    events: List[str]

class WebhookCreate(WebhookBase):
    hook_id: str
    org_id: str

class WebhookUpdate(BaseModel):
    name: Optional[str]
    url: Optional[str]
    events: Optional[List[str]]
    is_active: Optional[bool]

class WebhookOut(WebhookBase):
    hook_id: str
    org_id: str
    secret: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
