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
import { useTheme } from "@/providers/postGresPorviders/themeProvider";
import TicketModel from "@/models/ticketModel";
import { useCampaignResult } from "@/providers/postGresPorviders/campaginResultProvider";

export default function FormPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL parameters
  const sourceId = searchParams.get("source_id") || null;
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
  const [campaignResult, setCampaignResult] = useState(null);
  const { createCampaignResult, updateCampaignResult, getOrCreateCampaignResult } = useCampaignResult();

  const platform = useMemo(() => {
    return campaignType?.toLowerCase() === "social media"
      ? searchParams.get("platform") || null
      : null;
  }, [campaignType, searchParams]);

  // State
  const [questions, setQuestions] = useState([]);
  const [survey, setSurvey] = useState(null);
  const [theme, setTheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [status, setStatus] = useState("");
  const [participantSource, setParticipantSource] = useState(null);

  // Providers
  const { getAllQuestions } = useQuestion();
  const { getSurvey } = useSurvey();
  const { rules = [], getAllRules } = useRule() || {};
  const { saveResponse } = useResponse();
  const { updateContact } = useContacts();
  const { organisation, update } = useOrganisation();
  const { getById } = useTheme();

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

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
      case "subset": {
        const count = parseInt(subsetCount) || Math.ceil(questionOrder.length / 2);
        questionOrder = shuffleArray(questionOrder).slice(0, count);
        break;
      }
      case "rotate":
        questionOrder = [...questionOrder.slice(1), questionOrder[0]];
        break;
      case "none":
      default:
        break;
    }

    return { ...block, questionOrder };
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
    const idx = blocksCopy.findIndex((block) =>
      (block.questionOrder || []).includes(targetQuestionId)
    );
    
    if (idx === -1) return blocksArr;

    const targetBlock = blocksCopy[idx];
    let qOrder = targetBlock.questionOrder || [];
    qOrder = qOrder.filter((id) => id !== targetQuestionId);
    qOrder = [targetQuestionId, ...qOrder];

    const newTargetBlock = { ...targetBlock, questionOrder: qOrder };
    const remaining = blocksCopy.filter((_, i) => i !== idx);
    
    return [newTargetBlock, ...remaining];
  };

  // ============================================================
  // PANEL VARIABLE COLLECTION - FIXED VERSION
  // ============================================================

useEffect(() => {
  if (!campaignID || !contactID || campaignResult) return;

  const run = async () => {
    try {
      console.log("🟢 Getting or creating CampaignResult");
      
      const result = await getOrCreateCampaignResult({
        campaignId: campaignID,
        orgId,
        projectId,
        contactId: contactID,
        contactEmail: searchParams.get("email") || null,
        contactPhone: searchParams.get("phone") || null,
        status: "pending",
        channel: campaignType || "email",
        metaData: {
          entry_type: "survey_open",
          source: "form_page",
          raw_query: Object.fromEntries(searchParams.entries()),
          panel_vars: collectPanelVariables(),
          timestamp: new Date().toISOString(),
        },
      });
      
      setCampaignResult(result);
      console.log("✅ CampaignResult ready:", result.resultId);
    } catch (err) {
      console.error("❌ Failed to get/create CampaignResult", err);
    }
  };

  run();
}, [campaignID, contactID, campaignResult]);
  const collectPanelVariables = () => {
    console.log("🔍 collectPanelVariables called");
    console.log("🔍 participantSource:", participantSource);
    
    if (!participantSource?.url_variables || !Array.isArray(participantSource.url_variables)) {
      console.warn("⚠️ No url_variables configured in participant source");
      return {};
    }

    const collected = {};
    const urlVars = participantSource.url_variables;
    
    console.log("🔍 URL Variables config:", JSON.stringify(urlVars, null, 2));
    console.log("🔍 All URL params:", Object.fromEntries(searchParams.entries()));

    urlVars.forEach((varConfig) => {
      const customName = varConfig.var_name; // e.g., "piasdasasdadddadsaa"
      const mappedName = varConfig.mapped_to; // e.g., "pid"
      
      // Try to get value from URL using custom name
      const value = searchParams.get(customName);
      
      console.log(`🔍 Looking for "${customName}" in URL → found: "${value}"`);

      if (value) {
        collected[customName] = {
          value: value,
          mapped_to: mappedName,
          custom_name: customName,
          required: varConfig.required,
          description: varConfig.description,
        };

        console.log(`✅ Collected: ${customName}="${value}" (maps to: ${mappedName || 'none'})`);
      } else if (varConfig.required) {
        console.warn(`⚠️ Required variable "${customName}" missing from URL`);
      }
    });

    console.log("🔍 Final collected variables:", JSON.stringify(collected, null, 2));
    return collected;
  };

  // ============================================================
  // PANEL REDIRECT URL BUILDER - FIXED VERSION
  // ============================================================

  const buildPanelRedirectUrl = (statusKey) => {
    console.log("🔧 buildPanelRedirectUrl called with status:", statusKey);
    
    if (!participantSource) {
      console.error("❌ No participant source available");
      return null;
    }

    const exits = participantSource.exit_pages || {};
    const cfg = exits[statusKey];
    if (!cfg?.redirect_url) {
      console.error(`❌ No redirect URL for status: ${statusKey}`);
      console.log("Available exits:", Object.keys(exits));
      return null;
    }

    let url = cfg.redirect_url;
    console.log(`🔧 Original template URL: "${url}"`);

    // Collect panel variables
    const panelVars = collectPanelVariables();
    console.log(`🔧 Collected ${Object.keys(panelVars).length} panel variables`);

    if (Object.keys(panelVars).length === 0) {
      console.error("❌ No panel variables collected - URL will not be modified");
      return url;
    }

    // Process each collected variable
    Object.entries(panelVars).forEach(([customName, varData]) => {
      const { value, mapped_to } = varData;
      
      if (!value) {
        console.warn(`⚠️ Skipping "${customName}" - no value`);
        return;
      }

      // Determine which variable name to look for in template
      const templateVarName = mapped_to || customName;
      console.log(`🔧 Replacing template variable "${templateVarName}" with value "${value}"`);

      const encodedValue = encodeURIComponent(value);

      // Try different placeholder patterns
      const patterns = [
        { pattern: new RegExp(`\\$\\{${templateVarName}\\}`, "g"), name: '${...}' },
        { pattern: new RegExp(`\\[${templateVarName}\\]`, "g"), name: '[...]' },
        { pattern: new RegExp(`\\[%${templateVarName}%\\]`, "g"), name: '[%...%]' },
        { pattern: new RegExp(`%${templateVarName}%`, "g"), name: '%...%' },
        { pattern: new RegExp(`\\{${templateVarName}\\}`, "g"), name: '{...}' },
      ];

      let replacementMade = false;

      patterns.forEach(({ pattern, name }) => {
        const before = url;
        url = url.replace(pattern, encodedValue);
        
        if (url !== before) {
          console.log(`✅ Replaced ${name} pattern: "${templateVarName}" → "${value}"`);
          replacementMade = true;
        }
      });

      if (!replacementMade) {
        console.error(`❌ Template variable "${templateVarName}" NOT FOUND in URL!`);
        console.log(`   Searched in: "${cfg.redirect_url}"`);
      }
    });

    console.log(`🎯 Final redirect URL: "${url}"`);
    
    // Check if any variables are still unreplaced
    const unreplacedVars = url.match(/\$\{[^}]+\}|\[[^\]]+\]|%[^%]+%/g);
    if (unreplacedVars) {
      console.error(`⚠️ WARNING: Unreplaced variables detected: ${unreplacedVars.join(', ')}`);
    }

    return url;
  };

  // ============================================================
  // PANEL EXIT HANDLER (for termination/quota scenarios)
  // ============================================================

  const handlePanelExit = async (exitType) => {
    if (!sourceId) return false;

    try {
      await fetch(
        `/api/post-gres-apis/participant-sources/${encodeURIComponent(
          sourceId
        )}/track/${exitType}`,
        { method: "POST" }
      ).catch((err) => console.error(`Failed to track ${exitType}:`, err));

      const redirectUrl = buildPanelRedirectUrl(exitType);
if (campaignResult) {
  await updateCampaignResult(campaignResult.resultId, {
    status: exitType === "quota_full" ? "skipped" : "failed",
    failed_at: new Date().toISOString(),
    failure_reason: exitType,
  });
}

      if (redirectUrl) {
        console.log(`🚀 Panel ${exitType} redirect:`, redirectUrl);
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (typeof window !== "undefined") {
          window.location.href = redirectUrl;
          return true;
        }
      }
    } catch (e) {
      console.error(`❌ Panel ${exitType} error:`, e);
    }

    return false;
  };

  // ============================================================
  // EFFECTS
  // ============================================================

  // Load survey data
  useEffect(() => {
    const init = async () => {
      if (!orgId || !surveyId) return;

      let completedSurveys = [];
      try {
        completedSurveys = getCookie("SurveyCompleted")
          ? JSON.parse(getCookie("SurveyCompleted"))
          : [];
      } catch {
        completedSurveys = [];
      }

      if (Array.isArray(completedSurveys) && completedSurveys.includes(surveyId)) {
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

            let randomizedBlocks = (surveyDoc.blocks || []).map(applyBlockRandomization);
            randomizedBlocks = reorderBlocksForPrefill(randomizedBlocks, prefillQuestionId);

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
  }, [orgId, surveyId]);

  // Load participant source configuration
  useEffect(() => {
    if (!sourceId) return;

    const run = async () => {
      try {
        console.log("🔄 Loading participant source config for:", sourceId);
        
        // Track click
        fetch(
          `/api/post-gres-apis/participant-sources/${encodeURIComponent(sourceId)}/track/click`,
          { method: "POST" }
        ).catch((err) => console.error("Failed to track click:", err));

        // Track start
        fetch(
          `/api/post-gres-apis/participant-sources/${encodeURIComponent(sourceId)}/track/start`,
          { method: "POST" }
        ).catch((err) => console.error("Failed to track start:", err));

        // Load participant source config
        const res = await fetch(
          `/api/post-gres-apis/participant-sources/${encodeURIComponent(sourceId)}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error("Failed to load participant source");

        const data = await res.json();
        
        console.log("✅ Participant source loaded:", {
          name: data.source_name,
          provider: data.meta_data?.provider,
          url_variables: data.url_variables,
          exit_pages: data.exit_pages,
        });
        
        setParticipantSource(data);

      } catch (e) {
        console.error("❌ Panel bootstrap error:", e);
      }
    };

    run();
  }, [sourceId]);

  // Reorder questions based on blocks
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
  }, [blocks, questions.length]);

  // Prefill answers
  const prefillAnswers = useMemo(() => {
    if (!prefillQuestionId || !prefillAnswer || !questions.length) return {};

    const q = questions.find(
      (qq) => qq.questionId === prefillQuestionId || qq.id === prefillQuestionId
    );
    
    if (!q) return {};

    const qid = q.questionId || q.id;
    return { [qid]: prefillAnswer };
  }, [prefillQuestionId, prefillAnswer, questions]);

  // ============================================================
  // SUBMIT HANDLER
  // ============================================================

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

      const panelVars = collectPanelVariables();

      const responseData = {
        respondent_id: respondentId,
        status: surveyStatus === "test" ? "test_completed" : "completed",
        source_id: sourceId || undefined,

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

          panel: sourceId
            ? {
                source_id: sourceId,
                source_name: participantSource?.source_name || null,
                provider: participantSource?.meta_data?.provider || null,
                variables: panelVars,
                raw_query: Object.fromEntries(searchParams.entries()),
              }
            : null,
        },
        answers: Object.entries(answers).map(([questionId, answerValue]) => ({
          questionId,
          projectId,
          answer: answerValue,
        })),
      };

      console.log("💾 Saving response...");
      const savedResponse = await saveResponse(orgId, surveyId, responseData);
      console.log("✅ Response saved:", savedResponse.response_id);
      setResponseId(savedResponse.response_id);
if (campaignResult) {
  await updateCampaignResult(campaignResult.resultId, {
    survey_completed_at: new Date().toISOString(),
    survey_response_id: savedResponse.response_id,
    status: "completed",
  });
}

      // Update contact
      if (contactID) {
        await updateContact(contactID, {
          surveys: [{
            surveyId,
            responseId: savedResponse.response_id,
            projectId,
          }],
        });
      }

      // Update ticket
      if (ticketID) {
        try {
          const ticket = await TicketModel.get(ticketID);
          const updatedFollowup = {
            ...(ticket.followup || {}),
            mode: "survey",
            surveyId,
            responseId: savedResponse.response_id,
          };
          await TicketModel.update(ticketID, { followup: updatedFollowup });
        } catch (err) {
          console.error("Failed to update ticket:", err);
        }
      }

      // Update organization usage
      const currentUsage = organisation?.subscription?.currentusage?.response || 0;
      await update(orgId, {
        subscription: { currentusage: { response: currentUsage + 1 } },
        last_activity: new Date().toISOString(),
      });

      // Mark as completed
      const completedSurveys = getCookie("SurveyCompleted")
        ? JSON.parse(getCookie("SurveyCompleted"))
        : [];
      const updatedSurveys = Array.from(new Set([...completedSurveys, surveyId]));
      setCookie("SurveyCompleted", JSON.stringify(updatedSurveys), {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });

      console.log("🔹 Post-save complete. Handling redirect...");

      // PANEL REDIRECT LOGIC
      if (sourceId && surveyStatus !== "test") {
        try {
          // Track completion
          await fetch(
            `/api/post-gres-apis/participant-sources/${encodeURIComponent(
              sourceId
            )}/track/complete`,
            { method: "POST" }
          ).catch((err) => console.error("Failed to track complete:", err));

          // Build and execute redirect
          const redirectUrl = buildPanelRedirectUrl("qualified");

          if (redirectUrl) {
            console.log("🚀 Redirecting to panel:", redirectUrl);
            await new Promise((resolve) => setTimeout(resolve, 500));

            if (typeof window !== "undefined") {
              window.location.href = redirectUrl;
              return;
            }
          } else {
            console.warn("⚠️ No panel redirect URL. Using fallback.");
          }
        } catch (e) {
          console.error("❌ Panel redirect error:", e);
        }
      }

      // Fallback
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/thank-you");
    } catch (err) {
      console.error("❌ Submission error:", err);
      alert(`Something went wrong: ${err.message || err}`);
      setStatus("");
      throw err;
    }
  };
useEffect(() => {
  if (!campaignResult) return;

  const markStarted = async () => {
    if (campaignResult.surveyStartedAt) return;

    console.log("🟡 Marking survey started");

    await updateCampaignResult(campaignResult.resultId, {
      survey_started_at: new Date().toISOString(),
    });
  };

  markStarted();
}, [campaignResult]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>
      {loading ? (
        <Loading />
      ) : isCompleted ? (
        <p style={{ textAlign: "center", marginTop: "2rem", fontSize: "1.2rem" }}>
          ✅ You have already completed the survey. Thank you!
        </p>
      ) : (
        <SurveyForm
          questions={questions}
          blocks={expandBlocksByPageBreaks(blocks, questions)}
          handleSubmit={handleSubmit}
          rules={rules}
          theme={theme}
          initialAnswers={prefillAnswers}
          onPanelExit={handlePanelExit}
        />
      )}
    </div>
  );
}