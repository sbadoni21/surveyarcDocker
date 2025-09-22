export function calculateAnalytics(questions, responses) {
  const analytics = {};

  for (const question of questions) {
    const qId = question.questionId;
    const qLabel = question.label || question.config?.label || qId;
    const qType = question.type || "text";

    const answersForQuestion = [];

    responses.forEach((resp) => {
      if (!resp.answers) return;
      const ansObj = resp.answers.find((a) => a.questionId === qId);
      if (ansObj) answersForQuestion.push(ansObj.answer);
    });

    if (qType === "matrix") {
      const matrixRows = question.config?.rows || [];
      const matrixCols = question.config?.cols || [];
      const counts = {};
      answersForQuestion.forEach((answer, i) => {
        if (!answer?.value) {
          return;
        }
        Object.entries(answer.value).forEach(([row, rating]) => {
          if (!row || !rating) {
            return;
          }
          const col = rating.trim();
          counts[row] = counts[row] || {};
          counts[row][col] = (counts[row][col] || 0) + 1;
        });
      });

      const transformed = matrixRows.map((row) => {
        const rowObj = { row };
        matrixCols.forEach((col) => {
          const count = counts[row]?.[col] || 0;
          rowObj[col] = count;
        });
        return rowObj;
      });

      analytics[qId] = {
        label: qLabel,
        type: qType,
        rows: matrixRows,
        cols: matrixCols,
        data: transformed,
      };
    } else if (qType === "rating") {
      const numbers = answersForQuestion.filter((a) => typeof a === "number");
      const counts = {};
      numbers.forEach((n) => {
        counts[n] = (counts[n] || 0) + 1;
      });

      const fullData = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: counts[rating] || 0,
      }));

      analytics[qId] = {
        label: qLabel,
        type: qType,
        data: fullData,
      };
    } else if (qType === "number") {
      const numbers = answersForQuestion.filter((a) => typeof a === "number");
      const avg =
        numbers.length > 0
          ? +(numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)
          : 0;
      analytics[qId] = {
        label: qLabel,
        type: qType,
        data: [{ name: qLabel, average: avg }],
      };
    } else if (
      qType === "choice" ||
      qType === "multiple_choice" ||
      qType === "select"
    ) {
      const counts = {};
      answersForQuestion.forEach((answer) => {
        if (Array.isArray(answer)) {
          answer.forEach((ans) => {
            counts[ans] = (counts[ans] || 0) + 1;
          });
        } else if (answer) {
          counts[answer] = (counts[answer] || 0) + 1;
        }
      });

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const data = Object.entries(counts).map(([key, val]) => ({
        name: key,
        value: val,
        percent: (val / total).toFixed(2),
      }));

      analytics[qId] = {
        label: qLabel,
        type: qType,
        data,
      };
    } else if (qType === "text" || qType === "textarea") {
      analytics[qId] = {
        label: qLabel,
        type: qType,
        responseCount: answersForQuestion.length,
      };
    } else {
      const counts = {};
      answersForQuestion.forEach((answer) => {
        if (answer) {
          counts[answer.toString()] = (counts[answer.toString()] || 0) + 1;
        }
      });
      analytics[qId] = {
        label: qLabel,
        type: qType,
        data: Object.entries(counts).map(([key, val]) => ({
          name: key,
          value: val,
        })),
      };
    }
  }

  return analytics;
}