import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  const { roleId } = params;
  const { searchParams } = new URL(req.url);

  const res = await fetch(
    `${BASE}/rbac/permissions/roles/${roleId}/permissions`,
    {
      cache: "no-store",
      headers: {
        "x-user-id": searchParams.get("user_id") || "",
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(
    decryptGetResponse ? await decryptGetResponse(data) : data,
    { status: res.status }
  );
}

export async function POST(req, { params }) {
  const { roleId } = params;
  const body = await req.json();

  const res = await fetch(
    `${BASE}/rbac/permissions/roles/${roleId}/permissions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": body.user_id,
      },
      body: JSON.stringify({
        permission_id: body.permission_id,
      }),
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
