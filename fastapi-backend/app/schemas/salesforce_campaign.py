# ============================================
# SALESFORCE CAMPAIGN SCHEMAS
# app/schemas/salesforce_campaign.py
# ============================================

from pydantic import BaseModel, Field
from typing import List, Optional


# ============================================
# CAMPAIGN SCHEMAS
# ============================================

class SalesforceCampaignCreate(BaseModel):
    """Create campaign from Salesforce contacts"""
    campaign_name: str
    survey_id: str
    org_id: str
    user_id: str
    
    # Salesforce-specific fields
    salesforce_account_id: Optional[str] = None
    salesforce_contact_ids: Optional[List[str]] = None
    
    # Campaign content
    channel: str = "email"
    email_subject: str
    email_body_html: str
    email_from_name: Optional[str] = "Survey Team"
    email_reply_to: Optional[str] = None
    
    # Optional filters
    contact_filters: Optional[dict] = None


class SalesforceContactSummary(BaseModel):
    """Summary of Salesforce contact for campaign"""
    id: str
    name: str
    email: str
    account_name: Optional[str] = None


class SalesforceCampaignPreview(BaseModel):
    """Preview of campaign before sending"""
    total_recipients: int
    contacts: List[SalesforceContactSummary]
    invalid_contacts: List[dict]


# ============================================
# SYNC SCHEMAS
# ============================================

class SalesforceSyncRequest(BaseModel):
    """Request to sync Salesforce contacts"""
    account_id: Optional[str] = None
    contact_ids: Optional[List[str]] = None
    sync_all: bool = False


class SalesforceSyncResult(BaseModel):
    """Result of sync operation"""
    total_synced: int
    created: int
    updated: int
    linked: int
    failed: int
    details: List[dict]


# ============================================
# ACCOUNT TO LIST SCHEMAS
# ============================================

class SalesforceAccountToListRequest(BaseModel):
    """Request to sync Salesforce account as contact list"""
    account_id: str


class SalesforceAccountsToListsRequest(BaseModel):
    """Request to sync multiple Salesforce accounts as contact lists"""
    account_ids: List[str]