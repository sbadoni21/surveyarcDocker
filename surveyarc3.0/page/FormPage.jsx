"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { getCookie, setCookie } from "cookies-next";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";
import { useRule } from "@/providers/rulePProvider";
import { useContacts } from "@/providers/postGresPorviders/contactProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";
import { useTheme } from "@/providers/postGresPorviders/themeProvider"; // <- theme provider
import TicketModel from "@/models/ticketModel";
import { Wind } from "lucide-react";

export default function FormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orgId = searchParams.get("org_id");
  const projectId = searchParams.get("projects") || null;
  const surveyId = searchParams.get("survey_id");
  const campaignID = searchParams.get("campaign_id") || null;
  const campaignType = searchParams.get("campaign_type") || null;
  const userKey = searchParams.get("user_id") || null;
    const contactID = searchParams.get("contact_id") || null;
  const ticketID = searchParams.get("ticket_id") || null;
  const [startTime] = useState(() => new Date());
  const prefillQuestionId = searchParams.get("prefill_q") || null;
  const prefillAnswer = searchParams.get("prefill_a") || null;

  const platform = useMemo(() => {
    return campaignType?.toLowerCase() === "social media"
      ? searchParams.get("platform") || null
      : null;
  }, [campaignType, searchParams]);

  const [questions, setQuestions] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [theme, setTheme] = useState(null); // <- theme state
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
  const { getById } = useTheme();

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
      if (!orgId || !surveyId) return;

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
              return null;
            }

              let randomizedBlocks = (surveyDoc.blocks || []).map(
              applyBlockRandomization
            );

            // 🔹 If coming from 1-click email (prefill_q), bring that Q first
            randomizedBlocks = reorderBlocksForPrefill(
              randomizedBlocks,
              prefillQuestionId
            );

            setSurvey(surveyDoc);
            setBlocks(randomizedBlocks);


            if (surveyDoc?.theme_id) {
              try {
                const th = await getById(surveyDoc.theme_id);
                setTheme(th || null);
              } catch (err) {
                console.error("Failed to load theme:", err);
                setTheme(null);
              }
            } else {
              setTheme(null);
            }
            // --- end new
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

        await Promise.all([fetchSurveyData(), fetchQuestions(), fetchRules()]);
      } catch (err) {
        console.error(err);
        router.push("/404");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, surveyId]);

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

  // In FormPage.jsx handleSubmit function (around line 283):

const handleSubmit = async (answers) => {
  console.log("🔹 handleSubmit called with", Object.keys(answers).length, "answers");
  
  if (!orgId || !surveyId) {
    alert("Survey not ready. Please try again later.");
    return;
  }

  try {
    setStatus("Saving response…");
    const surveyStatus = survey?.status;
    const endTime = new Date();
    const totalMs = endTime - startTime;
    const totalMinutes = Math.floor(totalMs / 60000);
    const totalSeconds = Math.floor((totalMs % 60000) / 1000);
    const respondentId = userKey || "anonymous";

    const responseData = {
      respondent_id: respondentId,
      status: surveyStatus === "test" ? "test_completed" : "completed",
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
    
    console.log("🔹 About to call saveResponse with:", { orgId, surveyId, answersCount: responseData.answers.length });
    
    const savedResponse = await saveResponse(orgId, surveyId, responseData);
    
    console.log("🔹 Response saved successfully:", savedResponse);

    // ... rest of your code (contacts, tickets, org update) ...

    if (contactID) {
      await updateContact(contactID, {
        surveys: [{
          surveyId,
          responseId: savedResponse.response_id,
          projectId,
        }],
      });
    }

    if (ticketID) {
      try {
        const ticket = await TicketModel.get(ticketID);
        const updatedFollowup = {
          ...(ticket.followup || {}),
          mode: "survey",
          surveyId,
          responseId: savedResponse.response_id,
        };
        await TicketModel.update(ticketID, {
          followup: updatedFollowup,
        });
      } catch (err) {
        console.error("Failed to update ticket followup with responseId", err);
      }
    }

    const currentUsage = organisation?.subscription?.currentusage?.response || 0;
    await update(orgId, {
      subscription: { currentusage: { response: currentUsage + 1 } },
      last_activity: new Date().toISOString(),
    });

    // Mark survey as completed
    const completedSurveys = getCookie("SurveyCompleted")
      ? JSON.parse(getCookie("SurveyCompleted"))
      : [];
    const updatedSurveys = Array.from(new Set([...completedSurveys, surveyId]));
    setCookie("SurveyCompleted", JSON.stringify(updatedSurveys), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    console.log("🔹 All post-save logic complete, navigating to thank-you page");
    
    // 🔹 WAIT A MOMENT BEFORE NAVIGATION
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    router.push('/thank-you');

  } catch (err) {
    console.error("Submission error:", err);
    alert(`Something went wrong: ${err.message || err}`);
    setStatus("");
    throw err; // Re-throw so the caller knows it failed
  }
};

  const expandBlocksByPageBreaks = (blocks, questions) => {
    const expanded = [];

    blocks.forEach((block) => {
      const order = block.questionOrder || [];
      let currentPageQuestions = [];

      order.forEach((qid) => {
        if (qid.startsWith("PB-")) {
          if (currentPageQuestions.length > 0) {
            expanded.push({
              ...block,
              blockId: `${block.blockId}-page-${expanded.length + 1}`,
              questionOrder: [...currentPageQuestions],
            });
          }
          currentPageQuestions = [];
        } else {
          currentPageQuestions.push(qid);
        }
      });

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
  const reorderBlocksForPrefill = (blocksArr, targetQuestionId) => {
    if (!targetQuestionId) return blocksArr;

    const blocksCopy = [...blocksArr];

    // Find the block that contains this question
    const idx = blocksCopy.findIndex((block) =>
      (block.questionOrder || []).includes(targetQuestionId)
    );
    if (idx === -1) return blocksArr;

    const targetBlock = blocksCopy[idx];

    // Ensure this question is first in that block's questionOrder
    let qOrder = targetBlock.questionOrder || [];

    // Remove it from its old place
    qOrder = qOrder.filter((id) => id !== targetQuestionId);

    // Insert at the very beginning (before any PB- markers)
    qOrder = [targetQuestionId, ...qOrder];

    const newTargetBlock = {
      ...targetBlock,
      questionOrder: qOrder,
    };

    // Move that entire block to the front of the survey
    const remaining = blocksCopy.filter((_, i) => i !== idx);
    return [newTargetBlock, ...remaining];
  };
  const prefillAnswers = useMemo(() => {
    if (!prefillQuestionId || !prefillAnswer || !questions.length) return {};

    const q = questions.find(
      (qq) =>
        qq.questionId === prefillQuestionId || qq.id === prefillQuestionId
    );
    if (!q) return {};

    const qid = q.questionId || q.id;
    return { [qid]: prefillAnswer }; // 🔹 we store answer as the option id
  }, [prefillQuestionId, prefillAnswer, questions]);

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
          <SurveyForm
            questions={questions}
            blocks={expandBlocksByPageBreaks(blocks, questions)}
            handleSubmit={handleSubmit}
            rules={rules}
            theme={theme} // <- pass theme into SurveyForm
                        initialAnswers={prefillAnswers}   // 🔹 NEW

          />
        </>
      )}
    </div>
  );
}
