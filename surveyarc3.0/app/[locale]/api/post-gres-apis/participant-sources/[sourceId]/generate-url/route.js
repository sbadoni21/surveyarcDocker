// app/[locale]/api/post-gres-apis/participant-sources/[sourceId]/generate-url/route.js
import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;
const ENC = process.env.ENCRYPT_RESPONSES === "1";

export async function GET(req, { params }) {
  const { sourceId } = await params;
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString(); // will include base_url

  try {
    const url = `${BASE}/participant-sources/${sourceId}/generate-url${
      qs ? `?${qs}` : ""
    }`;
    const res = await fetch(url, { method: "GET" });
    const data = ENC ? await decryptGetResponse(res) : await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("GET generate-url error:", err);
    return NextResponse.json(
      { detail: "Failed to generate survey URL" },
      { status: 500 }
    );
  }
}
