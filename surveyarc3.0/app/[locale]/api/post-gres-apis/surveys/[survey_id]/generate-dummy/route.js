// app/api/post-gres-apis/surveys/[survey_id]/generate-dummy/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

const DEFAULT_FORM_BASE =
  process.env.FORM_PAGE_BASE_URL ||
  `${process.env.NEXT_PUBLIC_SITE_URL || "https://surveyarcdocker.onrender.com"}/en/form`;

// ---------- shared helpers (same style as surveys/[survey_id]/route.js) ----------

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

  // Object envelope
  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (looksEncrypted(data)) {
      try {
        const dec = await decryptGetResponse(data);
        return NextResponse.json(dec, { status: res.status });
      } catch (e) {
        console.warn(
          `[${label}] ❌ decrypt failed, returning raw object:`,
          e
        );
        return NextResponse.json(data, { status: res.status });
      }
    }
    return NextResponse.json(data, { status: res.status });
  }

  // Array of possibly encrypted items
  if (Array.isArray(data)) {
    try {
      const dec = await Promise.all(
        data.map(async (item, i) => {
          if (item && typeof item === "object" && looksEncrypted(item)) {
            try {
              const d = await decryptGetResponse(item);
              return d;
            } catch (e) {
              console.warn(
                `[${label}] ❌ decrypt failed for item[${i}], returning raw`,
                e
              );
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

  // Primitive JSON
  return NextResponse.json(data, { status: res.status });
}

// Camel → snake for the generator payload
function toSnakeCasePayload(body) {
  if (!body || typeof body !== "object") return {};

  const out = {};

  if ("orgId" in body) out.org_id = body.orgId;
  if ("projectId" in body) out.project_id = body.projectId;
  if ("count" in body) out.count = body.count;
  if ("concurrency" in body) out.concurrency = body.concurrency;
  if ("headless" in body) out.headless = body.headless;
  if ("baseFormUrl" in body) out.base_form_url = body.baseFormUrl;

  // sensible defaults
  if (!out.base_form_url) out.base_form_url = DEFAULT_FORM_BASE;

  return out;
}

// ---------- POST /surveys/[survey_id]/generate-dummy ----------
// Body: { orgId, projectId, count?, concurrency?, headless?, baseFormUrl? }

export async function POST(req, { params }) {
  const { survey_id } = await params;

  if (!BASE) {
    return NextResponse.json(
      { detail: "FASTAPI_BASE_URL is not configured" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json(
      { detail: "Invalid JSON body", message: String(e?.message || e) },
      { status: 400 }
    );
  }

  const snake = toSnakeCasePayload(body);
  const { org_id, project_id } = snake;

  if (!org_id || !project_id) {
    return NextResponse.json(
      { detail: "orgId and projectId are required" },
      { status: 400 }
    );
  }

  try {
    const payload = ENC ? await encryptPayload(snake) : snake;

    const res = await fetch(
      `${BASE}/surveys/${encodeURIComponent(
        survey_id
      )}/generate-dummy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      }
    );

    return forceDecryptResponse(res, "POST /surveys/[id]/generate-dummy");
  } catch (e) {
    console.error("[generate-dummy] ❌ upstream error:", e);
    return NextResponse.json(
      {
        status: "error",
        detail: "Upstream error calling FastAPI /generate-dummy",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
