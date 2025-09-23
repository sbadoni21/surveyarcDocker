from fastapi import Depends, HTTPException
from app.core.redis_client import redis_client, RedisClient

def get_redis_client() -> RedisClient:
    """
    Dependency to provide Redis client to route handlers
    Raises HTTPException if Redis is unavailable
    
    Usage in routes:
    @router.get("/example")
    def example_endpoint(redis: RedisClient = Depends(get_redis_client)):
        redis.cache_survey(survey_id, survey_data)
    """
    if not redis_client.ping():
        raise HTTPException(
            status_code=503, 
            detail="Redis service is unavailable"
        )
    return redis_client

def get_redis_optional() -> RedisClient:
    """
    Optional Redis dependency - returns None if Redis is unavailable
    Use this when Redis is optional for the endpoint functionality
    
    Usage in routes:
    @router.get("/example")
    def example_endpoint(redis: RedisClient = Depends(get_redis_optional)):
        if redis:
            # Use caching
            cached = redis.get_cached_survey(survey_id)
        else:
            # Fallback to database only
            pass
    """
    if redis_client.ping():
        return redis_client
    return None