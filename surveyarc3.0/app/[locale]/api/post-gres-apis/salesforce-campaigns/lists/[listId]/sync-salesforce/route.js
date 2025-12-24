import { decryptGetResponse } from "@/utils/crypto_client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

async function forceDecryptResponse(res) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json?.ciphertext) {
      const dec = await decryptGetResponse(json);
      return NextResponse.json(dec, { status: res.status });
    }
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json({ raw: text }, { status: res.status });
  }
}

// POST /api/post-gres-apis/salesforce-campaigns/lists/[listId]/sync-salesforce
export async function POST(req, { params }) {
  const { listId } = await params;
    const cookieStore = await cookies();
    const currentUserId = cookieStore.get("currentUserId")?.value;

  try {
    const res = await fetch(
      `${BASE}/salesforce-campaigns/lists/${encodeURIComponent(
        listId
      )}/sync-salesforce`,
      {
        method: "POST",
        headers:{"x-user-id" : currentUserId},
        signal: AbortSignal.timeout(30000),
      }
    );

    return forceDecryptResponse(res);
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
