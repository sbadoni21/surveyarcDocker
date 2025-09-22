from fastapi import APIRouter, Request
import base64, json
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

router = APIRouter()

# Load backend private key
with open("keys/fastapi_private.pem", "rb") as f:
    private_key = serialization.load_pem_private_key(f.read(), password=None)

@router.post("/secure-crud")
async def secure_crud(request: Request):
    body = await request.json()
    print("[Backend] Received Encrypted Data:", body)

    try:
        # Decode base64
        encrypted_key = base64.b64decode(body["encrypted_key"])
        ciphertext = base64.b64decode(body["ciphertext"])
        iv = base64.b64decode(body["iv"])
        tag = base64.b64decode(body["tag"])
        print("[Backend] Decoded lengths - encrypted_key:", len(encrypted_key),
              "ciphertext:", len(ciphertext), "iv:", len(iv), "tag:", len(tag))

        # 1️⃣ Decrypt AES key
        aes_key = private_key.decrypt(
            encrypted_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        print("[Backend] AES key decrypted successfully")

        # 2️⃣ Decrypt payload
        decryptor = Cipher(
            algorithms.AES(aes_key),
            modes.GCM(iv, tag)
        ).decryptor()
        decrypted_data = decryptor.update(ciphertext) + decryptor.finalize()

        payload = json.loads(decrypted_data.decode("utf-8"))
        print("[Backend] Decrypted Payload:", payload)

        return {"status": "success", "received": payload}

    except Exception as e:
        print("[Backend] AES-GCM decryption failed:", e)
        return {"status": "error", "message": str(e)}
