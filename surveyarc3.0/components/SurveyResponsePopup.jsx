"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  Paper,
} from "@mui/material";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

import { calculateAnalytics } from "@/utils/analytics/calculateAnalytics";
import { formatAnswer } from "@/utils/analytics/formatAnswer";
import { AnalyticsCard } from "./analytics/AnalyticsCard";

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

const SurveyResponsePopup = ({ open, onClose, responses, orgId, surveyId }) => {
  const [questions, setQuestions] = useState([]);
  const [tab, setTab] = useState(0);
  const [analytics, setAnalytics] = useState({});

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!surveyId || !orgId) return;
      try {
        const docRef = doc(db, "organizations", orgId, "questions", surveyId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          setQuestions(data.questions || []);
        } else {
          console.warn("No questions found for surveyId:", surveyId);
          setQuestions([]);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };

    fetchQuestions();
  }, [surveyId, orgId]);

  useEffect(() => {
    if (questions.length > 0 && responses.length > 0) {
      const analyticsData = calculateAnalytics(questions, responses);
      setAnalytics(analyticsData);
    } else {
      setAnalytics({});
    }
  }, [questions, responses]);

  const handleChange = (event, newValue) => {
    setTab(newValue);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      scroll="paper"
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          backgroundColor: "background.paper",
          zIndex: 1300,
          borderBottom: 1,
          borderColor: "divider",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          Survey Responses — {responses.length}{" "}
          {responses.length === 1 ? "response" : "responses"}
        </Typography>

        <Tabs value={tab} onChange={handleChange} aria-label="Response tabs">
          <Tab label="Responses" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ pt: 2, minHeight: 400 }}>
        {tab === 0 && (
          <>
            {responses.length === 0 ? (
              <Typography color="text.secondary">
                No responses found.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  maxHeight: "60vh",
                  overflowY: "auto",
                }}
              >
                {responses.map((response, idx) => (
                  <Paper
                    key={idx}
                    elevation={2}
                    sx={{ p: 3, borderRadius: 2 }}
                    aria-label={`Response number ${idx + 1}`}
                  >
                    <Typography variant="h6" gutterBottom>
                      Response {idx + 1}
                    </Typography>

                    <Box
                      component="table"
                      sx={{
                        width: "100%",
                        borderCollapse: "collapse",
                        mb: 2,
                      }}
                    >
                      <tbody>
                        {Object.entries(response)
                          .filter(
                            ([key]) =>
                              key !== "answers" && !EXCLUDED_KEYS.includes(key)
                          )
                          .map(([key, value]) => (
                            <tr
                              key={key}
                              style={{ borderBottom: "1px solid #ddd" }}
                            >
                              <th
                                style={{
                                  textAlign: "left",
                                  padding: "8px",
                                  fontWeight: "600",
                                  width: "25%",
                                  verticalAlign: "top",
                                }}
                              >
                                {key
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                              </th>
                              <td style={{ padding: "8px" }}>
                                {formatAnswer(value)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Box>

                    {response.answers && Array.isArray(response.answers) && (
                      <>
                        <Typography variant="subtitle1" gutterBottom>
                          Answers:
                        </Typography>

                        <Box
                          component="table"
                          sx={{ width: "100%", borderCollapse: "collapse" }}
                        >
                          <thead>
                            <tr
                              style={{
                                backgroundColor: "#f5f5f5",
                                borderBottom: "1px solid #ddd",
                              }}
                            >
                              <th
                                style={{
                                  padding: "8px",
                                  textAlign: "left",
                                  width: "40%",
                                }}
                              >
                                Question
                              </th>
                              <th style={{ padding: "8px", textAlign: "left" }}>
                                Answer
                              </th>
                            </tr>
                          </thead>
                          <tbody>
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
                                <tr
                                  key={`${ans.questionId}-${i}`}
                                  style={{ borderBottom: "1px solid #eee" }}
                                >
                                  <td
                                    style={{
                                      padding: "8px",
                                      verticalAlign: "top",
                                    }}
                                  >
                                    {`${label} (${ans.questionId})`}
                                  </td>
                                  <td style={{ padding: "8px" }}>
                                    {formatAnswer(ans.answer)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </Box>
                      </>
                    )}
                  </Paper>
                ))}
              </Box>
            )}
          </>
        )}

        {tab === 1 && (
          <Box sx={{ maxHeight: "70vh", overflowY: "auto" }}>
            {Object.entries(analytics).length === 0 && (
              <Typography color="text.secondary">
                No analytics data available.
              </Typography>
            )}

            {Object.entries(analytics)
              .filter(([_, data]) => ANALYTICS_SUPPORTED_TYPES.has(data.type))
              .map(([qId, data]) => (
                <AnalyticsCard key={qId} question={qId} data={data} />
              ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          variant="contained"
          color="primary"
          aria-label="Close dialog"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SurveyResponsePopup;
