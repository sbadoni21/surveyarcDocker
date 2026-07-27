// app/api/post-gres-apis/rbac/roles/route.js

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

// GET /api/post-gres-apis/rbac/roles
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("org_id");
    const userId = searchParams.get("user");
    const scope = searchParams.get("scope");

    console.log("[RBAC Roles] GET request:", { orgId, userId, scope });

    if (!orgId || !userId) {
      return NextResponse.json(
        { detail: "org_id and user are required" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ org_id: orgId, user: userId });
    if (scope) params.set("scope", scope);

    const res = await fetch(`${BASE}/rbac/roles?${params}`, {
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
    console.error("[RBAC Roles] GET error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// POST /api/post-gres-apis/rbac/roles
export async function POST(req) {
  try {
    const body = await req.json();
    console.log("[RBAC Roles] POST request:", body);

    const userId = body.user_id || body.user;

    // Validate required fields
    const required = ["name", "scope"];
    for (const k of required) {
      if (!body[k]) {
        return NextResponse.json(
          { detail: `${k} is required` },
          { status: 400 }
        );
      }
    }

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/roles`, {
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
    console.error("[RBAC Roles] POST error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}