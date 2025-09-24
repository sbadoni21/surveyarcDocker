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
  const [busy, setBusy] = useState(false);

  const mounted = useRef(true);
  const isSubmittingRef = useRef(false);

  const { create, update, getById } = useOrganisation();

  // Read invite orgId from query (?orgId=...)
  useEffect(() => {
    mounted.current = true;
    const orgId = searchParams.get("orgId");
    if (orgId) {
      setInviteOrgId(String(orgId));
      setStep(1);
    }
    return () => {
      mounted.current = false;
    };
  }, [searchParams]);

  const safeSetState = (fn) => {
    if (mounted.current) fn();
  };

  const goDashboard = (orgId, uid) => {
    // set cookies for downstream app usage
    setCookie("currentUserId", uid, { path: "/" });
    setCookie("currentOrgId", orgId, { path: "/" });
    router.push(`/en/postgres-org/${orgId}/dashboard`);
  };

  /**
   * Accept an invite:
   * 1) Update org team_members on org service
   * 2) Link user -> org via POST /users/{uid}/orgs (atomic on user)
   */
  const acceptInvite = async ({ orgId, uid, email, role = "member" }) => {
    const org = await getById(orgId);
    if (!org?.org_id) throw new Error("Organisation not found");

    const now = new Date().toISOString();

    const currentTeam = Array.isArray(org.team_members) ? [...org.team_members] : [];
    const idx = currentTeam.findIndex(
      (m) => m?.uid === uid || (!!email && m?.email === email)
    );
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

    // A) Update org team state
    const updatedOrg = await update(orgId, {
      team_members: nextTeam,
      organisation_size: nextSize,
      updated_at: now,
      last_activity: now,
    });

    // B) Link user -> org (atomic add; server handles duplicates)
    try {
      await UserModel.addOrg(uid, String(orgId));
    } catch (err) {
      // rollback org member add on failure
      try {
        const rolledTeam = nextTeam.filter((m) => m?.uid !== uid && m?.email !== email);
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

  // Step 1 — Register user and (invite) link to org OR continue to org creation
  const handleRegisterNext = async (data) => {
    if (busy || isSubmittingRef.current) return;
    setBusy(true);
    isSubmittingRef.current = true;

    try {
      safeSetState(() => setUserData(data));

      if (inviteOrgId) {
        // Accept invite (updates org + links user to org)
        await acceptInvite({
          orgId: String(inviteOrgId),
          uid: data.uid,
          email: data.email || "",
          role: "member",
        });

        const org = await getById(inviteOrgId);
        if (!org?.org_id) {
          alert("Invalid or missing organization.");
          return;
        }
        safeSetState(() => setOrgData(org));
        goDashboard(inviteOrgId, data.uid);
        return;
      }

      // No invite: move to org creation
      safeSetState(() => setStep(2));
    } catch (e) {
      console.error("Registration failed:", e);
      const msg = String(e?.message || "Registration failed");
      if (msg.toLowerCase().includes("limit")) {
        alert("❌ You cannot create or join more than 3 organizations.");
      } else {
        alert(msg);
      }
    } finally {
      isSubmittingRef.current = false;
      safeSetState(() => setBusy(false));
    }
  };

  // Step 2 — Create organisation (and link user -> org)
  const handleOrgNext = async (data) => {
    if (busy || isSubmittingRef.current || !userData?.uid) return;
    setBusy(true);
    isSubmittingRef.current = true;

    try {
      // create org (your model seeds owner in team_members)
      const created = await create({
        ...data,
        uid: String(userData.uid),
        ownerUID: userData.uid,
        ownerEmail: userData.email || "",
      });

      // link user -> org (atomic)
      await UserModel.addOrg(userData.uid, String(created.org_id));

      safeSetState(() => {
        setOrgData(created);
        setStep(3);
      });
    } catch (e) {
      console.error("Create org failed:", e);
      alert(String(e?.message || "Failed to create organization"));
    } finally {
      isSubmittingRef.current = false;
      safeSetState(() => setBusy(false));
    }
  };

  // Step 3 — Pick plan, update subscription, redirect
  const handlePricingComplete = async ({ selectedPlan, payment }) => {
    if (busy || isSubmittingRef.current) return;
    setBusy(true);
    isSubmittingRef.current = true;

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

      // TODO: handle paid plans (payment + subscription update)
      goDashboard(orgId, userData.uid);
    } catch (error) {
      console.error("Pricing completion failed:", error);
      alert("Something went wrong while completing your registration. Please try again.");
    } finally {
      isSubmittingRef.current = false;
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
        <OrganizationPage
          onNext={handleOrgNext}
          onBack={handleBack}
          busy={busy}
          submitLabel={submitLabel}
        />
      )}

      {step === 3 && (
        <PricingPage
          onBack={handleBack}
          onComplete={handlePricingComplete}
          busy={busy}
          submitLabel={submitLabel}
        />
      )}
    </div>
  );
}
