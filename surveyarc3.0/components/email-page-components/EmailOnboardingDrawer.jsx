// components/email/EmailOnboardingDrawer.jsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle,
  Circle,
  X,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";

const EXPECTED_FROM_NAME = "Appinfolgoic";

/** Small helper to find the /email base in any nested path */
function useEmailBasePath() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);
  const emailIdx = segs.lastIndexOf("email");
  const base =
    emailIdx >= 0 ? "/" + segs.slice(0, emailIdx + 1).join("/") : "/email";
  return base;
}

export default function EmailOnboardingDrawer({ open, onClose }) {
  const { orgId } = useRouteParams();
  const emailBase = useEmailBasePath();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");

  // computed flags
  const [hasEmailConfig, setHasEmailConfig] = useState(false);
  const [senderVerified, setSenderVerified] = useState(false);
  const [hasPublishedTemplate, setHasPublishedTemplate] = useState(false);
  const [hasContactsAndList, setHasContactsAndList] = useState(false);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [firstCampaignLaunched, setFirstCampaignLaunched] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError("");

    try {
      // 1) Org doc
      const orgRef = doc(db, "organizations", orgId);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) throw new Error("Organization not found");
      const orgData = orgSnap.data();
      setOrg(orgData);

      // STEP 1: Email configuration present & strict fromName
      const configs = Array.isArray(orgData.emailConfigurations)
        ? orgData.emailConfigurations
        : [];
      const hasConfig = configs.length > 0;
      const fromNameOk =
        hasConfig &&
        configs.some(
          (c) =>
            String(c?.fromName || "").trim().toLowerCase() ===
            EXPECTED_FROM_NAME.toLowerCase()
        );
      setHasEmailConfig(hasConfig);
      setSenderVerified(fromNameOk);

      // STEP 2: Published template exists
      const templateQ = query(
        collection(db, "organizations", orgId, "templates"),
        where("status", "==", "published"),
        limit(1)
      );
      const templateSnap = await getDocs(templateQ);
      setHasPublishedTemplate(!templateSnap.empty);

      // STEP 3: Contacts uploaded & list built (any list with at least 1 contact)
      const listsSnap = await getDocs(
        collection(db, "organizations", orgId, "lists")
      );
      let listsOk = false;
      listsSnap.forEach((d) => {
        const v = d.data();
        if (Array.isArray(v?.contactIds) && v.contactIds.length > 0) {
          listsOk = true;
        }
      });
      setHasContactsAndList(listsOk);

      // STEP 4: Test email sent (prefer org.onboarding flag; fallback to events)
      const testFlag = Boolean(orgData?.onboarding?.testEmailSent);
      if (!testFlag) {
        // optional: try detect via activity events (if you log them)
        // const eventsQ = query(
        //   collection(db, "organizations", orgId, "events"),
        //   where("type", "==", "test_email_sent"),
        //   limit(1),
        // );
        // const evSnap = await getDocs(eventsQ);
        // setTestEmailSent(testFlag || !evSnap.empty);
        setTestEmailSent(false);
      } else {
        setTestEmailSent(true);
      }

      // STEP 5: First campaign launched (any campaign doc exists)
      const campSnap = await getDocs(
        collection(db, "organizations", orgId, "campaigns")
      );
      setFirstCampaignLaunched(!campSnap.empty);
    } catch (e) {
      setError(e.message || "Failed to load onboarding status");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Steps config
  const steps = useMemo(
    () => [
      {
        id: "config",
        title: "Add at least one Email Configuration (and verify sender).",
        done: hasEmailConfig && senderVerified,
        warn:
          hasEmailConfig && !senderVerified
            ? `Your default "fromName" must be "${EXPECTED_FROM_NAME}".`
            : null,
        link: `${emailBase}/config`,
        cta: hasEmailConfig ? "Fix From Name" : "Add Configuration",
      },
      {
        id: "templates",
        title: "Create/import a Template and publish it.",
        done: hasPublishedTemplate,
        link: `${emailBase}/templates`,
        cta: hasPublishedTemplate ? "View Templates" : "Create Template",
      },
      {
        id: "contacts",
        title: "Upload Contacts and build a list.",
        done: hasContactsAndList,
        link: `${emailBase}/contacts`,
        cta: hasContactsAndList ? "View Lists" : "Upload Contacts",
      },
      {
        id: "test",
        title: "Send a Test Email (from Templates or Campaigns).",
        done: testEmailSent,
        link: `${emailBase}/templates?openTest=1`,
        cta: testEmailSent ? "Send Another Test" : "Send Test",
        markable: true,
      },
      {
        id: "campaigns",
        title: "Launch your First Campaign.",
        done: firstCampaignLaunched,
        link: `${emailBase}/campaigns?new=1`,
        cta: firstCampaignLaunched ? "View Campaigns" : "Create Campaign",
      },
    ],
    [
      emailBase,
      hasEmailConfig,
      senderVerified,
      hasPublishedTemplate,
      hasContactsAndList,
      testEmailSent,
      firstCampaignLaunched,
    ]
  );

  const completedCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) || steps[steps.length - 1];

  async function markTestEmailDone() {
    if (!orgId) return;
    try {
      await updateDoc(doc(db, "organizations", orgId), {
        onboarding: {
          ...(org?.onboarding || {}),
          testEmailSent: true,
          lastStepAt: new Date(),
        },
      });
      setTestEmailSent(true);
    } catch (e) {
      setError(e.message || "Failed to update onboarding");
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* overlay */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      {/* drawer */}
      <aside
        className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white dark:bg-[#111214] shadow-xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Email onboarding checklist"
      >
        {/* header */}
        <div className="p-4 border-b border-gray-200/70 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Onboarding</div>
            <h2 className="text-xl font-semibold">
              Email Setup Checklist ({completedCount}/{steps.length})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* progress dots */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-3">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    s.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                  title={s.title}
                >
                  {s.done ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-[2px] bg-gray-200 dark:bg-zinc-800" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* content */}
        <div className="px-5 pb-24 overflow-y-auto h-[calc(100%-9rem)]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading checklist…
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          ) : (
            <ul className="space-y-4">
              {steps.map((s) => (
                <li
                  key={s.id}
                  className="p-4 rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#121316]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {s.done ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{s.title}</div>
                      {s.warn && (
                        <div className="mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 text-xs flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                          <span>{s.warn}</span>
                        </div>
                      )}
                      {/* Special handler to mark test email as done if you can't auto-detect */}
                      {s.id === "test" && !s.done && (
                        <div className="mt-3">
                          <button
                            onClick={markTestEmailDone}
                            className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
                          >
                            I’ve sent a test email
                          </button>
                        </div>
                      )}
                    </div>
                    <Link
                      href={s.link}
                      className={`ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium ${
                        s.done
                          ? "border hover:bg-gray-50"
                          : "bg-[#ED7A13] text-white hover:opacity-90"
                      }`}
                    >
                      {s.cta}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* footer (Do next) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200/70 dark:border-zinc-800 bg-white dark:bg-[#111214]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Next up:
              <span className="ml-1 font-medium">
                {nextStep?.title || "All done 🎉"}
              </span>
            </div>
            {nextStep ? (
              <Link
                href={nextStep.link}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ED7A13] text-white hover:opacity-90"
                onClick={onClose}
              >
                Do next
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border hover:bg-gray-50"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
