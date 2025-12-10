// app/api/post-gres-apis/surveys/[survey_id]/generation-status/[job_id]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

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

// GET /surveys/[survey_id]/generation-status/[job_id]
export async function GET(req, { params }) {
  const { survey_id, job_id } = await params;

  if (!BASE) {
    return NextResponse.json(
      { detail: "FASTAPI_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    // Use the check_status_url format that backend provides
    // Backend returns: check_status_url: "/surveys/survey_id/generate-dummy/task_id"
    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(survey_id)}/generate-dummy/${encodeURIComponent(job_id)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      // If backend doesn't have this endpoint yet, return a mock response
      if (res.status === 404) {
        return NextResponse.json({
          status: "unknown",
          completed: 0,
          total: 0,
          message: "Status tracking not available on backend"
        }, { status: 200 });
      }
    }

    return forceDecryptResponse(res, "GET /generation-status");
  } catch (e) {
    console.error("[generation-status] ❌ upstream error:", e);
    
    // Return a fallback response instead of error
    return NextResponse.json({
      status: "unknown",
      completed: 0,
      total: 0,
      message: "Status tracking unavailable"
    }, { status: 200 });
  }
}