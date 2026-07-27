import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const res = await fetch(`${BASE}/rbac/permissions/by-module`, {
    cache: "no-store",
    headers: {
      "x-user-id": searchParams.get("user_id") || "",
    },
  });

  const data = await res.json();
  return NextResponse.json(
    decryptGetResponse ? await decryptGetResponse(data) : data,
    { status: res.status }
  );
}
