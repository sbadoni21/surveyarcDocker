"use client";
import React, { useState } from "react";
import AnonymousLinkPage from "@/components/AnonymousLinkPage";
import EmbedPage from "@/components/EmbedPage";
import SocialPage from "@/components/SocialPage";
import CampaignPage from "./CampaignPage";
import SurveyQRCodePage from "@/components/QrCodePage";

const distributionMethods = [
  { id: "email", label: "Email" },
  { id: "anonymous", label: "Anonymous Link" },
  { id: "embed", label: "Embed Code" },
  // { id: "social", label: "Social Media" },
  { id: "qr", label: "QR Code" }
];

export default function DistributionPage() {
  const [selectedMethod, setSelectedMethod] = useState("email");

  // Choose which detail page to render
  const renderDetailPage = () => {
    switch (selectedMethod) {
      case "email":
        return <CampaignPage />;
      case "anonymous":
        return <AnonymousLinkPage />;
      // case "whatsapp":
      //   return <WhatsappDistributionPage />;
      case "embed":
        return <EmbedPage />;
      // case "social":
      //   return <SocialPage />;
      // case "sms":
      //   return <SmsPage />;
      case "qr":
        return <SurveyQRCodePage />;
      default:
        return <div>Select a distribution method.</div>;
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/8 bg-gray-100 p-4 border-r">
        <h2 className="text-lg font-semibold mb-4">Distribution Methods</h2>
        <ul className="space-y-2">
          {distributionMethods.map((method) => (
            <li key={method.id}>
              <button
                onClick={() => setSelectedMethod(method.id)}
                className={`w-full text-left px-4 py-2 rounded text-xs
                  ${selectedMethod === method.id ? "bg-blue-500 text-white" : "hover:bg-gray-200"}`}
              >
                {method.label}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Details Panel */}
      <div className="flex-1 p-6">
        <h2 className="text-xl font-semibold mb-4">
          {distributionMethods.find((m) => m.id === selectedMethod)?.label} Details
        </h2>
        <div className="bg-white border rounded p-4 shadow">
          {renderDetailPage()}
        </div>
      </div>
    </div>
  );
}
