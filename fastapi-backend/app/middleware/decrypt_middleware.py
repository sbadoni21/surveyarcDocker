# app/middleware/decrypt_middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import Message
import json, base64, traceback

from app.utils.crypto_utils import load_private_key
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

private_key = load_private_key()

def _set_body(request: Request, body: bytes):
    # replace the receive channel so downstream can read the new body
    async def receive() -> Message:
        return {"type": "http.request", "body": body, "more_body": False}
    request._receive = receive  # starlette's supported pattern

class DecryptMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in {"POST", "PATCH", "PUT"}:
            try:
                raw = await request.body()
                if not raw:
                    return await call_next(request)

                try:
                    body = json.loads(raw.decode("utf-8"))
                except Exception:
                    # not JSON → pass through
                    _set_body(request, raw)
                    return await call_next(request)

                if "encrypted_key" not in body:
                    # not encrypted → pass through, but reset body we consumed
                    _set_body(request, raw)
                    return await call_next(request)

                # --- Logging (trim to avoid huge logs) ---
                print(f"\n[Middleware] Received payload for {request.url.path}:")
                print(json.dumps({k: (body[k][:80] + "...") if isinstance(body[k], str) and len(body[k]) > 100 else body[k]
                                  for k in body.keys() if k in ("key_id","encrypted_key","ciphertext","iv","tag")}, indent=2))

                # --- Base64 decode ---
                encrypted_key_bytes = base64.b64decode(body["encrypted_key"])
                ciphertext_bytes   = base64.b64decode(body["ciphertext"])
                iv_bytes           = base64.b64decode(body["iv"])
                tag_bytes          = base64.b64decode(body["tag"])
                print("[Middleware] Decoded lengths ->",
                      f"encrypted_key: {len(encrypted_key_bytes)},",
                      f"ciphertext: {len(ciphertext_bytes)},",
                      f"iv: {len(iv_bytes)}, tag: {len(tag_bytes)}")

                # --- RSA decrypt AES key ---
                aes_key = private_key.decrypt(
                    encrypted_key_bytes,
                    padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                                 algorithm=hashes.SHA256(), label=None)
                )
                print("[Middleware] AES key decrypted successfully, length:", len(aes_key))

                # --- AES-GCM decrypt ---
                decryptor = Cipher(algorithms.AES(aes_key), modes.GCM(iv_bytes, tag_bytes)).decryptor()
                decrypted_bytes = decryptor.update(ciphertext_bytes) + decryptor.finalize()
                decrypted_text = decrypted_bytes.decode("utf-8")
                print("[Middleware] AES-GCM decryption succeeded!")
                # print("Decrypted payload preview:", decrypted_text[:300])

                # --- Replace request body (and content-type) ---
                new_body = json.dumps(json.loads(decrypted_text)).encode("utf-8")
                _set_body(request, new_body)
                # also ensure content-type header is JSON
                headers = [(k, v) for (k, v) in request.scope.get("headers", []) if k != b"content-type"]
                headers.insert(0, (b"content-type", b"application/json"))
                request.scope["headers"] = headers

            except Exception as e:
                print("[Middleware] Decryption error:", e)
                traceback.print_exc()
                return JSONResponse({"status": "error", "message": f"Decryption middleware error: {e}"}, status_code=400)

        return await call_next(request)
