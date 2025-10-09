"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";

import { useRule } from "@/providers/rulePProvider";

export default function SurveyDemoPage() {
  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const projectId = pathParts[6];
  const surveyId = pathParts[7];

  const [questions, setQuestions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);
  const { getAllQuestions } = useQuestion();
  const { rules, getAllRules } = useRule();
  const { getSurvey } = useSurvey();

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

    Promise.all([fetchSurveyData(), fetchQuestions(), fetchRules()]).finally(
      () => setLoading(false)
    );
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
