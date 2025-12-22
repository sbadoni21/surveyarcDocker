"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Copy } from "lucide-react";

export default function AnonymousLinkPage() {
  const pathname = usePathname();
  const orgId = pathname.split("/")[3]

  // 🔹 Extract surveyId from URL
  const surveyId = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.split("/");
    return parts.find((p) => p.startsWith("survey_")) || null;
  }, [pathname]);

  // 🔹 Build anonymous link
  const anonymousLink = useMemo(() => {
    if (!surveyId) return "";
    return `${window.location.origin}/en/form?survey_id=${surveyId}&org_id=${orgId}&platform=anonymous`;
  }, [surveyId]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(anonymousLink);
      alert("Anonymous link copied!");
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  if (!surveyId) {
    return (
      <div className="text-sm text-red-600">
        Survey ID not found in URL
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-lg font-semibold">Anonymous Survey Link</h2>

      <div className="flex items-center gap-2 rounded-md border bg-gray-50 p-3">
        <input
          type="text"
          readOnly
          value={anonymousLink}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 rounded bg-black px-3 py-1.5 text-sm text-white hover:bg-gray-800"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Anyone with this link can submit responses anonymously.
      </p>
    </div>
  );
}
