from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import os

os.makedirs("keys", exist_ok=True)

# Private key (RSA 4096 recommended for production)
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096
)

with open("keys/fastapi_private.pem", "wb") as f:
    f.write(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()  # In prod, you may encrypt with a password
        )
    )

# Public key
public_key = private_key.public_key()
with open("keys/fastapi_public.pem", "wb") as f:
    f.write(
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
    )

print("✅ RSA keys generated")
