# app/services/redis_ticket_service.py
import json
from typing import Any, Dict, List, Optional
from datetime import datetime
from ..core.redis_client import redis_client


class RedisTicketService:
    """
    Cache layer for tickets. Keeps:
      - single ticket by id
      - simple org-level list (recent page you fetched)
      - counts (overall + per-status)
      - team-based and agent-based lists (single team/agent per ticket)
    """

    # TTLs (seconds)
    TICKET_TTL = 900          # 15 min for individual ticket
    LIST_TTL = 300            # 5 min for lists
    COUNT_TTL = 120           # 2 min for counts

    # Keys
    TICKET_KEY = "ticket:{ticket_id}"
    ORG_LIST_KEY = "tickets:org:{org_id}"                      # stores a list of ticket_ids
    COUNT_ORG_KEY = "tickets:count:org:{org_id}"               # total tickets in org
    COUNT_ORG_STATUS_KEY = "tickets:count:org:{org_id}:status:{status}"

    # Team-based keys (single team per ticket)
    TEAM_LIST_KEY = "tickets:org:{org_id}:team:{team_id}"
    COUNT_TEAM_KEY = "tickets:count:org:{org_id}:team:{team_id}"

    # Agent-based keys (single agent per ticket)
    AGENT_LIST_KEY = "tickets:org:{org_id}:agent:{agent_id}"
    COUNT_AGENT_KEY = "tickets:count:org:{org_id}:agent:{agent_id}"

    # Assignee-based keys (unchanged)
    ASSIGNEE_LIST_KEY = "tickets:org:{org_id}:assignee:{assignee_id}"
    COUNT_ASSIGNEE_KEY = "tickets:count:org:{org_id}:assignee:{assignee_id}"

    @classmethod
    def _ser(cls, obj: Any) -> str:
        """Serialize SQLAlchemy/Pydantic/Datetime safely to JSON string."""
        def default(o):
            if isinstance(o, datetime):
                return o.isoformat()
            if hasattr(o, "model_dump"):
                return o.model_dump()
            if hasattr(o, "__dict__"):
                # remove SQLAlchemy state if present
                d = {k: v for k, v in o.__dict__.items() if not k.startswith("_")}
                for k, v in list(d.items()):
                    if isinstance(v, datetime):
                        d[k] = v.isoformat()
                return d
            return o
        return json.dumps(obj, default=default)

    @classmethod
    def _deser(cls, s: bytes | str) -> Dict[str, Any]:
        if s is None:
            return {}
        if isinstance(s, bytes):
            s = s.decode("utf-8")
        return json.loads(s)

    # ---------------------------- single ticket ----------------------------

    @classmethod
    def cache_ticket(cls, ticket: Any) -> bool:
        try:
            if not redis_client.ping():
                return False
            tid = getattr(ticket, "ticket_id", None) or (isinstance(ticket, dict) and ticket.get("ticket_id"))
            if not tid:
                return False
            key = cls.TICKET_KEY.format(ticket_id=tid)
            redis_client.client.setex(key, cls.TICKET_TTL, cls._ser(ticket))
            return True
        except Exception:
            return False

    @classmethod
    def get_ticket(cls, ticket_id: str) -> Optional[Dict[str, Any]]:
        try:
            if not redis_client.ping():
                return None
            key = cls.TICKET_KEY.format(ticket_id=ticket_id)
            blob = redis_client.client.get(key)
            return cls._deser(blob) if blob else None
        except Exception:
            return None

    # ------------------------------ list cache -----------------------------

    @classmethod
    def cache_org_list(cls, org_id: str, tickets: List[Any]) -> bool:
        """Caches a simple org list by storing ticket_ids and each ticket blob."""
        try:
            if not redis_client.ping():
                return False
            ids: List[str] = []
            for t in tickets:
                cls.cache_ticket(t)
                tid = getattr(t, "ticket_id", None) or (isinstance(t, dict) and t.get("ticket_id"))
                if tid:
                    ids.append(tid)
            key = cls.ORG_LIST_KEY.format(org_id=org_id)
            redis_client.client.setex(key, cls.LIST_TTL, json.dumps(ids))
            return True
        except Exception:
            return False

    @classmethod
    def get_org_list(cls, org_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            if not redis_client.ping():
                return None
            key = cls.ORG_LIST_KEY.format(org_id=org_id)
            blob = redis_client.client.get(key)
            if not blob:
                return None
            ids: List[str] = json.loads(blob)
            out: List[Dict[str, Any]] = []
            for tid in ids:
                t = cls.get_ticket(tid)
                if t:
                    out.append(t)
            return out or None
        except Exception:
            return None

    # -------------------------- team-based lists ---------------------------

    @classmethod
    def cache_team_list(cls, org_id: str, team_id: str, tickets: List[Any]) -> bool:
        """Caches tickets for a specific team."""
        try:
            if not redis_client.ping():
                return False
            ids: List[str] = []
            for t in tickets:
                cls.cache_ticket(t)
                tid = getattr(t, "ticket_id", None) or (isinstance(t, dict) and t.get("ticket_id"))
                if tid:
                    ids.append(tid)
            key = cls.TEAM_LIST_KEY.format(org_id=org_id, team_id=team_id)
            redis_client.client.setex(key, cls.LIST_TTL, json.dumps(ids))
            return True
        except Exception:
            return False

    @classmethod
    def get_team_list(cls, org_id: str, team_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            if not redis_client.ping():
                return None
            key = cls.TEAM_LIST_KEY.format(org_id=org_id, team_id=team_id)
            blob = redis_client.client.get(key)
            if not blob:
                return None
            ids: List[str] = json.loads(blob)
            out: List[Dict[str, Any]] = []
            for tid in ids:
                t = cls.get_ticket(tid)
                if t:
                    out.append(t)
            return out or None
        except Exception:
            return None

    # -------------------------- agent-based lists --------------------------

    @classmethod
    def cache_agent_list(cls, org_id: str, agent_id: str, tickets: List[Any]) -> bool:
        """Caches tickets for a specific agent."""
        try:
            if not redis_client.ping():
                return False
            ids: List[str] = []
            for t in tickets:
                cls.cache_ticket(t)
                tid = getattr(t, "ticket_id", None) or (isinstance(t, dict) and t.get("ticket_id"))
                if tid:
                    ids.append(tid)
            key = cls.AGENT_LIST_KEY.format(org_id=org_id, agent_id=agent_id)
            redis_client.client.setex(key, cls.LIST_TTL, json.dumps(ids))
            return True
        except Exception:
            return False

    @classmethod
    def get_agent_list(cls, org_id: str, agent_id: str) -> Optional[List[Dict[str, Any]]]:
        try:
            if not redis_client.ping():
                return None
            key = cls.AGENT_LIST_KEY.format(org_id=org_id, agent_id=agent_id)
            blob = redis_client.client.get(key)
            if not blob:
                return None
            ids: List[str] = json.loads(blob)
            out: List[Dict[str, Any]] = []
            for tid in ids:
                t = cls.get_ticket(tid)
                if t:
                    out.append(t)
            return out or None
        except Exception:
            return None

    # ------------------------------- counts --------------------------------

    @classmethod
    def cache_count_org(cls, org_id: str, count: int) -> None:
        try:
            if not redis_client.ping():
                return
            key = cls.COUNT_ORG_KEY.format(org_id=org_id)
            redis_client.client.setex(key, cls.COUNT_TTL, json.dumps({"count": count}))
        except Exception:
            pass

    @classmethod
    def get_count_org(cls, org_id: str) -> Optional[int]:
        try:
            if not redis_client.ping():
                return None
            key = cls.COUNT_ORG_KEY.format(org_id=org_id)
            blob = redis_client.client.get(key)
            return (json.loads(blob).get("count") if blob else None)
        except Exception:
            return None

    @classmethod
    def cache_count_org_status(cls, org_id: str, status: str, count: int) -> None:
        try:
            if not redis_client.ping():
                return
            key = cls.COUNT_ORG_STATUS_KEY.format(org_id=org_id, status=status)
            redis_client.client.setex(key, cls.COUNT_TTL, json.dumps({"count": count}))
        except Exception:
            pass

    @classmethod
    def get_count_org_status(cls, org_id: str, status: str) -> Optional[int]:
        try:
            if not redis_client.ping():
                return None
            key = cls.COUNT_ORG_STATUS_KEY.format(org_id=org_id, status=status)
            blob = redis_client.client.get(key)
            return (json.loads(blob).get("count") if blob else None)
        except Exception:
            return None

    @classmethod
    def cache_count_team(cls, org_id: str, team_id: str, count: int) -> None:
        try:
            if not redis_client.ping():
                return
            key = cls.COUNT_TEAM_KEY.format(org_id=org_id, team_id=team_id)
            redis_client.client.setex(key, cls.COUNT_TTL, json.dumps({"count": count}))
        except Exception:
            pass

    @classmethod
    def get_count_team(cls, org_id: str, team_id: str) -> Optional[int]:
        try:
            if not redis_client.ping():
                return None
            key = cls.COUNT_TEAM_KEY.format(org_id=org_id, team_id=team_id)
            blob = redis_client.client.get(key)
            return (json.loads(blob).get("count") if blob else None)
        except Exception:
            return None

    @classmethod
    def cache_count_agent(cls, org_id: str, agent_id: str, count: int) -> None:
        try:
            if not redis_client.ping():
                return
            key = cls.COUNT_AGENT_KEY.format(org_id=org_id, agent_id=agent_id)
            redis_client.client.setex(key, cls.COUNT_TTL, json.dumps({"count": count}))
        except Exception:
            pass

    @classmethod
    def get_count_agent(cls, org_id: str, agent_id: str) -> Optional[int]:
        try:
            if not redis_client.ping():
                return None
            key = cls.COUNT_AGENT_KEY.format(org_id=org_id, agent_id=agent_id)
            blob = redis_client.client.get(key)
            return (json.loads(blob).get("count") if blob else None)
        except Exception:
            return None

    # ------------------------------ invalidation ---------------------------

    @classmethod
    def invalidate_ticket(cls, ticket_id: str) -> None:
        try:
            if not redis_client.ping():
                return
            redis_client.client.delete(cls.TICKET_KEY.format(ticket_id=ticket_id))
        except Exception:
            pass

    @classmethod
    def invalidate_org_lists_and_counts(cls, org_id: str) -> None:
        """Call after create/update/delete where org-level list or counts could change."""
        try:
            if not redis_client.ping():
                return
            pipe = redis_client.client.pipeline()
            pipe.delete(cls.ORG_LIST_KEY.format(org_id=org_id))
            pipe.delete(cls.COUNT_ORG_KEY.format(org_id=org_id))
            # nuke per-status counters (common statuses)
            for st in ["new", "open", "pending", "on_hold", "resolved", "closed", "canceled"]:
                pipe.delete(cls.COUNT_ORG_STATUS_KEY.format(org_id=org_id, status=st))
            pipe.execute()
        except Exception:
            pass

    @classmethod
    def invalidate_team_caches(cls, org_id: str, team_id: str) -> None:
        """Invalidate team-specific caches."""
        try:
            if not redis_client.ping():
                return
            pipe = redis_client.client.pipeline()
            pipe.delete(cls.TEAM_LIST_KEY.format(org_id=org_id, team_id=team_id))
            pipe.delete(cls.COUNT_TEAM_KEY.format(org_id=org_id, team_id=team_id))
            pipe.execute()
        except Exception:
            pass

    @classmethod
    def invalidate_agent_caches(cls, org_id: str, agent_id: str) -> None:
        """Invalidate agent-specific caches."""
        try:
            if not redis_client.ping():
                return
            pipe = redis_client.client.pipeline()
            pipe.delete(cls.AGENT_LIST_KEY.format(org_id=org_id, agent_id=agent_id))
            pipe.delete(cls.COUNT_AGENT_KEY.format(org_id=org_id, agent_id=agent_id))
            pipe.execute()
        except Exception:
            pass

    @classmethod
    def invalidate_all_assignment_caches(cls, org_id: str, team_id: Optional[str] = None, 
                                         agent_id: Optional[str] = None, 
                                         assignee_id: Optional[str] = None) -> None:
        """Invalidate all relevant assignment caches when a ticket is updated."""
        try:
            if not redis_client.ping():
                return
            pipe = redis_client.client.pipeline()
            
            if team_id:
                pipe.delete(cls.TEAM_LIST_KEY.format(org_id=org_id, team_id=team_id))
                pipe.delete(cls.COUNT_TEAM_KEY.format(org_id=org_id, team_id=team_id))
            
            if agent_id:
                pipe.delete(cls.AGENT_LIST_KEY.format(org_id=org_id, agent_id=agent_id))
                pipe.delete(cls.COUNT_AGENT_KEY.format(org_id=org_id, agent_id=agent_id))
            
            if assignee_id:
                pipe.delete(cls.ASSIGNEE_LIST_KEY.format(org_id=org_id, assignee_id=assignee_id))
                pipe.delete(cls.COUNT_ASSIGNEE_KEY.format(org_id=org_id, assignee_id=assignee_id))
            
            pipe.execute()
        except Exception:
            pass