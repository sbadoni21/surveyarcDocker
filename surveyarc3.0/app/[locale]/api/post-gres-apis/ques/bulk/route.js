// app/api/surveys/[surveyId]/bulk-questions/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_QUESTIONS === "1";

const looksEncrypted = (o) =>
  o && typeof o === "object" &&
  "key_id" in o && "encrypted_key" in o &&
  "ciphertext" in o && "iv" in o && "tag" in o;

const safeParse = (t) => { 
  try { 
    return { ok: true, json: JSON.parse(t) }; 
  } catch { 
    return { ok: false, raw: t }; 
  } 
};

export async function POST(req, { params }) {
  try {
    const { surveyId } = await params;
    const body = await req.json();
    
    // Expect body to be: { question_ids: ["Q123", "Q456"] } or just ["Q123", "Q456"]
    const questionIds = Array.isArray(body) ? body : body.question_ids;
    
    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { status: "error", message: "question_ids must be an array" }, 
        { status: 400 }
      );
    }
    console.log(questionIds)

    const payload = ENC ? await encryptPayload({ question_ids: questionIds }) : { question_ids: questionIds };
    console.log(payload)

    const res = await fetch(
      `${BASE}/questions/bulk`,
      {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          ...(ENC ? { "x-encrypted": "1" } : {}) 
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );

    const text = await res.text();
    const parsed = safeParse(text);
    
    if (parsed.ok && looksEncrypted(parsed.json)) {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    }
    
    return NextResponse.json(
      parsed.ok ? parsed.json : { status: "error", raw: parsed.raw }, 
      { status: res.status }
    );
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) }, 
      { status: 500 }
    );
  }
}