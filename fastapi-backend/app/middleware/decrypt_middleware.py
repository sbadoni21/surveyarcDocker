# app/middleware/decrypt_middleware.py
import json, base64, traceback
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from starlette.responses import JSONResponse
from app.utils.crypto_utils import load_private_key

private_key = load_private_key()

class DecryptMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def receive_wrapper():
            body = b""
            more_body = True
            while more_body:
                message = await receive()
                body += message.get("body", b"")
                more_body = message.get("more_body", False)

            try:
                if scope["method"] in {"POST", "PUT", "PATCH"}:
                    data = json.loads(body.decode("utf-8"))
                    if "encrypted_key" in data:
                        print(f"[Middleware] DecryptMiddleware activated for {scope['path']}")

                        encrypted_key_bytes = base64.b64decode(data["encrypted_key"])
                        ciphertext_bytes   = base64.b64decode(data["ciphertext"])
                        iv_bytes           = base64.b64decode(data["iv"])
                        tag_bytes          = base64.b64decode(data["tag"])

                        aes_key = private_key.decrypt(
                            encrypted_key_bytes,
                            padding.OAEP(
                                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                                algorithm=hashes.SHA256(),
                                label=None
                            )
                        )

                        decryptor = Cipher(
                            algorithms.AES(aes_key), modes.GCM(iv_bytes, tag_bytes)
                        ).decryptor()
                        decrypted_bytes = decryptor.update(ciphertext_bytes) + decryptor.finalize()
                        decrypted_text = decrypted_bytes.decode("utf-8")

                        decrypted_data = json.loads(decrypted_text)
                        print("Decrypted payload preview:", decrypted_data)

                        # Replace request body with decrypted JSON
                        body = json.dumps(decrypted_data).encode("utf-8")
                        # Ensure content-type header
                        headers = [(b"content-type", b"application/json")]
                        scope["headers"] = headers + [
                            h for h in scope.get("headers", []) if h[0] != b"content-type"
                        ]
            except Exception as e:
                print("[DecryptMiddleware] Error:", e)
                traceback.print_exc()
                response = JSONResponse(
                    {"status": "error", "message": f"Decryption failed: {e}"}, status_code=400
                )
                await response(scope, receive, send)
                return

            return {"type": "http.request", "body": body, "more_body": False}

        await self.app(scope, receive_wrapper, send)
