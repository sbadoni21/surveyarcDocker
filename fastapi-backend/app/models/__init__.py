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
    from .ticket import Ticket
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
