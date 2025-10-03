// ============================================
// 1. app/api/post-gres-apis/surveys/route.js
// GET /api/post-gres-apis/surveys (list)
// POST /api/post-gres-apis/surveys (create)
// ============================================

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

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

async function forceDecryptResponse(res, label = "") {
  const text = await res.text();
  console.log(`[${label}] raw text:`, text);

  const parsed = safeParse(text);
  if (!parsed.ok) {
    console.warn(`[${label}] not JSON, returning raw`);
    return NextResponse.json({ status: "error", raw: parsed.raw }, { status: res.status });
  }

  const data = parsed.json;
  console.log(`[${label}] parsed JSON:`, data);

  // Object envelope
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (looksEncrypted(data)) {
      try {
        console.log(`[${label}] attempting decrypt (object)…`);
        const dec = await decryptGetResponse(data);
        console.log(`[${label}] ✅ decrypted object:`, dec);
        return NextResponse.json(dec, { status: res.status });
      } catch (e) {
        console.warn(`[${label}] ❌ decrypt failed, returning raw object:`, e);
        return NextResponse.json(data, { status: res.status });
      }
    }
    return NextResponse.json(data, { status: res.status });
  }

  // Array of possibly encrypted items
  if (Array.isArray(data)) {
    try {
      console.log(`[${label}] array length=${data.length}, attempting per-item decrypt…`);
      const dec = await Promise.all(
        data.map(async (item, i) => {
          if (item && typeof item === "object" && looksEncrypted(item)) {
            try {
              const d = await decryptGetResponse(item);
              console.log(`[${label}] ✅ decrypted item[${i}]`, d);
              return d;
            } catch (e) {
              console.warn(`[${label}] ❌ decrypt failed for item[${i}], returning raw`, e);
              return item;
            }
          }
          return item;
        })
      );
      return NextResponse.json(dec, { status: res.status });
    } catch (e) {
      console.warn(`[${label}] ❌ array decrypt failed, returning raw`, e);
      return NextResponse.json(data, { status: res.status });
    }
  }

  return NextResponse.json(data, { status: res.status });
}

// Convert camelCase to snake_case for backend
function toSnakeCase(body) {
  const out = { ...body };
  
  // Survey fields
  if ("surveyId" in out) { out.survey_id = out.surveyId; delete out.surveyId; }
  if ("orgId" in out) { out.org_id = out.orgId; delete out.orgId; }
  if ("projectId" in out) { out.project_id = out.projectId; delete out.projectId; }
  if ("createdBy" in out) { out.created_by = out.createdBy; delete out.createdBy; }
  if ("updatedBy" in out) { out.updated_by = out.updatedBy; delete out.updatedBy; }
  if ("questionOrder" in out) { out.question_order = out.questionOrder; delete out.questionOrder; }
  if ("metaData" in out) { out.meta_data = out.metaData; delete out.metaData; }
  
  return out;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id") || searchParams.get("projectId");
  
  console.log("[GET /surveys] projectId:", projectId);

  try {
    const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
    const res = await fetch(`${BASE}/surveys${qs}`, {
      signal: AbortSignal.timeout(30000),
    });
    
    console.log("[GET /surveys] backend status:", res.status);
    return forceDecryptResponse(res, "GET /surveys");
  } catch (e) {
    console.error("[GET /surveys] ❌ error:", e);
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const raw = await req.json();
    console.log("[POST /surveys] incoming body (camel):", raw);

    const snake = toSnakeCase(raw);
    console.log("[POST /surveys] outgoing body (snake):", snake);

    const payload = ENC ? await encryptPayload(snake) : snake;
    console.log("[POST /surveys] payload (maybe encrypted):", payload);

    const res = await fetch(`${BASE}/surveys/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    
    console.log("[POST /surveys] backend status:", res.status);
    return forceDecryptResponse(res, "POST /surveys");
  } catch (e) {
    console.error("[POST /surveys] ❌ error:", e);
    return NextResponse.json(
      { status: "error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
