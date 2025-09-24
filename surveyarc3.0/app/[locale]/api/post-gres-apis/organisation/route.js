import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

// const BASE = "http://fastapi-backend:8000";
const BASE =  "http://fastapi-backend:8000"|| "http://localhost:8000" ;

export async function POST(req) {
  const body = await req.json();
  const encryptedBody = await encryptPayload(body);
  const res = await fetch(`${BASE}/organisation/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encryptedBody),
  });
  const encrypted = await res.json();
  console.log("encrypted", encrypted);
  return NextResponse.json(encrypted, { status: res.status });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  const res = await fetch(`${BASE}/organisation/${orgId}`);
  const encrypted = await res.json();
  const data = await decryptGetResponse(encrypted);
  console.log("Get decrypted", data);
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req) {
  const body = await req.json();
  const { orgId, ...rest } = body;
  const encryptedBody = await encryptPayload(rest);
  const res = await fetch(`${BASE}/organisation/${orgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encryptedBody),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
