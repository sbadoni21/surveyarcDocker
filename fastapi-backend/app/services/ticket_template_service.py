# app/services/ticket_template_service.py
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Dict, Any, Optional, List
from datetime import datetime
import re
from fastapi import HTTPException, status
import uuid

from ..models.ticket_templates import TicketTemplate, TicketTemplateUsage
from ..models.tickets import Ticket, Tag


class TicketTemplateService:
    """Service for managing and using ticket templates"""
    
    @staticmethod
    def create_template(
        db: Session,
        org_id: str,
        name: str,
        subject_template: str,
        created_by: str,
        **kwargs
    ) -> TicketTemplate:
        """Create a new ticket template"""
        template_id = f"tmpl_{uuid.uuid4().hex[:16]}"
        api_key = TicketTemplate.generate_api_key()
        
        template = TicketTemplate(
            template_id=template_id,
            org_id=org_id,
            name=name,
            subject_template=subject_template,
            api_key=api_key,
            created_by=created_by,
            **kwargs
        )
        
        db.add(template)
        db.commit()
        db.refresh(template)
        
        return template
    
    @staticmethod
    def get_template_by_api_key(db: Session, api_key: str) -> Optional[TicketTemplate]:
        """Get template by API key"""
        stmt = select(TicketTemplate).where(
            TicketTemplate.api_key == api_key,
            TicketTemplate.is_active == True
        )
        return db.scalar(stmt)
    
    @staticmethod
    def substitute_variables(template_str: str, variables: Dict[str, Any]) -> str:
        """
        Replace template variables like {{variable_name}} with actual values
        """
        def replacer(match):
            var_name = match.group(1)
            return str(variables.get(var_name, match.group(0)))
        
        return re.sub(r'\{\{(\w+)\}\}', replacer, template_str)
    
    @staticmethod
    def validate_variables(
        provided_vars: Dict[str, Any],
        allowed_vars: List[str],
        validation_rules: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """
        Validate provided variables against allowed variables and rules
        Returns (is_valid, error_message)
        """
        # Check for disallowed variables
        for var_name in provided_vars.keys():
            if allowed_vars and var_name not in allowed_vars:
                return False, f"Variable '{var_name}' is not allowed"
        
        # Apply validation rules
        for var_name, rules in validation_rules.items():
            if var_name not in provided_vars:
                if rules.get("required", False):
                    return False, f"Required variable '{var_name}' is missing"
                continue
            
            value = provided_vars[var_name]
            
            # Type validation
            expected_type = rules.get("type")
            if expected_type == "email":
                if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', str(value)):
                    return False, f"Variable '{var_name}' must be a valid email"
            elif expected_type == "number":
                try:
                    float(value)
                except ValueError:
                    return False, f"Variable '{var_name}' must be a number"
            
            # Length validation
            if "max_length" in rules:
                if len(str(value)) > rules["max_length"]:
                    return False, f"Variable '{var_name}' exceeds max length of {rules['max_length']}"
            
            if "min_length" in rules:
                if len(str(value)) < rules["min_length"]:
                    return False, f"Variable '{var_name}' must be at least {rules['min_length']} characters"
        
        return True, None
    
    @staticmethod
    def create_ticket_from_template(
        db: Session,
        template: TicketTemplate,
        requester_id: str,
        variables: Dict[str, Any] = None,
        overrides: Dict[str, Any] = None,
        request_meta: Dict[str, Any] = None
    ) -> Ticket:
        """
        Create a ticket from a template
        
        Args:
            template: The ticket template to use
            requester_id: ID of the user requesting the ticket
            variables: Variables to substitute in template strings
            overrides: Fields to override from the template defaults
            request_meta: Metadata about the request (IP, user agent, etc.)
        """
        variables = variables or {}
        overrides = overrides or {}
        request_meta = request_meta or {}
        
        # Validate variables
        is_valid, error_msg = TicketTemplateService.validate_variables(
            variables,
            template.allowed_variables,
            template.validation_rules
        )
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg
            )
        
        # Substitute variables in subject and description
        subject = TicketTemplateService.substitute_variables(
            template.subject_template,
            variables
        )
        
        description = None
        if template.description_template:
            description = TicketTemplateService.substitute_variables(
                template.description_template,
                variables
            )
        
        # Build ticket data from template defaults
        ticket_data = {
            "ticket_id": f"tkt_{uuid.uuid4().hex[:16]}",
            "org_id": template.org_id,
            "subject": subject,
            "description": description,
            "requester_id": requester_id,
            "status": template.default_status,
            "priority": template.default_priority,
            "severity": template.default_severity,
            "assignee_id": template.default_assignee_id,
            "team_id": template.default_team_id,
            "group_id": template.default_group_id,
            "category_id": template.default_category_id,
            "subcategory_id": template.default_subcategory_id,
            "feature_id": template.default_feature_id,
            "impact_id": template.default_impact_id,
            "sla_id": template.default_sla_id,
            "custom_fields": template.default_custom_fields.copy(),
            "meta": {
                "created_from_template": template.template_id,
                "template_name": template.name,
                **request_meta
            }
        }
        
        # Apply overrides
        ticket_data.update(overrides)
        
        # Create ticket
        ticket = Ticket(**ticket_data)
        db.add(ticket)
        
        # Add default tags if specified
        if template.default_tag_ids:
            stmt = select(Tag).where(Tag.tag_id.in_(template.default_tag_ids))
            tags = db.scalars(stmt).all()
            ticket.tags.extend(tags)
        
        # Log template usage
        usage = TicketTemplateUsage(
            usage_id=f"tplu_{uuid.uuid4().hex[:16]}",
            template_id=template.template_id,
            ticket_id=ticket.ticket_id,
            provided_variables=variables,
            success=True,
            created_by=requester_id,
            ip_address=request_meta.get("ip_address"),
            user_agent=request_meta.get("user_agent"),
            meta=request_meta
        )
        db.add(usage)
        
        # Update template usage stats
        template.usage_count += 1
        template.last_used_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ticket)
        
        return ticket

