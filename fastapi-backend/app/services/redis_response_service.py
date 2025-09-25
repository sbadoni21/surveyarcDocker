import json
from typing import Any, Dict, List, Optional
from datetime import datetime
from ..core.redis_client import redis_client

class RedisResponseService:
    RESP_TTL = 900
    RESP_LIST_TTL = 300
    COUNT_TTL = 120

    RESP_KEY = "response:{response_id}"
    SURVEY_LIST_KEY = "responses:survey:{survey_id}"
    COUNT_KEY = "responses:count:{survey_id}"

    @classmethod
    def _ser(cls, obj: Any) -> str:
        def default(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, "__dict__"):
                d = {k: v for k, v in o.__dict__.items() if not k.startswith("_")}
                for k, v in d.items():
                    if isinstance(v, datetime): d[k] = v.isoformat()
                return json.dumps(d, default=default)
            return json.dumps(o, default=default)
        if hasattr(obj, "model_dump"):
            return json.dumps(obj.model_dump(), default=default)
        return default(obj)

    @classmethod
    def _deser(cls, s: str) -> Dict[str, Any]:
        return json.loads(s)

    @classmethod
    def cache_response(cls, resp: Any) -> bool:
        try:
            if not redis_client.ping(): return False
            rid = getattr(resp, "response_id", None) or resp.get("response_id")
            key = cls.RESP_KEY.format(response_id=rid)
            redis_client.client.setex(key, cls.RESP_TTL, cls._ser(resp))
            return True
        except Exception:
            return False

    @classmethod
    def get_response(cls, response_id: str) -> Optional[Dict[str, Any]]:
        try:
            if not redis_client.ping(): return None
            key = cls.RESP_KEY.format(response_id=response_id)
            blob = redis_client.client.get(key)
            return cls._deser(blob) if blob else None
        except Exception:
            return None

    @classmethod
    def cache_list(cls, survey_id: str, responses: List[Any]) -> bool:
        try:
            if not redis_client.ping(): return False
            for r in responses: cls.cache_response(r)
            ids = [getattr(r, "response_id", None) or (isinstance(r, dict) and r.get("response_id")) for r in responses]
            key = cls.SURVEY_LIST_KEY.format(survey_id=survey_id)
            redis_client.client.setex(key, cls.RESP_LIST_TTL, json.dumps(ids))
            return True
        except Exception:
            return False

    @classmethod
    def get_list(cls, survey_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            if not redis_client.ping(): return None
            key = cls.SURVEY_LIST_KEY.format(survey_id=survey_id)
            blob = redis_client.client.get(key)
            if not blob: return None
            ids = json.loads(blob)
            out = []
            for rid in ids:
                r = cls.get_response(rid)
                if r: out.append(r)
            return out or None
        except Exception:
            return None

    @classmethod
    def cache_count(cls, survey_id: str, count: int) -> None:
        try:
            if not redis_client.ping(): return
            key = cls.COUNT_KEY.format(survey_id=survey_id)
            redis_client.client.setex(key, cls.COUNT_TTL, json.dumps({"count": count}))
        except Exception:
            pass

    @classmethod
    def get_count(cls, survey_id: str) -> Optional[int]:
        try:
            if not redis_client.ping(): return None
            key = cls.COUNT_KEY.format(survey_id=survey_id)
            blob = redis_client.client.get(key)
            return (json.loads(blob).get("count") if blob else None)
        except Exception:
            return None

    @classmethod
    def invalidate(cls, response_id: str, survey_id: Optional[str] = None) -> None:
        try:
            if not redis_client.ping(): return
            redis_client.client.delete(cls.RESP_KEY.format(response_id=response_id))
            if survey_id:
                redis_client.client.delete(cls.SURVEY_LIST_KEY.format(survey_id=survey_id))
                redis_client.client.delete(cls.COUNT_KEY.format(survey_id=survey_id))
        except Exception:
            pass
