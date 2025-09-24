from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class Condition(BaseModel):
    questionId: str
    operator: str
    value: str | int | float | bool | None = None
    conditionLogic: Optional[str] = "AND"

class Action(BaseModel):
    type: str
    blockId: Optional[str] = None
    targetBlockId: Optional[str] = None
    targetQuestionId: Optional[str] = None
    questionId: Optional[str] = None
    blockIds: Optional[List[str]] = []
    questionIds: Optional[List[str]] = []
    message: Optional[str] = ""

class RuleBase(BaseModel):
    org_id: str
    survey_id: str
    project_id: Optional[str] = None
    name: Optional[str] = ""
    block_id: str
    enabled: Optional[bool] = True
    priority: Optional[int] = 1
    conditions: List[Dict] | List[Condition] = []
    actions: List[Dict] | List[Action] = []

class RuleCreate(RuleBase):
    rule_id: Optional[str] = None

class RuleUpdate(BaseModel):
    name: Optional[str] = None
    block_id: Optional[str] = None
    enabled: Optional[bool] = None
    priority: Optional[int] = None
    conditions: Optional[List[Dict] | List[Condition]] = None
    actions: Optional[List[Dict] | List[Action]] = None

class RuleOut(RuleBase):
    rule_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
