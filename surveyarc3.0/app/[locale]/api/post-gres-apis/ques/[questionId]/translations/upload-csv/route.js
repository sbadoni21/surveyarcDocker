
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";
const BASE = process.env.FASTAPI_BASE_URL;

export async function POST(req, ctx) {
  const { surveyId } = await ctx.params;
  
  // Get user from cookie
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("currentUserId")?.value;

  if (!currentUserId) {
    return NextResponse.json(
      { error: "Unauthorized: currentUserId cookie missing" },
      { status: 401 }
    );
  }

  try {
    // Get the form data from the request
    const formData = await req.formData();
    
    // Forward the FormData directly to FastAPI
    const res = await fetch(
      `${BASE}/questions/surveys/${encodeURIComponent(surveyId)}/translations/upload-csv`,
      {
        method: "POST",
        headers: {
          "x-user-id": currentUserId,
          // Don't set Content-Type - let fetch handle it for FormData
        },
        body: formData,
      }
    );

    const text = await res.text();
    
    if (!text) {
      return NextResponse.json(null, { status: res.status });
    }

    try {
      const json = JSON.parse(text);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return NextResponse.json({ raw: text }, { status: res.status });
    }
  } catch (error) {
    console.error("CSV Upload Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload CSV" },
      { status: 500 }
    );
  }
}