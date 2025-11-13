# ============================================
# REDIS CACHE SERVICE - app/services/redis_campaign_service.py
# ============================================

import json
from typing import Any, List, Optional, Dict
from ..core.redis_client import redis_client

def _ser(obj: Any) -> str:
    return json.dumps(obj, default=str)

def _deser(blob: str) -> Any:
    return json.loads(blob)

class RedisCampaignService:
    # TTLs in seconds
    LIST_TTL = 300      # 5 minutes for lists
    ITEM_TTL = 600      # 10 minutes for individual items
    ANALYTICS_TTL = 60  # 1 minute for analytics (frequently updated)
    RESULT_TTL = 900    # 15 minutes for results
    
    # Cache key patterns
    CAMPAIGNS_BY_ORG_KEY = "campaigns:org:{org_id}"
    CAMPAIGNS_BY_SURVEY_KEY = "campaigns:survey:{survey_id}"
    CAMPAIGNS_BY_STATUS_KEY = "campaigns:org:{org_id}:status:{status}"
    CAMPAIGN_KEY = "campaign:{campaign_id}"
    CAMPAIGN_ANALYTICS_KEY = "campaign:{campaign_id}:analytics"
    
    RESULTS_BY_CAMPAIGN_KEY = "results:campaign:{campaign_id}"
    RESULTS_BY_CONTACT_KEY = "results:contact:{contact_id}"
    RESULTS_BY_STATUS_KEY = "results:campaign:{campaign_id}:status:{status}"
    RESULT_KEY = "result:{result_id}"
    RESULT_BY_TOKEN_KEY = "result:token:{tracking_token}"
    
    EVENTS_BY_CAMPAIGN_KEY = "events:campaign:{campaign_id}"
    EVENTS_BY_RESULT_KEY = "events:result:{result_id}"
    EVENT_KEY = "event:{event_id}"
    
    # Stats aggregation keys
    CAMPAIGN_CHANNEL_STATS_KEY = "stats:campaign:{campaign_id}:channel:{channel}"
    DAILY_STATS_KEY = "stats:org:{org_id}:date:{date}"

    @classmethod
    def _set(cls, key: str, obj: Any, ttl: int = None) -> None:
        try:
            if not redis_client.ping():
                return
            blob = _ser(obj)
            if ttl:
                redis_client.client.setex(key, ttl, blob)
            else:
                redis_client.client.set(key, blob)
        except Exception as e:
            print(f"Redis set error for key {key}: {e}")

    @classmethod
    def _get(cls, key: str) -> Optional[Any]:
        try:
            if not redis_client.ping():
                return None
            blob = redis_client.client.get(key)
            if not blob:
                return None
            if isinstance(blob, bytes):
                blob = blob.decode("utf-8")
            return _deser(blob)
        except Exception as e:
            print(f"Redis get error for key {key}: {e}")
            return None

    @classmethod
    def _delete(cls, *keys: str) -> None:
        try:
            if not redis_client.ping() or not keys:
                return
            redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Redis delete error for keys {keys}: {e}")

    @classmethod
    def _delete_pattern(cls, pattern: str) -> None:
        """Delete all keys matching a pattern"""
        try:
            if not redis_client.ping():
                return
            keys = redis_client.client.keys(pattern)
            if keys:
                redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Redis delete pattern error for {pattern}: {e}")

    # -------- Campaigns Cache --------
    @classmethod
    def cache_campaigns_by_org(cls, org_id: str, campaigns: List[Dict]) -> None:
        """Cache all campaigns for an organization"""
        cls._set(cls.CAMPAIGNS_BY_ORG_KEY.format(org_id=org_id), campaigns, cls.LIST_TTL)

    @classmethod
    def get_campaigns_by_org(cls, org_id: str) -> Optional[List[Dict]]:
        """Get cached campaigns for an organization"""
        return cls._get(cls.CAMPAIGNS_BY_ORG_KEY.format(org_id=org_id))

    @classmethod
    def cache_campaigns_by_survey(cls, survey_id: str, campaigns: List[Dict]) -> None:
        """Cache campaigns for a specific survey"""
        cls._set(cls.CAMPAIGNS_BY_SURVEY_KEY.format(survey_id=survey_id), campaigns, cls.LIST_TTL)

    @classmethod
    def get_campaigns_by_survey(cls, survey_id: str) -> Optional[List[Dict]]:
        """Get cached campaigns for a survey"""
        return cls._get(cls.CAMPAIGNS_BY_SURVEY_KEY.format(survey_id=survey_id))

    @classmethod
    def cache_campaigns_by_status(cls, org_id: str, status: str, campaigns: List[Dict]) -> None:
        """Cache campaigns filtered by status"""
        cls._set(cls.CAMPAIGNS_BY_STATUS_KEY.format(org_id=org_id, status=status), campaigns, cls.LIST_TTL)

    @classmethod
    def get_campaigns_by_status(cls, org_id: str, status: str) -> Optional[List[Dict]]:
        """Get cached campaigns by status"""
        return cls._get(cls.CAMPAIGNS_BY_STATUS_KEY.format(org_id=org_id, status=status))

    @classmethod
    def cache_campaign(cls, campaign_id: str, campaign_data: Dict) -> None:
        """Cache a single campaign"""
        cls._set(cls.CAMPAIGN_KEY.format(campaign_id=campaign_id), campaign_data, cls.ITEM_TTL)

    @classmethod
    def get_campaign(cls, campaign_id: str) -> Optional[Dict]:
        """Get cached campaign"""
        return cls._get(cls.CAMPAIGN_KEY.format(campaign_id=campaign_id))

    @classmethod
    def cache_campaign_analytics(cls, campaign_id: str, analytics: Dict) -> None:
        """Cache campaign analytics (shorter TTL as it updates frequently)"""
        cls._set(cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id), analytics, cls.ANALYTICS_TTL)

    @classmethod
    def get_campaign_analytics(cls, campaign_id: str) -> Optional[Dict]:
        """Get cached campaign analytics"""
        return cls._get(cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id))

    # -------- Campaign Results Cache --------
    @classmethod
    def cache_results_by_campaign(cls, campaign_id: str, results: List[Dict], page: int = 1) -> None:
        """Cache results for a campaign (with pagination)"""
        key = f"{cls.RESULTS_BY_CAMPAIGN_KEY.format(campaign_id=campaign_id)}:page:{page}"
        cls._set(key, results, cls.RESULT_TTL)

    @classmethod
    def get_results_by_campaign(cls, campaign_id: str, page: int = 1) -> Optional[List[Dict]]:
        """Get cached results for a campaign"""
        key = f"{cls.RESULTS_BY_CAMPAIGN_KEY.format(campaign_id=campaign_id)}:page:{page}"
        return cls._get(key)

    @classmethod
    def cache_results_by_contact(cls, contact_id: str, results: List[Dict]) -> None:
        """Cache all campaign results for a contact"""
        cls._set(cls.RESULTS_BY_CONTACT_KEY.format(contact_id=contact_id), results, cls.RESULT_TTL)

    @classmethod
    def get_results_by_contact(cls, contact_id: str) -> Optional[List[Dict]]:
        """Get cached results for a contact"""
        return cls._get(cls.RESULTS_BY_CONTACT_KEY.format(contact_id=contact_id))

    @classmethod
    def cache_results_by_status(cls, campaign_id: str, status: str, results: List[Dict]) -> None:
        """Cache results filtered by status"""
        cls._set(cls.RESULTS_BY_STATUS_KEY.format(campaign_id=campaign_id, status=status), results, cls.RESULT_TTL)

    @classmethod
    def get_results_by_status(cls, campaign_id: str, status: str) -> Optional[List[Dict]]:
        """Get cached results by status"""
        return cls._get(cls.RESULTS_BY_STATUS_KEY.format(campaign_id=campaign_id, status=status))

    @classmethod
    def cache_result(cls, result_id: str, result_data: Dict) -> None:
        """Cache a single campaign result"""
        cls._set(cls.RESULT_KEY.format(result_id=result_id), result_data, cls.RESULT_TTL)

    @classmethod
    def get_result(cls, result_id: str) -> Optional[Dict]:
        """Get cached result"""
        return cls._get(cls.RESULT_KEY.format(result_id=result_id))

    @classmethod
    def cache_result_by_token(cls, tracking_token: str, result_data: Dict) -> None:
        """Cache result by tracking token (for webhook lookups)"""
        cls._set(cls.RESULT_BY_TOKEN_KEY.format(tracking_token=tracking_token), result_data, cls.RESULT_TTL)

    @classmethod
    def get_result_by_token(cls, tracking_token: str) -> Optional[Dict]:
        """Get result by tracking token"""
        return cls._get(cls.RESULT_BY_TOKEN_KEY.format(tracking_token=tracking_token))

    # -------- Campaign Events Cache --------
    @classmethod
    def cache_events_by_campaign(cls, campaign_id: str, events: List[Dict], page: int = 1) -> None:
        """Cache events for a campaign"""
        key = f"{cls.EVENTS_BY_CAMPAIGN_KEY.format(campaign_id=campaign_id)}:page:{page}"
        cls._set(key, events, cls.LIST_TTL)

    @classmethod
    def get_events_by_campaign(cls, campaign_id: str, page: int = 1) -> Optional[List[Dict]]:
        """Get cached events for a campaign"""
        key = f"{cls.EVENTS_BY_CAMPAIGN_KEY.format(campaign_id=campaign_id)}:page:{page}"
        return cls._get(key)

    @classmethod
    def cache_events_by_result(cls, result_id: str, events: List[Dict]) -> None:
        """Cache events for a specific result"""
        cls._set(cls.EVENTS_BY_RESULT_KEY.format(result_id=result_id), events, cls.LIST_TTL)

    @classmethod
    def get_events_by_result(cls, result_id: str) -> Optional[List[Dict]]:
        """Get cached events for a result"""
        return cls._get(cls.EVENTS_BY_RESULT_KEY.format(result_id=result_id))

    @classmethod
    def cache_event(cls, event_id: str, event_data: Dict) -> None:
        """Cache a single event"""
        cls._set(cls.EVENT_KEY.format(event_id=event_id), event_data, cls.ITEM_TTL)

    @classmethod
    def get_event(cls, event_id: str) -> Optional[Dict]:
        """Get cached event"""
        return cls._get(cls.EVENT_KEY.format(event_id=event_id))

    # -------- Channel Statistics Cache --------
    @classmethod
    def cache_channel_stats(cls, campaign_id: str, channel: str, stats: Dict) -> None:
        """Cache per-channel statistics for a campaign"""
        cls._set(cls.CAMPAIGN_CHANNEL_STATS_KEY.format(campaign_id=campaign_id, channel=channel), 
                stats, cls.ANALYTICS_TTL)

    @classmethod
    def get_channel_stats(cls, campaign_id: str, channel: str) -> Optional[Dict]:
        """Get cached channel statistics"""
        return cls._get(cls.CAMPAIGN_CHANNEL_STATS_KEY.format(campaign_id=campaign_id, channel=channel))

    @classmethod
    def cache_daily_stats(cls, org_id: str, date: str, stats: Dict) -> None:
        """Cache daily aggregated stats for an organization"""
        cls._set(cls.DAILY_STATS_KEY.format(org_id=org_id, date=date), stats, cls.LIST_TTL)

    @classmethod
    def get_daily_stats(cls, org_id: str, date: str) -> Optional[Dict]:
        """Get cached daily stats"""
        return cls._get(cls.DAILY_STATS_KEY.format(org_id=org_id, date=date))

    # -------- Cache Invalidation --------
    @classmethod
    def invalidate_campaign_caches(cls, campaign_id: str, org_id: str, survey_id: str = None) -> None:
        """Invalidate all caches related to a campaign"""
        keys_to_delete = [
            cls.CAMPAIGN_KEY.format(campaign_id=campaign_id),
            cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id),
            cls.CAMPAIGNS_BY_ORG_KEY.format(org_id=org_id),
        ]
        
        if survey_id:
            keys_to_delete.append(cls.CAMPAIGNS_BY_SURVEY_KEY.format(survey_id=survey_id))
        
        cls._delete(*keys_to_delete)
        
        # Delete status-based caches
        cls._delete_pattern(f"campaigns:org:{org_id}:status:*")
        
        # Delete channel stats
        cls._delete_pattern(f"stats:campaign:{campaign_id}:channel:*")

    @classmethod
    def invalidate_result_caches(cls, result_id: str, campaign_id: str, contact_id: str, 
                                 tracking_token: str = None) -> None:
        """Invalidate all caches related to a campaign result"""
        keys_to_delete = [
            cls.RESULT_KEY.format(result_id=result_id),
            cls.RESULTS_BY_CONTACT_KEY.format(contact_id=contact_id),
            cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id),
        ]
        
        if tracking_token:
            keys_to_delete.append(cls.RESULT_BY_TOKEN_KEY.format(tracking_token=tracking_token))
        
        cls._delete(*keys_to_delete)
        
        # Delete paginated results
        cls._delete_pattern(f"results:campaign:{campaign_id}:page:*")
        cls._delete_pattern(f"results:campaign:{campaign_id}:status:*")

    @classmethod
    def invalidate_event_caches(cls, event_id: str, campaign_id: str, result_id: str) -> None:
        """Invalidate all caches related to a campaign event"""
        keys_to_delete = [
            cls.EVENT_KEY.format(event_id=event_id),
            cls.EVENTS_BY_RESULT_KEY.format(result_id=result_id),
            cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id),
        ]
        
        cls._delete(*keys_to_delete)
        
        # Delete paginated events
        cls._delete_pattern(f"events:campaign:{campaign_id}:page:*")

    @classmethod
    def invalidate_analytics_caches(cls, campaign_id: str, org_id: str) -> None:
        """Invalidate all analytics caches for a campaign"""
        cls._delete(cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id))
        cls._delete_pattern(f"stats:campaign:{campaign_id}:channel:*")
        
        # Invalidate daily stats for today
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        cls._delete(cls.DAILY_STATS_KEY.format(org_id=org_id, date=today))

    @classmethod
    def invalidate_all_campaign_caches(cls, org_id: str) -> None:
        """Invalidate all campaign-related caches for an organization"""
        try:
            if not redis_client.ping():
                return
            
            patterns = [
                f"campaigns:org:{org_id}*",
                f"stats:org:{org_id}*",
                f"results:*",  # This is broad but ensures consistency
                f"events:*",
            ]
            
            for pattern in patterns:
                keys = redis_client.client.keys(pattern)
                if keys:
                    redis_client.client.delete(*keys)
        except Exception as e:
            print(f"Error invalidating all campaign caches for org {org_id}: {e}")

    # -------- Bulk Operations --------
    @classmethod
    def increment_campaign_counter(cls, campaign_id: str, counter_name: str, 
                                   increment_by: int = 1) -> None:
        """
        Increment a campaign counter in Redis (for real-time stats updates)
        Counter names: sent_count, delivered_count, opened_count, clicked_count, etc.
        """
        try:
            if not redis_client.ping():
                return
            
            counter_key = f"counter:campaign:{campaign_id}:{counter_name}"
            redis_client.client.incrby(counter_key, increment_by)
            redis_client.client.expire(counter_key, cls.ANALYTICS_TTL)
            
            # Invalidate analytics cache
            cls._delete(cls.CAMPAIGN_ANALYTICS_KEY.format(campaign_id=campaign_id))
        except Exception as e:
            print(f"Error incrementing campaign counter {counter_name}: {e}")

    @classmethod
    def get_campaign_counter(cls, campaign_id: str, counter_name: str) -> Optional[int]:
        """Get a campaign counter value from Redis"""
        try:
            if not redis_client.ping():
                return None
            
            counter_key = f"counter:campaign:{campaign_id}:{counter_name}"
            value = redis_client.client.get(counter_key)
            
            if value is None:
                return None
            
            return int(value)
        except Exception as e:
            print(f"Error getting campaign counter {counter_name}: {e}")
            return None

    @classmethod
    def cache_tracking_token_to_result(cls, tracking_token: str, result_id: str) -> None:
        """
        Quick lookup cache for tracking tokens to result IDs
        Used for webhook processing
        """
        try:
            if not redis_client.ping():
                return
            
            key = f"token_lookup:{tracking_token}"
            redis_client.client.setex(key, cls.RESULT_TTL, result_id)
        except Exception as e:
            print(f"Error caching token lookup: {e}")

    @classmethod
    def get_result_id_by_token(cls, tracking_token: str) -> Optional[str]:
        """Get result ID from tracking token"""
        try:
            if not redis_client.ping():
                return None
            
            key = f"token_lookup:{tracking_token}"
            result = redis_client.client.get(key)
            
            if result is None:
                return None
            
            if isinstance(result, bytes):
                return result.decode("utf-8")
            
            return result
        except Exception as e:
            print(f"Error getting result ID by token: {e}")
            return None