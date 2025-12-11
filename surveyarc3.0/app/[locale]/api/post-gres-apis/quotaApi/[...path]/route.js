// app/[locale]/api/post-gres-apis/quotaApi/[...path]/route.js
import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

const looksEnvelope = (o) =>
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

async function decryptResponse(res) {
  const text = await res.text();
  const parsed = safeParse(text);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.raw }, { status: res.status });
  }

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map((i) => (looksEnvelope(i) ? decryptGetResponse(i) : i))
    );
    return NextResponse.json(out, { status: res.status });
  }

  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }

  return NextResponse.json(parsed.json, { status: res.status });
}

function buildForwardUrl(pathParam, search = "") {
  let urlPath = "";
  if (Array.isArray(pathParam)) {
    urlPath = pathParam.filter(Boolean).join("/");
  } else if (typeof pathParam === "string" && pathParam.length > 0) {
    urlPath = pathParam;
  }
  const baseQuotas = `${BASE.replace(/\/$/, "")}/quotas`;
  return urlPath ? `${baseQuotas}/${urlPath}${search}` : `${baseQuotas}${search}`;
}

// ---------- GET (list / by-survey / single quota) ----------
export async function GET(req, { params }) {
  try {
    const { path } = (await params) ?? {};
    const url = buildForwardUrl(path, req.nextUrl.search);
    console.log("[quotaApi proxy] GET ->", url);

    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(60000),
    });

    return decryptResponse(res);
  } catch (e) {
    console.error("[quotaApi proxy] GET error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ---------- POST (create / evaluate / increment) ----------
export async function POST(req, { params }) {
  try {
    const { path } = (await params) ?? {};
    // path undefined  -> POST /quotas           (create)
    // path ["id","evaluate"] -> POST /quotas/id/evaluate
    // path ["id","increment"]-> POST /quotas/id/increment
    const url = buildForwardUrl(path);
    console.log("[quotaApi proxy] POST ->", url);

    const body = await req.json().catch(() => ({}));
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const backendText = await res.text().catch(() => "<no-body>");
    console.log("[quotaApi proxy] POST backend status:", res.status, "body:", backendText);

    if (!res.ok) {
      try {
        const parsed = JSON.parse(backendText);
        return NextResponse.json(
          { backendStatus: res.status, backendBody: parsed },
          { status: res.status }
        );
      } catch {
        return NextResponse.json(
          { backendStatus: res.status, backendBody: backendText },
          { status: res.status }
        );
      }
    }

    // success
    return decryptResponse(new Response(backendText, { status: res.status }));
  } catch (e) {
    console.error("[quotaApi proxy] POST error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ---------- PUT (update quota) ----------
export async function PUT(req, { params }) {
  try {
    const { path } = (await params) ?? {};
    // expect path like ["{quotaId}"]
    const url = buildForwardUrl(path);
    console.log("[quotaApi proxy] PUT ->", url);

    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const backendText = await res.text().catch(() => "<no-body>");
    console.log("[quotaApi proxy] PUT backend status:", res.status, "body:", backendText);

    if (!res.ok) {
      try {
        const parsed = JSON.parse(backendText);
        return NextResponse.json(
          { backendStatus: res.status, backendBody: parsed },
          { status: res.status }
        );
      } catch {
        return NextResponse.json(
          { backendStatus: res.status, backendBody: backendText },
          { status: res.status }
        );
      }
    }

    return decryptResponse(new Response(backendText, { status: res.status }));
  } catch (e) {
    console.error("[quotaApi proxy] PUT error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ---------- DELETE (delete quota) ----------
export async function DELETE(req, { params }) {
  try {
    const { path } = (await params) ?? {};
    // expect path like ["{quotaId}"]
    const url = buildForwardUrl(path);
    console.log("[quotaApi proxy] DELETE ->", url);

    const res = await fetch(url, {
      method: "DELETE",
      signal: AbortSignal.timeout(60000),
    });

    const text = await res.text().catch(() => "<no-body>");
    const parsed = safeParse(text);

    if (!res.ok) {
      return NextResponse.json(
        { backendStatus: res.status, backendBody: parsed.ok ? parsed.json : text },
        { status: res.status }
      );
    }

    return parsed.ok
      ? NextResponse.json(parsed.json, { status: res.status })
      : NextResponse.json({ raw: text }, { status: res.status });
  } catch (e) {
    console.error("[quotaApi proxy] DELETE error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
