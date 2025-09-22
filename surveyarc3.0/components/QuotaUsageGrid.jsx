"use client";
import React from "react";
import { MessageSquare, TrendingUp, CalendarDays } from "lucide-react";
import { FaUsers } from "react-icons/fa";
import { FiCheckCircle } from "react-icons/fi";
import { MdOutlineMailOutline } from "react-icons/md";

const ICONS = [MessageSquare, TrendingUp, FaUsers];
const ICON_BG_CLASSES = ["bg-[#2F70F0]", "bg-[#327039]", "bg-[#ED7A13]"];

const QuotaUsageGrid = ({ quota = {}, currentUsage = {}, team = [] }) => {
  if (!quota || !currentUsage) return null;

  const quotaEntries = Object.entries(quota).filter(
    ([key]) => key !== "teamMembers" && key !== "surveys"
  );

  const teamLimit = quota?.teamMembers ?? 5;
  const teamUsed = team.length;
  const teamUsagePercent = teamLimit === 0 ? 0 : (teamUsed / teamLimit) * 100;

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        {quotaEntries.map(([key, value], index) => {
          const current = currentUsage[key] ?? 0;
          const percentage = value === 0 ? 0 : (current / value) * 100;
          const IconComponent = ICONS[index] || TrendingUp;
          const bgClass = ICON_BG_CLASSES[index] || "bg-gray-500";

          return (
            <div
              key={key}
              className="p-6 rounded-xl  bg-white dark:bg-[#1A1A1E]"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-2 rounded-md ${bgClass}`}>
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-medium capitalize text-gray-600 dark:text-[#B6BAC3]">
                  {key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}
                </span>
                <span className="ml-auto text-xs text-gray-500 dark:text-[#96949C]">
                  {percentage.toFixed(0)}% used
                </span>
              </div>

              <div className=" font-semibold text-gray-900 dark:text-[#B6BAC3] text-left mb-2">
                {current}
                <span className="text-xs text-gray-500 dark:text-[#96949C]">
                  {" "}
                  / {value}
                </span>
              </div>

              <div className="w-full bg-gray-200/60 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor:
                      percentage > 90
                        ? "#dc2626"
                        : percentage > 70
                        ? "#f59e0b"
                        : "var(--primary)",
                  }}
                />
              </div>
            </div>
          );
        })}

        <div className="p-6 rounded-xl bg-white dark:bg-[#1A1A1E]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 rounded-md bg-[#2F70F0]">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-medium capitalize text-gray-600 dark:text-[#B6BAC3]">
              Surveys Created
            </span>
            <span className="ml-auto text-xs text-gray-500 dark:text-[#96949C]">
              {quota?.surveys
                ? `${((currentUsage.surveys / quota.surveys) * 100).toFixed(
                    (currentUsage.surveys / quota.surveys) * 100 >= 1 ? 0 : 2
                  )}% used`
                : "0% used"}
            </span>
          </div>

          <div className="font-semibold text-gray-900 dark:text-[#B6BAC3] text-left mb-2">
            {currentUsage.surveys}
            <span className="text-xs text-gray-500 dark:text-[#96949C]">
              {" "}
              / {quota?.surveys ?? 0}
            </span>
          </div>

          <div className="w-full bg-gray-200/60 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  quota?.surveys
                    ? Math.min(
                        (currentUsage.surveys / quota.surveys) * 100,
                        100
                      )
                    : 0
                }%`,
                backgroundColor:
                  quota?.surveys && currentUsage.surveys / quota.surveys > 0.9
                    ? "#dc2626"
                    : currentUsage.surveys / quota?.surveys > 0.7
                    ? "#f59e0b"
                    : "var(--primary)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-white dark:bg-[#1A1A1E]">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 rounded-md bg-[#ED7A13]">
            <FaUsers className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Team Members
          </span>
          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
            {teamUsagePercent.toFixed(0)}% used
          </span>
        </div>

        <div className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          {teamUsed}
          <span className="text-base text-gray-500 dark:text-gray-300">
            {" "}
            / {teamLimit}
          </span>
        </div>

        <div className="w-full bg-gray-200/60 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div
            className="h-2 rounded-full block dark:hidden"
            style={{
              width: `${teamUsagePercent}%`,
              backgroundImage: "linear-gradient(to right, black, #ED7A13)",
            }}
          />

          <div
            className="h-2 rounded-full hidden dark:block"
            style={{
              width: `${teamUsagePercent}%`,
              backgroundColor: "#BDAD99",
            }}
          />
        </div>

        {team.map((member, index) => {
          const initials = member.name
            ? member.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
            : member.email[0].toUpperCase();

          const displayName = member.name ?? member.email.split("@")[0];
          const joinedDate = new Date(member.joinedAt?.seconds * 1000);
          const formattedDate = joinedDate.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });

          return (
            <div
              key={member.uid}
              className="flex items-center justify-between py-3"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                    ["bg-purple-500", "bg-orange-500", "bg-blue-500"][index % 3]
                  }`}
                >
                  {initials}
                </div>
                <div className="text-sm">
                  <div className="text-gray-900 text-sm font-semibold dark:text-[#CBC9DE]">
                    {displayName}
                  </div>
                  <div className="text-gray-500 flex items-center gap-1 dark:text-[#96949C] text-[10px]">
                    <MdOutlineMailOutline /> {member.email}
                  </div>
                  <div className="text-[10px] font-semibold dark:text-[#CBC9DE] -mt-1">
                    {member.role?.charAt(0).toUpperCase() +
                      member.role?.slice(1)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 mb-1">
                  <span className="dark:bg-[#2B3336] bg-[#DCFCE7] text-green-600 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                    <FiCheckCircle className="w-4 h-4" />
                    {member.status?.charAt(0).toUpperCase() +
                      member.status?.slice(1)}
                  </span>
                </div>
                <div className="flex items-center text-gray-400 text-[10px] justify-end gap-1">
                  <CalendarDays className="w-4 h-4" />
                  Joined {formattedDate}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default QuotaUsageGrid;
