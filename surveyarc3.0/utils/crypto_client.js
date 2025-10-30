import crypto from "crypto";
const BASE = process.env.KEYSERVER_BASE_URL


export function decryptAESGCM({ ciphertext, iv, tag }, aesKeyBase64) {
  const key = Buffer.from(aesKeyBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

export async function decryptGetResponse(encrypted) {
  const keyRes = await fetch(`${BASE}/get-key/${encrypted.key_id}`);
    // const keyRes = await fetch(`http://key-server:8001/get-key/${encrypted.key_id}`);
  if (!keyRes.ok) throw new Error("Failed to get key from keyserver");
  const { aes_key_b64 } = await keyRes.json();
  return decryptAESGCM(encrypted, aes_key_b64);
}
