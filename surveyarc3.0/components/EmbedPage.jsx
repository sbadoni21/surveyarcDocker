"use client";

import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Copy, Check } from "lucide-react";

export default function EmbedPage() {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  // 🔹 Extract surveyId from URL
  const surveyId = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.split("/");
    return parts.find((p) => p.startsWith("survey_")) || null;
  }, [pathname]);

  const embedUrl = useMemo(() => {
    if (!surveyId || typeof window === "undefined") return "";
    return `${window.location.origin}/en/form?survey_id=${surveyId}&platform=embed`;
  }, [surveyId]);

  const iframeCode = useMemo(() => {
    if (!embedUrl) return "";
    return `<iframe
  src="${embedUrl}"
  width="100%"
  height="700"
  style="border:0; max-width:100%;"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`;
  }, [embedUrl]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!surveyId) {
    return (
      <div className="text-sm text-red-600">
        Survey ID not found in URL
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">Embed Survey</h2>

      {/* Embed URL */}
      <div>
        <label className="block text-sm font-medium mb-1">Embed URL</label>
        <input
          readOnly
          value={embedUrl}
          className="w-full rounded border bg-gray-50 px-3 py-2 text-sm"
        />
      </div>

      {/* Embed Code */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Embed Code (iframe)
        </label>

        <div className="relative">
          <textarea
            readOnly
            rows={6}
            value={iframeCode}
            className="w-full rounded border bg-gray-50 p-3 text-sm font-mono"
          />

          <button
            onClick={copyToClipboard}
            className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Responses collected via embed are anonymous by default.</p>
        <p>• Quotas, logic, and validation still apply.</p>
        <p>• Works on WordPress, Webflow, React, HTML sites.</p>
      </div>
    </div>
  );
}
