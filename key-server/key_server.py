# # key_server.py - 8001
# from fastapi import FastAPI
# import os, base64
# from cryptography.hazmat.primitives import serialization, hashes
# from cryptography.hazmat.primitives.asymmetric import padding

# app = FastAPI()

# # Load backend public key (never stores private key)
# with open("keys/fastapi_public.pem", "rb") as f:
#     public_key = serialization.load_pem_public_key(f.read())

# @app.get("/get-key/{key_id}")
# def get_key(key_id: str):
#     """
#     Generate a one-time AES-256 key per request and return it encrypted
#     with backend public key.
#     """
#     aes_key = os.urandom(32)  # AES-256
#     encrypted_key = public_key.encrypt(
#         aes_key,
#         padding.OAEP(
#             mgf=padding.MGF1(algorithm=hashes.SHA256()),
#             algorithm=hashes.SHA256(),
#             label=None
#         )
#     )
#     print({"key_id": key_id,
#         "encrypted_key": base64.b64encode(encrypted_key).decode(),
#         "aes_key_b64": base64.b64encode(aes_key).decode()})
#     return {
#         "key_id": key_id,
#         "encrypted_key": base64.b64encode(encrypted_key).decode(),
#         "aes_key_b64": base64.b64encode(aes_key).decode()  # frontend uses this to encrypt
#     }


# key_server.py
from fastapi import FastAPI
import os, base64
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa

app = FastAPI()

# in-memory store: key_id -> AES key
KEY_STORE = {}

# Load backend public key (for encrypting AES key)
with open("keys/fastapi_public.pem", "rb") as f:
    public_key = serialization.load_pem_public_key(f.read())

@app.get("/get-key/{key_id}")
def get_key(key_id: str):
    if key_id not in KEY_STORE:
        # generate AES key
        aes_key = os.urandom(32)  # 256-bit key
        KEY_STORE[key_id] = aes_key

    aes_key = KEY_STORE[key_id]

    # Encrypt AES key with backend's public key
    encrypted_key = public_key.encrypt(
        aes_key,
        padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                     algorithm=hashes.SHA256(),
                     label=None)
    )

    return {
        "encrypted_key": base64.b64encode(encrypted_key).decode(),
        "aes_key_b64": base64.b64encode(aes_key).decode()
    }
