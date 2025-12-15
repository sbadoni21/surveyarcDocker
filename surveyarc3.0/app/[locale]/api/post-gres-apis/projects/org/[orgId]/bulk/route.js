import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

/* --------------------------------------------------
   FORCE DECRYPT RESPONSE
-------------------------------------------------- */
async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      const dec = await Promise.all(
        json.map(async (i) => {
          try { return await decryptGetResponse(i); } catch { return i; }
        })
      );
      return NextResponse.json(dec, { status: res.status });
    }
    if (json && typeof json === "object") {
      try {
        return NextResponse.json(await decryptGetResponse(json), { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

/* --------------------------------------------------
   SHARED BULK CALL
-------------------------------------------------- */
async function bulkCall(orgId, body) {
  const payload = ENC ? await encryptPayload(body) : body;

  const res = await fetch(`${BASE}/projects/${orgId}/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ENC ? { "x-encrypted": "1" } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });

  return forceDecryptResponse(res);
}

/* --------------------------------------------------
   METHODS
-------------------------------------------------- */

// POST → archive, unarchive, set-status, set-priority
export async function POST(req, { params }) {
  const { orgId } = await params;
  const body = await req.json();

  if (!body?.op) {
    return NextResponse.json(
      { detail: "Missing bulk op" },
      { status: 400 }
    );
  }

  return bulkCall(orgId, body);
}

// DELETE → delete projects
export async function DELETE(req, { params }) {
  const { orgId } = await params;
  const body = await req.json();
console.log(body)
  return bulkCall(orgId, {
    ...body,
    op: "delete",
  });
}
