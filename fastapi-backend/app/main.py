from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.middleware.decrypt_middleware import DecryptMiddleware
from app.middleware.encrypt_middleware import EncryptGetMiddleware
from app.models import init_models

# Import Redis client
from app.core.redis_client import redis_client

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

# Startup event to test Redis connection
@app.on_event("startup")
async def startup_event():
    """Test database and Redis connections on startup"""
    print("🚀 Starting Survey & Ticket Management API...")
    
    # Test Redis connection
    if redis_client.ping():
        print("✅ Redis connected successfully")
    else:
        print("⚠️  Warning: Redis connection failed - caching will be disabled")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("🛑 Survey API shutting down...")

# Add middleware
app.add_middleware(DecryptMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoints
@app.get("/")
def root():
    return {"message": "Survey & Ticket Management API is running"}

@app.get("/health")
def health_check():
    """Health check endpoint including Redis status"""
    redis_status = "connected" if redis_client.ping() else "disconnected"
    
    return {
        "status": "healthy",
        "database": "connected",  # Assuming DB is working if app starts
        "redis": redis_status,
        "api": "Survey & Ticket Management API",
        "version": "1.0.0"
    }

@app.get("/redis/info")
def redis_info():
    """Get Redis database information for admin monitoring"""
    try:
        if not redis_client.ping():
            raise HTTPException(status_code=503, detail="Redis connection failed")
        
        # Get basic Redis info
        info = redis_client.client.info()
        return {
            "redis_version": info.get("redis_version"),
            "connected_clients": info.get("connected_clients"),
            "used_memory_human": info.get("used_memory_human"),
            "total_commands_processed": info.get("total_commands_processed"),
            "keyspace": info.get("db0", "No keys found")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis error: {str(e)}")

@app.get("/redis/keys")
def redis_keys(pattern: str = "*"):
    """Get all Redis keys (for debugging/admin purposes)"""
    try:
        if not redis_client.ping():
            raise HTTPException(status_code=503, detail="Redis connection failed")
        
        keys = redis_client.client.keys(pattern)
        return {
            "total_keys": len(keys),
            "keys": keys[:100] if len(keys) > 100 else keys,
            "note": "Showing first 100 keys" if len(keys) > 100 else "All keys shown"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis error: {str(e)}")

# Include all your existing routers
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
app.include_router(payment.router, tags=["Payments"])
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