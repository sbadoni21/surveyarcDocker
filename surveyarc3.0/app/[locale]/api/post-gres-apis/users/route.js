// /api/post-gres-apis/users/route.js
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function POST(req) {
  try {
    const body = await req.json();
    const encryptedBody = await encryptPayload(body);
    
    const res = await fetch(`${BASE}/users/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedBody),
      signal: AbortSignal.timeout(30000)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
    
  } catch (error) {
    console.error("POST /users error:", error);
    return NextResponse.json(
      { error: "Failed to create user", message: error.message },
      { status: 500 }
    );
  }
}