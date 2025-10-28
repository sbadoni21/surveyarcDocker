import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";
const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";


export async function POST(req) {
  const body = await req.json();
  const encryptedBody = await encryptPayload(body);
  const res = await fetch(`${BASE}/users/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encryptedBody),

  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}