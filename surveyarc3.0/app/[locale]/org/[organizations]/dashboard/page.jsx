"use client";
import React, { useEffect, useState } from "react";
import { Clock, Crown } from "lucide-react";
import { useOrganisation } from "@/providers/organisationPProvider";
import QuotaUsageGrid from "@/components/QuotaUsageGrid";
import OrgAndSubscriptionInfo from "@/components/OrgAndSubscriptionInfo";
import FeaturesAndCompliance from "@/components/FeaturesAndCompliance";
import { Icon } from "@iconify/react";
import UserAvatar from "@/components/frontend/UseAvatar";
import UpgradePopup from "@/components/UpgradePopup";
import DashboardSkeleton from "@/components/frontend/DashboardSkeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/firebase/firebase";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { setCookie, getCookie } from "cookies-next";

function OrgSwitcher({ currentOrgId }) {
  const router = useRouter();
  const organisationCtx = useOrganisation();
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const uid = getCookie("currentUserId");
        if (!uid) return setLoading(false);

        const userSnap = await getDoc(doc(db, "users", uid));
        const userData = userSnap.exists() ? userSnap.data() : null;
        const orgId = Array.isArray(userData?.orgId) ? userData.orgId : [];

        const details = await Promise.all(
          orgId.map(async (id) => {
            try {
              const snap = await getDoc(doc(db, "organizations", id));
              const data = snap.exists() ? snap.data() : null;
              return { id, name: data?.name || id };
            } catch {
              return { id, name: id };
            }
          })
        );

        const unique = Array.from(
          new Map(details.map((o) => [o.id, o])).values()
        ).sort((a, b) => a.name.localeCompare(b.name));

        setOrgs(unique);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const value = currentOrgId || getCookie("currentOrgId") || "";

  const onChange = (e) => {
    const selected = e.target.value;
    if (!selected) return;

    setCookie("currentOrgId", selected);
    organisationCtx?.setCurrentOrgId?.(selected);
    organisationCtx?.reload?.();

    router.push(`/en/org/${selected}/dashboard`);
  };

  return (
    <div className="w-full sm:w-auto">
      <div className="w-full sm:w-auto">
        {!loading && orgs.length > 0 && (
          <>
            <label className="sr-only">Select organisation</label>
            <select
              disabled={loading || orgs.length === 0}
              className="min-w-[220px] rounded-xl border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-gray-800 dark:text-zinc-100"
              value={value}
              onChange={onChange}
            >
              <option value="" disabled>
                Choose organisation
              </option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const { organisation } = useOrganisation();
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [expired, setExpired] = useState(false);

  /** ---- Subscription Expiry Check ---- */
  useEffect(() => {
    if (!organisation?.uid || !organisation?.subscription?.endDate) return;

    const checkExpiry = async () => {
      const lastCheck = localStorage.getItem("lastSubscriptionCheck");
      const today = new Date().toDateString();

      if (lastCheck === today) return; // only once per day
      localStorage.setItem("lastSubscriptionCheck", today);

      const endDate = new Date(
        (organisation.subscription.endDate?.seconds ?? 0) * 1000
      );
      setCookie("subscriptionEnd", endDate.toISOString(), {
        path: "/", // accessible everywhere
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      const now = new Date();

      if (now > endDate) {
        try {
          const orgRef = doc(db, "organizations", organisation.uid);

          await updateDoc(orgRef, {
            "subscription.trial.isActive": false,
            "subscription.plan": "expired",
            "subscription.expiredAt": serverTimestamp(),
          });

          console.log("Subscription expired, updated in Firestore");
          setExpired(true);
        } catch (err) {
          console.error("Error updating subscription:", err);
        }
      } else {
        setExpired(false);
      }
    };

    checkExpiry();
  }, [organisation]);

  /** ---- Expiry Reminder Emails ---- */
useEffect(() => {
  if (!organisation?.uid || !organisation?.subscription?.endDate) return;

  const endDate = new Date(
    (organisation.subscription.endDate?.seconds ?? 0) * 1000
  );
  const today = new Date();
  const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays > 0 && diffDays <= 3) {
    const lastMailSent = localStorage.getItem("lastExpiryMailSent");
    const todayKey = `${organisation.uid}-${today.toDateString()}`;

    if (lastMailSent !== todayKey) {
      fetch("/api/send-expiry-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: organisation.uid,
          orgName: organisation.name,
          expiryDate: endDate.toISOString(),
          daysRemaining: diffDays,
        }),
      })
        .then(() => {
          console.log("Reminder mail sent for", todayKey);
          localStorage.setItem("lastExpiryMailSent", todayKey);
        })
        .catch((err) => console.error("Mail error:", err));
    }
  }
}, [organisation]);


  if (!organisation) {
    return <DashboardSkeleton />;
  }

  const isExpired =
    expired || organisation?.subscription?.plan === "expired" || false;

  return (
    <div className="min-h-screen">
      <div className="p-6 sm:p-10">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-textPrimary">Dashboard</h1>
            </div>
            <p className="text-lg text-[#5B596A]">
              Welcome to {organisation?.name}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <OrgSwitcher currentOrgId={organisation?.uid} />
            <div className="rounded-full p-2">
              <UserAvatar
                fullName={organisation?.name}
                orgID={organisation?.uid}
              />
            </div>
          </div>
        </div>
        {/* Expiry Reminder Banner - Show in last 3 days */}
        {organisation?.subscription?.endDate &&
          (() => {
            const endDate = new Date(
              (organisation.subscription.endDate?.seconds ?? 0) * 1000
            );
            const today = new Date();
            const diffDays = Math.ceil(
              (endDate - today) / (1000 * 60 * 60 * 24)
            );

            if (diffDays > 0 && diffDays <= 3) {
              return (
                <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-lg">
                  <p className="font-semibold">
                    ⏳ Your subscription will expire on{" "}
                    {endDate.toLocaleDateString("en-GB")} ({diffDays} day
                    {diffDays > 1 ? "s" : ""} remaining).
                  </p>
                  <p>Please renew or upgrade to avoid interruption.</p>
                </div>
              );
            }
            return null;
          })()}

        {/* Subscription Banner */}
        <div
          className="mb-8 flex justify-between items-center p-4 rounded-lg border-l-4 backdrop-blur-sm 
          bg-[#FFF7ED] dark:bg-[#1A1A1E]"
        >
          <div className="flex items-center gap-2">
            {organisation?.subscription?.trial?.isActive && !isExpired ? (
              <div className="bg-[#ED7A13] p-2 rounded-xl">
                <Clock className="w-5 h-5 text-white" />
              </div>
            ) : (
              <Crown className="w-5 h-5 text-green-600" />
            )}
            <div>
              <span className="font-medium text-black dark:text-white">
                {isExpired
                  ? "Subscription Expired"
                  : organisation?.subscription?.trial?.isActive
                  ? `Trial Active - Expires ${new Date(
                      (organisation?.subscription?.endDate?.seconds ?? 0) * 1000
                    ).toLocaleDateString()}`
                  : `${(
                      organisation?.subscription?.plan || ""
                    ).toUpperCase()} Plan Active`}
              </span>
              {organisation?.subscription?.trial?.isActive && !isExpired && (
                <p className="text-[10px] text-[#B05B0F]">
                  Upgrade your plan to use all features
                </p>
              )}
            </div>
          </div>

          {isExpired ? (
            <div
              className="flex gap-1 bg-red-600 py-2 px-3 rounded-lg text-white cursor-pointer"
              onClick={() => setShowUpgradePopup(true)}
            >
              Renew Plan
              <Icon icon="solar:arrow-right-outline" width="24" height="24" />
            </div>
          ) : organisation?.subscription?.trial?.isActive ? (
            <div
              className="flex gap-1 bg-[#ED7A13] py-2 px-3 rounded-lg text-white cursor-pointer"
              onClick={() => setShowUpgradePopup(true)}
            >
              Upgrade now
              <Icon icon="solar:arrow-right-outline" width="24" height="24" />
            </div>
          ) : (
            <span className="font-medium text-black dark:text-white">
              Plan Expires –{" "}
              {new Date(
                (organisation?.subscription?.endDate?.seconds ?? 0) * 1000
              ).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Disable features if expired */}
        {isExpired ? (
          <div className="p-6 bg-red-50 text-red-600 rounded-xl text-center font-semibold">
            Your subscription has expired. Please renew or upgrade your plan to
            continue using features.
          </div>
        ) : (
          <>
            <OrgAndSubscriptionInfo data={organisation} />

            {organisation?.subscription?.quota &&
              organisation?.subscription?.currentUsage && (
                <QuotaUsageGrid
                  quota={organisation.subscription.quota}
                  currentUsage={organisation.subscription.currentUsage}
                  team={organisation.teamMembers}
                />
              )}

            <FeaturesAndCompliance
              features={organisation?.features}
              compliance={organisation?.compliance}
            />
          </>
        )}

        {showUpgradePopup && (
          <UpgradePopup
            onClose={() => setShowUpgradePopup(false)}
            orgData={organisation}
          />
        )}
      </div>
    </div>
  );
}
