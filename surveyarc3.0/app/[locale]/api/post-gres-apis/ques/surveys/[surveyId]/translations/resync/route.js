// app/[locale]/api/post-gres-apis/ques/surveys/[surveyId]/translations/resync/route.js

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptGetResponse } from "@/utils/crypto_client";

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
  const { surveyId } = await ctx.params;

  // 🍪 Read user id from cookie
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get("currentUserId")?.value;

  if (!currentUserId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const res = await fetch(
    `${BASE}/questions/surveys/${encodeURIComponent(
      surveyId
    )}/translations/resync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": currentUserId,
      },
      cache: "no-store",
    }
  );

  const text = await res.text();

  try {
    const json = JSON.parse(text);

    // 🔐 Handle encrypted backend response
    if (looksEncrypted(json)) {
      const decrypted = await decryptGetResponse(json);
      return NextResponse.json(decrypted, { status: res.status });
    }

    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid backend response",
        raw: text,
      },
      { status: 500 }
    );
  }
}
