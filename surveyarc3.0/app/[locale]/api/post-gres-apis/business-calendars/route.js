// app/api/post-gres-apis/slas/business-calendars/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// ---- helpers ----
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) => {
            if (item && typeof item === "object") {
              try { return await decryptGetResponse(item); } catch { return item; }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// Pick only the auth headers we support on the FastAPI side
function pickAuthHeaders(inHeaders) {
  const out = {};
  const auth = inHeaders.get("authorization");
  const xuid = inHeaders.get("x-user-id");
  if (auth) out["authorization"] = auth;      // Bearer <firebase-id-token>
  if (xuid) out["x-user-id"] = xuid;          // trusted user id from middleware
  return out;
}

// Forward request-context so audit has richer data
function pickContextHeaders(inHeaders) {
  const keys = [
    "x-request-id",
    "x-trace-id",
    "x-correlation-id",
    "x-session-id",
    "x-parent-log-id",
    "x-tenant-id",
    "user-agent",
    "x-forwarded-for",
  ];
  const out = {};
  for (const k of keys) {
    const v = inHeaders.get(k);
    if (v) out[k] = v;
  }
  return out;
}

// ----- GET /api/post-gres-apis/slas/business-calendars?org_id=...&active=... -----
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  for (const k of ["org_id", "active"]) {
    const v = searchParams.get(k);
    if (v !== null && v !== "") qs.set(k, v);
  }

  try {
    const res = await fetch(`${BASE}/business-calendars?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
      headers: {
        ...pickAuthHeaders(req.headers),     // not required for GET, but harmless
        ...pickContextHeaders(req.headers),
      },
    });

    if (!res.ok && res.status === 404) {
      return NextResponse.json([], { status: 200 });
    }
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

// ----- POST /api/post-gres-apis/slas/business-calendars -----
export async function POST(req) {
  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(`${BASE}/business-calendars`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
        ...pickAuthHeaders(req.headers),     // ⬅️ REQUIRED for 200 (auth)
        ...pickContextHeaders(req.headers),  // ⬅️ fills audit ids/ua/ip
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
