// app/api/post-gres-apis/projects/[projectId]/status/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);

    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) =>
            item && typeof item === "object"
              ? (await decryptGetResponse(item).catch(() => item))
              : item
          )
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    if (json && typeof json === "object") {
      try {
        const dec = await decryptGetResponse(json);
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    // Upstream did not return JSON
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// POST /api/post-gres-apis/projects/:projectId/status
export async function POST(req, { params }) {
  try {
    const { projectId } = await params ?? {};
    if (!projectId) {
      return NextResponse.json({ detail: "projectId is required in the path" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { orgId, status, reason } = body || {};

    if (!orgId)  return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
    if (!status) return NextResponse.json({ detail: "status is required" }, { status: 400 });

    const toSend = { status, reason };
    const payload = ENC ? await encryptPayload(toSend) : toSend;

    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
