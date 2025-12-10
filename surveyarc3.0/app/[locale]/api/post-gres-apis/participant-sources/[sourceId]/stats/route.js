// app/[locale]/api/post-gres-apis/participant-sources/[sourceId]/stats/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

export async function GET(req, { params }) {
  const { sourceId } = await params;

  try {
    const res = await fetch(`${BASE}/participant-sources/${sourceId}/stats`, {
      method: "GET",
    });
    const data = ENC ? await decryptGetResponse(res) : await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET participant-source stats error:", err);
    return NextResponse.json(
      { detail: "Failed to fetch participant source stats" },
      { status: 500 }
    );
  }
}
