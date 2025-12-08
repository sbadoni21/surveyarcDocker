import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const status = res.status;
  const url = res.url;

  // 🔹 Read raw text
  const text = await res.text();
  console.log("[SF /contacts/byAccount] 🔹 RAW TEXT from backend:", {
    status,
    url,
    text,
  });

  try {
    const json = JSON.parse(text);
    console.log("[SF /contacts/byAccount] 🔹 PARSED JSON:", json);

    if (json && typeof json === "object") {
      try {
        const decrypted = await decryptGetResponse(json);
        console.log("[SF /contacts/byAccount] 🔹 DECRYPTED JSON:", decrypted);

        return NextResponse.json(decrypted, { status });
      } catch (e) {
        console.warn(
          "[SF /contacts/byAccount] ⚠️ decryptGetResponse failed, returning raw JSON:",
          e
        );
        return NextResponse.json(json, { status });
      }
    }

    // if json is not an object (string/number/etc)
    return NextResponse.json(json, { status });
  } catch (e) {
    console.warn(
      "[SF /contacts/byAccount] ⚠️ JSON.parse failed, returning raw text:",
      e
    );
    return NextResponse.json({ status: "error", raw: text }, { status });
  }
}

export async function GET(req, { params }) {
  const { accountId } = await params;

  console.log("[SF /accounts/[accountId]/contacts] ➜ Incoming request", {
    accountId,
    BASE,
  });

  try {
    const url = `${BASE}/salesforce/accounts/${accountId}/contacts`;
    console.log("[SF /accounts/[accountId]/contacts] ➜ Fetching URL:", url);

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    console.log("[SF /accounts/[accountId]/contacts] ➜ Backend response status:", res.status);

    return forceDecryptResponse(res);
  } catch (err) {
    console.error(
      "[SF /accounts/[accountId]/contacts] ❌ Error fetching contacts:",
      err
    );
    return NextResponse.json(
      { status: "error", message: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
