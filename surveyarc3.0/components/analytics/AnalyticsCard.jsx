
import {  NpsAnalytics, BarChartComponent, CheckboxAnalyticsFull, PictureChoiceBarChart, PieChartComponent, RatingBarChart, VerticalMatrixBarChart, YesNoProgressBar } from "@/utils/analytics/graphs";
import { Divider, Paper, Typography } from "@mui/material";

export const AnalyticsCard = ({ data }) => {
  const { label, type, data: chartData, responseCount } = data;
  return (
    <Paper
      elevation={3}
      sx={{ p: 3, my: 2, borderRadius: 2, bgcolor: "background.paper" }}
      aria-label={`Analytics for question ${label}`}
    >
      <Typography variant="h6" gutterBottom>
        {label}
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {type === "text" || type === "textarea" ? (
        <Typography variant="body1">
          Total Responses: <strong>{responseCount}</strong>
        </Typography>
      ) : null}

      {type === "yes_no" && chartData ? (
        <YesNoProgressBar data={chartData} />
      ) : null}
      {type ==='nps' && chartData ? (
<NpsAnalytics data={chartData} onBucketClick={(score) => console.log("Clicked score", score)} />

      ):null}

      {(type === "multiple_choice" || type === "select" ) && chartData ? (
        <PieChartComponent data={chartData} />
      ) : null}

      {type === "rating" && chartData ? (
        <RatingBarChart data={chartData} />
      ) : null}

      {type === "osat" && chartData ? (
        <RatingBarChart data={chartData} />
      ) : null}

      {(type === "number"  )&& chartData ? (
        <BarChartComponent data={chartData} />
      ) : null}

      {type === "picture_choice" && chartData ? (
        <PictureChoiceBarChart data={chartData} />
      ) : null}

      {type === "dropdown" && chartData ? (
        <PieChartComponent data={chartData} />
      ) : null}

 {type === "checkbox" && chartData ? (
  <CheckboxAnalyticsFull
    question={{ label, data: chartData }} // Construct the expected structure
    top={8}
    Chart={BarChartComponent}
    options={{ splitCombined: true, distribution: "full" }}
  />
) : null}

      {type === "matrix" && chartData && data.cols ? (
        <>
          <VerticalMatrixBarChart data={chartData} cols={data.cols} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {chartData?.map((rowData) => {
              const pieData = data.cols.map((col) => ({
                name: col,
                value: rowData[col] || 0,
              }));

              return (
                <div key={rowData.row} className="p-4 bg-white rounded shadow">
                  <h3 className="text-lg font-semibold mb-2">{rowData.row}</h3>
                  <PieChartComponent data={pieData} />
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {!chartData && !responseCount && (
        <Typography>No data available for this question.</Typography>
      )}
    </Paper>
  );
};
