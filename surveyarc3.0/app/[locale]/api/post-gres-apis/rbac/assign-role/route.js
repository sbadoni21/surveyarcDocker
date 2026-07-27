import { NextResponse } from "next/server";
import { encryptPayload } from "@/utils/crypto_utils";
import { forceDecryptResponse } from "@/utils/categoryApiHelpers";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

export async function POST(req) {
  try {
    const body = await req.json();

    /**
     * ----------------------------------------------------
     * Determine acting user (RBAC actor)
     * Priority:
     * 1. created_by
     * 2. createdBy
     * 3. user_uid (fallback)
     * ----------------------------------------------------
     */
    const actorUid =
      body.created_by ||
      body.createdBy ||
      body.user_uid;

    if (!actorUid) {
      return NextResponse.json(
        { detail: "created_by or user_uid is required" },
        { status: 400 }
      );
    }

    /**
     * ----------------------------------------------------
     * Validate required RBAC fields
     * ----------------------------------------------------
     */
    const required = ["user_uid", "role_name", "scope", "resource_id"];
    for (const key of required) {
      if (!body[key]) {
        return NextResponse.json(
          { detail: `${key} is required` },
          { status: 400 }
        );
      }
    }

    /**
     * ----------------------------------------------------
     * Encrypt payload if needed
     * ----------------------------------------------------
     */
    const payload = ENC ? await encryptPayload(body) : body;

    /**
     * ----------------------------------------------------
     * Forward to FastAPI RBAC service
     * ----------------------------------------------------
     */
    const res = await fetch(`${BASE}/rbac/assign-role`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": actorUid, // ✅ always set correctly
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      {
        detail: "Upstream error",
        message: String(e?.message || e),
      },
      { status: 500 }
    );
  }
}
