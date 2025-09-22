from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.middleware.decrypt_middleware import DecryptMiddleware
from app.middleware.encrypt_middleware import EncryptGetMiddleware
from app.models import init_models

# Import all models so SQLAlchemy knows about them
init_models()

# Create tables in the database
Base.metadata.create_all(bind=engine)


from app.routes import (
    secure_crud, user, project, survey, questions, responses, ticket, webhook, answer,
    archive, audit_log, domains, integration, invite, invoice,
    marketplace, metric, order, organisation, payment, pricing_plan
)

app = FastAPI(title="Survey & Ticket Management API")

app.add_middleware(DecryptMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(answer.router, tags=["Answers"])
app.include_router(archive.router, tags=["Archives"])
app.include_router(audit_log.router, tags=["Audit Logs"])
app.include_router(domains.router, tags=["Domains"])
app.include_router(integration.router, tags=["Integrations"])
app.include_router(invite.router, tags=["Invite"])
app.include_router(invoice.router, tags=["Invoices"])
app.include_router(marketplace.router, tags=["Marketplace"])
app.include_router(metric.router, tags=["Metrics"])
app.include_router(order.router, tags=["Orders"])
app.include_router(organisation.router, tags=["Organisations"])
app.include_router(payment.router,tags=["Payments"])
app.include_router(pricing_plan.router, tags=["Pricing Plans"])
app.include_router(user.router, tags=["Users"])
app.include_router(project.router, tags=["Projects"])
app.include_router(survey.router, tags=["Surveys"])
app.include_router(questions.router, tags=["Questions"])
app.include_router(responses.router, tags=["Responses"])
app.include_router(ticket.router, tags=["Tickets"])
app.include_router(webhook.router, tags=["Webhooks"])
app.include_router(secure_crud.router, tags=["Secure CRUD"])

app.add_middleware(EncryptGetMiddleware) 

@app.get("/")
def root():
    return {"message": "Survey & Ticket Management API is running"}
