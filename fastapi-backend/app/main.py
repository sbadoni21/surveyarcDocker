import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.db import Base, engine
from app.middleware.decrypt_middleware import DecryptMiddleware
from app.middleware.encrypt_middleware import EncryptGetMiddleware
from app.models import init_models

# Import Redis client and utilities
from app.core.redis_client import redis_client
from app.utils.redis_utils import RedisHealthCheck, RedisProjectAnalytics, RedisKeyManager

# Import all models so SQLAlchemy knows about them
init_models()

# Create tables in the database
Base.metadata.create_all(bind=engine)

from app.routes import (
    secure_crud, user, project, survey, questions, responses, ticket, webhook, answer,
    archive, audit_log, domains, integration, invite, invoice,
    marketplace, metric, order, organisation, payment, pricing_plan
)

app = FastAPI(
    title="Survey & Ticket Management API",
    description="FastAPI application with Redis caching layer for improved performance",
    version="1.0.0"
)

# Configuration from environment variables
ENABLE_ENCRYPTION = os.getenv("ENABLE_ENCRYPTION", "true").lower() == "true"
ENCRYPTION_FALLBACK = os.getenv("ENCRYPTION_FALLBACK", "true").lower() == "true"
REDIS_HEALTH_CHECK_INTERVAL = int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30"))  # seconds

# Startup event to test connections
@app.on_event("startup")
async def startup_event():
    """Test database, Redis, and key server connections on startup"""
    print("🚀 Starting Survey & Ticket Management API with Redis Integration...")
    
    # Test Redis connection with detailed info
    try:
        redis_info = RedisHealthCheck.get_redis_info()
        if redis_info["status"] == "connected":
            print("✅ Redis connected successfully")
            print(f"   - Redis Version: {redis_info.get('redis_version', 'unknown')}")
            print(f"   - Connected Clients: {redis_info.get('connected_clients', 0)}")
            print(f"   - Memory Used: {redis_info.get('used_memory_human', 'unknown')}")
            print(f"   - Hit Ratio: {redis_info.get('hit_ratio', 0)}%")
        else:
            print("⚠️  Warning: Redis connection failed - caching will be disabled")
            print(f"   - Error: {redis_info.get('error', 'Unknown error')}")
    except Exception as e:
        print(f"⚠️  Warning: Redis connection error: {e}")
    
    # Get Redis cache statistics
    try:
        cache_stats = RedisHealthCheck.get_cache_statistics("project:*")
        if "error" not in cache_stats:
            print(f"📊 Redis Cache Statistics:")
            print(f"   - Project Keys: {cache_stats.get('total_keys', 0)}")
            print(f"   - Estimated Cache Size: {cache_stats.get('estimated_total_size_human', '0 KB')}")
    except Exception as e:
        print(f"⚠️  Warning: Could not get cache statistics: {e}")
    
    # Test key server connection if encryption is enabled
    if ENABLE_ENCRYPTION:
        try:
            import httpx
            timeout = httpx.Timeout(5.0, connect=3.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                test_key_id = "startup_test"
                # response = await client.get(f"http://key-server:8001/get-key/{test_key_id}")
                response = await client.get(f"http://localhost:8001/get-key/{test_key_id}")
                if response.status_code == 200:
                    print("✅ Key server connected successfully")
                else:
                    print(f"⚠️  Warning: Key server returned {response.status_code}")
                    if not ENCRYPTION_FALLBACK:
                        print("❌ Encryption fallback disabled - this may cause issues")
        except Exception as e:
            print(f"⚠️  Warning: Key server connection failed: {e}")
            if not ENCRYPTION_FALLBACK:
                print("❌ Encryption fallback disabled - API may fail")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    print("🛑 Survey API shutting down...")
    
    # Optional: Clean up Redis connections
    try:
        # You could add cleanup operations here if needed
        print("✅ Redis cleanup completed")
    except Exception as e:
        print(f"⚠️ Warning: Redis cleanup failed: {e}")

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
    return {
        "message": "Survey & Ticket Management API is running",
        "redis_enabled": RedisHealthCheck.is_redis_available(),
        "encryption_enabled": ENABLE_ENCRYPTION
    }

@app.get("/health")
def health_check():
    """Comprehensive health check endpoint"""
    redis_info = RedisHealthCheck.get_redis_info()
    
    return {
        "status": "healthy",
        "timestamp": redis_info.get("server_time"),
        "database": "connected",  # Assuming DB is working if app starts
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
        "api": "Survey & Ticket Management API",
        "version": "1.0.0"
    }

@app.get("/health/redis")
def redis_health_detailed():
    """Detailed Redis health check"""
    return RedisHealthCheck.get_redis_info()

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
app.include_router(project.router, tags=["Projects"])  # Updated with Redis integration
app.include_router(survey.router, tags=["Surveys"])
app.include_router(questions.router, tags=["Questions"])
app.include_router(responses.router, tags=["Responses"])
app.include_router(ticket.router, tags=["Tickets"])
app.include_router(webhook.router, tags=["Webhooks"])
app.include_router(secure_crud.router, tags=["Secure CRUD"])

# Add encryption middleware with configuration
app.add_middleware(
    EncryptGetMiddleware, 
    enable_encryption=ENABLE_ENCRYPTION, 
    fallback_on_error=ENCRYPTION_FALLBACK
)