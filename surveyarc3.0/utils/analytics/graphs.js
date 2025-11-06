import { Box, Typography, useTheme } from "@mui/material";
import { useMemo, useState } from "react";
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
import {
  aggregateCheckboxResponses,
  countSelectionsPerRow,
  topCombinations,
  cooccurrenceMatrix,
  cumulativeCoverage,
} from "@/utils/analytics/aggregateCheckboxResponses.js";
import { computeNps, npsInterpretation } from "./npsAnalytics";
import { AlertCircle, Minus, TrendingDown, TrendingUp, Users } from "lucide-react";



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


// Color palette for bars
const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', 
  '#06b6d4', '#6366f1', '#f97316', '#14b8a6', '#a855f7'
];

export const  CheckboxAnalyticsFull = ({ question, options = {}, top = 8, onChoiceClick }) =>{
  const rows = question?.data || [];
  const label = question?.label || "Question";

  const agg = useMemo(() => aggregateCheckboxResponses(rows, options), [rows, options]);
  const dist = useMemo(() => countSelectionsPerRow(rows, options), [rows, options]);
  const combos = useMemo(() => topCombinations(rows, 10), [rows]);
  const cooc = useMemo(() => cooccurrenceMatrix(rows, options), [rows, options]);
  const coverage = useMemo(() => cumulativeCoverage(agg.aggregated, 80), [agg]);

  const avgSelectionsPerRespondent = useMemo(() => {
    if ((agg.totalRows || 0) === 0) return 0;
    return Number((agg.totalSelections / agg.totalRows).toFixed(2));
  }, [agg]);

  const [highlight, setHighlight] = useState(null);

  return (
    <section className="bg-white rounded-xl shadow p-6 my-4">
      <header className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500 mt-1">Multi-select / checkbox — best-practice analytics below</p>
        </div>
        <div className="flex gap-4 items-center text-sm text-gray-600">
          <div>Rows: <strong className="text-gray-900">{agg.totalRows}</strong></div>
          <div>Total selections: <strong className="text-gray-900">{agg.totalSelections}</strong></div>
          <div>Avg selections/respondent: <strong className="text-gray-900">{avgSelectionsPerRespondent}</strong></div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Top choices + bar list */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4 border">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Top choices</h3>
            <div className="space-y-3">
              {agg.aggregated.slice(0, top).map((r, idx) => {
                const pct = agg.totalSelections ? (r.value / agg.totalSelections)*100 : 0;
                return (
                  <div key={r.name} className="flex items-center gap-4">
                    <div className="w-6 text-sm font-semibold" style={{color: COLORS[idx % COLORS.length]}}>{idx+1}</div>
                    <div className="flex-1 min-w-0">
                      <button
                        className="text-left w-full"
                        onClick={() => onChoiceClick?.(r.name)}
                        title={r.name}
                      >
                        <div className="text-sm text-gray-800 truncate">{r.name}</div>
                        <div className="w-full bg-white rounded h-2 mt-2 overflow-hidden">
                          <div className="h-2 rounded" style={{ width: `${Math.max(2, pct)}%`, backgroundColor: COLORS[idx % COLORS.length] }} />
                        </div>
                      </button>
                    </div>
                    <div className="w-28 text-right">
                      <div className="text-sm font-medium text-gray-900">{r.value}</div>
                      <div className="text-xs text-gray-500">{pct.toFixed(1)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {agg.aggregated.length > top && (
              <div className="mt-3 text-xs text-gray-500">Showing top {top} choices. Use "All choices" below to view full list.</div>
            )}
          </div>

          {/* Selection count distribution */}
          <div className="bg-white rounded-lg p-4 border">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">How many options respondents selected</h3>
            <div className="flex gap-4 items-end">
              {dist.distribution.map((d) => {
                const pct = dist.totalRows ? (d.rows / dist.totalRows) * 100 : 0;
                return (
                  <div key={d.count} className="text-center">
                    <div className="h-32 w-8 bg-gray-100 rounded-b flex items-end justify-center overflow-hidden">
                      <div className="w-full rounded-b" style={{ height: `${Math.max(4,pct)}%`, background: "#3b82f6" }} />
                    </div>
                    <div className="mt-2 text-xs text-gray-700">{d.count}</div>
                    <div className="text-xs text-gray-500">{d.rows} ({pct.toFixed(0)}%)</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              This helps to understand whether respondents mostly pick single options or many. High avg selections can indicate multi-channel behavior.
            </p>
          </div>

          {/* Top exact combinations */}
          <div className="bg-white rounded-lg p-4 border">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Top exact combinations</h3>
            {combos.length ? (
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                {combos.map((c, i) => {
                  const pct = agg.totalSelections ? (c.value / agg.totalSelections)*100 : 0;
                  return (
                    <li key={c.comb} className="flex justify-between items-baseline">
                      <div className="truncate mr-4">{c.comb}</div>
                      <div className="text-right text-xs text-gray-600">
                        <div className="font-medium text-gray-900">{c.value}</div>
                        <div>{pct.toFixed(1)}%</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <div className="text-sm text-gray-500">No combinations found.</div>}
            <p className="mt-3 text-xs text-gray-500">Exact combinations show commonly co-selected sets (useful for bundling & merchandising).</p>
          </div>
        </div>

        {/* Right: Co-occurrence matrix + coverage */}
        <aside className="space-y-6">
          <div className="bg-white rounded-lg p-4 border">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Cumulative coverage</h4>
            <div className="text-xs text-gray-600 mb-3">How many top choices cover ~80% of selections</div>
            <div className="space-y-2">
              {coverage.steps.map((s, idx) => (
                <div key={s.name} className="flex items-center justify-between text-sm">
                  <div className="truncate mr-2">{idx+1}. {s.name}</div>
                  <div className="text-right">
                    <div className="text-xs text-gray-700 font-semibold">{s.cumPct.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-500">If few items cover large percent, you can prioritize those in product placement.</div>
          </div>

          <div className="bg-white rounded-lg p-2 border overflow-auto max-h-72">
            <h4 className="text-sm font-semibold text-gray-700 px-3 py-2">Co-occurrence (matrix)</h4>
            <div className="p-2">
              <table className="table-auto text-xs w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky top-0 z-10 bg-white text-left py-1 px-2 border-b"> </th>
                    {cooc.labels.map((l, i) => <th key={l} className="py-1 px-2 text-left border-b">{l}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cooc.labels.map((rowLabel, ri) => (
                    <tr key={rowLabel} className={ri % 2 ? 'bg-gray-50' : ''}>
                      <td className="py-1 px-2 font-medium text-xs sticky left-0 bg-white">{rowLabel}</td>
                      {cooc.labels.map((colLabel, ci) => {
                        const val = cooc.matrix[rowLabel][colLabel] || 0;
                        const tot = cooc.totals[rowLabel] || 1;
                        const pct = tot ? (val / tot) * 100 : 0;
                        const highlightClass = highlight && (highlight === rowLabel || highlight === colLabel) ? "ring-2 ring-blue-300" : "";
                        return (
                          <td key={colLabel} className={`py-1 px-2 text-right ${highlightClass}`}>
                            <div className="text-xs">{val}</div>
                            <div className="text-xs text-gray-400">{pct.toFixed(0)}%</div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3 text-xs text-gray-500">
              Tip: click a choice in "Top choices" to set highlight and inspect which other options it pairs with.
            </div>
          </div>
        </aside>
      </div>

      {/* footer: processing options */}
      <footer className="mt-6 text-xs text-gray-500">
        Processing: split combined answers by comma/semicolon — each row's value contributes to choices. To change behavior, pass options={` { splitCombined:false | distribution:'even' }` }.
      </footer>
    </section>
  );
}


// Component now accepts data directly
export function NpsAnalytics({ data = [], label = "Net Promoter Score", onBucketClick }) {

  const stats = useMemo(() => computeNps(data), [data]);
  const interp = useMemo(() => npsInterpretation(stats.nps), [stats.nps]);

  const { nps, average, totalResponses, breakdown } = stats;
  const { promoters, passives, detractors, promotersPct, passivesPct, detractorsPct } = breakdown;

  const Icon = interp.icon;

  const getScoreCategory = (score) => {
    if (score >= 9) return { label: 'Promoter', color: 'bg-green-500', textColor: 'text-green-700' };
    if (score >= 7) return { label: 'Passive', color: 'bg-yellow-400', textColor: 'text-yellow-700' };
    return { label: 'Detractor', color: 'bg-red-500', textColor: 'text-red-700' };
  };

  return (
    <div className="w-full bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Hero Section */}
        <div className="px-8 py-10 text-black">
          <h2 className="text-3xl font-bold mb-2">{label}</h2>
          <p className="text-blue-100 text-lg">Net Promoter Score Analysis</p>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* NPS Score Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Your NPS Score</span>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-5xl font-bold mb-1">{nps}</div>
              <div className="text-sm font-medium text-blue-100">{interp.label}</div>
            </div>

            {/* Total Responses */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Total Responses</span>
                <Users className="w-5 h-5" />
              </div>
              <div className="text-5xl font-bold mb-1">{totalResponses}</div>
              <div className="text-sm font-medium text-blue-100">Survey participants</div>
            </div>

            {/* Average Score */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-100">Average Score</span>
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="text-5xl font-bold mb-1">{average}</div>
              <div className="text-sm font-medium text-blue-100">Out of 10</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8">
          {/* Interpretation Banner */}
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">What This Means</h4>
                <p className="text-gray-700">{interp.advice}</p>
              </div>
            </div>
          </div>

          {/* Customer Segments */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Customer Segments</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Promoters */}
              <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    Scores 9-10
                  </div>
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{promoters}</div>
                <div className="text-lg font-semibold text-green-700 mb-3">{promotersPct.toFixed(1)}%</div>
                <h4 className="font-semibold text-gray-900 mb-1">Promoters</h4>
                <p className="text-sm text-gray-600">Loyal enthusiasts who will recommend your brand</p>
              </div>

              {/* Passives */}
              <div className="bg-yellow-50 rounded-xl p-6 border-2 border-yellow-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-yellow-400 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    Scores 7-8
                  </div>
                  <Minus className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{passives}</div>
                <div className="text-lg font-semibold text-yellow-700 mb-3">{passivesPct.toFixed(1)}%</div>
                <h4 className="font-semibold text-gray-900 mb-1">Passives</h4>
                <p className="text-sm text-gray-600">Satisfied but unenthusiastic, vulnerable to competitors</p>
              </div>

              {/* Detractors */}
              <div className="bg-red-50 rounded-xl p-6 border-2 border-red-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                    Scores 0-6
                  </div>
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">{detractors}</div>
                <div className="text-lg font-semibold text-red-700 mb-3">{detractorsPct.toFixed(1)}%</div>
                <h4 className="font-semibold text-gray-900 mb-1">Detractors</h4>
                <p className="text-sm text-gray-600">Unhappy customers who may damage your brand</p>
              </div>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Score Distribution</h3>
            
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <div className="space-y-3">
                {stats.buckets.map((bucket) => {
                  const pct = totalResponses ? (bucket.count / totalResponses) * 100 : 0;
                  const category = getScoreCategory(bucket.score);
                  
                  return (
                    <div key={bucket.score} className="group">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => onBucketClick?.(bucket.score)}
                          className="w-12 text-right hover:scale-110 transition-transform"
                        >
                          <span className="text-sm font-semibold text-gray-700">{bucket.score}</span>
                        </button>
                        
                        <div className="flex-1">
                          <div className="relative">
                            <div className="w-full bg-white rounded-lg h-10 border-2 border-gray-200 overflow-hidden">
                              <div
                                className={`h-full ${category.color} transition-all duration-300 group-hover:opacity-80 flex items-center px-3 cursor-pointer`}
                                style={{ width: `${Math.max(3, pct)}%` }}
                                onClick={() => onBucketClick?.(bucket.score)}
                              >
                                {bucket.count > 0 && (
                                  <span className="text-xs font-semibold text-white">
                                    {bucket.count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-20 text-right">
                          <span className="text-sm font-semibold text-gray-700">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        
                        <div className="w-24">
                          <span className={`text-xs font-medium ${category.textColor}`}>
                            {category.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Key Takeaways & Action Items</h3>
            <div className="space-y-3 text-sm text-gray-700">
              <div className="flex gap-3">
                <span className="font-bold text-purple-600">•</span>
                <p><strong>NPS Calculation:</strong> Your score of <strong>{nps}</strong> = {promotersPct.toFixed(1)}% Promoters - {detractorsPct.toFixed(1)}% Detractors</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-purple-600">•</span>
                <p><strong>Focus Area:</strong> {detractors > 0 ? `Follow up with ${detractors} detractors to understand their concerns and prevent negative word-of-mouth.` : 'Great! No detractors to address.'}</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-purple-600">•</span>
                <p><strong>Growth Opportunity:</strong> {passives > 0 ? `Convert ${passives} passive customers into promoters by improving key touchpoints and exceeding expectations.` : 'Focus on maintaining your promoter base.'}</p>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-purple-600">•</span>
                <p><strong>Benchmark:</strong> {nps >= 50 ? 'Excellent score! You\'re in the top tier.' : nps >= 0 ? 'Aim for 50+ to reach excellence.' : 'Priority: Get above 0 by reducing detractors.'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
