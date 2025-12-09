// app/en/api/post-gres-apis/salesforce-campaigns/add-to-list/route.js
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

  if (looksEnvelope(parsed.json)) {
    try {
      const dec = await decryptGetResponse(parsed.json);
      return NextResponse.json(dec, { status: res.status });
    } catch {
      return NextResponse.json(parsed.json, { status: res.status });
    }
  }

  return NextResponse.json(parsed.json, { status: res.status });
}

// POST /en/api/post-gres-apis/salesforce-campaigns/add-to-list
export async function POST(req) {
  try {
    const body = await req.json();
    const { listId, salesforceAccountId, salesforceContactIds } = body || {};

    if (!listId) {
      return NextResponse.json(
        { status: "error", message: "listId is required" },
        { status: 400 }
      );
    }

    if (!salesforceAccountId && !salesforceContactIds?.length) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Either salesforceAccountId or salesforceContactIds[] is required",
        },
        { status: 400 }
      );
    }

    const payload = {
      list_id: listId,
      salesforce_account_id: salesforceAccountId ?? null,
      salesforce_contact_ids: salesforceContactIds ?? null,
    };

    const finalBody = ENC ? await encryptPayload(payload) : payload;

    const res = await fetch(
      `${BASE}/salesforce-campaigns/add-to-list?list_id=${encodeURIComponent(
        listId
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENC ? { "x-encrypted": "1" } : {}),
        },
        body: JSON.stringify(finalBody),
        signal: AbortSignal.timeout(30000),
      }
    );

    return forceDecryptResponse(res);
  } catch (error) {
    console.error("[add-to-list] error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
