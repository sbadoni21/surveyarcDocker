import crypto from "crypto";

const BASE = process.env.KEYSERVER_BASE_URL;
const BACKEND_BASE = process.env.FASTAPI_BASE_URL;


export async function POST(req) {
  const payload = await req.json();
  const key_id = "req_" + Date.now();
  const keyRes = await fetch(`${BASE}/get-key/${key_id}`);
  const { encrypted_key, aes_key_b64 } = await keyRes.json();
  const aesKey = Buffer.from(aes_key_b64, "base64");
  const iv = crypto.randomBytes(12); 
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  let ciphertext = cipher.update(JSON.stringify(payload), "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();

  const response = await fetch(`${BACKEND_BASE}/secure-crud` , {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key_id,
      encrypted_key, 
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
    }),
  });

  const result = await response.json();
  console.log("Backend Response:", result);
  return new Response(JSON.stringify(result), { status: 200 });
}
