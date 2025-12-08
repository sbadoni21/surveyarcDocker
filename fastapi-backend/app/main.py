import os
import asyncio
import threading
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.middleware.decrypt_middleware import DecryptMiddleware
from app.middleware.encrypt_middleware import EncryptGetMiddleware
from app.models import init_models
from contextlib import asynccontextmanager
import logging

# Import Redis client and utilities
from app.core.redis_client import redis_client
from app.utils.redis_utils import RedisHealthCheck, RedisProjectAnalytics, RedisKeyManager

# Import outbox processor
from app.services.outbox_processor import run_forever as run_outbox_processor
from app.middleware.request_context import request_context_middleware
from app.services.campaign_scheduler_service import start_scheduler, stop_scheduler

# Import all models so SQLAlchemy knows about them
init_models()

# Create tables in the database
Base.metadata.create_all(bind=engine)

from app.routes import (
    quota, secure_crud, user, project, survey, questions, responses, tickets, webhook, answer,
    archive, audit_log, domains, integration, invite, invoice,
    marketplace, metric, order, organisation, payment, pricing_plan, rule, contacts, 
    support_groups, support_teams, support_routing, slas, business_calendars, tags, 
    ticket_categories, ticket_sla, ticket_taxonomies, audit_events, contact_emails, 
    contact_lists, list_members, contact_phone, contact_socials, ticket_templates, audience_files,
    themes, campaigns, scheduler_routes, salesforce_routes, salesforce_campaign_routes, salesforce_sync_routes
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment variables
ENABLE_ENCRYPTION = os.getenv("ENABLE_ENCRYPTION", "true").lower() == "true"
ENCRYPTION_FALLBACK = os.getenv("ENCRYPTION_FALLBACK", "true").lower() == "true"
REDIS_HEALTH_CHECK_INTERVAL = int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30"))  # seconds
ENABLE_OUTBOX_PROCESSOR = os.getenv("ENABLE_OUTBOX_PROCESSOR", "true").lower() == "true"
OUTBOX_POLL_INTERVAL = float(os.getenv("OUTBOX_POLL_INTERVAL", "2.0"))
OUTBOX_BATCH_SIZE = int(os.getenv("OUTBOX_BATCH_SIZE", "25"))
CAMPAIGN_SCHEDULER_INTERVAL = int(os.getenv("CAMPAIGN_SCHEDULER_INTERVAL", "20"))

# Global variable to track outbox processor thread
outbox_processor_thread = None


def start_outbox_processor():
    """Start the outbox processor in a separate thread"""
    try:
        run_outbox_processor(
            poll_interval=OUTBOX_POLL_INTERVAL,
            batch_size=OUTBOX_BATCH_SIZE
        )
    except Exception as e:
        logger.error(f"❌ Outbox processor error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup/shutdown events
    """
    global outbox_processor_thread
    
    
    # Test Redis connection with detailed info
    try:
        redis_info = RedisHealthCheck.get_redis_info()
        if redis_info["status"] == "connected":
            logger.info("✅ Redis connected successfully")
        else:
            logger.warning(f"   - Error: {redis_info.get('error', 'Unknown error')}")
    except Exception as e:
        logger.warning(f"⚠️  Warning: Redis connection error: {e}")
    
    # Get Redis cache statistics
    try:
        cache_stats = RedisHealthCheck.get_cache_statistics("project:*")
        if "error" not in cache_stats:
            logger.info(f"📊 Redis Cache Statistics:")
            logger.info(f"   - Project Keys: {cache_stats.get('total_keys', 0)}")
            logger.info(f"   - Estimated Cache Size: {cache_stats.get('estimated_total_size_human', '0 KB')}")
    except Exception as e:
        logger.warning(f"⚠️  Warning: Could not get cache statistics: {e}")
    
    # Test key server connection if encryption is enabled
    if ENABLE_ENCRYPTION:
        try:
            import httpx
            timeout = httpx.Timeout(5.0, connect=3.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                test_key_id = "startup_test"
                response = await client.get(f"https://surveyarcdocker.onrender.com/get-key/{test_key_id}")
                if response.status_code == 200:
                    logger.info("✅ Key server connected successfully")
                else:
                    logger.warning(f"⚠️  Warning: Key server returned {response.status_code}")
                    if not ENCRYPTION_FALLBACK:
                        logger.error("❌ Encryption fallback disabled - this may cause issues")
        except Exception as e:
            logger.warning(f"⚠️  Warning: Key server connection failed: {e}")
            if not ENCRYPTION_FALLBACK:
                logger.error("❌ Encryption fallback disabled - API may fail")
    
    # Start outbox processor in background thread
    if ENABLE_OUTBOX_PROCESSOR:
        try:
            outbox_processor_thread = threading.Thread(
                target=start_outbox_processor,
                daemon=True,
                name="OutboxProcessor"
            )
            outbox_processor_thread.start()
        except Exception as e:
            logger.error(f"❌ Failed to start outbox processor: {e}")
    else:
        logger.info("ℹ️  Outbox processor disabled (set ENABLE_OUTBOX_PROCESSOR=true to enable)")
    
    # Start campaign scheduler
    try:
        start_scheduler(check_interval=CAMPAIGN_SCHEDULER_INTERVAL)
        logger.info("✅ Campaign scheduler started successfully")
        logger.info(f"   - Check Interval: {CAMPAIGN_SCHEDULER_INTERVAL}s")
    except Exception as e:
        logger.error(f"❌ Failed to start campaign scheduler: {e}")
    
    logger.info("=" * 80)
    logger.info("✅ Application startup complete")
    logger.info("=" * 80)
    
    yield
    
    # ==================== SHUTDOWN ====================
    logger.info("=" * 80)
    logger.info("🛑 Shutting down Survey & Ticket Management API...")
    logger.info("=" * 80)
    
    # Stop campaign scheduler
    try:
        stop_scheduler()
        logger.info("✅ Campaign scheduler stopped")
    except Exception as e:
        logger.error(f"⚠️  Warning: Campaign scheduler shutdown failed: {e}")
    
    # Stop outbox processor
    if outbox_processor_thread and outbox_processor_thread.is_alive():
        logger.info("🛑 Outbox processor will terminate with main process")
    
    # Optional: Clean up Redis connections
    try:
        logger.info("✅ Redis cleanup completed")
    except Exception as e:
        logger.warning(f"⚠️ Warning: Redis cleanup failed: {e}")
    
    logger.info("=" * 80)
    logger.info("✅ Application shutdown complete")
    logger.info("=" * 80)


# Create FastAPI app with lifespan
app = FastAPI(
    title="Survey & Ticket Management API",
    description="FastAPI application with Redis caching layer for improved performance",
    version="1.0.0",
    lifespan=lifespan  # Register the lifespan context manager
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(DecryptMiddleware)
app.middleware("http")(request_context_middleware)
app.add_middleware(
    EncryptGetMiddleware, 
    enable_encryption=ENABLE_ENCRYPTION, 
    fallback_on_error=ENCRYPTION_FALLBACK
)

# ==================== HEALTH CHECK ENDPOINTS ====================

@app.get("/")
def root():
    return {
        "message": "Survey & Ticket Management API is running",
        "redis_enabled": RedisHealthCheck.is_redis_available(),
        "encryption_enabled": ENABLE_ENCRYPTION,
        "outbox_processor_enabled": ENABLE_OUTBOX_PROCESSOR,
        "outbox_processor_running": outbox_processor_thread.is_alive() if outbox_processor_thread else False,
        "campaign_scheduler_interval": CAMPAIGN_SCHEDULER_INTERVAL
    }


@app.get("/health")
def health_check():
    """Comprehensive health check endpoint"""
    redis_info = RedisHealthCheck.get_redis_info()
    
    return {
        "status": "healthy",
        "timestamp": redis_info.get("server_time"),
        "database": "connected",
        "redis": {
            "status": redis_info["status"],
            "version": redis_info.get("redis_version"),
            "memory_used": redis_info.get("used_memory_human"),
            "hit_ratio": redis_info.get("hit_ratio"),
            "uptime": redis_info.get("uptime_in_seconds")
        },
        "encryption": {
            "enabled": ENABLE_ENCRYPTION,
            "fallback_enabled": ENCRYPTION_FALLBACK
        },
        "outbox_processor": {
            "enabled": ENABLE_OUTBOX_PROCESSOR,
            "running": outbox_processor_thread.is_alive() if outbox_processor_thread else False,
            "poll_interval": OUTBOX_POLL_INTERVAL,
            "batch_size": OUTBOX_BATCH_SIZE
        },
        "campaign_scheduler": {
            "interval": CAMPAIGN_SCHEDULER_INTERVAL
        },
        "api": "Survey & Ticket Management API",
        "version": "1.0.0"
    }


@app.get("/health/redis")
def redis_health_detailed():
    """Detailed Redis health check"""
    return RedisHealthCheck.get_redis_info()


@app.get("/health/outbox")
def outbox_health():
    """Check outbox processor status"""
    from app.db import SessionLocal
    import sqlalchemy as sa
    from app.models.outbox import Outbox
    
    try:
        with SessionLocal() as session:
            pending_count = session.execute(
                sa.select(sa.func.count(Outbox.id)).where(Outbox.sent_at.is_(None))
            ).scalar()
            
            sent_count = session.execute(
                sa.select(sa.func.count(Outbox.id)).where(Outbox.sent_at.isnot(None))
            ).scalar()
            
            return {
                "status": "healthy",
                "processor_enabled": ENABLE_OUTBOX_PROCESSOR,
                "processor_running": outbox_processor_thread.is_alive() if outbox_processor_thread else False,
                "pending_messages": pending_count,
                "sent_messages": sent_count,
                "poll_interval": OUTBOX_POLL_INTERVAL,
                "batch_size": OUTBOX_BATCH_SIZE
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outbox health check error: {str(e)}")


# ==================== REDIS MANAGEMENT ENDPOINTS ====================

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
            "keyspace_hits": info.get("keyspace_hits"),
            "keyspace_misses": info.get("keyspace_misses"),
            "hit_ratio": round((info.get("keyspace_hits", 0) / max(
                info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1
            )) * 100, 2),
            "keyspace": info.get("db0", "No keys found"),
            "uptime_in_seconds": info.get("uptime_in_seconds")
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


@app.get("/redis/cache/stats")
def redis_cache_stats(pattern: str = "project:*"):
    """Get cache statistics for specific pattern"""
    try:
        if not redis_client.ping():
            raise HTTPException(status_code=503, detail="Redis connection failed")
        
        return RedisHealthCheck.get_cache_statistics(pattern)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis cache stats error: {str(e)}")


@app.post("/redis/cache/cleanup")
def redis_cache_cleanup(dry_run: bool = True):
    """Clean up Redis cache keys"""
    try:
        if not redis_client.ping():
            raise HTTPException(status_code=503, detail="Redis connection failed")
        
        return RedisKeyManager.cleanup_expired_keys(dry_run)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redis cleanup error: {str(e)}")


@app.get("/redis/analytics/{org_id}")
async def get_org_analytics(org_id: str):
    """Get organization project analytics from Redis"""
    try:
        if not redis_client.ping():
            raise HTTPException(status_code=503, detail="Redis connection failed")
        
        analytics = await RedisProjectAnalytics.get_project_analytics(org_id)
        
        if not analytics:
            raise HTTPException(status_code=404, detail="No analytics data found for organization")
        
        return analytics
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analytics error: {str(e)}")


# ==================== INCLUDE ROUTERS ====================

app.include_router(answer.router, tags=["Answers"])
app.include_router(archive.router, tags=["Archives"])
app.include_router(audit_log.router, tags=["Audit Logs"])
app.include_router(domains.router, tags=["Domains"])
app.include_router(integration.router, tags=["Integrations"])
app.include_router(invite.router, tags=["Invite"])
app.include_router(invoice.router, tags=["Invoices"])
app.include_router(rule.router, tags=["Rules"])
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
app.include_router(tickets.router, tags=["Tickets"])
app.include_router(webhook.router, tags=["Webhooks"])
app.include_router(secure_crud.router, tags=["Secure CRUD"])
app.include_router(support_groups.router, tags=["Support Groups"])
app.include_router(contacts.router, tags=["Contacts & Lists"])
app.include_router(support_teams.router, tags=["Support Teams"])
app.include_router(support_routing.router, tags=["Support Routing"])
app.include_router(slas.router, tags=["Service Level Agreements"])
app.include_router(business_calendars.router, tags=["Business Calendars"])
app.include_router(ticket_categories.router, tags=["Categories"])
app.include_router(tags.router, tags=["Tags"])
app.include_router(ticket_sla.router, tags=["Sla tickets"])
app.include_router(ticket_taxonomies.router, tags=["Taxomony tickets"])
app.include_router(audit_events.router, tags=["Audit Events"])
app.include_router(contact_emails.router, tags=["Contact Emails"])
app.include_router(contact_lists.router, tags=["Contact Lists"])
app.include_router(list_members.router, tags=["List Members"])
app.include_router(contact_phone.router, tags=["Contact Phones"])
app.include_router(contact_socials.router, tags=["Contact Socials"])
app.include_router(quota.router, tags=["Quotas"])
app.include_router(ticket_templates.router, tags=["Ticket Templates"])
app.include_router(themes.router, tags=["Themes Survey"])
app.include_router(campaigns.router, tags=["Campaigns Survey"])
app.include_router(scheduler_routes.router, tags=["Campaigns Scheduler"])
app.include_router(audience_files.router)
app.include_router(salesforce_routes.router)
app.include_router(salesforce_campaign_routes.router)
app.include_router(salesforce_sync_routes.router)

