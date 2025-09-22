# app/middleware/decrypt_middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
import json, base64, traceback
from app.utils.crypto_utils import load_private_key, decrypt_request
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

private_key = load_private_key()

class DecryptMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method in ["POST", "PATCH", "PUT"]:
            try:
                body = await request.json()
                if "encrypted_key" in body:
                    print(f"\n[Middleware] Received payload for {request.url.path}:")
                    print(json.dumps(body, indent=2)[:1000], "...")

                    # --- Step 1: Base64 decode ---
                    try:
                        encrypted_key_bytes = base64.b64decode(body["encrypted_key"])
                        ciphertext_bytes = base64.b64decode(body["ciphertext"])
                        iv_bytes = base64.b64decode(body["iv"])
                        tag_bytes = base64.b64decode(body["tag"])
                        print("[Middleware] Decoded lengths ->",
                              f"encrypted_key: {len(encrypted_key_bytes)},",
                              f"ciphertext: {len(ciphertext_bytes)},",
                              f"iv: {len(iv_bytes)},",
                              f"tag: {len(tag_bytes)}")
                    except Exception as e:
                        print("[Middleware] Base64 decode error:", e)
                        return JSONResponse({"status": "error", "message": f"Base64 decode error: {e}"}, status_code=400)

                    # --- Step 2: Decrypt AES key using RSA ---
                    try:
                        aes_key = private_key.decrypt(
                            encrypted_key_bytes,
                            padding.OAEP(
                                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                                algorithm=hashes.SHA256(),
                                label=None
                            )
                        )
                        print("[Middleware] AES key decrypted successfully, length:", len(aes_key))
                        print("AES key bytes (hex):", aes_key.hex())
                    except Exception as e:
                        print("[Middleware] AES key decryption failed:", e)
                        return JSONResponse({"status": "error", "message": f"AES key decryption failed: {e}"}, status_code=400)

                    # --- Step 3: Manual AES-GCM decryption for debug ---
                    try:
                        decryptor = Cipher(
                            algorithms.AES(aes_key),
                            modes.GCM(iv_bytes, tag_bytes)
                        ).decryptor()
                        decrypted_bytes = decryptor.update(ciphertext_bytes) + decryptor.finalize()
                        decrypted_text = decrypted_bytes.decode("utf-8")
                        print("[Middleware] AES-GCM decryption succeeded!")
                        print("Decrypted payload preview:", decrypted_text[:500])
                    except Exception as e:
                        print("[Middleware] AES-GCM decryption failed:", e)
                        traceback.print_exc()
                        return JSONResponse({"status": "error", "message": f"AES-GCM decryption failed: {e}"}, status_code=400)

                    # --- Step 4: Replace request body ---
                    request._body = json.dumps(json.loads(decrypted_text)).encode()
                    print("[Middleware] Request body replaced with decrypted JSON\n")

            except Exception as e:
                print("[Middleware] General middleware error:", e)
                traceback.print_exc()
                return JSONResponse({"status": "error", "message": f"Decryption middleware error: {e}"}, status_code=400)

        response = await call_next(request)
        return response
