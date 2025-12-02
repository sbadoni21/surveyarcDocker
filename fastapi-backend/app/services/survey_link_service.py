# ============================================
# SURVEY LINK SERVICE
# app/services/survey_link_service.py
# ============================================

import logging
import secrets
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from ..models.survey_link import SurveyLinkReference
from ..models.campaigns import Campaign, CampaignResult
from ..models.contact import Contact

logger = logging.getLogger(__name__)


class SurveyLinkError(Exception):
    """Base exception for survey link operations"""
    pass


class InvalidURLError(SurveyLinkError):
    """Raised when URL validation fails"""
    pass


class LinkExpiredError(SurveyLinkError):
    """Raised when attempting to use an expired link"""
    pass


class LinkNotFoundError(SurveyLinkError):
    """Raised when reference ID doesn't exist"""
    pass


def generate_reference_id() -> str:
    """
    Generate a cryptographically secure unique reference ID for survey links.
    
    Format: slr_{22_random_chars}
    Example: slr_Xk9mP2nQ7vR8wT3yU4zA
    
    Returns:
        Unique reference ID string
    """
    return f"slr_{secrets.token_urlsafe(16)}"


def validate_url(url: str) -> bool:
    """
    Validate that a URL is well-formed and has required components.
    
    Args:
        url: URL to validate
        
    Returns:
        True if valid
        
    Raises:
        InvalidURLError: If URL is malformed
    """
    try:
        parsed = urlparse(url)
        
        # Check for required components
        if not parsed.scheme or parsed.scheme not in ['http', 'https']:
            raise InvalidURLError(f"Invalid or missing URL scheme: {parsed.scheme}")
        
        if not parsed.netloc:
            raise InvalidURLError("Missing URL domain")
        
        # Check URL length (reasonable limit for most systems)
        if len(url) > 8000:
            logger.warning(f"Very long URL detected: {len(url)} characters")
        
        return True
        
    except Exception as e:
        raise InvalidURLError(f"Invalid URL format: {str(e)}")


def create_survey_link_reference(
    session: Session,
    campaign: Campaign,
    result: CampaignResult,
    contact: Contact,
    full_tracking_url: str,
    expires_in_days: Optional[int] = 90
) -> SurveyLinkReference:
    """
    Create a reference entry for a survey link.
    
    This creates a short, clean reference URL that redirects to the full
    tracking URL with all parameters. This prevents exposing sensitive
    tracking tokens and provides better analytics.
    
    Args:
        session: Database session
        campaign: Campaign object
        result: CampaignResult object
        contact: Contact object
        full_tracking_url: The complete URL with all tracking parameters
        expires_in_days: Optional expiration (default 90 days)
    
    Returns:
        SurveyLinkReference object with reference_id
        
    Raises:
        InvalidURLError: If the tracking URL is invalid
    """
    logger.debug("Creating survey link reference...")
    logger.debug(f"   - Campaign: {campaign.campaign_id}")
    logger.debug(f"   - Result: {result.result_id}")
    logger.debug(f"   - Contact: {contact.contact_id}")
    
    # Validate URL before creating reference
    validate_url(full_tracking_url)
    
    # Generate unique reference ID (with collision check)
    max_attempts = 5
    reference_id = None
    
    for attempt in range(max_attempts):
        candidate_id = generate_reference_id()
        
        # Check if ID already exists
        existing = session.query(SurveyLinkReference).filter(
            SurveyLinkReference.reference_id == candidate_id
        ).first()
        
        if not existing:
            reference_id = candidate_id
            break
    
    if not reference_id:
        raise SurveyLinkError(f"Failed to generate unique reference ID after {max_attempts} attempts")
    
    logger.debug(f"   - Reference ID: {reference_id}")
    
    # Calculate expiration
    expires_at = None
    if expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        logger.debug(f"   - Expires at: {expires_at}")
    
    # Create reference entry
    link_ref = SurveyLinkReference(
        reference_id=reference_id,
        full_url=full_tracking_url,
        campaign_id=campaign.campaign_id,
        result_id=result.result_id,
        contact_id=contact.contact_id,
        org_id=campaign.org_id,
        tracking_token=result.tracking_token,
        channel=result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used,
        meta_data={
            "campaign_name": campaign.campaign_name,
            "contact_name": contact.name,
            "recipient_address": result.recipient_address,
            "created_by": "campaign_service"
        },
        expires_at=expires_at
    )
    
    session.add(link_ref)
    session.flush()
    
    logger.info(f"✅ Survey link reference created: {reference_id}")
    
    return link_ref


def get_reference_url(reference_id: str, base_url: Optional[str] = None) -> str:
    """
    Build the public reference URL that users will click.
    
    This creates a clean, short URL without any tracking parameters.
    
    Args:
        reference_id: The reference ID (e.g., "slr_abc123")
        base_url: Base URL for the redirect endpoint (default from env)
    
    Returns:
        Clean URL like: https://api.example.com/r/slr_abc123
        
    Example:
        >>> get_reference_url("slr_abc123", "https://api.example.com")
        'https://api.example.com/r/slr_abc123'
    """
    if not base_url:
        base_url = os.getenv("API_BASE_URL", "https://surveyarc-docker.vercel.app")
    
    # Ensure base_url has no trailing slash
    base_url = base_url.rstrip('/')
    
    # ✅ CRITICAL: Build clean URL with ONLY the reference ID
    # Format: {base_url}/r/{reference_id}
    reference_url = f"{base_url}/r/{reference_id}"
    
    # ✅ SAFETY CHECK: Verify no query parameters leaked in
    if '?' in reference_url:
        logger.error(f"❌ CRITICAL: Query parameters detected in reference URL: {reference_url}")
        # Strip everything after '?'
        reference_url = reference_url.split('?')[0]
        logger.warning(f"   - Cleaned to: {reference_url}")
    
    logger.debug(f"Reference URL generated: {reference_url}")
    
    return reference_url
def resolve_survey_link(
    session: Session,
    reference_id: str,
    track_access: bool = True
) -> str:
    """
    Resolve a reference ID to the actual survey URL.
    Also tracks access and checks expiration.
    
    Args:
        session: Database session
        reference_id: The reference ID to resolve
        track_access: Whether to increment access counter (default True)
    
    Returns:
        The full tracking URL
        
    Raises:
        LinkNotFoundError: If reference ID doesn't exist
        LinkExpiredError: If the link has expired
    """
    logger.debug(f"Resolving reference ID: {reference_id}")
    
    # Look up reference (no locking for better performance)
    link_ref = session.query(SurveyLinkReference).filter(
        SurveyLinkReference.reference_id == reference_id
    ).first()
    
    if not link_ref:
        logger.warning(f"Reference ID not found: {reference_id}")
        raise LinkNotFoundError(f"Link reference not found: {reference_id}")
    
    # Check expiration
    if link_ref.is_expired():
        logger.warning(f"Reference ID expired: {reference_id}")
        logger.warning(f"   - Expired at: {link_ref.expires_at}")
        raise LinkExpiredError(f"Link expired on {link_ref.expires_at}")
    
    # Track access (optional, for analytics)
    if track_access:
        try:
            link_ref.increment_access(session)
            session.commit()  # Commit the access tracking
        except Exception as e:
            logger.error(f"Failed to track access for {reference_id}: {e}")
            session.rollback()
            # Don't fail the redirect just because tracking failed
    
    logger.info(f"✅ Reference resolved: {reference_id}")
    logger.debug(f"   - Campaign: {link_ref.campaign_id}")
    logger.debug(f"   - Result: {link_ref.result_id}")
    logger.debug(f"   - Access count: {link_ref.access_count}")
    logger.debug(f"   - Full URL: {link_ref.full_url[:100]}...")
    
    return link_ref.full_url


def get_link_analytics(
    session: Session,
    reference_id: str
) -> Dict[str, Any]:
    """
    Get analytics for a specific link reference.
    
    Args:
        session: Database session
        reference_id: The reference ID
    
    Returns:
        Dictionary with access stats
        
    Raises:
        LinkNotFoundError: If reference ID doesn't exist
    """
    link_ref = session.query(SurveyLinkReference).filter(
        SurveyLinkReference.reference_id == reference_id
    ).first()
    
    if not link_ref:
        raise LinkNotFoundError(f"Link reference not found: {reference_id}")
    
    return link_ref.to_dict()


def get_campaign_link_analytics(
    session: Session,
    campaign_id: str,
    org_id: str
) -> Dict[str, Any]:
    """
    Get aggregated analytics for all links in a campaign.
    
    Args:
        session: Database session
        campaign_id: Campaign ID
        org_id: Organization ID (for security)
    
    Returns:
        Dictionary with aggregated stats
    """
    from sqlalchemy import func
    
    # Get aggregate stats
    stats = session.query(
        func.count(SurveyLinkReference.reference_id).label('total_links'),
        func.sum(SurveyLinkReference.access_count).label('total_accesses'),
        func.count(SurveyLinkReference.first_accessed_at).label('links_accessed'),
        func.min(SurveyLinkReference.first_accessed_at).label('first_access'),
        func.max(SurveyLinkReference.last_accessed_at).label('last_access')
    ).filter(
        SurveyLinkReference.campaign_id == campaign_id,
        SurveyLinkReference.org_id == org_id
    ).first()
    
    return {
        "campaign_id": campaign_id,
        "total_links": stats.total_links or 0,
        "total_accesses": int(stats.total_accesses or 0),
        "links_accessed": stats.links_accessed or 0,
        "links_not_accessed": (stats.total_links or 0) - (stats.links_accessed or 0),
        "first_access_at": stats.first_access.isoformat() if stats.first_access else None,
        "last_access_at": stats.last_access.isoformat() if stats.last_access else None,
        "access_rate": round((stats.links_accessed or 0) / (stats.total_links or 1) * 100, 2)
    }


def cleanup_expired_links(
    session: Session,
    days_old: int = 180,
    batch_size: int = 1000
) -> int:
    """
    Clean up old expired link references.
    
    This removes:
    1. Links that have expired (expires_at < now)
    2. Very old links regardless of expiration (created > days_old ago)
    
    Args:
        session: Database session
        days_old: Delete links older than this many days (default 180)
        batch_size: Number of records to delete per batch (default 1000)
    
    Returns:
        Total number of records deleted
    """
    now = datetime.now(timezone.utc)
    cutoff_date = now - timedelta(days=days_old)
    
    logger.info(f"Cleaning up links expired before {now} or created before {cutoff_date}")
    
    total_deleted = 0
    
    while True:
        # Delete in batches to avoid locking issues
        result = session.query(SurveyLinkReference).filter(
            or_(
                # Expired links
                SurveyLinkReference.expires_at < now,
                # Very old links (regardless of expiration)
                SurveyLinkReference.created_at < cutoff_date
            )
        ).limit(batch_size).delete(synchronize_session=False)
        
        session.commit()
        total_deleted += result
        
        logger.debug(f"Deleted batch of {result} links (total: {total_deleted})")
        
        # Stop when no more records to delete
        if result < batch_size:
            break
    
    logger.info(f"✅ Deleted {total_deleted} expired/old link references")
    
    return total_deleted


def bulk_create_link_references(
    session: Session,
    campaign: Campaign,
    results_with_contacts: list[tuple[CampaignResult, Contact, str]],
    expires_in_days: Optional[int] = 90
) -> list[SurveyLinkReference]:
    """
    Bulk create survey link references for multiple results.
    More efficient than creating one at a time.
    
    Args:
        session: Database session
        campaign: Campaign object
        results_with_contacts: List of (result, contact, full_url) tuples
        expires_in_days: Optional expiration (default 90 days)
    
    Returns:
        List of created SurveyLinkReference objects
    """
    logger.info(f"Bulk creating {len(results_with_contacts)} link references")
    
    expires_at = None
    if expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    
    link_refs = []
    
    for result, contact, full_url in results_with_contacts:
        try:
            # Validate URL
            validate_url(full_url)
            
            # Generate unique ID
            reference_id = generate_reference_id()
            
            # Create reference
            link_ref = SurveyLinkReference(
                reference_id=reference_id,
                full_url=full_url,
                campaign_id=campaign.campaign_id,
                result_id=result.result_id,
                contact_id=contact.contact_id,
                org_id=campaign.org_id,
                tracking_token=result.tracking_token,
                channel=result.channel_used.value if hasattr(result.channel_used, 'value') else result.channel_used,
                meta_data={
                    "campaign_name": campaign.campaign_name,
                    "contact_name": contact.name,
                    "recipient_address": result.recipient_address
                },
                expires_at=expires_at
            )
            
            link_refs.append(link_ref)
            
        except Exception as e:
            logger.error(f"Failed to create link reference for result {result.result_id}: {e}")
            continue
    
    # Bulk insert
    session.bulk_save_objects(link_refs)
    session.flush()
    
    logger.info(f"✅ Created {len(link_refs)} link references")
    
    return link_refs