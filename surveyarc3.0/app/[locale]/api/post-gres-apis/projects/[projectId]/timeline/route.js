// app/api/post-gres-apis/projects/[projectId]/timeline/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils"; // not used here (GET), kept for parity

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
    // Upstream returned non-JSON (e.g., HTML error)
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// GET /en/api/post-gres-apis/projects/:projectId/timeline?orgId=... (also accepts org_id)
export async function GET(req, { params }) {
  try {
    const { projectId } = await params ?? {};
    if (!projectId) {
      return NextResponse.json({ detail: "projectId is required in the path" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId") || searchParams.get("org_id");
    if (!orgId) {
      return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
    }

    // forward any other query params (exclude orgId/org_id)
    const fwd = new URLSearchParams();
    for (const [k, v] of searchParams.entries()) {
      if (k === "orgId" || k === "org_id") continue;
      if (v !== null && v !== undefined && v !== "") fwd.set(k, v);
    }
    const qs = fwd.toString();
    const url = `${BASE}/projects/${encodeURIComponent(orgId)}/${encodeURIComponent(projectId)}/timeline${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
      headers: {
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
