"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import SurveyForm from "@/components/SurveyForm";
import { useQuestion } from "@/providers/questionPProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import Loading from "@/app/[locale]/loading";
import { useRule } from "@/providers/rulePProvider";
import { useTheme } from "@/providers/postGresPorviders/themeProvider";

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
  const [theme, setTheme] = useState(null);
  const { getById } = useTheme();

  const [isMobile, setIsMobile] = useState(false);

  // detect mobile on mount and on resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(max-width: 640px)");
    const update = () => setIsMobile(Boolean(mq.matches));
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

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
        if (s?.theme_id) {
          try {
            const th = await getById(s.theme_id);
            setTheme(th || null);
          } catch (err) {
            console.error("Failed to load theme:", err);
            setTheme(null);
          }
        } else {
          setTheme(null);
        }
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
        if (String(qid).startsWith("PB-")) {
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

  if (loading) return <Loading />;
  if (!survey) return <p>Survey not found</p>;

  // compact data once for both frames
  const preparedBlocks = expandBlocksByPageBreaks(blocks, questions);

  return (
    <div className="h-full overflow-hidden">
      <div
        style={{
          margin: "16px auto",
          maxWidth: 1300,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "400px 1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Phone Frame */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {!isMobile && (
            <div style={{ fontSize: 12, marginBottom: 8, color: "#aaa" }}>
              Phone
            </div>
          )}

          <div
            style={{
              width: isMobile ? "100%" : 360,
              maxWidth: 420,
              height: isMobile ? "calc(100vh - 120px)" : 620,
              borderRadius: 36,
              padding: "18px 10px",
              background: "#000",
              boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#000",
                borderRadius: 28,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Scrollable phone screen */}
              <div
                style={{
                  flex: 1,
                  background: "#000",
                  overflowY: "auto", // ENABLE SCROLLING
                  overflowX: "hidden",
                  paddingBottom: 20,
                }}
              >
                <SurveyForm
                  questions={questions}
                  blocks={preparedBlocks}
                  handleSubmit={handleSubmit}
                  rules={rules}
                  embedded={true}
                  embeddedDevice="mobile" // FORCE MOBILE UI
                  theme={theme}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Laptop Frame (hide on mobile) */}
        {!isMobile && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, marginBottom: 8, color: "#aaa" }}>
              Laptop
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 1000,
                height: 640,
                borderRadius: 12,
                background: "#000", // black background
                padding: "12px 12px 0 12px",
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden", // prevents outer scroll leakage
              }}
            >
              <div
                style={{
                  background: "#000",
                  height: "100%",
                  borderRadius: 8,
                  overflowY: "auto", // enable vertical scroll
                  overflowX: "hidden",
                  scrollbarWidth: "thin", // firefox
                }}
              >
                <SurveyForm
                  questions={questions}
                  blocks={preparedBlocks}
                  handleSubmit={handleSubmit}
                  rules={rules}
                  embedded={true}
                  theme={theme}
                />
              </div>

              {/* laptop base */}
              <div
                style={{
                  width: "110%",
                  height: 20,
                  background: "#0b0b0b",
                  borderRadius: "0 0 12px 12px",
                  position: "absolute",
                  bottom: -20,
                  left: "-5%",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
