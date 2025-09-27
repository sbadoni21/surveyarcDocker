# app/models/__init__.py

def init_models():
    # Base tables that are referenced
    from .organisation import Organisation
    from .project import Project
    from .survey import Survey
    from .responses import Response
    from .user import User
    from .questions import Question

    # Dependent tables (need survey/response/org/project already defined)
    from .answer import Answer
    from .webhook import Webhook    
    from .archive import Archive
    from .audit_log import AuditLog
    from .domains import Domain
    from .integration import Integration
    from .invite import Invite
    from .invoice import Invoice
    from .marketplace import Marketplace
    from .metric import Metric
    from .order import Order
    from .payment import Payment
    from .rule import Rule
    from .contact import Contact, ContactList
    from .tickets import Ticket, Tag, TicketComment, TicketAttachment, TicketCollaborator
    from .support import SupportGroupMember, GroupMemberRole, ProficiencyLevel, SupportGroup, SupportTeam
    from .sla import SLA, SLADimension, SLAPauseWindow
    from .business_calendar import BusinessCalendar, BusinessCalendarHour, BusinessCalendarHoliday