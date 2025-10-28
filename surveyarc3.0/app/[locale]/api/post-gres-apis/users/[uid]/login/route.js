// /api/post-gres-apis/users/[uid]/login/route.js
import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function POST(req, { params }) {
  const { uid } = await params;
  
  try {
    
    const res = await fetch(`${BASE}/users/${uid}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000)
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      return NextResponse.json(errorData, { status: res.status });
    }
    
    const responseData = await res.json();
    return NextResponse.json(responseData, { status: res.status });
    
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Login failed", message: error.message }, 
      { status: 500 }
    );
  }
}