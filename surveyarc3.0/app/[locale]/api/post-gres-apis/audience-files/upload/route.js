// app/api/post-gres-apis/audience-files/upload/route.js

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

/* -------------------------------- helpers -------------------------------- */

async function forceDecryptResponse(res) {
  const text = await res.text();

  try {
    const json = JSON.parse(text);

    // Array response
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) => {
            if (item && typeof item === "object") {
              try {
                return await decryptGetResponse(item);
              } catch {
                return item;
              }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    // Object response
    if (json && typeof json === "object") {
      try {
        return NextResponse.json(await decryptGetResponse(json), {
          status: res.status,
        });
      } catch {
        return NextResponse.json(json, { status: res.status });
      }
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: "error", raw: text },
      { status: res.status }
    );
  }
}

function pickAuthHeaders(inHeaders) {
  const out = {};
  const auth = inHeaders.get("authorization");
  const xuid = inHeaders.get("x-user-id");

  if (auth) out["authorization"] = auth;
  if (xuid) out["x-user-id"] = xuid;

  return out;
}

function pickContextHeaders(inHeaders) {
  const keys = [
    "x-request-id",
    "x-trace-id",
    "x-correlation-id",
    "x-session-id",
    "x-parent-log-id",
    "x-tenant-id",
    "user-agent",
    "x-forwarded-for",
  ];

  const out = {};
  for (const k of keys) {
    const v = inHeaders.get(k);
    if (v) out[k] = v;
  }
  return out;
}

/* -------------------------------- POST -------------------------------- */
/**
 * POST /api/post-gres-apis/audience-files/upload
 * 
 * Handles file upload with encryption support
 * Note: File uploads use FormData (multipart/form-data) which cannot be encrypted
 * Only the response is encrypted if ENC=true
 */
export async function POST(req) {
  try {
    console.log("📤 [Next.js] Receiving file upload request");

    // Get FormData from request
    const formData = await req.formData();
    
    const file = formData.get('file');
    const audienceName = formData.get('audience_name');
    const orgId = formData.get('org_id');
    const userId = formData.get('user_id');

    console.log("📋 [Next.js] Upload details:", {
      fileName: file?.name,
      fileSize: file?.size,
      audienceName,
      orgId,
      userId,
      encryptionEnabled: ENC
    });

    if (!file) {
      return NextResponse.json(
        { detail: "No file provided" },
        { status: 400 }
      );
    }

    if (!audienceName || !orgId) {
      return NextResponse.json(
        { detail: "Missing required fields: audience_name, org_id" },
        { status: 400 }
      );
    }

    // Create new FormData for backend
    const backendFormData = new FormData();
    backendFormData.append('file', file);
    backendFormData.append('audience_name', audienceName);
    backendFormData.append('org_id', orgId);
    if (userId) {
      backendFormData.append('user_id', userId);
    }

    console.log(`🚀 [Next.js] Forwarding to: ${BASE}/audience-files/upload`);

    // Forward to FastAPI
    // NOTE: FormData (multipart/form-data) cannot be encrypted
    // We send it as-is and decrypt the response if needed
    const res = await fetch(`${BASE}/audience-files/upload`, {
      method: "POST",
      headers: {
        // DO NOT set Content-Type - let browser set it with boundary
        ...pickAuthHeaders(req.headers),
        ...pickContextHeaders(req.headers),
        // Signal to backend that we expect encrypted response if ENC=true
        ...(ENC ? { "x-encrypted": "1" } : {}),
      },
      body: backendFormData,
      signal: AbortSignal.timeout(120000), // 2 minute timeout for large files
    });

    console.log(`📥 [Next.js] Backend response status: ${res.status}`);

    // Use forceDecryptResponse to handle encrypted responses
    return await forceDecryptResponse(res);

  } catch (error) {
    console.error("❌ [Next.js] Upload error:", error);
    return NextResponse.json(
      {
        detail: "Upload failed",
        message: String(error?.message || error),
      },
      { status: 500 }
    );
  }
}

// Add OPTIONS for CORS if needed
export async function OPTIONS(req) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-encrypted',
    },
  });
}