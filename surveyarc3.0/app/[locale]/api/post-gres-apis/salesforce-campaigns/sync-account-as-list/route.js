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

async function forceDecryptResponse(res) {
  const text = await res.text();
  const parsed = safeParse(text);

  if (!parsed.ok) {
    return NextResponse.json(
      { status: "error", raw: parsed.raw },
      { status: res.status }
    );
  }

  if (Array.isArray(parsed.json)) {
    const out = await Promise.all(
      parsed.json.map(async (item) =>
        looksEnvelope(item) ? await decryptGetResponse(item) : item
      )
    );
    return NextResponse.json(out, { status: res.status });
  }

  if (looksEnvelope(parsed.json)) {
    const dec = await decryptGetResponse(parsed.json);
    return NextResponse.json(dec, { status: res.status });
  }

  return NextResponse.json(parsed.json, { status: res.status });
}

export async function POST(req) {
  try {
    const body = await req.json();
    // Backend expects SalesforceAccountToListRequest:
    // { "account_id": "<sf-account-id>" }
    const payloadRaw = {
      account_id: body.accountId,
      org_id: body.orgId,
    };

    const payload = ENC ? await encryptPayload(payloadRaw) : payloadRaw;

    const res = await fetch(
      `${BASE}/salesforce-campaigns/sync-account-as-list`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
          "X-User-ID": payloadRaw.org_id,
          Authorization: req.headers.get("authorization") ?? "",
          Cookie: req.headers.get("cookie") ?? "",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      }
    );

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("❌ sync-account-as-list error:", error);
    return NextResponse.json(
      { status: "error", message: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
