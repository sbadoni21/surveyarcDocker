// app/api/post-gres-apis/projects/[projectId]/surveys/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";

const BASE = process.env.FASTAPI_BASE_URL;
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

export async function GET(req, { params }) {
  const { projectId } = await params;
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const userId = searchParams.get("userId") ; // ✅ FIXED
  
  if (!orgId) {
    return NextResponse.json({ detail: "orgId is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
      headers: { "x-user-id": userId },
    });
    
    const project = await res.json();
    return NextResponse.json(project.survey_ids || [], { status: res.status });
  } catch (e) {
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { projectId } = await params;
  
  try {
    const raw = await req.json();
    const { orgId, surveyId, user_id } = raw; // ✅ EXTRACT user_id
    const userId = user_id ;

    if (!orgId || !surveyId) {
      return NextResponse.json({ detail: "orgId and surveyId are required" }, { status: 400 });
    }

    const qs = new URLSearchParams({ use_cache: "false" });
    const getRes = await fetch(`${BASE}/projects/${orgId}/${projectId}?${qs.toString()}`, {
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
      headers: { "x-user-id": userId },
    });

    if (!getRes.ok) {
      const errorText = await getRes.text();
      return NextResponse.json({ detail: "Failed to fetch project", error: errorText }, { status: getRes.status });
    }

    const projectData = await getRes.json();
    const currentSurveyIds = Array.isArray(projectData.survey_ids) ? projectData.survey_ids : [];
    
    if (currentSurveyIds.includes(surveyId)) {
      return NextResponse.json(projectData);
    }

    const updatedSurveyIds = [...currentSurveyIds, surveyId];

    const payload = ENC ? await encryptPayload({ survey_ids: updatedSurveyIds }) : { survey_ids: updatedSurveyIds };
    const res = await fetch(`${BASE}/projects/${orgId}/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-user-id": userId, ...(ENC ? { "x-encrypted": "1" } : {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
      cache: "no-store",
    });
    
    return forceDecryptResponse(res);
  } catch (e) {
    console.error("[Surveys POST] Error:", e);
    return NextResponse.json({ detail: "Upstream error", message: String(e?.message || e) }, { status: 500 });
  }
}
