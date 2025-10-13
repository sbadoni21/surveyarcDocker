"use client";
import { Icon } from "@iconify/react";
import React from "react";
import { TbLayoutDistributeHorizontal, TbSettingsCog } from "react-icons/tb";

export default function TopTabsNavbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "questions", label: "Questions", icon: <Icon icon="ri:survey-line" width="20" height="20" /> },
    { id: "rules", label: "Logic rules", icon: <TbSettingsCog className="w-5 h-5" /> },
    { id: "flow", label: "Survey flow", icon: <TbSettingsCog className="w-5 h-5" /> },
    { id: "distribution", label: "Distribution", icon: <TbLayoutDistributeHorizontal width="20" height="20" /> },
    { id: "demo", label: "Demo survey", icon: <Icon icon="solar:play-linear" width="20" height="20" /> },
    { id: "campaign", label: "campaign", icon: <Icon icon="solar:play-linear" width="20" height="20" /> },
  ];

  // Map tab ids to desired hash routes (including your misspelling requirement)
  const hashMap = {
    questions: "#questoins",
    rules: "#logicrules",
    flow: "#flow",
    distribution: "#distribution",
    demo: "#demo",
  };

  const handleClick = (id) => {
    setActiveTab(id);
    const hash = hashMap[id] || `#${id}`;
    if (typeof window !== "undefined") {
      // replace the hash without adding a new history entry
      history.replaceState(null, "", hash);
    }
  };

  return (
    <div className="flex justify-start items-center ">
      <div className="flex justify-center py-4 px-4 w-[100%]  dark:bg-[#1A1A1E] bg-[#FFFFFF]">
        <div className="dark:bg-[#0e0e0f] rounded-xl bg-[#F5F5F5] px-2 py-2 shadow-sm flex gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleClick(tab.id)}
                className={`flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-lg transition-all duration-200 ${
                  isActive ? "bg-[#ED7A13] text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
                // Optional: show the target hash on hover without changing styles
                title={hashMap[tab.id]}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
