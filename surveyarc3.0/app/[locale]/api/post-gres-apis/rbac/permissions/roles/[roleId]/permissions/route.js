import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

// --------------------------------------------------
// GET: list permissions of a role
// --------------------------------------------------
export async function GET(req, { params }) {
  const { roleId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user");

  const res = await fetch(
    `${BASE}/rbac/permissions/roles/${roleId}/permissions?user=${userId}`,
    {
      cache: "no-store",
      headers: {
        "x-user-id": userId || "",
      },
    }
  );

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  // 🔐 decrypt ONLY if encrypted payload
  const output =
    data &&
    typeof data === "object" &&
    data.ciphertext &&
    data.iv &&
    data.tag
      ? await decryptGetResponse(data)
      : data;

  return NextResponse.json(output ?? [], { status: res.status });
}

// --------------------------------------------------
// POST: add permission to role
// --------------------------------------------------
export async function POST(req, { params }) {
  const { roleId } = await params;
  const body = await req.json();

  const res = await fetch(
    `${BASE}/rbac/permissions/roles/${roleId}/permissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": body.user_id || "",
      },
      body: JSON.stringify({
        permission_id: body.permission_id,
      }),
    }
  );

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return NextResponse.json(data ?? {}, { status: res.status });
}
