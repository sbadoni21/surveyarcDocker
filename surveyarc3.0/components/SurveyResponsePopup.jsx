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
              <div className="bg-white rounded-lg p-16 text-center">
                <h2 className="text-xl font-semibold text-gray-600 mb-2">
                  No responses found.
                </h2>
                <p className="text-sm text-gray-500">
                  Responses will appear here once participants submit the survey.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {responses.map((response, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-lg shadow-md p-6"
                    aria-label={`Response number ${idx + 1}`}
                  >
                    <h2 className="text-xl font-semibold mb-4">
                      Response {idx + 1}
                    </h2>

                    <table className="w-full mb-4">
                      <tbody>
                        {Object.entries(response)
                          .filter(
                            ([key]) =>
                              key !== "answers" && !EXCLUDED_KEYS.includes(key)
                          )
                          .map(([key, value]) => (
                            <tr key={key} className="border-b border-gray-200">
                              <th className="text-left py-3 px-2 font-semibold w-1/4 align-top">
                                {key
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </th>
                              <td className="py-3 px-2">
                                {formatAnswer(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {response.answers && Array.isArray(response.answers) && (
                      <>
                        <h3 className="text-lg font-semibold mt-6 mb-4">
                          Answers:
                        </h3>

                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                              <th className="py-3 px-2 text-left w-2/5 font-semibold">
                                Question
                              </th>
                              <th className="py-3 px-2 text-left font-semibold">
                                Answer
                              </th>
                            </tr>
                          </thead>
                          <tbody>
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
                                <tr
                                  key={`${ans.questionId}-${i}`}
                                  className="border-b border-gray-100"
                                >
                                  <td className="py-3 px-2 align-top">
                                    {`${label} (${ans.questionId})`}
                                  </td>
                                  <td className="py-3 px-2">
                                    {formatAnswer(ans.answer)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
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