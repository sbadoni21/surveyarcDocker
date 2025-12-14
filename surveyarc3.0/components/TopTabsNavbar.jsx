"use client";
import React from "react";
import { 
  ClipboardList, 
  GitBranch, 
  PieChart, 
  Play, 
  MessageSquare, 
  Palette, 
  Users, 
  Languages, 
  Megaphone 
} from "lucide-react";

export default function TopTabsNavbar({ activeTab, setActiveTab }) {
  const tabs = [
    { 
      id: "questions", 
      label: "Questions", 
      icon: ClipboardList
    },
    { 
      id: "flow", 
      label: "Survey Flow", 
      icon: GitBranch
    },
    { 
      id: "quota", 
      label: "Quota", 
      icon: PieChart
    },
    { 
      id: "demo", 
      label: "Demo Survey", 
      icon: Play
    },
    { 
      id: "responses", 
      label: "Responses", 
      icon: MessageSquare
    },
    { 
      id: "theme", 
      label: "Theme", 
      icon: Palette
    },
    { 
      id: "panel", 
      label: "Panel", 
      icon: Users
    },
    { 
      id: "translation", 
      label: "Translations", 
      icon: Languages
    },
    { 
      id: "campaign", 
      label: "Campaign",
      icon: Megaphone
    },
  ];

  const hashMap = {
    questions: "#questoins",
    rules: "#logicrules",
    quota: "#quota",
    flow: "#flow",
    distribution: "#distribution",
    demo: "#demo",
    campaign: "#campaign",
  };

  const handleClick = (id) => {
    setActiveTab(id);
    const hash = hashMap[id] || `#${id}`;
    if (typeof window !== "undefined") {
      history.replaceState(null, "", hash);
    }
  };

  return (
    <div className="w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1A1A1E]">
      <div className="px-6">
        <nav className="flex justify-center items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleClick(tab.id)}
                className={`
                  group relative flex items-center gap-2.5 px-5 py-4 
                  font-medium text-[12px] whitespace-nowrap
                  transition-all duration-200 ease-in-out
                  ${isActive 
                    ? 'text-[#ED7A13]' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }
                `}
                title={hashMap[tab.id]}
              >
                {/* Icon */}
                <IconComponent 
                  className={`
                    w-4 h-4 transition-all duration-200
                    ${isActive 
                      ? 'text-[#ED7A13] scale-110' 
                      : 'text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 group-hover:scale-105'
                    }
                  `}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                
                {/* Label */}
                <span className="relative">
                  {tab.label}
                  
                  {/* Active indicator line */}
                  {isActive && (
                    <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-[#ED7A13] rounded-full" />
                  )}
                </span>

                {/* Hover background effect */}
                <div 
                  className={`
                    absolute inset-0 rounded-lg -z-10
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-orange-50 dark:bg-orange-950/20' 
                      : 'bg-transparent group-hover:bg-gray-50 dark:group-hover:bg-gray-800/50'
                    }
                  `}
                />
              </button>
            );
          })}
        </nav>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}