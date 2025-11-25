"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { calculateAnalytics } from "@/utils/analytics/calculateAnalytics";
import { formatAnswer } from "@/utils/analytics/formatAnswer";
import { AnalyticsCard } from "./analytics/AnalyticsCard";
import { useQuestion } from "@/providers/questionPProvider";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";
import { findDuplicateSurveys } from "@/utils/analytics/duplicateDetection";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@mui/material";
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
  "matrix",
  "number",
]);

const SurveyResponsesPage = () => {
  const router = usePathname();
  const [tab, setTab] = useState(0);
  const [analytics, setAnalytics] = useState({});

  const { questions } = useQuestion();
  const { responses, deleteResponse } = useResponse();

  useEffect(() => {
    if (questions.length > 0 && responses.length > 0) {
      const analyticsData = calculateAnalytics(questions, responses);
      setAnalytics(analyticsData);
    } else {
      setAnalytics({});
    }
  }, [questions, responses]);

  const surveyId = router.split("/")[7];
  console.log(responses);
  const downloadPDF = async () => {
    const element = document.getElementById("analytics-page");
    const canvas = await html2canvas(element, {
      scale: 1, // Reduced from 2 to 1
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    // Use JPEG with compression instead of PNG
    const imgData = canvas.toDataURL("image/jpeg", 0.7); // 0.7 = 70% quality

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    // First Page
    pdf.addImage(
      imgData,
      "JPEG",
      0,
      position,
      imgWidth,
      imgHeight,
      undefined,
      "FAST"
    );
    heightLeft -= pageHeight;

    // Add multi-pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        position,
        imgWidth,
        imgHeight,
        undefined,
        "FAST"
      );
      heightLeft -= pageHeight;
    }

    pdf.save("analytics.pdf");
  };
  return (
    <div className=" mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="sticky top-0 z-50 pb-4 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">Survey Responses</h1>

          <div className="ml-auto">
            <span className="text-xl text-gray-600">
              {responses.length}{" "}
              {responses.length === 1 ? "response" : "responses"}
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
<ExportSurveyButton responses ={responses} questions={questions}  />
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
                    Responses will appear here once participants submit the
                    survey
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
                      <button
                        onClick={() =>
                          deleteResponse(surveyId, response.response_id)
                        }
                      >
                        {" "}
                        Delete
                      </button>
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
              <div>
                <Button variant="contained" onClick={downloadPDF}>
                  Download Page PDF
                </Button>
                <div id="analytics-page" className="flex flex-col gap-6">
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
  );
};

export default SurveyResponsesPage;

// "use client";

// import React, { useEffect, useMemo, useState } from "react";
// import jsPDF from "jspdf";
// import html2canvas from "html2canvas";
// import { Button } from "@mui/material";
// import { FileText } from "lucide-react";
// import { useQuestion } from "@/providers/questionPProvider";
// import { useResponse } from "@/providers/postGresPorviders/responsePProvider";

// /**
//  * SurveyResponsesPage
//  * - Shows responses and analytics per question
//  * - Toggling response details shown inline (expand/collapse)
//  * - Robust analytics for many shapes of response.answers
//  */

// // ---------- Helpers ----------
// const EXCLUDED_KEYS = ["id", "projectId", "__v", "orgId", "surveyId"];

// function safeGetAnswerForQuestion(response, qid) {
//   if (!response) return undefined;
//   const answers = response.answers;
//   if (!answers) return undefined;

//   // If answers is array of { questionId, answer }:
//   if (Array.isArray(answers)) {
//     const found =
//       answers.find(
//         (a) =>
//           a?.questionId === qid ||
//           a?.id === qid ||
//           a?.question_id === qid ||
//           a?.question === qid
//       ) || null;
//     if (found) return found.answer ?? found.value ?? found.answer_value ?? found;
//   }

//   // If answers is object/map form:
//   if (typeof answers === "object") {
//     // direct key
//     if (qid in answers) return answers[qid];
//     // key might be string variant
//     if (`${qid}` in answers) return answers[`${qid}`];
//     // maybe nested objects: try to find an entry with questionId or id matching
//     const alt = Object.values(answers).find(
//       (v) => v && (v.questionId === qid || v.id === qid || v.question_id === qid)
//     );
//     if (alt) return alt.answer ?? alt.value ?? alt;
//   }

//   return undefined;
// }

// function normalizeValue(val) {
//   if (val == null) return null;
//   if (Array.isArray(val)) return val.map((v) => (v == null ? "" : String(v)));
//   if (typeof val === "object") {
//     // object answer like {label, value} or {choice: ...}
//     if ("value" in val) return val.value;
//     if ("label" in val) return val.label;
//     // fallback: stringify small objects
//     try {
//       return JSON.stringify(val);
//     } catch {
//       return String(val);
//     }
//   }
//   return val;
// }

// function computeAnalyticsFromResponses(questions = [], responses = []) {
//   const out = {};
//   const totalResponses = responses.length || 0;

//   questions.forEach((q) => {
//     const qid = q.questionId || q.id;
//     const type = q.type || "unknown";

//     const counts = new Map();
//     let numericValues = [];

//     responses.forEach((resp) => {
//       const raw = safeGetAnswerForQuestion(resp, qid);
//       if (raw == null) return;

//       const val = normalizeValue(raw);

//       // arrays (checkbox) => count each element
//       if (Array.isArray(val)) {
//         val.forEach((v) => {
//           const key = String(v ?? "");
//           counts.set(key, (counts.get(key) || 0) + 1);
//         });
//         return;
//       }

//       // numeric-like detection
//       const maybeNumber =
//         type === "number" ||
//         type === "rating" ||
//         type === "opinion_scale" ||
//         type === "nps" ||
//         (!isNaN(Number(val)) && String(val).trim() !== "");

//       if (maybeNumber) {
//         const num = Number(val);
//         if (!Number.isNaN(num)) numericValues.push(num);
//       }

//       const key = String(val ?? "");
//       counts.set(key, (counts.get(key) || 0) + 1);
//     });

//     const buckets = Array.from(counts.entries())
//       .map(([label, count]) => ({
//         label,
//         count,
//         pct: totalResponses ? Math.round((count / totalResponses) * 100) : 0,
//       }))
//       .sort((a, b) => b.count - a.count);

//     const stat = {
//       questionId: qid,
//       type,
//       totalResponses,
//       buckets,
//     };

//     if (numericValues.length) {
//       const sum = numericValues.reduce((s, n) => s + n, 0);
//       stat.numeric = {
//         count: numericValues.length,
//         sum,
//         avg: sum / numericValues.length,
//         min: Math.min(...numericValues),
//         max: Math.max(...numericValues),
//       };
//     }

//     out[qid] = stat;
//   });

//   return out;
// }

// // Simple bar component for bucket visualization
// function BucketBar({ label, count, pct }) {
//   return (
//     <div className="flex items-center gap-3">
//       <div className="w-32 text-xs text-gray-600">{label || "(empty)"}</div>
//       <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
//         <div
//           className="h-full bg-blue-600"
//           style={{ width: `${Math.max(1, pct)}%` }}
//         />
//       </div>
//       <div className="w-12 text-right text-xs text-gray-700">{count}</div>
//     </div>
//   );
// }

// // AnalyticsCard: shows summary for a single question
// function AnalyticsCard({ question, data }) {
//   if (!data) return null;
//   const qLabel = question?.label || question?.config?.label || data.questionId;

//   return (
//     <div className="bg-white border rounded-lg p-4 shadow-sm">
//       <div className="flex items-start justify-between gap-3 mb-3">
//         <div>
//           <div className="text-sm font-semibold text-gray-800">{qLabel}</div>
//           <div className="text-xs text-gray-500">{data.type}</div>
//         </div>
//         <div className="text-right">
//           <div className="text-sm font-medium text-gray-700">
//             {data.totalResponses} responses
//           </div>
//         </div>
//       </div>

//       {data.numeric && (
//         <div className="mb-3 text-sm text-gray-700 grid grid-cols-4 gap-2">
//           <div>
//             <div className="text-xs text-gray-500">Count</div>
//             <div className="font-medium">{data.numeric.count}</div>
//           </div>
//           <div>
//             <div className="text-xs text-gray-500">Avg</div>
//             <div className="font-medium">{Number(data.numeric.avg).toFixed(2)}</div>
//           </div>
//           <div>
//             <div className="text-xs text-gray-500">Min</div>
//             <div className="font-medium">{data.numeric.min}</div>
//           </div>
//           <div>
//             <div className="text-xs text-gray-500">Max</div>
//             <div className="font-medium">{data.numeric.max}</div>
//           </div>
//         </div>
//       )}

//       <div className="space-y-2">
//         {data.buckets.length ? (
//           data.buckets.map((b, i) => (
//             <BucketBar key={i} label={b.label} count={b.count} pct={b.pct} />
//           ))
//         ) : (
//           <div className="text-sm text-gray-500">No answers for this question yet.</div>
//         )}
//       </div>
//     </div>
//   );
// }

// function ResponseCard({ idx, response, questions }) {
//   const [open, setOpen] = useState(false);

//   const formattedAnswers = useMemo(() => {
//     const pairs = [];
//     if (!response) return pairs;
//     const answers = response.answers || [];

//     if (Array.isArray(answers)) {
//       answers.forEach((a) => {
//         const qid = a?.questionId || a?.id || a?.question;
//         const question = questions.find((q) => q.questionId === qid || q.id === qid);
//         pairs.push({
//           qid,
//           label: question?.label || qid,
//           answer: a?.answer ?? a?.value ?? a,
//         });
//       });
//       return pairs;
//     }

//     if (typeof answers === "object") {
//       for (const key of Object.keys(answers)) {
//         const val = answers[key];
//         const qid = val?.questionId || key;
//         const question = questions.find((q) => q.questionId === qid || q.id === qid);
//         const answer =
//           val?.answer ?? val?.value ?? val?.answer_value ?? val ?? "";
//         pairs.push({
//           qid,
//           label: question?.label || question?.config?.label || qid,
//           answer,
//         });
//       }
//     }

//     return pairs;
//   }, [response, questions]);

//   return (
//     <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
//       <div className="px-4 py-3 flex items-center justify-between gap-3 border-b">
//         <div>
//           <div className="text-sm font-semibold text-gray-800">
//             Response #{idx + 1}
//           </div>
//           <div className="text-xs text-gray-500">
//             {response.respondent_id ? `By: ${response.respondent_id}` : ""}
//           </div>
//         </div>

//         <div className="flex items-center gap-3">
//           <button
//             onClick={() => setOpen((s) => !s)}
//             className="text-sm text-blue-600 hover:underline"
//           >
//             {open ? "Hide answers" : "Show answers"}
//           </button>
//         </div>
//       </div>

//       {open && (
//         <div className="px-4 py-3 space-y-3">
//           <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
//             {Object.entries(response)
//               .filter(([key]) => key !== "answers" && !EXCLUDED_KEYS.includes(key))
//               .map(([key, val]) => (
//                 <div key={key} className="flex gap-2">
//                   <div className="min-w-[120px] font-medium text-gray-700">
//                     {String(key)
//                       .replace(/_/g, " ")
//                       .replace(/\b\w/g, (c) => c.toUpperCase())}
//                   </div>
//                   <div className="flex-1">{String(val ?? "")}</div>
//                 </div>
//               ))}
//           </div>

//           <div>
//             <h4 className="text-sm font-semibold text-gray-800 mb-2">Answers</h4>
//             <div className="space-y-3">
//               {formattedAnswers.length ? (
//                 formattedAnswers.map((f, i) => (
//                   <div key={`${f.qid}-${i}`} className="text-sm border-b pb-1">
//                     <div className="font-medium text-gray-700">{i+1} - {f.label}</div>
//                     <div className="text-gray-600">{String(f.answer ?? "")}</div>
//                   </div>
//                 ))
//               ) : (
//                 <div className="text-sm text-gray-500">No answers recorded.</div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ---------- Main Page Component ----------
// export default function SurveyResponsesPage() {
//   const { questions = [] } = useQuestion();
//   const { responses = [], deleteResponse } = useResponse();

//   const [tab, setTab] = useState(0);
//   const [analytics, setAnalytics] = useState({});
//   const [expandedResponseIds, setExpandedResponseIds] = useState(new Set());

//   // compute analytics whenever questions/responses change
//   useEffect(() => {
//     const computed = computeAnalyticsFromResponses(questions || [], responses || []);
//     setAnalytics(computed);
//   }, [questions, responses]);

//   const surveyIdFromPath = typeof window !== "undefined" ? window.location.pathname.split("/")[7] : "";

//   // Download PDF of analytics area
//   const downloadPDF = async () => {
//     const element = document.getElementById("analytics-page");
//     if (!element) {
//       alert("Analytics area not found.");
//       return;
//     }
//     const canvas = await html2canvas(element, {
//       scale: 1,
//       useCORS: true,
//       allowTaint: true,
//       logging: false,
//     });
//     const imgData = canvas.toDataURL("image/jpeg", 0.8);
//     const pdf = new jsPDF("p", "mm", "a4");
//     const pageWidth = pdf.internal.pageSize.getWidth();
//     const pageHeight = pdf.internal.pageSize.getHeight();
//     const imgWidth = pageWidth;
//     const imgHeight = (canvas.height * pageWidth) / canvas.width;
//     let position = 0;
//     pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
//     let heightLeft = imgHeight - pageHeight;
//     while (heightLeft > 0) {
//       position = -heightLeft;
//       pdf.addPage();
//       pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
//       heightLeft -= pageHeight;
//     }
//     pdf.save("analytics.pdf");
//   };

//   return (
//     <div className="mx-auto p-4 ">
//       {/* Header */}
//       <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md py-4 p-2 rounded">
//         <div className="flex items-center gap-4">
//           <div className="p-2 bg-gray-100 rounded-md">
//             <FileText size={20} />
//           </div>
//           <h1 className="text-2xl font-bold">Survey Responses</h1>
//           <div className="ml-auto text-sm text-gray-700">
//             {responses.length} {responses.length === 1 ? "response" : "responses"}
//           </div>
//         </div>

//         <div className="mt-4 bg-white rounded-md shadow-sm overflow-hidden">
//           <div className="flex">
//             <button
//               onClick={() => setTab(0)}
//               className={`flex-1 px-6 py-3 text-sm font-medium ${tab === 0 ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900"}`}
//             >
//               Responses
//             </button>
//             <button
//               onClick={() => setTab(1)}
//               className={`flex-1 px-6 py-3 text-sm font-medium ${tab === 1 ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-600 hover:text-gray-900"}`}
//             >
//               Analytics
//             </button>
//             <div className="p-3">
//               <Button variant="contained" onClick={downloadPDF} size="small">
//                 Download Page PDF
//               </Button>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div className="mt-6 space-y-6">
//         {tab === 0 && (
//           <>
//             {responses.length === 0 ? (
//               <div className="bg-white rounded-lg p-12 text-center text-gray-600">
//                 No responses yet — responses will show up here.
//               </div>
//             ) : (
//               <div className="space-y-4">
//                 {responses.map((resp, i) => (
//                   <div key={resp.response_id || i}>
//                     <ResponseCard idx={i} response={resp} questions={questions} />
//                   </div>
//                 ))}
//               </div>
//             )}
//           </>
//         )}

//         {tab === 1 && (
//           <div id="analytics-page" className="grid grid-cols-1 md:grid-cols-2 gap-6">
//             {questions.length === 0 ? (
//               <div className="bg-white rounded-lg p-8 text-gray-600">No questions available.</div>
//             ) : (
//               questions.map((q) => (
//                 <AnalyticsCard key={q.questionId || q.id} question={q} data={analytics[q.questionId || q.id]} />
//               ))
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
