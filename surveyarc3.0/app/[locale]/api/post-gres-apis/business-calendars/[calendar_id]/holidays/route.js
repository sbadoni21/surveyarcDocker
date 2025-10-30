// app/api/post-gres-apis/slas/business-calendars/[calendar_id]/holidays/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

// ---------- helpers ----------
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

function pickAuthHeaders(h) {
  const out = {};
  const auth = h.get("authorization");
  const xuid = h.get("x-user-id");
  if (auth) out["authorization"] = auth;   // Bearer <id token>
  if (xuid) out["x-user-id"] = xuid;       // trusted user id
  return out;
}

function pickContextHeaders(h) {
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
    const v = h.get(k);
    if (v) out[k] = v;
  }
  return out;
}

// ---------- GET /holidays ----------
export async function GET(req, { params }) {
  const { calendar_id } = await params;

  try {
    const res = await fetch(
      `${BASE}/business-calendars/${encodeURIComponent(calendar_id)}/holidays`,
      {
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
        headers: {
          ...pickAuthHeaders(req.headers),
          ...pickContextHeaders(req.headers),
        },
      }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// ---------- PUT /holidays ----------
export async function PUT(req, { params }) {
  const { calendar_id } = await params;

  try {
    const raw = await req.json();
    const payload = ENC ? await encryptPayload(raw) : raw;

    const res = await fetch(
      `${BASE}/business-calendars/${encodeURIComponent(calendar_id)}/holidays`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
          ...pickAuthHeaders(req.headers),
          ...pickContextHeaders(req.headers),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
        cache: "no-store",
      }
    );
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
