"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { getCookie, setCookie } from "cookies-next";
import {
  doc,
  serverTimestamp,
  writeBatch,
  collection,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";
import { useRule } from "@/providers/rulePProvider";
import { useContacts } from "@/providers/postGresPorviders/ContactProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";

export default function FormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orgId = searchParams.get("orgId");
  const projectId = searchParams.get("projects");
  const surveyId = searchParams.get("survey");
  const campaignID = searchParams.get("campaignID") || null;
  const campaignType = searchParams.get("campaignType") || null;
  const userKey = searchParams.get("userKey") || null;
  const [startTime] = useState(() => new Date());

  const platform = useMemo(() => {
    return campaignType?.toLowerCase() === "social media"
      ? searchParams.get("platform") || null
      : null;
  }, [campaignType, searchParams]);

  const [questions, setQuestions] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [status, setStatus] = useState("");
  const { getAllQuestions } = useQuestion();
  const { getSurvey } = useSurvey();
  const { rules = [], getAllRules } = useRule() || {};
  const { saveResponse } = useResponse();
  const { updateContact } = useContacts();
  const { organisation, update } = useOrganisation();

  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const applyBlockRandomization = (block) => {
    let questionOrder = block.questionOrder || [];

    const type = block.randomization?.type || "none";
    const subsetCount = block.randomization?.subsetCount || "";

    switch (type) {
      case "full":
        questionOrder = shuffleArray(questionOrder);
        break;

      case "subset":
        const count =
          parseInt(subsetCount) || Math.ceil(questionOrder.length / 2);
        questionOrder = shuffleArray(questionOrder).slice(0, count);
        break;

      case "rotate":
        questionOrder = [...questionOrder.slice(1), questionOrder[0]];
        break;

      case "none":
      default:
        // keep original order
        break;
    }

    return { ...block, questionOrder };
  };

  useEffect(() => {
    const init = async () => {
      // avoid running until we have required params
      if (!orgId || !surveyId || !projectId) return;

      let completedSurveys = [];
      try {
        completedSurveys = getCookie("SurveyCompleted")
          ? JSON.parse(getCookie("SurveyCompleted"))
          : [];
      } catch (e) {
        completedSurveys = [];
      }

      if (
        Array.isArray(completedSurveys) &&
        completedSurveys.includes(surveyId)
      ) {
        setIsCompleted(true);
        setLoading(false);
        return;
      }

      try {
        const fetchSurveyData = async () => {
          try {
            const surveyDoc = await getSurvey(surveyId);
            if (!surveyDoc) {
              router.push("/404");
              return;
            }

            const randomizedBlocks = (surveyDoc.blocks || []).map(
              applyBlockRandomization
            );

            setSurvey(surveyDoc);
            setBlocks(randomizedBlocks);
          } catch (err) {
            console.error("Error fetching survey:", err);
            router.push("/404");
          }
        };

        const fetchQuestions = async () => {
          try {
            const questionsData = await getAllQuestions(orgId, surveyId);
            setQuestions(questionsData || []);
          } catch (err) {
            console.error("Error fetching questions:", err);
          }
        };

        const fetchRules = async () => {
          try {
            await getAllRules(surveyId);
          } catch (err) {
            console.error("Error fetching rules:", err);
          }
        };

        Promise.all([
          fetchSurveyData(),
          fetchQuestions(),
          fetchRules(),
        ]).finally(() => setLoading(false));
      } catch (err) {
        console.error(err);
        router.push("/404");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [orgId, projectId, surveyId]);

  useEffect(() => {
    if (blocks.length && questions.length) {
      const orderedQuestions = [];

      blocks.forEach((block) => {
        if (block.questionOrder && block.questionOrder.length > 0) {
          block.questionOrder.forEach((qid) => {
            const q = questions.find(
              (qq) => qq.id === qid || qq.questionId === qid
            );
            if (q) orderedQuestions.push(q);
          });
        }
      });

      const remaining = questions.filter(
        (q) =>
          !orderedQuestions.find(
            (oq) => oq.id === q.id || oq.questionId === q.questionId
          )
      );

      setQuestions([...orderedQuestions, ...remaining]);
    }
  }, [blocks]);

  // const handleSubmit = async (answers) => {
  //   try {
  //     if (!responseId) {
  //       alert("Preparing form… please try again in a moment.");
  //       return;
  //     }

  //     const endTime = new Date();
  //     const totalMs = endTime - startTime;
  //     const totalMinutes = Math.floor(totalMs / 60000);
  //     const totalSeconds = Math.floor((totalMs % 60000) / 1000);

  //     const responseRef = doc(
  //       db,
  //       "organizations",
  //       orgId,
  //       "surveys",
  //       surveyId,
  //       "responses",
  //       responseId
  //     );

  //     const embeddedAnswers = Object.entries(answers).map(
  //       ([questionId, answerValue]) => ({
  //         questionId,
  //         projectId,
  //         answer: answerValue,
  //       })
  //     );

  //     const batch = writeBatch(db);

  //     batch.set(responseRef, {
  //       orgId,
  //       projectId,
  //       surveyId,
  //       campaignID,
  //       campaignType,
  //       platform,
  //       userContactId: userKey,
  //       createdAt: serverTimestamp(),
  //       answers: embeddedAnswers,
  //       uid: responseId,
  //       startTime: startTime.toISOString(),
  //       endTime: endTime.toISOString(),
  //       totalTime: `${totalMinutes}m ${totalSeconds}s`,
  //     });

  //     if (userKey) {
  //       const contactRef = doc(db, "organizations", orgId, "contacts", userKey);
  //       batch.set(
  //         contactRef,
  //         {
  //           surveys: [
  //             {
  //               surveyId,
  //               responseId,
  //               projectId,
  //             },
  //           ],
  //         },
  //         { merge: true }
  //       );
  //     }
  //     const orgRef = doc(db, "organizations", orgId);
  //     batch.set(
  //       orgRef,
  //       { subscription: { currentusage: { response: increment(1) } } },
  //       { merge: true }
  //     );
  //     await batch.commit();

  //     setCookie("SurveyCompleted", surveyId);

  //     setStatus("Saving to Salesforce…");
  //     const res = await fetch("/api/salesforce/ingest", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ orgId, surveyId, projectId, responseId }),
  //     });

  //     if (!res.ok) {
  //       const t = await res.text();
  //       console.warn("Salesforce ingest failed:", t);
  //       setStatus("Saved locally, Salesforce push failed.");
  //     } else {
  //       setStatus("Saved to Salesforce.");
  //     }

  //     window.location.href = "/thank-you";
  //   } catch (err) {
  //     console.error("Submission error:", err);
  //     alert("Something went wrong. Please try again.");
  //   }
  // };

  // const handleSubmit = async (answers) => {
  //     if (!responseId) {
  //       alert("Preparing form… please try again in a moment.");
  //       return;
  //     }

  //     try {
  //       setStatus("Saving response…");

  //       // Calculate total time
  //       const endTime = new Date();
  //       const totalMs = endTime - startTime;
  //       const totalMinutes = Math.floor(totalMs / 60000);
  //       const totalSeconds = Math.floor((totalMs % 60000) / 1000);

  //       // Build response payload
  //       const responseData = {
  //         respondent_id: userKey,
  //         status: "completed",
  //         meta_data: {
  //           orgId,
  //           projectId,
  //           surveyId,
  //           campaignID,
  //           campaignType,
  //           platform,
  //           startTime: startTime.toISOString(),
  //           endTime: endTime.toISOString(),
  //           totalTime: `${totalMinutes}m ${totalSeconds}s`,
  //         },
  //         answers: Object.entries(answers).map(([questionId, answerValue]) => ({
  //           question_id: questionId,
  //           project_id: projectId,
  //           answer: answerValue,
  //         })),
  //       };

  //       const isNewResponse = !responseId;

  //       const savedResponse = isNewResponse
  //         ? await saveResponse(orgId, surveyId, responseData)
  //         : await updateResponse(surveyId, responseId, responseData);

  //       if (userKey) {
  //         await updateContact(userKey, {
  //           surveys: [
  //             {
  //               surveyId,
  //               responseId: savedResponse?.response_id || responseId,
  //               projectId,
  //             },
  //           ],
  //         });
  //       }

  //       const currentUsage = organisation?.subscription?.currentusage?.response || 0;
  //       await update(orgId, {
  //         subscription: {
  //           currentusage: { response: currentUsage + 1 },
  //         },
  //         last_activity: new Date().toISOString(),
  //       });

  //       setStatus("Saving to Salesforce…");
  //       const salesforceRes = await fetch("/api/salesforce/ingest", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           orgId,
  //           surveyId,
  //           projectId,
  //           responseId: savedResponse?.response_id || responseId,
  //         }),
  //       });

  //       if (!salesforceRes.ok) {
  //         const text = await salesforceRes.text();
  //         console.warn("Salesforce ingest failed:", text);
  //         setStatus("Saved locally, Salesforce push failed.");
  //       } else {
  //         setStatus("Saved to Salesforce.");
  //       }

  //       setCookie("SurveyCompleted", surveyId);
  //       window.location.href = "/thank-you";
  //     } catch (err) {
  //       console.error("Submission error:", err);
  //       alert(`Something went wrong: ${err.message || err}`);
  //     }
  //   };

  const handleSubmit = async (answers) => {
    if (!orgId || !surveyId) {
      alert("Survey not ready. Please try again later.");
      return;
    }

    try {
      setStatus("Saving response…");

      // Calculate total time
      const endTime = new Date();
      const totalMs = endTime - startTime;
      const totalMinutes = Math.floor(totalMs / 60000);
      const totalSeconds = Math.floor((totalMs % 60000) / 1000);
      const respondentId = userKey || "anonymous"; // or `resp_" + uuid()` if you want unique

      const responseData = {
        respondent_id: respondentId,
        status: "completed",
        meta_data: {
          orgId,
          projectId,
          surveyId,
          campaignID,
          campaignType,
          platform,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          totalTime: `${totalMinutes}m ${totalSeconds}s`,
        },
        answers: Object.entries(answers).map(([questionId, answerValue]) => ({
          questionId,
          projectId,
          answer: answerValue,
        })),
      };

      // Always create a new response (POST)
      const savedResponse = await saveResponse(orgId, surveyId, responseData);

      // Update contact with this survey
      if (userKey) {
        await updateContact(userKey, {
          surveys: [
            {
              surveyId,
              responseId: savedResponse.response_id,
              projectId,
            },
          ],
        });
      }

      // Update organisation usage
      const currentUsage =
        organisation?.subscription?.currentusage?.response || 0;
      await update(orgId, {
        subscription: { currentusage: { response: currentUsage + 1 } },
        last_activity: new Date().toISOString(),
      });

      // Push to Salesforce
      setStatus("Saving to Salesforce…");
      // const salesforceRes = await fetch("/api/salesforce/ingest", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     orgId,
      //     surveyId,
      //     projectId,
      //     responseId: savedResponse.response_id,
      //   }),
      // });

      // if (!salesforceRes.ok) {
      //   const text = await salesforceRes.text();
      //   console.warn("Salesforce ingest failed:", text);
      //   setStatus("Saved locally, Salesforce push failed.");
      // } else {
      //   setStatus("Saved to Salesforce.");
      // }

      // Mark survey as completed
      const completedSurveys = getCookie("SurveyCompleted")
        ? JSON.parse(getCookie("SurveyCompleted"))
        : [];
      const updatedSurveys = Array.from(
        new Set([...completedSurveys, surveyId])
      );
      setCookie("SurveyCompleted", JSON.stringify(updatedSurveys), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });

      window.location.href = "/thank-you";
    } catch (err) {
      console.error("Submission error:", err);
      alert(`Something went wrong: ${err.message || err}`);
      setStatus("");
    }
  };

  const expandBlocksByPageBreaks = (blocks, questions) => {
    const expanded = [];

    blocks.forEach((block) => {
      const order = block.questionOrder || [];
      let currentPageQuestions = [];

      order.forEach((qid) => {
        if (qid.startsWith("PB-")) {
          // Push the accumulated questions as one "page block"
          if (currentPageQuestions.length > 0) {
            expanded.push({
              ...block,
              blockId: `${block.blockId}-page-${expanded.length + 1}`,
              questionOrder: [...currentPageQuestions],
            });
          }
          // reset for next page
          currentPageQuestions = [];
        } else {
          currentPageQuestions.push(qid);
        }
      });

      // push the last set (after last page break)
      if (currentPageQuestions.length > 0) {
        expanded.push({
          ...block,
          blockId: `${block.blockId}-page-${expanded.length + 1}`,
          questionOrder: [...currentPageQuestions],
        });
      }
    });

    return expanded.length ? expanded : blocks;
  };

  return (
    <div>
      {loading ? (
        <Loading />
      ) : isCompleted ? (
        <p
          style={{ textAlign: "center", marginTop: "2rem", fontSize: "1.2rem" }}
        >
          ✅ You have already completed the survey. Thank you!
        </p>
      ) : (
        <>
          {status && (
            <p className="text-xs text-gray-500 mb-2 px-2">{status}</p>
          )}
          <SurveyForm
            questions={questions}
            blocks={expandBlocksByPageBreaks(blocks, questions)}
            handleSubmit={handleSubmit}
            rules={rules}
          />
        </>
      )}
    </div>
  );
}
