// app/[locale]/api/post-gres-apis/ques/surveys/[surveyId]/translations/initialize/route.js

import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";

const BASE = process.env.FASTAPI_BASE_URL;

const looksEncrypted = (o) =>
  o &&
  typeof o === "object" &&
  "key_id" in o &&
  "encrypted_key" in o &&
  "ciphertext" in o &&
  "iv" in o &&
  "tag" in o;

export async function POST(req, ctx) {
  const { surveyId } = await ctx.params; // ✅ REQUIRED in Next 15
  const body = await req.json();
   // ✅ Next.js 15 SAFE cookie access
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("currentUserId")?.value;

    if (!currentUserId) {
      return NextResponse.json(
        { status: "error", message: "Unauthorized" },
        { status: 401 }
      );
    }

  const res = await fetch(
    `${BASE}/questions/surveys/${encodeURIComponent(
      surveyId
    )}/translations/initialize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": currentUserId, // ✅ REQUIRED by FastAPI
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const text = await res.text();

  try {
    const json = JSON.parse(text);

    if (looksEncrypted(json)) {
      return NextResponse.json(await decryptGetResponse(json), {
        status: res.status,
      });
    }

    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Invalid backend response", raw: text },
      { status: 500 }
    );
  }
}
