// app/[locale]/api/post-gres-apis/quotaApi/route.js
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
  if (!parsed.ok) return NextResponse.json({ error: parsed.raw }, { status: res.status });

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(parsed.json.map((i) => (looksEnvelope(i) ? decryptGetResponse(i) : i)));
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

export async function POST(req, ctx) {
  try {
    const { path } = ctx.params ?? {};
    const url = buildForwardUrl(path);
    console.log("[quotaApi proxy] POST ->", url);

    const body = await req.json();
    const payload = ENC ? await encryptPayload(body) : body;

    // send to FastAPI (dev: no tight timeout so you can see backend error body)
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      // consider adding a moderate timeout in production:
      signal: AbortSignal.timeout(60000),
    });

    const backendText = await res.text().catch(() => "<no-body>");
    console.log("[quotaApi proxy] backend status:", res.status, "body:", backendText);

    if (!res.ok) {
      try {
        const parsed = JSON.parse(backendText);
        return NextResponse.json({ backendStatus: res.status, backendBody: parsed }, { status: res.status });
      } catch (e) {
        return NextResponse.json({ backendStatus: res.status, backendBody: backendText }, { status: res.status });
      }
    }

    // if OK, attempt to decrypt/parse as before
    return decryptResponse(new Response(backendText, { status: res.status }));
  } catch (e) {
    console.error("[quotaApi proxy] POST error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
