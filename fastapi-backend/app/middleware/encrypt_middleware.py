# app/middleware/encrypt_get_middleware.py
import time, json, base64
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
import httpx
from app.utils.crypto_utils import encrypt_aes_gcm

KEYSERVER_URL = "http://key-server:8001/get-key"

class EncryptGetMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method != "GET":
            return await call_next(request)

        response = await call_next(request)
        if response.status_code != 200 or "application/json" not in response.headers.get("content-type", ""):
            return response

        try:
            body_bytes = b"".join([section async for section in response.body_iterator])
            data = json.loads(body_bytes.decode("utf-8"))

            # consistent key_id per request
            key_id = f"req_{int(time.time() * 1000)}"

            async with httpx.AsyncClient(timeout=5.0) as client:
                key_res = await client.get(f"{KEYSERVER_URL}/{key_id}")
                key_data = key_res.json()

            encrypted_key = key_data["encrypted_key"]
            aes_key_b64 = key_data["aes_key_b64"]
            aes_key = base64.b64decode(aes_key_b64)

            encrypted_payload = encrypt_aes_gcm(data, aes_key)

            result = {"key_id": key_id, "encrypted_key": encrypted_key, **encrypted_payload}
            return JSONResponse(result, media_type="application/json")

        except Exception as e:
            print("[EncryptGetMiddleware] Encryption failed:", e)
            return JSONResponse({"status": "error", "message": str(e)}, status_code=500)
