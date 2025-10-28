import crypto from "crypto";
const BASE = process.env.KEYSERVER_BASE_URL || "http://localhost:8001";

export async function encryptPayload(payload) {
  const key_id = "req_" + Date.now();
  // const keyRes = await fetch(`http://key-server:8001/get-key/${key_id}`);
  const keyRes = await fetch(`${BASE}/get-key/${key_id}`);
  const { encrypted_key, aes_key_b64 } = await keyRes.json();
  const aesKey = Buffer.from(aes_key_b64, "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);

  let ciphertext = cipher.update(JSON.stringify(payload), "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    key_id,
    encrypted_key,          
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}
