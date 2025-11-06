# app/core/redis_client.py
import os
import redis
import json
from typing import Any, Optional
from datetime import datetime, timedelta


class RedisClient:
    """Enhanced Redis client with project-specific functionality"""
    
    def __init__(self):
        """Initialize Redis client with configuration from environment"""
        self.host = os.getenv("REDIS_HOST", "redis-17179.c89.us-east-1-3.ec2.redns.redis-cloud.com")
        self.port = int(os.getenv("REDIS_PORT", "17179"))
        self.password = os.getenv("REDIS_PASSWORD", "t2N5re4xZn773qSiI1kTlyGwwyv1eWtT")
        self.db = int(os.getenv("REDIS_DB", "0"))
        self.socket_timeout = float(os.getenv("REDIS_SOCKET_TIMEOUT", "5.0"))
        self.socket_connect_timeout = float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5.0"))
        
        # Cvonnection pool settings
        self.max_connections = int(os.getenv("REDIS_MAX_CONNECTIONS", "50"))
        self.retry_on_timeout = os.getenv("REDIS_RETRY_ON_TIMEOUT", "true").lower() == "true"
        
        self._client = None
        self._connection_pool = None
        self._initialize_client()
    # ---- Session helpers ----
    def cache_user_session(self, uid: str, session: dict, ex: int = 7200) -> bool:
        """Cache a user session as JSON"""
        try:
            if not self.ping():
                return False
            from .redis_client import serialize_for_redis  # avoid circular if top-level imported
            return self.set(f"user_session:{uid}", serialize_for_redis(session), ex=ex)
        except Exception as e:
            print(f"[RedisClient] cache_user_session failed: {e}")
            return False

    def get_user_session(self, uid: str):
        """Get cached user session"""
        try:
            if not self.ping():
                return None
            blob = self.get(f"user_session:{uid}")
            if not blob:
                return None
            if isinstance(blob, bytes):
                blob = blob.decode("utf-8")
            from .redis_client import deserialize_from_redis
            return deserialize_from_redis(blob)
        except Exception as e:
            print(f"[RedisClient] get_user_session failed: {e}")
            return None

    def invalidate_user_session(self, uid: str) -> int:
        """Delete cached user session"""
        try:
            if not self.ping():
                return 0
            return self.delete(f"user_session:{uid}")
        except Exception as e:
            print(f"[RedisClient] invalidate_user_session failed: {e}")
            return 0

    def clear_pattern(self, pattern: str) -> int:
        """Delete keys by pattern (use carefully)"""
        try:
            if not self.ping():
                return 0
            keys = self.client.keys(pattern)
            return self.delete(*keys) if keys else 0
        except Exception as e:
            print(f"[RedisClient] clear_pattern failed: {e}")
            return 0

    def _initialize_client(self):
        """Initialize Redis client with connection pool"""
        try:
            # Create connection pool
            self._connection_pool = redis.ConnectionPool(
                host=self.host,
                port=self.port,
                password=self.password,
                db=self.db,
                socket_timeout=self.socket_timeout,
                socket_connect_timeout=self.socket_connect_timeout,
                max_connections=self.max_connections,
                retry_on_timeout=self.retry_on_timeout,
                decode_responses=False  # Keep as bytes for flexibility
            )
            
            # Create Redis client
            self._client = redis.Redis(
                connection_pool=self._connection_pool,
                socket_keepalive=True,
                socket_keepalive_options={}
            )
            
            # Test connection
            self._client.ping()
            print(f"✅ Redis client initialized successfully")
            print(f"   - Host: {self.host}:{self.port}")
            print(f"   - Database: {self.db}")
            print(f"   - Max Connections: {self.max_connections}")
            
        except Exception as e:
            print(f"❌ Failed to initialize Redis client: {e}")
            self._client = None
    
    @property
    def client(self) -> redis.Redis:
        """Get Redis client instance"""
        if self._client is None:
            self._initialize_client()
        return self._client
    
    def ping(self) -> bool:
        """Test Redis connection"""
        try:
            if self._client is None:
                return False
            return self._client.ping()
        except Exception as e:
            print(f"[RedisClient] Ping failed: {e}")
            return False
    def get(self, key: str, default: Any = None) -> Any:
        return self.safe_get(key, default)

    def set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        return self.safe_set(key, value, ex)

    def delete(self, *keys: str) -> int:
        return self.safe_delete(*keys)
    
    def reconnect(self) -> bool:
        """Attempt to reconnect to Redis"""
        print("[RedisClient] Attempting to reconnect...")
        try:
            if self._connection_pool:
                self._connection_pool.disconnect()
            self._initialize_client()
            return self.ping()
        except Exception as e:
            print(f"[RedisClient] Reconnection failed: {e}")
            return False
    
    # Enhanced methods for project caching
    
    def safe_get(self, key: str, default: Any = None) -> Any:
        """Safely get a key with error handling"""
        try:
            if not self.ping():
                return default
            
            result = self._client.get(key)
            return result if result is not None else default
            
        except Exception as e:
            print(f"[RedisClient] Safe get failed for key {key}: {e}")
            return default
    
    def safe_set(self, key: str, value: Any, ex: Optional[int] = None) -> bool:
        """Safely set a key with error handling"""
        try:
            if not self.ping():
                return False
            
            if ex:
                return bool(self._client.setex(key, ex, value))
            else:
                return bool(self._client.set(key, value))
                
        except Exception as e:
            print(f"[RedisClient] Safe set failed for key {key}: {e}")
            return False
    
    def safe_delete(self, *keys: str) -> int:
        """Safely delete keys with error handling"""
        try:
            if not self.ping() or not keys:
                return 0
            
            return self._client.delete(*keys)
            
        except Exception as e:
            print(f"[RedisClient] Safe delete failed for keys {keys}: {e}")
            return 0
    
    def safe_exists(self, key: str) -> bool:
        """Safely check if key exists"""
        try:
            if not self.ping():
                return False
            
            return bool(self._client.exists(key))
            
        except Exception as e:
            print(f"[RedisClient] Safe exists check failed for key {key}: {e}")
            return False
    
    def safe_ttl(self, key: str) -> int:
        """Safely get TTL of a key"""
        try:
            if not self.ping():
                return -2  # Key doesn't exist
            
            return self._client.ttl(key)
            
        except Exception as e:
            print(f"[RedisClient] Safe TTL check failed for key {key}: {e}")
            return -2
    
    def safe_expire(self, key: str, time: int) -> bool:
        """Safely set expiration for a key"""
        try:
            if not self.ping():
                return False
            
            return bool(self._client.expire(key, time))
            
        except Exception as e:
            print(f"[RedisClient] Safe expire failed for key {key}: {e}")
            return False
    
    def get_memory_info(self) -> dict:
        """Get Redis memory information"""
        try:
            if not self.ping():
                return {"error": "Redis not available"}
            
            info = self._client.info("memory")
            return {
                "used_memory": info.get("used_memory", 0),
                "used_memory_human": info.get("used_memory_human", "0B"),
                "used_memory_rss": info.get("used_memory_rss", 0),
                "used_memory_peak": info.get("used_memory_peak", 0),
                "used_memory_peak_human": info.get("used_memory_peak_human", "0B"),
                "maxmemory": info.get("maxmemory", 0),
                "maxmemory_human": info.get("maxmemory_human", "0B"),
                "mem_fragmentation_ratio": info.get("mem_fragmentation_ratio", 1.0),
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def flush_pattern(self, pattern: str = "project:*") -> int:
        """Flush all keys matching a pattern"""
        try:
            if not self.ping():
                return 0
            
            keys = self._client.keys(pattern)
            if keys:
                return self._client.delete(*keys)
            return 0
            
        except Exception as e:
            print(f"[RedisClient] Flush pattern failed for {pattern}: {e}")
            return 0
    
    def get_connection_info(self) -> dict:
        """Get Redis connection information"""
        try:
            if not self.ping():
                return {"status": "disconnected"}
            
            info = self._client.info("clients")
            return {
                "status": "connected",
                "connected_clients": info.get("connected_clients", 0),
                "client_recent_max_input_buffer": info.get("client_recent_max_input_buffer", 0),
                "client_recent_max_output_buffer": info.get("client_recent_max_output_buffer", 0),
                "blocked_clients": info.get("blocked_clients", 0),
                "host": self.host,
                "port": self.port,
                "db": self.db
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}


# Create global Redis client instance
redis_client = RedisClient()


# Utility functions for common Redis operations
def serialize_for_redis(data: Any) -> str:
    """Serialize data for Redis storage"""
    def json_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
    
    return json.dumps(data, default=json_serializer)


def deserialize_from_redis(data: str) -> Any:
    """Deserialize data from Redis"""
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError) as e:
        print(f"[RedisClient] Deserialization failed: {e}")
        return None


# Context manager for Redis operations
class RedisTransaction:
    """Context manager for Redis pipeline operations"""
    
    def __init__(self, client: RedisClient):
        self.client = client
        self.pipeline = None
    
    def __enter__(self):
        if self.client.ping():
            self.pipeline = self.client.client.pipeline()
            return self.pipeline
        return None
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.pipeline and exc_type is None:
            try:
                return self.pipeline.execute()
            except Exception as e:
                print(f"[RedisTransaction] Pipeline execution failed: {e}")
                return None
        return None


# Example usage functions for testing
def test_redis_connection():
    """Test Redis connection and basic operations"""
    print("\n🧪 Testing Redis Connection...")
    
    # Test ping
    if redis_client.ping():
        print("✅ Redis ping successful")
    else:
        print("❌ Redis ping failed")
        return False
    
    # Test basic operations
    test_key = "test:connection"
    test_value = {"message": "Hello Redis!", "timestamp": datetime.now().isoformat()}
    
    # Set
    if redis_client.safe_set(test_key, serialize_for_redis(test_value), ex=60):
        print("✅ Redis set successful")
    else:
        print("❌ Redis set failed")
        return False
    
    # Get
    result = redis_client.safe_get(test_key)
    if result:
        data = deserialize_from_redis(result.decode() if isinstance(result, bytes) else result)
        if data and data.get("message") == "Hello Redis!":
            print("✅ Redis get successful")
        else:
            print("❌ Redis get data mismatch")
            return False
    else:
        print("❌ Redis get failed")
        return False
    
    # Clean up
    redis_client.safe_delete(test_key)
    print("✅ Redis test completed successfully")
    return True


if __name__ == "__main__":
    # Test the Redis client when run directly
    test_redis_connection()