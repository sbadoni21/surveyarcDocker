"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import RegisterPage from "@/page/postgres-pages/RegisterPage";
import OrganizationPage from "@/page/postgres-pages/OrganizationPage";
import PricingPage from "@/page/PricingPage.jsx";
import { setCookie } from "cookies-next";
import UserModel from "@/models/postGresModels/userModel";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";

export default function RegistrationFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userData, setUserData] = useState(null);
  const [orgData, setOrgData] = useState(null);
  const [inviteOrgId, setInviteOrgId] = useState(null);
  const { create, update, getById } = useOrganisation();

  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const orgId = searchParams.get("orgId");
    if (orgId) {
      setInviteOrgId(orgId);
      setStep(1);
    }
    return () => {
      mounted.current = false;
    };
  }, [searchParams]);

  const safeSetState = (fn) => mounted.current && fn();

  const goDashboard = (orgId, uid) => {
    setCookie("currentUserId", uid);
    setCookie("currentOrgId", orgId);
    router.push(`/en/postgres-org/${orgId}/dashboard`);
  };

  const acceptInvite = async ({ orgId, uid, email, role = "member" }) => {
    const org = await getById(orgId);
    if (!org?.org_id) throw new Error("Organisation not found");

    const now = new Date().toISOString();
    const currentTeam = Array.isArray(org.team_members) ? [...org.team_members] : [];
    const idx = currentTeam.findIndex((m) => m?.uid === uid || (!!email && m?.email === email));
    const isNew = idx === -1;

    let nextTeam;
    if (isNew) {
      nextTeam = [
        ...currentTeam,
        { uid, email: email || "", role, status: "active", joinedAt: now },
      ];
    } else {
      const prev = currentTeam[idx] || {};
      nextTeam = [...currentTeam];
      nextTeam[idx] = {
        ...prev,
        uid,
        email: email || prev.email || "",
        role: role || prev.role || "member",
        status: "active",
        joinedAt: prev.joinedAt || now,
      };
    }

    const prevSize = parseInt(org.organisation_size || "0", 10);
    const nextSize = String((isNaN(prevSize) ? 0 : prevSize) + (isNew ? 1 : 0));

    // Step A: update org
    const updatedOrg = await update(orgId, {
      team_members: nextTeam,
      organisation_size: nextSize,
      updated_at: now,
      last_activity: now,
    });

    // Step B: update user (server merges org_ids)
    try {
      await UserModel.update(uid, { org_ids: [String(orgId)] });
    } catch (err) {
      // rollback org member add
      try {
        const rolledTeam = nextTeam.filter((m) => m?.uid !== uid);
        await update(orgId, {
          team_members: rolledTeam,
          organisation_size: String(Math.max(isNaN(prevSize) ? 0 : prevSize, 0)),
          updated_at: new Date().toISOString(),
        });
      } catch (rb) {
        console.error("Rollback failed:", rb);
      }
      throw err;
    }

    return updatedOrg;
  };

  // Step 1 — Register user and link to org (invite or self-org)
  const handleRegisterNext = async (data) => {
    if (busy) return;
    setBusy(true);

    try {
      setUserData(data);

      if (inviteOrgId) {
        // Accept invite using org.update + user.update only
        await acceptInvite({
          orgId: String(inviteOrgId),
          uid: data.uid,
          email: data.email || "",
          role: "member",
        });

        const org = await getById(inviteOrgId);
        if (!org || !org.org_id) {
          alert("Invalid or missing organization.");
          return;
        }
        safeSetState(() => setOrgData(org));
        goDashboard(inviteOrgId, data.uid);
        return;
      }

      // No invite: continue to org creation
      safeSetState(() => setStep(2));
    } catch (e) {
      console.error("Registration failed:", e);
      const msg = String(e?.message || "Registration failed");
      if (msg.includes("limit")) {
        alert("❌ You cannot create or join more than 3 organizations.");
      } else {
        alert(msg);
      }
    } finally {
      safeSetState(() => setBusy(false));
    }
  };

  // Step 2 — Create organisation (server will set defaults)
  const handleOrgNext = async (data) => {
    if (busy || !userData?.uid) return;
    setBusy(true);

    try {
      // your organisationModel.create already seeds owner into team_members
      const created = await create({
        ...data,
        uid: String(userData.uid),        // org_id = uid inside model.defaultData
        ownerUID: userData.uid,
        ownerEmail: userData.email || "",
      });

      safeSetState(() => {
        setOrgData(created);
        setStep(3);
      });
    } catch (e) {
      console.error("Create org failed:", e);
      alert(String(e?.message || "Failed to create organization"));
    } finally {
      safeSetState(() => setBusy(false));
    }
  };

  // Step 3 — Pick plan, (optionally) record payment, update subscription, redirect
  const handlePricingComplete = async ({ selectedPlan, payment }) => {
    if (busy) return;
    setBusy(true);

    try {
      const orgId = String(orgData?.org_id || userData?.uid);
      const now = new Date().toISOString();
      const endsAt = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
      if (!orgId || !userData?.uid) {
        alert("Missing user/org context.");
        return;
      }

      if (selectedPlan === "free") {
        await update(orgId, {
          subscription: {
            plan: "free",
            renewalType: "none",
            startDate: now,
            endDate: endsAt,
            autoRenew: true,
            trial: { isActive: true, endsAt },
            quota: { responses: 1000, surveys: 10, teamMembers: 5 },
            currentUsage: { responses: 0, surveys: 0, teamMembers: 1 },
          },
          business_type: "small",
        });
        goDashboard(orgId, userData.uid);
        return;
      }

      // (Optional) handle paid plans here (paymentApi/orgApi)…
      goDashboard(orgId, userData.uid);
    } catch (error) {
      console.error("Pricing completion failed:", error);
      alert("Something went wrong while completing your registration. Please try again.");
    } finally {
      safeSetState(() => setBusy(false));
    }
  };

  const handleBack = () => setStep((prev) => Math.max(1, prev - 1));
  const submitLabel = useMemo(() => (busy ? "Please wait…" : "Continue"), [busy]);

  return (
    <div>
      {step === 1 && (
        <RegisterPage onNext={handleRegisterNext} busy={busy} submitLabel={submitLabel} />
      )}

      {step === 2 && !inviteOrgId && (
        <OrganizationPage onNext={handleOrgNext} onBack={handleBack} busy={busy} submitLabel={submitLabel} />
      )}

      {step === 3 && (
        <PricingPage onBack={handleBack} onComplete={handlePricingComplete} busy={busy} submitLabel={submitLabel} />
      )}
    </div>
  );
}
