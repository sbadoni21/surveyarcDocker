"use client";
import QUESTION_TYPES from "@/enums/questionTypes";
import { QUESTION_CATEGORIES } from "@/utils/questionCategories";
import { ICONS_MAP } from "@/utils/questionTypes";
import React, { useState } from "react";
import { FaFont, FaTimes } from "react-icons/fa";

export default function QuestionTypeSelector({
  selectedType,
  setSelectedType,
  setShowTypePopup,
}) {
  const [activeCategory, setActiveCategory] = useState(
    Object.keys(QUESTION_CATEGORIES)[0]
  );

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

  const activeQuestionKeys = QUESTION_CATEGORIES[activeCategory] || [];
  const iconBgClass = iconBgClassMap[activeCategory] || "bg-gray-100 dark:bg-gray-700";

  return (
    <div className="min-h-screen relative dark:bg-[#1A1A1E] bg-white">
      <div className="fixed top-3 right-3 hover:rotate-90 duration-300 z-10">
        <button
          onClick={() => setShowTypePopup(false)}
          aria-label="Close"
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#2D2D30] hover:bg-red-100 dark:hover:bg-red-900 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <FaTimes className="w-4 h-4 text-gray-800 dark:text-gray-200" />
        </button>
      </div>

      <div className="flex h-screen">
        {/* Left Sidebar - Categories */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-6 space-y-2">
          <h3 className="text-lg font-semibold mb-4 dark:text-gray-200 text-gray-800">
            Categories
          </h3>
          {Object.keys(QUESTION_CATEGORIES).map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? `bg-gradient-to-r ${categoryColors[category]} text-black dark:text-white shadow-md dark:shadow-lg dark:from-white/10 dark:to-white/10`
                    : "hover:bg-gray-100 dark:hover:bg-[#2D2D30] dark:text-gray-300 text-gray-700"
                }`}
              >
                <div className="font-medium">{category}</div>
              </button>
            );
          })}
        </div>

        {/* Right Side - Question Types */}
        <div className="flex-1 p-8 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold dark:text-[#CBC9DE] text-gray-800 mb-2">
              {activeCategory}
            </h2>
            <div
              className={`h-1 w-32 bg-gradient-to-r ${categoryColors[activeCategory]} rounded-full`}
            ></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeQuestionKeys.map((key) => {
              const type = QUESTION_TYPES[key];
              const isSelected = selectedType === type;

              return (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedType(type);
                    setShowTypePopup(false);
                  }}
                  className={`group relative px-4 py-4 rounded-xl transition-all duration-300 text-left ${
                    isSelected
                      ? `border-2 border-blue-400 bg-gradient-to-br ${categoryColors[activeCategory]} text-white shadow-lg`
                      : "hover:shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2D2D30]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 flex items-center justify-center text-lg rounded-xl ${
                        isSelected ? "bg-white/20" : iconBgClass
                      }`}
                    >
                      {ICONS_MAP[key] || <FaFont />}
                    </div>

                    <span
                      className={`text-sm font-medium ${
                        isSelected
                          ? "text-white"
                          : "dark:text-[#96949C] text-[#5B596A]"
                      }`}
                    >
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
      </div>
    </div>
  );
}