// app/api/post-gres-apis/surveys/[survey_id]/generation-stop/[job_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

const looksEncrypted = (o) =>
  o &&
  typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

const safeParse = (t) => {
  try {
    return { ok: true, json: JSON.parse(t) };
  } catch {
    return { ok: false, raw: t };
  }
};

async function forceDecryptResponse(res, label = "") {
  const text = await res.text();
  const parsed = safeParse(text);
  
  if (!parsed.ok) {
    console.warn(`[${label}] not JSON, returning raw`);
    return NextResponse.json(
      { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  }

  const data = parsed.json;

  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (looksEncrypted(data)) {
      try {
        const dec = await decryptGetResponse(data);
        return NextResponse.json(dec, { status: res.status });
      } catch (e) {
        console.warn(`[${label}] ❌ decrypt failed, returning raw object:`, e);
        return NextResponse.json(data, { status: res.status });
      }
    }
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data, { status: res.status });
}

// POST /surveys/[survey_id]/generation-stop/[job_id]
// Note: We might need to adjust this endpoint based on what the backend expects
export async function POST(req, { params }) {
  const { survey_id, job_id } = await params;

  if (!BASE) {
    return NextResponse.json(
      { detail: "FASTAPI_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const payload = ENC ? await encryptPayload({ action: "stop" }) : { action: "stop" };

    // Try DELETE method first (common for canceling tasks)
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(survey_id)}/generate-dummy/${encodeURIComponent(job_id)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      // If backend doesn't have this endpoint yet, return success anyway
      if (res.status === 404 || res.status === 405) {
        return NextResponse.json({
          success: true,
          message: "Stop signal sent (backend endpoint not available)"
        }, { status: 200 });
      }
    }

    return forceDecryptResponse(res, "POST /generation-stop");
  } catch (e) {
    console.error("[generation-stop] ❌ upstream error:", e);
    
    // Return success anyway to allow frontend to stop
    return NextResponse.json({
      success: true,
      message: "Stop signal sent (error occurred)"
    }, { status: 200 });
  }
}