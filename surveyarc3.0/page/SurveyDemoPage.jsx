"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export default function SurveyDemoPage() {
  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const projectId = pathParts[6];
  const surveyId = pathParts[7];

  const [questions, setQuestions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);

  const { getAllQuestions } = useQuestion();
  const { getSurvey } = useSurvey();

  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        const surveyDoc = await getSurvey(orgId, surveyId);
        if (!surveyDoc) {
          router.push("/404");
          return;
        }
        setSurvey(surveyDoc);

        const blocksFromSurvey = (surveyDoc.blocks || []).map((b) => ({
          ...b,
          questionOrder: b.questionOrder || [],
        }));

        setBlocks(blocksFromSurvey);
      } catch (err) {
        console.error(err);
        router.push("/404");
      }
    };

    const fetchQuestions = async () => {
      try {
        const questionsData = await getAllQuestions(orgId, surveyId);
        setQuestions(questionsData || []);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchRules = async () => {
      try {
        const snapshot = await getDocs(
          collection(db, "organizations", orgId, "surveys", surveyId, "rules")
        );
        const rulesData = snapshot.docs
          .map((doc) => doc.data())
          .filter((r) => r.surveyId === surveyId);
        setRules(rulesData);
      } catch (err) {
        console.error(err);
      }
    };

    Promise.all([fetchSurveyData(), fetchQuestions(), fetchRules()]).finally(() =>
      setLoading(false)
    );
  }, [orgId, projectId, surveyId]);

  const handleSubmit = async (answers) => {
    alert("Survey submitted!");
  };

  if (loading) return <Loading />;
  if (!survey) return <p>Survey not found</p>;

  return (
    <SurveyForm
      questions={questions}
      blocks={blocks}
      handleSubmit={handleSubmit}
      rules={rules}
    />
  );
}
