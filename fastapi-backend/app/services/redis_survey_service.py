# app/services/redis_survey_service.py
import json
from typing import Any, Dict, List, Optional
from datetime import datetime

from ..core.redis_client import redis_client

class RedisSurveyService:
    SURVEY_TTL = 3600           # 1 hour
    SURVEY_LIST_TTL = 1800      # 30 min
    RESPONSES_TTL = 600         # 10 min (counts)
    
    SURVEY_KEY = "survey:{survey_id}"
    PROJECT_SURVEYS_KEY = "surveys:project:{project_id}"
    RESPONSES_COUNT_KEY = "survey:{survey_id}:responses_count"
    RESPONSES_LIST_KEY = "survey:{survey_id}:responses"

    @classmethod
    def _serialize(cls, obj: Any) -> str:
      def default(o):
          if isinstance(o, datetime):
              return o.isoformat()
          raise TypeError(f"Not JSON serializable: {type(o)}")
      if hasattr(obj, "model_dump"):
          return json.dumps(obj.model_dump(), default=default)
      if hasattr(obj, "__dict__"):
          data = {k:v for k,v in obj.__dict__.items() if not k.startswith("_")}
          for k,v in data.items():
              if isinstance(v, datetime):
                  data[k] = v.isoformat()
          return json.dumps(data, default=default)
      return json.dumps(obj, default=default)

    @classmethod
    def _deserialize(cls, s: str) -> Dict[str, Any]:
      data = json.loads(s)
      for k in ("created_at", "updated_at"):
          if k in data and data[k]:
              try:
                  data[k] = datetime.fromisoformat(str(data[k]).replace("Z","+00:00"))
              except Exception:
                  pass
      return data

    @classmethod
    def cache_survey(cls, survey: Any) -> bool:
      try:
          if not redis_client.ping():
              return False
          sid = getattr(survey, "survey_id", None) or survey.get("survey_id")
          key = cls.SURVEY_KEY.format(survey_id=sid)
          redis_client.client.setex(key, cls.SURVEY_TTL, cls._serialize(survey))
          return True
      except Exception as e:
          print(f"[RedisSurveyService] cache_survey failed: {e}")
          return False

    @classmethod
    def get_survey(cls, survey_id: str) -> Optional[Dict[str, Any]]:
      try:
          if not redis_client.ping():
              return None
          key = cls.SURVEY_KEY.format(survey_id=survey_id)
          val = redis_client.client.get(key)
          return cls._deserialize(val) if val else None
      except Exception as e:
          print(f"[RedisSurveyService] get_survey failed: {e}")
          return None


    @classmethod
    def cache_project_surveys(cls, project_id: str, surveys: List[Any]) -> bool:
        """Cache a list of surveys for a project (MERGE with existing)."""
        try:
            if not redis_client.ping():
                return False

            # Cache individuals
            for s in surveys:
                cls.cache_survey(s)

            # Merge IDs
            incoming_ids = []
            for s in surveys:
                incoming_ids.append(getattr(s, 'survey_id', None) or s.get('survey_id'))

            current_ids = cls._get_project_ids(project_id)
            id_set = {sid for sid in current_ids if sid} | {sid for sid in incoming_ids if sid}
            cls._set_project_ids(project_id, sorted(id_set))  # sort optional

            return True
        except Exception as e:
            print(f"[RedisSurveyService] cache_project_surveys failed: {e}")
            return False
    @classmethod
    def remove_from_project_list(cls, project_id: str, survey_id: str) -> None:
        try:
            ids = cls._get_project_ids(project_id)
            if not ids:
                return
            new_ids = [sid for sid in ids if sid != survey_id]
            if new_ids:
                cls._set_project_ids(project_id, new_ids)
            else:
                # delete the list key entirely when empty
                if redis_client.ping():
                    list_key = cls.PROJECT_SURVEYS_KEY.format(project_id=project_id)
                    redis_client.client.delete(list_key)
        except Exception as e:
            print(f"[RedisSurveyService] remove_from_project_list failed: {e}")
    @classmethod
    def invalidate_survey(cls, survey_id: str) -> bool:
        try:
            if not redis_client.ping():
                return False
            key = cls.SURVEY_KEY.format(survey_id=survey_id)
            # remove survey object + counters
            redis_client.client.delete(key)
            redis_client.client.delete(cls.RESPONSES_COUNT_KEY.format(survey_id=survey_id))
            redis_client.client.delete(cls.RESPONSES_LIST_KEY.format(survey_id=survey_id))
            return True
        except Exception as e:
            print(f"[RedisSurveyService] invalidate_survey failed: {e}")
            return False



    @classmethod
    def get_project_surveys(cls, project_id: str) -> Optional[List[Dict[str, Any]]]:
      try:
          if not redis_client.ping():
              return None
          list_key = cls.PROJECT_SURVEYS_KEY.format(project_id=project_id)
          ids_blob = redis_client.client.get(list_key)
          if not ids_blob:
              return None
          ids = json.loads(ids_blob)
          out = []
          for sid in ids:
              s = cls.get_survey(sid)
              if s:
                  out.append(s)
          return out or None
      except Exception as e:
          print(f"[RedisSurveyService] get_project_surveys failed: {e}")
          return None

    # Responses (optional stubs; wire to real table if you have one)
    @classmethod
    def cache_responses_count(cls, survey_id: str, count: int) -> bool:
      try:
          if not redis_client.ping():
              return False
          key = cls.RESPONSES_COUNT_KEY.format(survey_id=survey_id)
          redis_client.client.setex(key, cls.RESPONSES_TTL, json.dumps({"count": count}))
          return True
      except Exception as e:
          print(f"[RedisSurveyService] cache_responses_count failed: {e}")
          return False

    @classmethod
    def get_responses_count(cls, survey_id: str) -> Optional[int]:
      try:
          if not redis_client.ping():
              return None
          key = cls.RESPONSES_COUNT_KEY.format(survey_id=survey_id)
          blob = redis_client.client.get(key)
          if not blob:
              return None
          return json.loads(blob).get("count", 0)
      except Exception as e:
          print(f"[RedisSurveyService] get_responses_count failed: {e}")
          return None

    @classmethod
    def cache_responses(cls, survey_id: str, responses: List[Dict[str, Any]]) -> bool:
      try:
          if not redis_client.ping():
              return False
          key = cls.RESPONSES_LIST_KEY.format(survey_id=survey_id)
          redis_client.client.setex(key, cls.RESPONSES_TTL, json.dumps(responses))
          return True
      except Exception as e:
          print(f"[RedisSurveyService] cache_responses failed: {e}")
          return False

    @classmethod
    def get_responses(cls, survey_id: str) -> Optional[List[Dict[str, Any]]]:
      try:
          if not redis_client.ping():
              return None
          key = cls.RESPONSES_LIST_KEY.format(survey_id=survey_id)
          blob = redis_client.client.get(key)
          return json.loads(blob) if blob else None
      except Exception as e:
          print(f"[RedisSurveyService] get_responses failed: {e}")
          return None
# app/services/redis_survey_service.py

    @classmethod
    def _get_project_ids(cls, project_id: str) -> list[str]:
        if not redis_client.ping():
            return []
        list_key = cls.PROJECT_SURVEYS_KEY.format(project_id=project_id)
        blob = redis_client.client.get(list_key)
        if not blob:
            return []
        try:
            return json.loads(blob)
        except Exception:
            return []

    @classmethod
    def _set_project_ids(cls, project_id: str, ids: list[str]) -> None:
        if not redis_client.ping():
            return
        list_key = cls.PROJECT_SURVEYS_KEY.format(project_id=project_id)
        redis_client.client.setex(list_key, cls.SURVEY_LIST_TTL, json.dumps(ids))
