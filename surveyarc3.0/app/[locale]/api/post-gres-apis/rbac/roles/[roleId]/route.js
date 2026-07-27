// app/api/post-gres-apis/rbac/roles/[roleId]/route.js

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

// PUT /api/post-gres-apis/rbac/roles/[roleId]
export async function PUT(req, { params }) {
  try {
    const { roleId } = params;
    const body = await req.json();
    console.log("[RBAC Roles] PUT request:", { roleId, body });

    const userId = body.user_id || body.user;

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/roles/${roleId}`, {
      method: "PUT",
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
    console.error("[RBAC Roles] PUT error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}

// DELETE /api/post-gres-apis/rbac/roles/[roleId]
export async function DELETE(req, { params }) {
  try {
    const { roleId } = params;
    const body = await req.json();
    console.log("[RBAC Roles] DELETE request:", { roleId, body });

    const userId = body.user_id || body.user;

    const payload = ENC ? await encryptPayload(body) : body;

    const res = await fetch(`${BASE}/rbac/roles/${roleId}`, {
      method: "DELETE",
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
    console.error("[RBAC Roles] DELETE error:", e);
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}