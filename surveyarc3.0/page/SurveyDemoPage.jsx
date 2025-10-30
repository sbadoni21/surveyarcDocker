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
  const parts = pathname.split("/");
  const orgId = parts[3];
  const projectId = parts[6];
  const surveyId = parts[7];

  const [questions, setQuestions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);

  const { getAllQuestions } = useQuestion();
  const { rules, getAllRules } = useRule();
  const { getSurvey } = useSurvey();

  const shuffleArray = (a) => {
    const x = [...a];
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };

  const applyBlockRandomization = (block) => {
    let order = block.questionOrder || [];
    const type = block.randomization?.type || "none";
    const subsetCount = block.randomization?.subsetCount || "";

    switch (type) {
      case "full":
        order = shuffleArray(order);
        break;
      case "subset": {
        const c = parseInt(subsetCount) || Math.ceil(order.length / 2);
        order = shuffleArray(order).slice(0, c);
        break;
      }
      case "rotate":
        order = [...order.slice(1), order[0]];
        break;
      case "none":
      default:
        break;
    }
    return { ...block, questionOrder: order };
  };

  useEffect(() => {
    const fetchSurveyData = async () => {
      try {
        const s = await getSurvey(surveyId);
        if (!s) return router.push("/404");
        const randomized = (s.blocks || []).map(applyBlockRandomization);
        setSurvey(s);
        setBlocks(randomized);
      } catch (e) {
        console.error("Error fetching survey:", e);
        router.push("/404");
      }
    };
    const fetchQuestions = async () => {
      try {
        const q = await getAllQuestions(orgId, surveyId);
        setQuestions(q || []);
      } catch (e) {
        console.error("Error fetching questions:", e);
      }
    };
    const fetchRules = async () => {
      try {
        await getAllRules(surveyId);
      } catch (e) {
        console.error("Error fetching rules:", e);
      }
    };
    Promise.all([fetchSurveyData(), fetchQuestions(), fetchRules()]).finally(
      () => setLoading(false)
    );
  }, [orgId, projectId, surveyId]);

  useEffect(() => {
    if (blocks.length && questions.length) {
      const ordered = [];
      blocks.forEach((b) =>
        b.questionOrder?.forEach((qid) => {
          const q = questions.find(
            (qq) => qq.id === qid || qq.questionId === qid
          );
          if (q) ordered.push(q);
        })
      );
      const remaining = questions.filter(
        (q) =>
          !ordered.find((o) => o.id === q.id || o.questionId === q.questionId)
      );
      setQuestions([...ordered, ...remaining]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const handleSubmit = async () => alert("Survey submitted!");

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

  if (loading) return <Loading />;
  if (!survey) return <p>Survey not found</p>;

  return (
    <div>
      <div
        style={{
          margin: "16px auto",
          maxWidth: 1300,
          display: "grid",
          gridTemplateColumns: "400px 1fr",
          gap: 10,
          alignItems: "start",
        }}
      >
        {/* ---------------- Phone Frame ---------------- */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, marginBottom: 8, color: "#555" }}>
            Phone
          </div>
          <div
            style={{
              width: 300,
              height: 580,
              borderRadius: 36,
              padding: "18px 10px",
              background: "#000",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 300,
                height: 560,
                background: "#fff",
                borderRadius: 28,
                overflow: "auto",
              }}
            >
              <SurveyForm
                questions={questions}
                blocks={expandBlocksByPageBreaks(blocks, questions)}
                handleSubmit={handleSubmit}
                rules={rules}
              />
            </div>
          </div>
        </div>

        {/* ---------------- Laptop Frame ---------------- */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, marginBottom: 8, color: "#555" }}>
            Laptop
          </div>
          <div
            style={{
              width: "100%",
              maxWidth: 1000,
              height: 620,
              borderRadius: 12,
              background: "#e8e8e8",
              padding: "12px 12px 0 12px",
              boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              position: "relative",
            }}
          >
            {/* Screen area */}
            <div
              style={{
                background: "#fff",
                height: "100%",
                borderRadius: 8,
                overflow: "auto",
              }}
            >
              <SurveyForm
                questions={questions}
                blocks={expandBlocksByPageBreaks(blocks, questions)}
                handleSubmit={handleSubmit}
                rules={rules}
              />
            </div>

            {/* Laptop base */}
            <div
              style={{
                width: "110%",
                height: 20,
                background: "#c0c0c0",
                borderRadius: "0 0 12px 12px",
                position: "absolute",
                bottom: -20,
                left: "-5%",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
