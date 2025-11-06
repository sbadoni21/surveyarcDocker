"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { calculateAnalytics } from "@/utils/analytics/calculateAnalytics";
import { formatAnswer } from "@/utils/analytics/formatAnswer";
import { AnalyticsCard } from "./analytics/AnalyticsCard";
import { useQuestion } from "@/providers/questionPProvider";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";

const EXCLUDED_KEYS = ["id", "projectId", "__v", "orgId", "surveyId"];

const ANALYTICS_SUPPORTED_TYPES = new Set([
  "multiple_choice",
  "dropdown",
  "picture_choice",
  "yes_no",
  "checkbox",
  "rating",
  "opinion_scale",
  "nps",
  "ranking",
  "matrix",
  "number",
]);

const SurveyResponsesPage = () => {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [analytics, setAnalytics] = useState({});
  
  const { questions } = useQuestion();
  const { responses } = useResponse();
  console.log(questions)

  useEffect(() => {
    if (questions.length > 0 && responses.length > 0) {
      const analyticsData = calculateAnalytics(questions, responses);
      setAnalytics(analyticsData);
    } else {
      setAnalytics({});
    }
  }, [questions, responses]);

  const handleBack = () => {
    router.back();
  };

  return (
    <div className=" mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="sticky top-0 z-50 pb-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
         
          
          <h1 className="text-3xl font-bold">Survey Responses</h1>
          
          <div className="ml-auto">
            <span className="text-xl text-gray-600">
              {responses.length} {responses.length === 1 ? "response" : "responses"}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="flex border-b">
            <button
              onClick={() => setTab(0)}
              className={`flex-1 px-8 py-4 font-medium transition-colors ${
                tab === 0
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Responses
            </button>
            <button
              onClick={() => setTab(1)}
              className={`flex-1 px-8 py-4 font-medium transition-colors ${
                tab === 1
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="min-h-[60vh]">
    
{tab === 0 && (
  <>
    {responses.length === 0 ? (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <svg 
            className=" h-16 mx-auto mb-4 text-gray-300" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <h2 className="text-lg font-medium text-gray-800 mb-2">
            No responses yet
          </h2>
          <p className="text-sm text-gray-500">
            Responses will appear here once participants submit the survey
          </p>
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        {responses.map((response, idx) => (
          <div
            key={idx}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            aria-label={`Response number ${idx + 1}`}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">
                Response #{idx + 1}
              </h2>
            </div>

            <div className="px-6 py-4">
              {/* Metadata section */}
              <div className="space-y-3 pb-6 border-b border-gray-100">
                {Object.entries(response)
                  .filter(
                    ([key]) =>
                      key !== "answers" && !EXCLUDED_KEYS.includes(key)
                  )
                  .map(([key, value]) => (
                    <div key={key} className="flex gap-4">
                      <div className="font-medium text-gray-700 min-w-[140px] text-sm">
                        {key
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                      <div className="text-gray-600 text-sm flex-1">
                        {formatAnswer(value)}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Answers section */}
              {response.answers && Array.isArray(response.answers) && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Survey Answers
                  </h3>

                  <div className="space-y-4">
                    {response.answers.map((ans, i) => {
                      const found = questions.find(
                        (q) => q.questionId === ans.questionId
                      );
                      const label =
                        found?.label ||
                        found?.config?.label ||
                        ans.questionId
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase());
                      
                      return (
                        <div
                          key={`${ans.questionId}-${i}`}
                          className="pb-4 border-b border-gray-100 last:border-0"
                        >
                          <div className="text-sm font-medium text-gray-700 mb-2">
                            {label}
                            <span className="text-xs text-gray-400 ml-2">
                              ({ans.questionId})
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatAnswer(ans.answer)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )}
  </>
)}

        {tab === 1 && (
          <div>
            {Object.entries(analytics).length === 0 ? (
              <div className="bg-white rounded-lg p-16 text-center">
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  No analytics data available.
                </h2>
                <p className="text-sm text-gray-500">
                  Analytics will be generated once responses are collected.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(analytics)
                  .filter(([_, data]) => ANALYTICS_SUPPORTED_TYPES.has(data.type))
                  .map(([qId, data]) => (
                    <AnalyticsCard key={qId} question={qId} data={data} />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyResponsesPage;