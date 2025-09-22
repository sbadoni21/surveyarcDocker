"use client";
import React from "react";
import { Building2, Crown, CheckCircle, XCircle } from "lucide-react";
import { Icon } from "@iconify/react";

const OrgAndSubscriptionInfo = ({ data }) => {
  if (!data) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      <div className="lg:col-span-1">
        <div className="p-6 rounded-xl h-full bg-white dark:bg-[#1A1A1E] ">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-[#ED7A13] text-white p-1 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Organization
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex gap-1 items-center">
              <Icon
                icon="mingcute:building-1-line"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow
                  label="Organization Name"
                  value={data?.orgName}
                  isMono
                />
              </div>
            </div>
            <div className="flex gap-1 items-center">
              <Icon
                icon="hugeicons:user"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow label="Owner Email" value={data?.ownerEmail} isMono />
              </div>
            </div>
            <div className="flex gap-1 items-center">
              <Icon
                icon="solar:suitcase-linear"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow
                  label="Business Type"
                  value={data?.businessType}
                  isCapital
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Icon
                icon="uit:calender"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow
                  label="Created"
                  value={
                    data?.createdAt
                      ? new Date(data.createdAt.toDate()).toLocaleString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }
                        )
                      : "N/A"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-1">
        <div className="p-6 rounded-xl h-full bg-white dark:bg-[#1A1A1E]  ">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-[#133020] p-2 rounded-2xl text-white">
              <Crown className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              Subscription
            </h2>
          </div>
          <div className="grid sm:grid-cols-1 gap-2">
            <div className="flex justify-between">
              <div className="space-y-2">
                <p className="text-[#5B596A] text-sm dark:text-[#96949C]">
                  Current Plan
                </p>
                <p className="bg-[#FFF7ED] dark:bg-[#2B3032] rounded-3xl w-fit px-3 text-[#B05B0F] capitalize">
                  {data?.subscription?.plan}
                </p>
              </div>
              <StatusRow
                label="Trial Status"
                active={data?.subscription?.trial?.isActive}
                activeText="Active"
                inactiveText="Inactive"
              />
            </div>
            <div className="flex items-center gap-1">
              <Icon
                icon="uit:calender"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow
                  label="Expires"
                  value={
                    data?.subscription?.endDate
                      ? new Date(
                          data?.subscription?.endDate.toDate()
                        ).toLocaleString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "N/A"
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Icon
                icon="ion:reload-outline"
                width="20"
                height="20"
                className="text-[#5B596A] dark:text-[#96949C]"
              />
              <div className="w-full">
                <InfoRow
                  label="Auto Renewal"
                  active={data?.subscription?.autoRenew}
                  activeText="Enabled"
                  inactiveText="Disabled"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({
  label,
  value,
  isMono = false,
  isCapital = false,
  isHighlight = false,
}) => (
  <div className="flex justify-between items-center">
    <label className="text-sm font-medium text-[#96949C] ">{label}</label>
    <p
      className={`mt-1 text-[#96949C] ${isMono ? " text-sm" : ""} ${
        isCapital ? "capitalize" : ""
      } ${
        isHighlight
          ? "text-lg font-semibold capitalize text-orange-700 dark:text-orange-300"
          : ""
      }`}
    >
      {value || "—"}
    </p>
  </div>
);

const StatusRow = ({ label, active, activeText, inactiveText }) => (
  <div>
    <label className="text-sm font-medium text-[#96949C]">{label}</label>
    <div className="flex items-center gap-2 mt-1">
      {active ? (
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
      )}
      <span className="text-gray-800 dark:text-gray-100">
        {active ? activeText : inactiveText}
      </span>
    </div>
  </div>
);

export default OrgAndSubscriptionInfo;
