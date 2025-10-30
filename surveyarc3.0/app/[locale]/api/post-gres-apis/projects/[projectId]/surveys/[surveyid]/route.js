// app/api/post-gres-apis/projects/[projectId]/surveys/[surveyid]/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.DEVELOPMENT_MODE ? "http://localhost:8000" : process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_SURVEYS === "1";

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) {
      try {
        const dec = await Promise.all(
          json.map(async (item) => {
            if (item && typeof item === "object") {
              try { return await decryptGetResponse(item); } catch { return item; }
            }
            return item;
          })
        );
        return NextResponse.json(dec, { status: res.status });
      } catch { return NextResponse.json(json, { status: res.status }); }
    }
    if (json && typeof json === "object") {
      try { return NextResponse.json(await decryptGetResponse(json), { status: res.status }); }
      catch { return NextResponse.json(json, { status: res.status }); }
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ status: "error", raw: text }, { status: res.status });
  }
}

// DELETE /api/post-gres-apis/projects/[projectId]/surveys/[surveyid]?orgId=...
export async function DELETE(req, { params }) {
  const { projectId, surveyid } = params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  
  if (!orgId) {
    return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
  }

  try {
    // Get current project
    const getRes = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    const project = await getRes.json();
    
    const surveyIds = (project.survey_ids || []).filter(id => id !== surveyid);

    // Update project
    const payload = ENC ? await encryptPayload({ survey_ids: surveyIds }) : { survey_ids: surveyIds };
    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}