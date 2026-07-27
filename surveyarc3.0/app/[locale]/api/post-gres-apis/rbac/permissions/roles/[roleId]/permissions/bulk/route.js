import { NextResponse } from "next/server";

const BASE = process.env.FASTAPI_BASE_URL;

export async function POST(req, { params }) {
  try {
    const { roleId } = await params;
    const body = await req.json();

    console.log("Bulk adding permissions to role:", roleId);
    console.log("Permission IDs:", body.permission_ids);

    const res = await fetch(
      `${BASE}/rbac/permissions/roles/${roleId}/permissions/bulk`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": body.user_id || "",
        },
        body: JSON.stringify({
          permission_ids: body.permission_ids,
        }),
      }
    );

    const data = await res.json();
    
    if (!res.ok) {
      console.error("Bulk add failed:", data);
      return NextResponse.json(data, { status: res.status });
    }

    console.log("Bulk add successful:", data);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Error in bulk add route:", error);
    return NextResponse.json(
      { error: "Internal server error", detail: error.message },
      { status: 500 }
    );
  }
}