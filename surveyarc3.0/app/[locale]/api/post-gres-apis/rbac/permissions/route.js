// app/api/post-gres-apis/rbac/permissions/route.js

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

// GET /api/post-gres-apis/rbac/permissions
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user");
    const orgId = searchParams.get("orgId");
    const module = searchParams.get("module");

    console.log("[RBAC Permissions] GET request:", { userId, orgId, module });

    if (!userId || !orgId) {
      return NextResponse.json(
        { detail: "user and orgId are required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ user: userId, orgId });
    if (module) params.set("module", module);

    const res = await fetch(`${BASE}/rbac/permissions?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[RBAC Permissions] GET error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// POST /api/post-gres-apis/rbac/permissions
export async function POST(req) {
  try {
    const body = await req.json();
    console.log("[RBAC Permissions] POST request:", body);

    const userId = body.user_id || body.user;

    // Validate required fields
    const required = ["code", "module"];
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json(
          { detail: `${k} is required` },
          { status: 400 }
        );
      }
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/permissions`, {
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
    console.error("[RBAC Permissions] POST error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}