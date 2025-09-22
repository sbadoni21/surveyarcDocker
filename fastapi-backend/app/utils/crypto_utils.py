from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64
import json
import os


def load_private_key(path="keys/fastapi_private.pem"):
    with open(path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)

def decrypt_request(body, private_key):
    encrypted_key = base64.b64decode(body["encrypted_key"])
    ciphertext = base64.b64decode(body["ciphertext"])
    iv = base64.b64decode(body["iv"])
    tag = base64.b64decode(body["tag"])

    # 1️⃣ Decrypt AES key
    aes_key = private_key.decrypt(
        encrypted_key,
        padding.OAEP(
            mgf=padding.MGF1(hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )

    # 2️⃣ Decrypt payload with AES-GCM
    decryptor = Cipher(
        algorithms.AES(aes_key),
        modes.GCM(iv, tag)
    ).decryptor()
    decrypted_bytes = decryptor.update(ciphertext) + decryptor.finalize()

    return json.loads(decrypted_bytes.decode("utf-8"))


def encrypt_aes_gcm(data: dict, aes_key: bytes):
    """
    Encrypt a dict using AES-256-GCM. Returns base64 encoded {ciphertext, iv, tag}
    """
    iv = os.urandom(12)
    cipher = Cipher(algorithms.AES(aes_key), modes.GCM(iv))
    encryptor = cipher.encryptor()
    plaintext = json.dumps(data).encode("utf-8")
    ciphertext = encryptor.update(plaintext) + encryptor.finalize()
    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "iv": base64.b64encode(iv).decode(),
        "tag": base64.b64encode(encryptor.tag).decode(),
    }