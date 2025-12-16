import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

export async function POST(req) {
  try {
    const body = await req.json();

    const required = ["user_uid", "role_name", "scope", "resource_id"];
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json({ detail: `${k} is required` }, { status: 400 });
      }
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/remove-role`, {
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
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
