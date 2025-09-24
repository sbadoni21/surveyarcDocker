import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";
// const BASE = "http://localhost:8000" || "http://fastapi-backend:8000";
const BASE =  "http://fastapi-backend:8000"|| "http://localhost:8000" ;

export async function GET(req, { params }) {
  const { id } = params;
  console.log(id);
  const res = await fetch(`${BASE}/users/${id}`);
  const encrypted = await res.json();
  const data = await decryptGetResponse(encrypted);
  console.log(data);
  return NextResponse.json(data, { status: res.status });
}
