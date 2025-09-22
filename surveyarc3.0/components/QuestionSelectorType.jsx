"use client";
import QUESTION_TYPES from "@/enums/questionTypes";
import { QUESTION_CATEGORIES } from "@/utils/questionCategories";
import { ICONS_MAP } from "@/utils/questionTypes";
import React from "react";
import { FaFont, FaTimes } from "react-icons/fa";

export default function QuestionTypeSelector({
  selectedType,
  setSelectedType,
  setShowTypePopup,
}) {
  const categoryColors = {
    "Text & Input": "from-blue-500 to-indigo-600",
    "Multiple Choice": "from-purple-500 to-pink-500",
    "Rating & Scale": "from-amber-500 to-orange-500",
    "Date & Time": "from-emerald-500 to-teal-500",
    "Media & Files": "from-rose-500 to-red-500",
  };

  const iconBgClassMap = {
    "Contact Information": "bg-[#FFEEDF] dark:bg-[#483A2D]",
    "Choice Questions": "bg-[#DFF5FF] dark:bg-[#374247]",
    "Rating & Opinion": "bg-[#FFDFE0] dark:bg-[#473434]",
    "Text & Media": "bg-[#DFFFEC] dark:bg-[#2B3B34]",
    "Data Collection": "bg-[#F6FFDF] dark:bg-[#363A2C]",
    "Flow & Structure": "bg-[#E4DFFF] dark:bg-[#262337]",
  };

  return (
    <div className="min-h-screen relative dark:bg-[#1A1A1E] bg-white">
      <div>
        <div className="fixed top-3 right-3 hover:rotate-90 duration-300">
          <button
            onClick={() => setShowTypePopup(false)}
            aria-label="Close"
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#2D2D30] hover:bg-red-100 dark:hover:bg-red-900 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <FaTimes className="w-4 h-4 text-gray-800 dark:text-gray-200" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-8">
          {Object.entries(QUESTION_CATEGORIES).map(
            ([category, questionKeys], categoryIndex) => (
              <div key={category} className="space-y-0">
                <div className="flex items-center gap-4">
                  <div>
                    <h4 className="font-medium dark:text-[#CBC9DE]">
                      {category}
                    </h4>
                    <div
                      className={`h-1 w-20 bg-gradient-to-r ${categoryColors[category]} rounded-full`}
                    ></div>
                  </div>
                </div>

                <div className="flex flex-col ">
                  {questionKeys.map((key) => {
                    const type = QUESTION_TYPES[key];
                    const isSelected = selectedType === type;
                    const iconBgClass =
                      iconBgClassMap[category] ||
                      "bg-gray-100 dark:bg-gray-700";

                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setSelectedType(type);
                          setShowTypePopup(false);
                        }}
                        className={`group relative px-1.5 py-3 rounded-xl transition-all duration-300 text-left ${
                          isSelected
                            ? `border border-blue-200 bg-gradient-to-br ${categoryColors[category]} text-black `
                            : "hover:shadow-md text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 flex items-center justify-center text-md rounded-xl ${iconBgClass}`}
                          >
                            {ICONS_MAP[key] || <FaFont />}
                          </div>

                          <span className="text-xs dark:text-[#96949C] text-[#5B596A]">
                            {key
                              .replaceAll("_", " ")
                              .toLowerCase()
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
