// app/api/post-gres-apis/rbac/user-permissions/remove-denial/route.js

import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
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

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("[User Permissions] Remove denial request:", body);

    const userId = body.user_id || body.user_uid;

    // Validate required fields
    const required = ["user_uid", "permission_code", "scope", "resource_id"];
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json(
          { detail: `${k} is required` },
          { status: 400 }
        );
      }
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/user-permissions/remove-denial`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId || "",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[User Permissions] Remove denial error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}