// app/en/api/invites/accept/route.ts
import { NextResponse } from "next/server";

const BASE_URL = "http://localhost:8000" || "http://fastapi-backend:8000";


async function asJson(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return { _raw: txt }; }
}

export async function POST(req) {
  const body = (await req.json());
  const orgId = String(body?.orgId || "").trim();
  const uid = String(body?.uid || "").trim();
  const email = String(body?.email || "");
  const role = String(body?.role || "member");

  if (!orgId || !uid) {
    return NextResponse.json({ ok: false, error: "orgId and uid are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // 1) Get org (we need current team_members + size)
    const orgRes = await fetch(`${BASE_URL}/organisation/${orgId}`, { cache: "no-store" });
    if (!orgRes.ok) {
      const data = await asJson(orgRes);
      return NextResponse.json({ ok: false, error: "Organisation not found", data }, { status: orgRes.status });
    }
    const org = await orgRes.json();

    const currentTeam = Array.isArray(org.team_members) ? org.team_members : [];
    const idx = currentTeam.findIndex((m) => m?.uid === uid || (!!email && m?.email === email));
    const isNew = idx === -1;

    let nextTeam;
    if (isNew) {
      nextTeam = [
        ...currentTeam,
        { uid, email, role, status: "active", joinedAt: now },
      ];
    } else {
      const prev = currentTeam[idx] || {};
      nextTeam = [...currentTeam];
      nextTeam[idx] = {
        ...prev,
        uid,
        email: email || prev.email,
        role: role || prev.role || "member",
        status: "active",
        joinedAt: prev.joinedAt || now,
      };
    }

    const prevSize = parseInt(org.organisation_size || "0", 10);
    const nextSize = isNaN(prevSize) ? "1" : String(prevSize + (isNew ? 1 : 0));

    // 2) PATCH organisation (your existing endpoint)
    const patchOrgRes = await fetch(`${BASE_URL}/organisation/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_members: nextTeam,
        organisation_size: nextSize,
        updated_at: now,
        last_activity: now,
      }),
    });

    if (!patchOrgRes.ok) {
      const data = await asJson(patchOrgRes);
      return NextResponse.json({ ok: false, error: "Org update failed", data }, { status: patchOrgRes.status });
    }

    // 3) PATCH user (merge orgId into org_ids; your API already unions)
    const patchUserRes = await fetch(`${BASE_URL}/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ org_ids: [String(orgId)] }),
    });

    if (!patchUserRes.ok) {
      // ROLLBACK: remove the member we added
      try {
        const rolledTeam = nextTeam.filter((m) => m?.uid !== uid);
        await fetch(`${BASE_URL}/organisation/${orgId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_members: rolledTeam,
            organisation_size: String(Math.max(isNaN(prevSize) ? 0 : prevSize, 0)),
            updated_at: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.error("Rollback failed:", e);
      }

      const data = await asJson(patchUserRes);
      return NextResponse.json({ ok: false, error: "User update failed", data }, { status: patchUserRes.status });
    }

    const updatedOrg = await asJson(patchOrgRes);
    const updatedUser = await asJson(patchUserRes);

    return NextResponse.json({ ok: true, org: updatedOrg, user: updatedUser }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
