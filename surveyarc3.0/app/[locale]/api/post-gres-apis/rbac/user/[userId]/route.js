import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  const { userId } = await params;
  const user_id = userId;
  if (!userId) {
    return NextResponse.json({ detail: "userUid is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BASE}/rbac/user/user_id=${user_id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    return forceDecryptResponse(res);
  } catch (e) {
    return NextResponse.json(
      { detail: "Upstream error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
