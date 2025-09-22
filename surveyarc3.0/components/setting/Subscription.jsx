"use client";
import React from "react";
import { FaArrowUp } from "react-icons/fa";
import { useOrganisation } from "@/providers/organisationPProvider";
import { Icon } from "@iconify/react";

export default function Subscription() {
  const { organisation } = useOrganisation();

  const subscription = organisation?.subscription;

  if (!subscription) {
    return (
      <div className="text-center text-slate-500">
        Subscription details not available.
      </div>
    );
  }

  const { currentUsage, quota, startDate, endDate, plan } = subscription;

  const usageData = [
    {
      label: "Surveys created",
      current: currentUsage?.surveys ?? 0,
      total: quota?.surveys ?? 0,
    },
    {
      label: "Responses",
      current: currentUsage?.responses ?? 0,
      total: quota?.responses ?? 0,
    },
    {
      label: "Team members",
      current: currentUsage?.teamMembers ?? 0,
      total: quota?.teamMembers ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border dark:border-[#96949C3B] dark:bg-[#1A1A1E] border-slate-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold dark:text-[#CBC9DE] text-black">Current plan</h2>
            <p className="text-xl text-black dark:text-[#96949C] font-medium mt-1.5">
              {plan || "Free"}
            </p>
            <p className="text-xs dark:text-[#5B596A] text-[#8C8A97]">Active subscription</p>
          </div>
          {/* <button className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-3 px-6 rounded-md flex items-center gap-2">
            <FaArrowUp className="text-sm" />
            Upgrade plan
          </button> */}
        </div>
        <hr className="mt-5" />
        <div className="flex gap-x-32 text-sm dark:text-[#96949C] mt-6">
          <div>
            <div className="flex items-center text-black dark:text-[#5B596A] gap-2">
              <Icon icon="akar-icons:calendar" width="12" height="12" />
              <p className="text-xs font-medium">Started</p>
            </div>
            <p className="font-medium text-sm mt-1">
              {startDate
                ? startDate.toDate().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "-"}
            </p>
          </div>
          <div>
            <div className="flex items-center text-black dark:text-[#96949C] gap-2">
              <Icon icon="akar-icons:calendar" width="12" height="12" />
              <p className="text-xs font-medium">Renewal</p>
            </div>
            <p className="font-medium text-sm mt-1">
              {endDate
                ? endDate.toDate().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "-"}
            </p>
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="bg-white dark:bg-[#1A1A1E] dark:border-[#96949C3B] dark:text-[#CBC9DE] rounded-xl p-6 shadow-sm border border-slate-200 space-y-5">
        <h2 className="text-2xl text-black dark:text-[#CBC9DE] font-semibold">Usage</h2>

        {usageData.map(({ label, current, total }) => {
          const percent =
            total > 0 ? Math.min((current / total) * 100, 100) : 0;
          return (
            <div key={label}>
              <div className="flex dark:text-[#96949C] justify-between text-black text-xs mb-1">
                <span>{label}</span>
                <span>
                  {current}/{total}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full">
                <div
                  className="h-2 bg-orange-600 dark:bg-[#BDAD99] rounded-full"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Billing Info */}
      {/* <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
        <h2 className="text-2xl font-semibold text-black">
          Billing information
        </h2>

        <div className="flex gap-32 text-sm mt-5 text-black">
          <div>
            <p className="text-black">Card ending</p>
            <p className="font-medium mt-1">******2231</p>
          </div>
          <div>
            <p className="text-black">Next Billing</p>
            <p className="font-medium mt-1">
              {endDate
                ? endDate.toDate().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "-"}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-3 px-4 rounded-md">
            Update billing details
          </button>
        </div>
      </div> */}
    </div>
  );
}
