// /api/post-gres-apis/users/[uid]/route.js
import { decryptGetResponse } from "@/utils/crypto_client";
import { encryptPayload } from "@/utils/crypto_utils";
import { NextResponse } from "next/server";

const BASE = "http://localhost:8000";

export async function GET(req, { params }) {
  const { uid } = await params;
  try {
    
    const res = await fetch(`${BASE}/users/${uid}`, {
      signal: AbortSignal.timeout(30000)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json(errorData, { status: res.status });
    }
    
    const responseData = await res.json();
    
    // Check if response is encrypted
    if (responseData && responseData.iv && responseData.ciphertext && responseData.tag) {
      try {
        const data = await decryptGetResponse(responseData);
        return NextResponse.json(data, { status: res.status });
      } catch (decryptError) {
        console.error("Decryption failed:", decryptError);
        return NextResponse.json(responseData, { status: res.status });
      }
    } else {
      return NextResponse.json(responseData, { status: res.status });
    }
    
  } catch (error) {
    console.error("GET user error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user", message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  const { uid } = params;
  
  try {
    const body = await req.json();
    const encryptedBody = await encryptPayload(body);
    
    const res = await fetch(`${BASE}/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(encryptedBody),
      signal: AbortSignal.timeout(30000)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
    
  } catch (error) {
    console.error("PATCH user error:", error);
    return NextResponse.json(
      { error: "Failed to update user", message: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  const { uid } = params;
  
  try {
    const res = await fetch(`${BASE}/users/${uid}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(30000)
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
    
  } catch (error) {
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user", message: error.message },
      { status: 500 }
    );
  }
}