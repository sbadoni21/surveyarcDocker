import json
from typing import Any, Dict, List, Optional
from datetime import datetime

from ..core.redis_client import redis_client

class RedisRuleService:
    RULE_TTL = 3600
    RULE_LIST_TTL = 600

    RULE_KEY = "rule:{survey_id}:{rule_id}"
    SURVEY_RULES_KEY = "rules:survey:{survey_id}"

    @classmethod
    def _ser(cls, obj: Any) -> str:
        def default(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, "__dict__"):
                d = {k: v for k, v in o.__dict__.items() if not k.startswith("_")}
                for k, v in d.items():
                    if isinstance(v, datetime):
                        d[k] = v.isoformat()
                return json.dumps(d, default=default)
            return json.dumps(o, default=default)
        if hasattr(obj, "model_dump"):
            return json.dumps(obj.model_dump(), default=default)
        return default(obj)

    @classmethod
    def _deser(cls, s: str) -> Dict[str, Any]:
        return json.loads(s)

    @classmethod
    def cache_rule(cls, survey_id: str, rule: Any) -> bool:
        try:
            if not redis_client.ping(): return False
            rid = getattr(rule, "rule_id", None) or rule.get("rule_id")
            key = cls.RULE_KEY.format(survey_id=survey_id, rule_id=rid)
            redis_client.client.setex(key, cls.RULE_TTL, cls._ser(rule))
            return True
        except Exception:
            return False

    @classmethod
    def get_rule(cls, survey_id: str, rule_id: str) -> Optional[Dict[str, Any]]:
        try:
            if not redis_client.ping(): return None
            key = cls.RULE_KEY.format(survey_id=survey_id, rule_id=rule_id)
            blob = redis_client.client.get(key)
            return cls._deser(blob) if blob else None
        except Exception:
            return None

    @classmethod
    def cache_rules_list(cls, survey_id: str, rules: List[Any]) -> bool:
        try:
            if not redis_client.ping(): return False
            # cache items
            for r in rules:
                cls.cache_rule(survey_id, r)
            # store id list
            ids = [
                getattr(r, "rule_id", None) or (isinstance(r, dict) and r.get("rule_id"))
                for r in rules
            ]
            key = cls.SURVEY_RULES_KEY.format(survey_id=survey_id)
            redis_client.client.setex(key, cls.RULE_LIST_TTL, json.dumps(ids))
            return True
        except Exception:
            return False

    @classmethod
    def get_rules_for_survey(cls, survey_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            if not redis_client.ping(): return None
            key = cls.SURVEY_RULES_KEY.format(survey_id=survey_id)
            ids_blob = redis_client.client.get(key)
            if not ids_blob: return None
            ids = json.loads(ids_blob)
            out = []
            for rid in ids:
                r = cls.get_rule(survey_id, rid)
                if r: out.append(r)
            return out or None
        except Exception:
            return None

    @classmethod
    def invalidate_rule(cls, survey_id: str, rule_id: str) -> None:
        try:
            if not redis_client.ping(): return
            key = cls.RULE_KEY.format(survey_id=survey_id, rule_id=rule_id)
            redis_client.client.delete(key)
        except Exception:
            pass

    @classmethod
    def remove_from_list(cls, survey_id: str, rule_id: str) -> None:
        try:
            if not redis_client.ping(): return
            key = cls.SURVEY_RULES_KEY.format(survey_id=survey_id)
            blob = redis_client.client.get(key)
            if not blob: return
            ids = json.loads(blob)
            ids = [i for i in ids if i != rule_id]
            if ids:
                redis_client.client.setex(key, cls.RULE_LIST_TTL, json.dumps(ids))
            else:
                redis_client.client.delete(key)
        except Exception:
            pass
