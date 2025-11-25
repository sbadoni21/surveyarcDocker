import time
import json
import base64
import asyncio
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
import httpx
from app.utils.crypto_utils import encrypt_aes_gcm

# KEYSERVER_URL = "http://localhost:8001/get-key"
KEYSERVER_URL = "https://surveyarcdocker.onrender.com/get-key"

class EncryptGetMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, enable_encryption: bool = True, fallback_on_error: bool = True):
        super().__init__(app)
        self.enable_encryption = enable_encryption
        self.fallback_on_error = fallback_on_error

    async def dispatch(self, request: Request, call_next):
        request_path = request.url.path
        
        if request.method != "GET":
            return await call_next(request)

        response = await call_next(request)
        
        # Skip encryption for non-200 responses or non-JSON content
        if response.status_code != 200 or "application/json" not in response.headers.get("content-type", ""):
            return response

        # Skip encryption if disabled
        if not self.enable_encryption:
            return response

        try:
            
            # Read response body
            body_bytes = b"".join([section async for section in response.body_iterator])
            
            data = json.loads(body_bytes.decode("utf-8"))

            # Generate key_id
            timestamp = int(time.time() * 1000)
            key_id = f"req_{timestamp}"

            # Validate key_id is not None or empty
            if not key_id or key_id == "req_":
                raise ValueError(f"Invalid key_id generated: {key_id}")

            # Add timeout and retry logic
            max_retries = 2
            timeout = httpx.Timeout(10.0, connect=5.0)  # Increased timeouts
            key_server_url = f"{KEYSERVER_URL}/{key_id}"
            
            for attempt in range(max_retries):
                try:
                    
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        key_res = await client.get(key_server_url)
                        
                        
                        if key_res.status_code != 200:
                            raise httpx.HTTPStatusError(
                                f"Key server returned {key_res.status_code}", 
                                request=key_res.request, 
                                response=key_res
                            )
                        
                        key_data = key_res.json()
                    
                    break  # Success, exit retry loop
                    
                except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                    error_msg = f"[EncryptGetMiddleware] Attempt {attempt + 1} failed: {type(e).__name__}: {e}"
                    print(error_msg)
                    
                    if attempt == max_retries - 1:  # Last attempt
                        print(f"[EncryptGetMiddleware] All {max_retries} attempts failed, raising exception")
                        raise e
                    
                    await asyncio.sleep(0.5)  # Brief delay before retry

            
            # Validate key data
            if "encrypted_key" not in key_data or "aes_key_b64" not in key_data:
                raise ValueError(f"Invalid key data from server: {list(key_data.keys())}")
            
            encrypted_key = key_data["encrypted_key"]
            aes_key_b64 = key_data["aes_key_b64"]
            

            
            aes_key = base64.b64decode(aes_key_b64)

            encrypted_payload = encrypt_aes_gcm(data, aes_key)

            result = {
                "key_id": key_id, 
                "encrypted_key": encrypted_key, 
                **encrypted_payload
            }
            
            return JSONResponse(result, media_type="application/json")

        except Exception as e:
            error_msg = f"[EncryptGetMiddleware] Encryption failed: {type(e).__name__}: {e}"
            print(error_msg)
            
            # Print stack trace for debugging
            import traceback
            traceback.print_exc()
            
            # Return original response if fallback is enabled
            if self.fallback_on_error:
                print("[EncryptGetMiddleware] Falling back to unencrypted response")
                try:
                    return JSONResponse(data, media_type="application/json")
                except Exception as fallback_error:
                    print(f"[EncryptGetMiddleware] Fallback also failed: {fallback_error}")
                    return JSONResponse(
                        {"status": "error", "message": "Complete encryption failure"},
                        status_code=500
                    )
            else:
                # Return error response
                return JSONResponse(
                    {
                        "status": "error", 
                        "message": "Encryption service unavailable",
                        "details": str(e)
                    }, 
                    status_code=503
                )