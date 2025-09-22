"use client";
import React from "react";
import { CheckCircle, XCircle, Calendar, Zap, Shield } from "lucide-react";
import { FaCheck } from "react-icons/fa";
import { RxCross1 } from "react-icons/rx";
import { IoCheckmark } from "react-icons/io5";
import { LuCheck } from "react-icons/lu";

const complianceLabels = {
  ccpa: "CCPA",
  gdpr: "GDPR",
  iso27001: "ISO27001",
  lastAuditDate: "Last audit date",
};

const formatTimestamp = (timestamp) => {
  if (!timestamp?.seconds) return "N/A";
  return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
    day: "numeric",
    month: "numeric",
    year: "2-digit",
  });
};

const formatFeatureName = (feature) => {
  return feature
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
};

const FeaturesAndCompliance = ({ features = {}, compliance = {} }) => {
  return (
    <div className="grid lg:grid-cols-2 gap-6 my-8">
      <div className="p-6 rounded-xl bg-white dark:bg-[#1A1A1E]">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#810050] p-2 rounded-md">
            <Zap className="w-3 h-3 text-white" />
          </div>
          <h2 className="font-semibold text-gray-800 dark:text-[#CBC9DE]">
            Features
          </h2>
        </div>
        <div className="space-y-3 mt-8">
          {Object.entries(features).map(([key, enabled]) => (
            <div
              key={key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700 dark:text-[#96949C] font-medium">
                {formatFeatureName(key)}
              </span>
              <span
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                  enabled
                    ? "bg-green-100 dark:bg-[#2B3336] text-green-700"
                    : "bg-red-100 dark:bg-[#473434] text-red-700"
                }`}
              >
                {enabled ? (
                  <>
                    <LuCheck className="w-4 h-4" />
                    Enabled
                  </>
                ) : (
                  <>
                    <RxCross1 className="w-3.5 h-3.5" />
                    Disabled
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 rounded-xl bg-white dark:bg-[#1A1A1E]">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-[#133020] p-2 rounded-lg w-fit">
            <Shield className="text-white w-3 h-3" />
          </div>
          <h2 className="font-semibold text-gray-800 dark:text-[#CBC9DE]">
            Compliance
          </h2>
        </div>
        <div className="space-y-3 mt-8">
          {Object.entries(compliance).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-gray-700 dark:text-[#96949C] font-medium">
                {complianceLabels[key] || key}
              </span>
              {key === "lastAuditDate" ? (
                <span className="flex items-center gap-1 bg-blue-100 dark:bg-[#2B3336] text-blue-700 w-24 justify-center py-1 flex-row rounded-full text-xs font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatTimestamp(value)}
                </span>
              ) : value ? (
                <span className="flex items-center gap-1 bg-green-100 dark:bg-[#2B3336] text-green-700 w-24 justify-center py-1 flex-row rounded-full text-xs font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Compliant
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-red-100 dark:bg-[#473434] text-red-700 w-24 justify-center py-1 flex-row rounded-full text-xs font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Disabled
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturesAndCompliance;
