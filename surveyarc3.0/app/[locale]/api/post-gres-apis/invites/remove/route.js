// app/en/api/invites/remove/route.ts
import { NextResponse } from "next/server";
const BASE = process.env.FASTAPI_BASE_URL || "http://localhost:8000";

export async function POST(req) {
  const { orgId, uid } = await req.json();
  if (!orgId || !uid) {
    return NextResponse.json({ ok: false, error: "orgId and uid required" }, { status: 400 });
  }

  const orgRes = await fetch(`${BASE}/organisation/${orgId}`, { cache: "no-store" });
  if (!orgRes.ok) {
    const data = await orgRes.json().catch(() => ({}));
    return NextResponse.json({ ok: false, error: "Organisation not found", data }, { status: orgRes.status });
  }
  const org = await orgRes.json();
  const nextTeam = (org.team_members || []).filter((m) => m?.uid !== uid);

  const res = await fetch(`${BASE}/organisation/${orgId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      team_members: nextTeam,
      organisation_size: String(Math.max(parseInt(org.organisation_size || "1", 10) - 1, 0)),
      updated_at: new Date().toISOString(),
    }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, data }, { status: res.status });
}
