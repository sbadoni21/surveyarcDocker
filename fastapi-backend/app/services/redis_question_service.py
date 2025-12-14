import json
from typing import Any, Dict, List, Optional
from datetime import datetime
from ..core.redis_client import redis_client


class RedisQuestionService:
    # ============================================================
    # CONFIG
    # ============================================================

    QUESTION_TTL = 3600        # 1 hour
    QUESTIONS_LIST_TTL = 1800  # 30 minutes

    QUESTION_KEY = "question:{survey_id}:{question_id}"
    QUESTIONS_BY_SURVEY_KEY = "questions:survey:{survey_id}"

    # ============================================================
    # INTERNAL HELPERS
    # ============================================================

    @classmethod
    def _serialize(cls, obj: Any) -> str:
        def default(o):
            if isinstance(o, datetime):
                return o.isoformat()
            raise TypeError(f"Not JSON serializable: {type(o)}")

        if hasattr(obj, "model_dump"):
            return json.dumps(obj.model_dump(), default=default)

        if hasattr(obj, "__dict__"):
            data = {
                k: (v.isoformat() if isinstance(v, datetime) else v)
                for k, v in obj.__dict__.items()
                if not k.startswith("_")
            }
            return json.dumps(data, default=default)

        return json.dumps(obj, default=default)

    @classmethod
    def _deserialize(cls, blob: bytes | str) -> Dict[str, Any]:
        if isinstance(blob, (bytes, bytearray)):
            blob = blob.decode("utf-8", errors="ignore")

        data = json.loads(blob)

        for k in ("created_at", "updated_at"):
            if data.get(k):
                try:
                    data[k] = datetime.fromisoformat(
                        str(data[k]).replace("Z", "+00:00")
                    )
                except Exception:
                    pass

        return data

    @classmethod
    def _list_key(cls, survey_id: str) -> str:
        return cls.QUESTIONS_BY_SURVEY_KEY.format(survey_id=survey_id)

    @classmethod
    def _ping(cls) -> bool:
        try:
            return redis_client.ping()
        except Exception:
            return False

    # ============================================================
    # SINGLE QUESTION CACHE
    # ============================================================

    @classmethod
    def cache_question(cls, survey_id: str, question: Any) -> bool:
        try:
            if not cls._ping():
                return False

            qid = getattr(question, "question_id", None) or question.get("question_id")
            if not qid:
                return False

            key = cls.QUESTION_KEY.format(
                survey_id=survey_id,
                question_id=qid,
            )

            redis_client.client.setex(
                key,
                cls.QUESTION_TTL,
                cls._serialize(question),
            )
            return True
        except Exception as e:
            print(f"[RedisQuestionService] cache_question failed: {e}")
            return False

    @classmethod
    def get_question(cls, survey_id: str, question_id: str) -> Optional[Dict[str, Any]]:
        try:
            if not cls._ping():
                return None

            key = cls.QUESTION_KEY.format(
                survey_id=survey_id,
                question_id=question_id,
            )

            blob = redis_client.client.get(key)
            return cls._deserialize(blob) if blob else None
        except Exception as e:
            print(f"[RedisQuestionService] get_question failed: {e}")
            return None

    @classmethod
    def invalidate_question(cls, survey_id: str, question_id: str) -> None:
        try:
            if not cls._ping():
                return

            key = cls.QUESTION_KEY.format(
                survey_id=survey_id,
                question_id=question_id,
            )
            redis_client.client.delete(key)
        except Exception as e:
            print(f"[RedisQuestionService] invalidate_question failed: {e}")

    # ============================================================
    # SURVEY QUESTION LIST CACHE
    # ============================================================

    @classmethod
    def _get_ids(cls, survey_id: str) -> List[str]:
        if not cls._ping():
            return []

        blob = redis_client.client.get(cls._list_key(survey_id))
        if not blob:
            return []

        try:
            if isinstance(blob, (bytes, bytearray)):
                blob = blob.decode("utf-8", errors="ignore")
            return json.loads(blob) or []
        except Exception:
            return []

    @classmethod
    def _set_ids(cls, survey_id: str, ids: List[str]) -> None:
        if not cls._ping():
            return

        redis_client.client.setex(
            cls._list_key(survey_id),
            cls.QUESTIONS_LIST_TTL,
            json.dumps(ids),
        )

    @classmethod
    def cache_questions_list(cls, survey_id: str, questions: List[Any]) -> bool:
        """
        Merge-safe list cache.
        """
        try:
            if not cls._ping():
                return False

            incoming_ids: List[str] = []

            for q in questions:
                cls.cache_question(survey_id, q)
                qid = getattr(q, "question_id", None) or q.get("question_id")
                if qid:
                    incoming_ids.append(qid)

            current_ids = set(cls._get_ids(survey_id))
            merged_ids = sorted(current_ids.union(incoming_ids))

            cls._set_ids(survey_id, merged_ids)
            return True
        except Exception as e:
            print(f"[RedisQuestionService] cache_questions_list failed: {e}")
            return False

    @classmethod
    def remove_from_list(cls, survey_id: str, question_id: Optional[str] = None) -> None:
        """
        Safe removal:
        - If question_id provided → remove only that
        - If None → remove entire survey list
        """
        try:
            if not cls._ping():
                return

            if not question_id:
                redis_client.client.delete(cls._list_key(survey_id))
                return

            ids = cls._get_ids(survey_id)
            if not ids:
                return

            filtered = [i for i in ids if i != question_id]

            if filtered:
                cls._set_ids(survey_id, filtered)
            else:
                redis_client.client.delete(cls._list_key(survey_id))
        except Exception as e:
            print(f"[RedisQuestionService] remove_from_list failed: {e}")

    # ============================================================
    # READ FULL SURVEY QUESTIONS
    # ============================================================

    @classmethod
    def get_questions_for_survey(
        cls, survey_id: str
    ) -> Optional[List[Dict[str, Any]]]:
        try:
            if not cls._ping():
                return None

            ids = cls._get_ids(survey_id)
            if not ids:
                return None

            result: List[Dict[str, Any]] = []

            for qid in ids:
                q = cls.get_question(survey_id, qid)
                if q:
                    result.append(q)

            return result or None
        except Exception as e:
            print(f"[RedisQuestionService] get_questions_for_survey failed: {e}")
            return None
