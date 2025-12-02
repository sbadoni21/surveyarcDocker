"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { calculateAnalytics } from "@/utils/analytics/calculateAnalytics";
import { formatAnswer } from "@/utils/analytics/formatAnswer";
import { AnalyticsCard } from "./analytics/AnalyticsCard";
import { useQuestion } from "@/providers/questionPProvider";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ExportSurveyButton from "./ExportSurveyButton";

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
  "osat",
  "matrix",
  "number",
]);

const SurveyResponsesPage = ({ survey }) => {
  const pathname = usePathname();
  const [tab, setTab] = useState(0);
  const [analytics, setAnalytics] = useState({});
  const { questions } = useQuestion();
  const { responses, deleteResponse } = useResponse();
  const surveyStatus = survey?.status;

  const filteredResponses = useMemo(() => {
    if (!responses) return [];

    if (surveyStatus === "test") {
      return responses.filter((r) => r.status === "test_completed");
    }

    return responses.filter((r) => r.status !== "test_completed");
  }, [responses, surveyStatus]);

  useEffect(() => {
    if (questions.length > 0 && filteredResponses.length > 0) {
      const analyticsData = calculateAnalytics(questions, filteredResponses);
      setAnalytics(analyticsData);
    } else {
      setAnalytics({});
    }
  }, [questions, filteredResponses]);

  const surveyId = pathname.split("/")[7];

  const downloadPDF = async () => {
    const element = document.getElementById("analytics-page");
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 1,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.7);
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;
    }

    pdf.save("analytics.pdf");
  };

  const responseCountLabel =
    filteredResponses.length === 1 ? "response" : "responses";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950/95">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 pb-4 mb-6 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-start gap-4 mb-3 pt-1">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Survey
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-50">
                Survey Responses
              </h1>
              {survey?.title && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {survey.title}
                </p>
              )}
            </div>

            <div className="ml-auto flex flex-col items-end gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-50 px-3 py-1 text-xs font-medium shadow-sm">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                <span>
                  {filteredResponses.length} {responseCountLabel}
                </span>
              </div>
              {surveyStatus && (
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    surveyStatus === "test"
                      ? "bg-amber-50 text-amber-700 border border-amber-100"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                  }`}
                >
                  {surveyStatus === "test" ? "Test Mode" : "Live"}
                </span>
              )}
            </div>
          </div>

          {/* Tabs + Export */}
          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setTab(0)}
                className={`relative px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition-all ${
                  tab === 0
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                Responses
              </button>
              <button
                onClick={() => setTab(1)}
                className={`relative px-4 py-1.5 text-xs md:text-sm font-medium rounded-full transition-all ${
                  tab === 1
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                Analytics
              </button>
            </div>

            {/* Right-side actions */}
            <div className="ml-auto flex items-center gap-2">
              <ExportSurveyButton
                responses={filteredResponses}
                questions={questions}
              />
              {tab === 1 && (
                <button
                  onClick={downloadPDF}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-slate-50 px-3 py-1.5 text-xs md:text-sm font-medium shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-950"
                >
                  <span className="material-icons-outlined !text-base">
                    picture_as_pdf
                  </span>
                  <span>Download analytics PDF</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[60vh] pb-12">
          {tab === 0 && (
            <>
              {filteredResponses.length === 0 ? (
                <div className="flex items-center justify-center min-h-[360px]">
                  <div className="bg-white dark:bg-slate-900/80 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl px-10 py-12 text-center max-w-lg shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <svg
                        className="h-8 w-8"
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
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-50 mb-1">
                      No responses yet
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Once participants start submitting the survey, responses
                      will appear here in real-time.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredResponses.map((response, idx) => (
                    <article
                      key={idx}
                      className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
                      aria-label={`Response number ${idx + 1}`}
                    >
                      {/* Card header */}
                      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                            Response #{String(idx + 1).padStart(2, "0")}
                          </h2>
                          {response?.created_at || response?.createdAt ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Submitted at{" "}
                              {new Date(
                                response.created_at || response.createdAt
                              ).toLocaleString()}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {response.status && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {response.status.replace(/_/g, " ")}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              deleteResponse(surveyId, response.response_id)
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200/70 bg-rose-50/70 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                          >
                            <span className="material-icons-outlined !text-sm">
                              delete
                            </span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-5 py-4">
                        {/* Metadata */}
                        <section className="pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                            Response metadata
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-6">
                            {Object.entries(response)
                              .filter(
                                ([key]) =>
                                  key !== "answers" &&
                                  !EXCLUDED_KEYS.includes(key)
                              )
                              .map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex flex-col text-sm"
                                >
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {key
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (c) =>
                                        c.toUpperCase()
                                      )}
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-200">
                                    {formatAnswer(value)}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </section>

                        {/* Answers */}
                        {response.answers &&
                          Array.isArray(response.answers) && (
                            <section>
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-50">
                                  Survey answers
                                </h3>
                                <span className="text-xs text-slate-400">
                                  {response.answers.length} questions answered
                                </span>
                              </div>

                              <div className="space-y-3">
                                {response.answers.map((ans, i) => {
                                  const found = questions.find(
                                    (q) => q.questionId === ans.questionId
                                  );
                                  const label =
                                    found?.label ||
                                    found?.config?.label ||
                                    ans.questionId
                                      .replace(/_/g, " ")
                                      .replace(/\b\w/g, (c) =>
                                        c.toUpperCase()
                                      );

                                  return (
                                    <div
                                      key={`${ans.questionId}-${i}`}
                                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-3"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">
                                            {label}
                                          </p>
                                          <p className="text-[11px] text-slate-400 mt-0.5">
                                            {ans.questionId}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="mt-2 text-sm text-slate-800 dark:text-slate-50">
                                        {formatAnswer(ans.answer)}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 1 && (
            <div>
              {Object.entries(analytics).length === 0 ? (
                <div className="bg-white dark:bg-slate-900/80 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 px-8 py-12 text-center shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-50 mb-2">
                    No analytics data yet
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Analytics will be generated once there are responses for
                    analytics-supported questions in this survey.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-slate-50">
                        Analytics overview
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Visual breakdown of responses for choice and scale
                        questions.
                      </p>
                    </div>
                    <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300">
                      {Object.entries(analytics).length} questions analysed
                    </span>
                  </div>

                  <div
                    id="analytics-page"
                    className="flex flex-col gap-4 md:gap-6"
                  >
                    {Object.entries(analytics)
                      .filter(([_, data]) =>
                        ANALYTICS_SUPPORTED_TYPES.has(data.type)
                      )
                      .map(([qId, data]) => (
                        <AnalyticsCard key={qId} question={qId} data={data} />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyResponsesPage;
