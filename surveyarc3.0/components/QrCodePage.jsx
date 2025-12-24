"use client";

import React, { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, Check } from "lucide-react";

export default function SurveyQRCodePage() {
  const pathname = usePathname();
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // 🔹 Extract orgId (4th segment)
  const orgId = pathname.split("/")[3]

  // 🔹 Extract surveyId
  const surveyId = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.split("/");
    return parts.find((p) => p.startsWith("survey_")) || null;
  }, [pathname]);

  // 🔹 Build survey link
  const surveyLink = useMemo(() => {
    if (!surveyId || !orgId || typeof window === "undefined") return "";
    return `${window.location.origin}/en/form?org_id=${orgId}&survey_id=${surveyId}&platform=anonymous`;
  }, [surveyId, orgId]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(surveyLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadQR = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-${surveyId}-qr.png`;
    a.click();
  };

  if (!surveyId || !orgId) {
    return (
      <div className="p-6 text-red-600">
        Required parameters not found in URL
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border shadow-sm p-6 w-full max-w-md space-y-6 text-center">
        <h1 className="text-xl font-semibold">Survey QR Code</h1>

        {/* QR CODE */}
        <div
          ref={canvasRef}
          className="flex justify-center p-4 bg-gray-50 rounded-lg"
        >
          <QRCodeCanvas
            value={surveyLink}
            size={240}
            level="H"
            includeMargin
          />
        </div>

        {/* LINK */}
        <div className="text-xs break-all bg-gray-100 p-3 rounded">
          {surveyLink}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded hover:bg-gray-50"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            {copied ? "Copied" : "Copy link"}
          </button>

          <button
            onClick={downloadQR}
            className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            <Download size={16} />
            Download QR
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Anonymous survey • Org-bound • QR enabled
        </p>
      </div>
    </div>
  );
}
