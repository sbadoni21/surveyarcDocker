# ============================================
# VARIABLE REPLACEMENT SERVICE
# app/services/variable_replacement_service.py
# ============================================

import re
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

from ..models.contact import Contact
from ..models.campaigns import Campaign
from ..models.campaign_result import CampaignResult

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def replace_variables(
    template: str,
    contact: Contact,
    campaign: Campaign,
    result: CampaignResult,
    survey_link: str,
    short_link: Optional[str] = None
) -> str:
    """
    Replace all {{variable}} placeholders with actual data
    
    Supported variables:
    - {{name}} - Contact's name
    - {{email}} - Primary email
    - {{phone}} - Primary phone number
    - {{survey_link}} - Full survey link with tracking
    - {{short_link}} - Shortened link (for SMS/WhatsApp)
    - {{tracking_token}} - Unique tracking token
    - {{campaign_name}} - Campaign name
    - {{current_date}} - Current date (e.g., "January 15, 2024")
    - {{current_year}} - Current year (e.g., "2024")
    - {{current_time}} - Current time (e.g., "03:45 PM")
    - {{twitter_handle}}, {{linkedin_handle}}, etc. - Social media handles
    
    Args:
        template: The text with {{variable}} placeholders
        contact: Contact object with all related data
        campaign: Campaign object
        result: CampaignResult object with tracking data
        survey_link: Full survey link with tracking parameters
        short_link: Shortened survey link (for SMS/WhatsApp)
    
    Returns:
        String with all variables replaced
    """
    
    if not template:
        return ""
    
    # Build replacement dictionary
    replacements = {}
    
    # ============================================
    # CONTACT VARIABLES
    # ============================================
    replacements['name'] = contact.name or 'there'
    replacements['first_name'] = contact.name.split()[0] if contact.name else 'there'
    replacements['contact_id'] = contact.contact_id
    
    # Get primary email
    primary_email = None
    if contact.emails:
        primary_email = next(
            (e.email for e in contact.emails if e.is_primary and e.status == 'active'),
            None
        )
        if not primary_email:
            primary_email = next(
                (e.email for e in contact.emails if e.status == 'active'), 
                None
            )
    
    replacements['email'] = primary_email or ''
    
    # Get primary phone
    primary_phone = None
    if contact.phones:
        primary_phone = next(
            (p for p in contact.phones if p.is_primary),
            None
        )
        if not primary_phone:
            primary_phone = contact.phones[0] if contact.phones else None
    
    if primary_phone:
        replacements['phone'] = f"{primary_phone.country_code}{primary_phone.phone_number}"
        replacements['phone_formatted'] = format_phone_number(
            primary_phone.country_code, 
            primary_phone.phone_number
        )
    else:
        replacements['phone'] = ''
        replacements['phone_formatted'] = ''
    
    # Get social media handles
    if contact.socials:
        for social in contact.socials:
            platform_key = f"{social.platform}_handle"
            replacements[platform_key] = social.handle or ''
    
    # Common social platforms (set to empty if not found)
    for platform in ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube']:
        key = f"{platform}_handle"
        if key not in replacements:
            replacements[key] = ''
    
    # ============================================
    # CAMPAIGN VARIABLES
    # ============================================
    replacements['campaign_id'] = campaign.campaign_id
    replacements['campaign_name'] = campaign.campaign_name
    replacements['survey_id'] = campaign.survey_id
    replacements['org_id'] = campaign.org_id
    replacements['user_id'] = campaign.user_id or ''
    
    # ============================================
    # TRACKING VARIABLES
    # ============================================
    replacements['tracking_token'] = result.tracking_token
    replacements['result_id'] = result.result_id
    replacements['channel'] = result.channel.value
    
    # ============================================
    # SURVEY LINKS
    # ============================================
    replacements['survey_link'] = survey_link
    replacements['short_link'] = short_link or survey_link
    replacements['link'] = survey_link  # Alias for survey_link
    
    # ============================================
    # SYSTEM VARIABLES
    # ============================================
    now = datetime.now(timezone.utc)
    replacements['current_date'] = now.strftime('%B %d, %Y')
    replacements['current_year'] = now.strftime('%Y')
    replacements['current_time'] = now.strftime('%I:%M %p')
    replacements['current_month'] = now.strftime('%B')
    replacements['current_day'] = now.strftime('%d')
    
    # ============================================
    # PERFORM REPLACEMENT
    # ============================================
    result_text = template
    
    # Replace all {{variable}} patterns (case-insensitive)
    for key, value in replacements.items():
        # Match {{key}} with optional whitespace
        pattern = r'\{\{\s*' + re.escape(key) + r'\s*\}\}'
        result_text = re.sub(
            pattern, 
            str(value), 
            result_text, 
            flags=re.IGNORECASE
        )
    
    # Log any unreplaced variables (for debugging)
    unreplaced = re.findall(r'\{\{([^}]+)\}\}', result_text)
    if unreplaced:
        logger.warning(
            f"⚠️  Unreplaced variables in template: {unreplaced}"
        )
    
    return result_text


def format_phone_number(country_code: str, phone_number: str) -> str:
    """
    Format phone number in a human-readable way
    
    Examples:
    - +1 (555) 123-4567
    - +44 20 1234 5678
    """
    if not country_code or not phone_number:
        return ''
    
    # Remove any non-digit characters
    digits = re.sub(r'\D', '', phone_number)
    
    # US/Canada format
    if country_code in ['+1', '1']:
        if len(digits) == 10:
            return f"+1 ({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    
    # UK format
    elif country_code in ['+44', '44']:
        if len(digits) >= 10:
            return f"+44 {digits[:2]} {digits[2:6]} {digits[6:]}"
    
    # Default format
    return f"{country_code} {digits}"


def build_tracking_url(
    base_survey_link: str,
    campaign: Campaign,
    contact: Contact,
    result: CampaignResult
) -> str:
    """
    Build survey URL with all tracking parameters
    
    Creates URLs like:
    https://survey.example.com/s/srv_123?
        campaign_id=camp_abc&
        contact_id=ct_xyz&
        tracking_token=camp_tracking_abc123&
        source=email&
        ...
    
    Args:
        base_survey_link: Base survey URL (e.g., https://survey.example.com/s/srv_123)
        campaign: Campaign object
        contact: Contact object
        result: CampaignResult object
    
    Returns:
        Complete tracking URL with all parameters
    """
    
    # Parse existing URL
    parsed = urlparse(base_survey_link)
    existing_params = parse_qs(parsed.query)
    
    # Build tracking parameters
    tracking_params = {
        'campaign_id': campaign.campaign_id,
        'survey_id': campaign.survey_id,
        'contact_id': contact.contact_id,
        'tracking_token': result.tracking_token,
        'result_id': result.result_id,
        'org_id': campaign.org_id,
        'source': result.channel.value,
        'channel': 'campaign',
        'utm_source': 'campaign',
        'utm_medium': result.channel.value,
        'utm_campaign': campaign.campaign_name,
    }
    
    # Add user_id if available
    if campaign.user_id:
        tracking_params['user_id'] = campaign.user_id
    
    # Add contact email if available
    if contact.emails:
        primary_email = next(
            (e.email for e in contact.emails if e.is_primary and e.status == 'active'),
            None
        )
        if not primary_email and contact.emails:
            primary_email = next(
                (e.email for e in contact.emails if e.status == 'active'), 
                None
            )
        
        if primary_email:
            tracking_params['email'] = primary_email
    
    # Add phone if available
    if contact.phones:
        primary_phone = next(
            (p for p in contact.phones if p.is_primary),
            None
        )
        if not primary_phone and contact.phones:
            primary_phone = contact.phones[0]
        
        if primary_phone:
            tracking_params['phone'] = f"{primary_phone.country_code}{primary_phone.phone_number}"
    
    # Merge with existing params (tracking params take priority)
    all_params = {}
    
    # Add existing params first
    for key, values in existing_params.items():
        all_params[key] = values[0] if isinstance(values, list) else values
    
    # Override with tracking params
    all_params.update(tracking_params)
    
    # Build final URL
    new_query = urlencode(all_params, doseq=True)
    final_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    
    logger.debug(f"📊 Built tracking URL: {final_url[:100]}...")
    
    return final_url


def validate_template(template: str) -> Dict[str, Any]:
    """
    Validate a template and return info about variables used
    
    Returns:
        {
            "valid": True/False,
            "variables": ["name", "email", ...],
            "unknown_variables": ["unknown_var", ...],
            "error": "error message" (if any)
        }
    """
    
    if not template:
        return {
            "valid": True,
            "variables": [],
            "unknown_variables": [],
            "error": None
        }
    
    # Find all {{variable}} patterns
    variables = re.findall(r'\{\{([^}]+)\}\}', template)
    variables = [v.strip().lower() for v in variables]
    
    # Known variables
    known_variables = {
        'name', 'first_name', 'email', 'phone', 'phone_formatted',
        'contact_id', 'campaign_id', 'campaign_name', 'survey_id',
        'org_id', 'user_id', 'tracking_token', 'result_id', 'channel',
        'survey_link', 'short_link', 'link',
        'current_date', 'current_year', 'current_time', 'current_month', 'current_day',
        'twitter_handle', 'linkedin_handle', 'facebook_handle', 
        'instagram_handle', 'youtube_handle'
    }
    
    # Find unknown variables
    unknown = [v for v in variables if v not in known_variables]
    
    return {
        "valid": len(unknown) == 0,
        "variables": list(set(variables)),
        "unknown_variables": unknown,
        "error": f"Unknown variables: {', '.join(unknown)}" if unknown else None
    }


def get_available_variables() -> Dict[str, str]:
    """
    Get list of all available variables with descriptions
    
    Returns:
        Dictionary of variable_name: description
    """
    return {
        # Contact variables
        "name": "Contact's full name",
        "first_name": "Contact's first name only",
        "email": "Contact's primary email address",
        "phone": "Contact's primary phone number",
        "phone_formatted": "Contact's phone number in formatted style",
        "contact_id": "Unique contact identifier",
        
        # Social media
        "twitter_handle": "Twitter/X handle",
        "linkedin_handle": "LinkedIn profile handle",
        "facebook_handle": "Facebook profile handle",
        "instagram_handle": "Instagram handle",
        "youtube_handle": "YouTube channel handle",
        
        # Campaign variables
        "campaign_id": "Unique campaign identifier",
        "campaign_name": "Campaign name",
        "survey_id": "Survey identifier",
        "org_id": "Organization identifier",
        "user_id": "User identifier",
        
        # Tracking variables
        "tracking_token": "Unique tracking token for this recipient",
        "result_id": "Campaign result identifier",
        "channel": "Communication channel (email, sms, whatsapp, voice)",
        
        # Links
        "survey_link": "Full survey link with tracking parameters",
        "short_link": "Shortened survey link (for SMS/WhatsApp)",
        "link": "Alias for survey_link",
        
        # Date/Time variables
        "current_date": "Current date (e.g., 'January 15, 2024')",
        "current_year": "Current year (e.g., '2024')",
        "current_time": "Current time (e.g., '03:45 PM')",
        "current_month": "Current month (e.g., 'January')",
        "current_day": "Current day (e.g., '15')",
    }

