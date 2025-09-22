import { Box, Typography, useTheme } from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#A569BD",
  "#DC7633",
  "#45B39D",
  "#E74C3C",
  "#5D6D7E",
];

export const YesNoProgressBar = ({ data }) => {
  const theme = useTheme();

  const yesValue = data.find((d) => d.name.toLowerCase() === "yes")?.value || 0;
  const noValue = data.find((d) => d.name.toLowerCase() === "no")?.value || 0;
  const total = yesValue + noValue;

  const yesPercent = total > 0 ? (yesValue / total) * 100 : 0;
  const noPercent = total > 0 ? (noValue / total) * 100 : 0;

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 1,
          px: 0.5,
        }}
      >
        <Typography variant="body2" color="success.main">
          Yes: {yesPercent.toFixed(0)}%
        </Typography>
        <Typography variant="body2" color="error.main">
          No: {noPercent.toFixed(0)}%
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          height: 20,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: theme.palette.grey[300],
        }}
      >
        <Box
          sx={{
            width: `${yesPercent}%`,
            backgroundColor: theme.palette.success.main,
            transition: "width 0.5s",
          }}
        />
        <Box
          sx={{
            width: `${noPercent}%`,
            backgroundColor: theme.palette.error.main,
            transition: "width 0.5s",
          }}
        />
      </Box>
    </Box>
  );
};

export const PictureChoiceBarChart = ({ data }) => {
  if (!data || data.length === 0)
    return <Typography>No data available</Typography>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
      >
        <XAxis
          dataKey="name"
          interval={0}
          angle={0}
          height={80}
          tickFormatter={() => ""}
          tick={({ x, y, payload }) => (
            <foreignObject x={x - 20} y={y + 10} width={40} height={40}>
              <img
                src={payload.value}
                alt="choice"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #1976d2",
                }}
              />
            </foreignObject>
          )}
        />
        <YAxis allowDecimals={false} />
        <Tooltip
          formatter={(value) => [`${value} votes`, 'Selected']}
          labelFormatter={() => ''}
        />
        <Bar dataKey="value" fill="#1976d2">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const VerticalMatrixBarChart = ({ data, cols }) => {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 40, bottom: 40 }}
      >
        <XAxis dataKey="row" />
        <YAxis />
        <Tooltip />
        <Legend />
        {cols.map((col, idx) => (
          <Bar
            key={col}
            dataKey={col}
            fill={COLORS[idx % COLORS.length]}
            name={col}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export const PieChartComponent = ({ data }) => {
  const theme = useTheme();

  if (!data || data.length === 0) return <Typography>No data</Typography>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={80}
          fill={theme.palette.primary.main}
          label={({ name, percent }) =>
            percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ""
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, "Count"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const BarChartComponent = ({
  data,
  dataKey = "average",
  nameKey = "service",
}) => {
  const theme = useTheme();

  if (!data || data.length === 0) return <Typography>No data</Typography>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis dataKey={nameKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={dataKey} fill={theme.palette.primary.main} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const RatingBarChart = ({ data }) => {
  const theme = useTheme();

  if (!data || data.length === 0) return <Typography>No data</Typography>;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <XAxis
          dataKey="rating"
          label={{ value: "Rating", position: "insideBottom", offset: -5 }}
        />
        <YAxis
          allowDecimals={false}
          label={{
            value: "No. of responses",
            angle: -90,
            position: "insideLeft",
          }}
        />
        <Tooltip />
        <Bar dataKey="count" fill={theme.palette.primary.main} />
      </BarChart>
    </ResponsiveContainer>
  );
};
