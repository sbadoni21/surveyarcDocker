"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { getCookie, setCookie } from "cookies-next";
import {
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";

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
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responseId, setResponseId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [status, setStatus] = useState("");
  const { getAllQuestions } = useQuestion();
  const { getSurvey } = useSurvey();

  useEffect(() => {
    if (!responseId && orgId && surveyId) {
      const newRef = doc(
        collection(db, "organizations", orgId, "surveys", surveyId, "responses")
      );
      setResponseId(newRef.id);
    }
  }, [orgId, surveyId, responseId]);

  useEffect(() => {
    const init = async () => {
      // avoid running until we have required params
      if (!orgId || !surveyId || !projectId) return;

      const isSurveyDone = getCookie("SurveyCompleted");
      if (isSurveyDone === surveyId) {
        setIsCompleted(true);
        setLoading(false);
        return;
      }

      try {
        const survey = await getSurvey(orgId, surveyId);
        if (!survey) throw new Error("Survey not found");

        setBlocks(
          (survey.blocks || []).map((b) => ({
            ...b,
            questionOrder: b.questionOrder || [],
          }))
        );

        const qs = await getAllQuestions(orgId, surveyId);
        setQuestions(qs);

        const snapshot = await getDocs(
          collection(db, "organizations", orgId, "surveys", surveyId, "rules")
        );
        setRules(snapshot.docs.map((d) => d.data()));
      } catch (err) {
        console.error(err);
        router.push("/404");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [orgId, projectId, surveyId, getAllQuestions, getSurvey, router]);

  const handleSubmit = async (answers) => {
    try {
      if (!responseId) {
        alert("Preparing form… please try again in a moment.");
        return;
      }

      const endTime = new Date();
      const totalMs = endTime - startTime;
      const totalMinutes = Math.floor(totalMs / 60000);
      const totalSeconds = Math.floor((totalMs % 60000) / 1000);

      const responseRef = doc(
        db,
        "organizations",
        orgId,
        "surveys",
        surveyId,
        "responses",
        responseId
      );

      const embeddedAnswers = Object.entries(answers).map(
        ([questionId, answerValue]) => ({
          questionId,
          projectId,
          answer: answerValue,
        })
      );

      const batch = writeBatch(db);

      batch.set(responseRef, {
        orgId,
        projectId,
        surveyId,
        campaignID,
        campaignType,
        platform,
        userContactId: userKey,
        createdAt: serverTimestamp(),
        answers: embeddedAnswers,
        uid: responseId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalTime: `${totalMinutes}m ${totalSeconds}s`,
      });

      if (userKey) {
        const contactRef = doc(db, "organizations", orgId, "contacts", userKey);
        batch.set(
          contactRef,
          {
            surveys: [
              {
                surveyId,
                responseId,
                projectId,
              },
            ],
          },
          { merge: true }
        );
      }
      const orgRef = doc(db, "organizations", orgId);
      batch.set(
        orgRef,
        { subscription: { currentusage: { response: increment(1) } } },
        { merge: true }
      );
      await batch.commit();

      setCookie("SurveyCompleted", surveyId);

      setStatus("Saving to Salesforce…");
      const res = await fetch("/api/salesforce/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, surveyId, projectId, responseId }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.warn("Salesforce ingest failed:", t);
        setStatus("Saved locally, Salesforce push failed.");
      } else {
        setStatus("Saved to Salesforce.");
      }

      window.location.href = "/thank-you";
    } catch (err) {
      console.error("Submission error:", err);
      alert("Something went wrong. Please try again.");
    }
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
            blocks={blocks}
            handleSubmit={handleSubmit}
            rules={rules}
          />
        </>
      )}
    </div>
  );
}
