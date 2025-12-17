import { NextResponse } from "next/server";
import { decryptGetResponse } from "@/utils/crypto_client";

const BASE = process.env.FASTAPI_BASE_URL;

export async function GET(req, { params }) {
  const { permissionId } = params;
  const { searchParams } = new URL(req.url);

  const res = await fetch(`${BASE}/rbac/permissions/${permissionId}`, {
    cache: "no-store",
    headers: {
      "x-user-id": searchParams.get("user_id") || "",
    },
  });

  const data = await res.json();
  return NextResponse.json(
    decryptGetResponse ? await decryptGetResponse(data) : data,
    { status: res.status }
  );
}

export async function PUT(req, { params }) {
  const { permissionId } = params;
  const body = await req.json();

  const res = await fetch(`${BASE}/rbac/permissions/${permissionId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": body.user_id,
    },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(req, { params }) {
  const { permissionId } = params;
  const body = await req.json();

  const res = await fetch(`${BASE}/rbac/permissions/${permissionId}`, {
    method: "DELETE",
    headers: {
      "x-user-id": body.user_id,
    },
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
