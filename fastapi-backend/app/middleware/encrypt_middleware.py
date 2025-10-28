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
        print(f"[EncryptGetMiddleware] Initialized - encryption: {enable_encryption}, fallback: {fallback_on_error}")

    async def dispatch(self, request: Request, call_next):
        request_path = request.url.path
        print(f"[EncryptGetMiddleware] Processing request: {request.method} {request_path}")
        
        if request.method != "GET":
            print(f"[EncryptGetMiddleware] Skipping non-GET request: {request.method}")
            return await call_next(request)

        response = await call_next(request)
        print(f"[EncryptGetMiddleware] Response status: {response.status_code}, content-type: {response.headers.get('content-type', 'none')}")
        
        # Skip encryption for non-200 responses or non-JSON content
        if response.status_code != 200 or "application/json" not in response.headers.get("content-type", ""):
            print(f"[EncryptGetMiddleware] Skipping encryption - status: {response.status_code}, content-type: {response.headers.get('content-type', 'none')}")
            return response

        # Skip encryption if disabled
        if not self.enable_encryption:
            print("[EncryptGetMiddleware] Encryption disabled, returning original response")
            return response

        try:
            print("[EncryptGetMiddleware] Starting encryption process...")
            
            # Read response body
            body_bytes = b"".join([section async for section in response.body_iterator])
            print(f"[EncryptGetMiddleware] Response body length: {len(body_bytes)} bytes")
            
            data = json.loads(body_bytes.decode("utf-8"))
            print(f"[EncryptGetMiddleware] Parsed JSON data keys: {list(data.keys()) if isinstance(data, dict) else 'not a dict'}")

            # Generate key_id
            timestamp = int(time.time() * 1000)
            key_id = f"req_{timestamp}"
            print(f"[EncryptGetMiddleware] Generated key_id: {key_id} (timestamp: {timestamp})")

            # Validate key_id is not None or empty
            if not key_id or key_id == "req_":
                raise ValueError(f"Invalid key_id generated: {key_id}")

            # Add timeout and retry logic
            max_retries = 2
            timeout = httpx.Timeout(10.0, connect=5.0)  # Increased timeouts
            key_server_url = f"{KEYSERVER_URL}/{key_id}"
            print(f"[EncryptGetMiddleware] Will call key server at: {key_server_url}")
            
            for attempt in range(max_retries):
                try:
                    print(f"[EncryptGetMiddleware] Attempt {attempt + 1}/{max_retries} - calling key server...")
                    
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        print(f"[EncryptGetMiddleware] Making GET request to: {key_server_url}")
                        key_res = await client.get(key_server_url)
                        
                        print(f"[EncryptGetMiddleware] Key server response: status={key_res.status_code}")
                        
                        if key_res.status_code != 200:
                            raise httpx.HTTPStatusError(
                                f"Key server returned {key_res.status_code}", 
                                request=key_res.request, 
                                response=key_res
                            )
                        
                        key_data = key_res.json()
                        print(f"[EncryptGetMiddleware] Key server response keys: {list(key_data.keys())}")
                    
                    print(f"[EncryptGetMiddleware] Successfully got key data on attempt {attempt + 1}")
                    break  # Success, exit retry loop
                    
                except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as e:
                    error_msg = f"[EncryptGetMiddleware] Attempt {attempt + 1} failed: {type(e).__name__}: {e}"
                    print(error_msg)
                    
                    if attempt == max_retries - 1:  # Last attempt
                        print(f"[EncryptGetMiddleware] All {max_retries} attempts failed, raising exception")
                        raise e
                    
                    print(f"[EncryptGetMiddleware] Waiting 0.5s before retry...")
                    await asyncio.sleep(0.5)  # Brief delay before retry

            print("[EncryptGetMiddleware] Processing encryption keys...")
            
            # Validate key data
            if "encrypted_key" not in key_data or "aes_key_b64" not in key_data:
                raise ValueError(f"Invalid key data from server: {list(key_data.keys())}")
            
            encrypted_key = key_data["encrypted_key"]
            aes_key_b64 = key_data["aes_key_b64"]
            
            print(f"[EncryptGetMiddleware] Got encrypted_key length: {len(encrypted_key)}")
            print(f"[EncryptGetMiddleware] Got aes_key_b64 length: {len(aes_key_b64)}")
            
            aes_key = base64.b64decode(aes_key_b64)
            print(f"[EncryptGetMiddleware] Decoded AES key length: {len(aes_key)} bytes")

            print("[EncryptGetMiddleware] Calling encrypt_aes_gcm...")
            encrypted_payload = encrypt_aes_gcm(data, aes_key)
            print(f"[EncryptGetMiddleware] Encryption successful, payload keys: {list(encrypted_payload.keys())}")

            result = {
                "key_id": key_id, 
                "encrypted_key": encrypted_key, 
                **encrypted_payload
            }
            
            print(f"[EncryptGetMiddleware] Final result keys: {list(result.keys())}")
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