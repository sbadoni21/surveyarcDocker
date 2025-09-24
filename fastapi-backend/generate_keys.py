from fastapi import FastAPI, HTTPException
import os, base64, time
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa

app = FastAPI()

# in-memory store: key_id -> AES key
KEY_STORE = {}

# Load backend public key (for encrypting AES key)
try:
    with open("keys/fastapi_public.pem", "rb") as f:
        public_key = serialization.load_pem_public_key(f.read())
    print("[KeyServer] Successfully loaded public key")
except Exception as e:
    print(f"[KeyServer] Failed to load public key: {e}")
    raise

@app.on_event("startup")
async def startup_event():
    print("🔑 Key Server starting up...")
    print(f"[KeyServer] Key store initialized: {len(KEY_STORE)} keys")

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "key-server",
        "keys_in_store": len(KEY_STORE),
        "timestamp": int(time.time())
    }

@app.get("/get-key/{key_id}")
def get_key(key_id: str):
    print(f"[KeyServer] Received request for key_id: '{key_id}' (type: {type(key_id)}, length: {len(key_id)})")
    
    # Validate key_id
    if not key_id or key_id.strip() == "":
        print("[KeyServer] ERROR: Empty key_id received")
        raise HTTPException(status_code=400, detail="key_id cannot be empty")
    
    if key_id == "undefined":
        print("[KeyServer] WARNING: Received 'undefined' as key_id - this indicates a frontend/middleware issue")
    
    # Log current key store status
    print(f"[KeyServer] Current key store size: {len(KEY_STORE)}")
    if key_id in KEY_STORE:
        print(f"[KeyServer] Key {key_id} already exists in store")
    else:
        print(f"[KeyServer] Creating new key for {key_id}")
    
    try:
        if key_id not in KEY_STORE:
            # generate AES key
            aes_key = os.urandom(32)  # 256-bit key
            KEY_STORE[key_id] = aes_key
            print(f"[KeyServer] Generated new AES key for {key_id} (32 bytes)")
        else:
            print(f"[KeyServer] Reusing existing AES key for {key_id}")

        aes_key = KEY_STORE[key_id]
        print(f"[KeyServer] AES key length: {len(aes_key)} bytes")

        # Encrypt AES key with backend's public key
        print("[KeyServer] Encrypting AES key with public key...")
        encrypted_key = public_key.encrypt(
            aes_key,
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()),
                         algorithm=hashes.SHA256(),
                         label=None)
        )
        print(f"[KeyServer] Encrypted key length: {len(encrypted_key)} bytes")

        # Prepare response
        encrypted_key_b64 = base64.b64encode(encrypted_key).decode()
        aes_key_b64 = base64.b64encode(aes_key).decode()
        
        response_data = {
            "key_id": key_id,  # Include key_id in response for verification
            "encrypted_key": encrypted_key_b64,
            "aes_key_b64": aes_key_b64
        }
        
        print(f"[KeyServer] Response prepared:")
        print(f"  - key_id: {key_id}")
        print(f"  - encrypted_key length: {len(encrypted_key_b64)}")
        print(f"  - aes_key_b64 length: {len(aes_key_b64)}")
        
        return response_data
        
    except Exception as e:
        error_msg = f"[KeyServer] Error processing key request: {type(e).__name__}: {e}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Key generation failed: {str(e)}")

@app.get("/keys/list")
def list_keys():
    """Debug endpoint to list all stored keys"""
    return {
        "total_keys": len(KEY_STORE),
        "key_ids": list(KEY_STORE.keys())[:20],  # Show first 20 keys
        "note": "Showing first 20 keys only" if len(KEY_STORE) > 20 else "All keys shown"
    }

@app.delete("/keys/clear")
def clear_keys():
    """Debug endpoint to clear all stored keys"""
    count = len(KEY_STORE)
    KEY_STORE.clear()
    print(f"[KeyServer] Cleared {count} keys from store")
    return {"message": f"Cleared {count} keys", "remaining": len(KEY_STORE)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)