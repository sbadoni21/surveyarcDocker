import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

// const BASE =  "http://fastapi-backend:8000";
const BASE =  "http://localhost:8000" ;

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

// export async function GET(req) {
//   const { searchParams } = new URL(req.url);
//   const uid = searchParams.get("uid");
//   const res = await fetch(`${BASE}/users/${uid}`);
//   const encrypted = await res.json();
//   const data = await decryptGetResponse(encrypted);
//   return NextResponse.json(data, { status: res.status });
// }


export async function PATCH(req) {
  const body = await req.json();
  const { uid, ...rest } = body;
  const encryptedBody = await encryptPayload(rest);
  const res = await fetch(`${BASE}/users/${uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encryptedBody),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
