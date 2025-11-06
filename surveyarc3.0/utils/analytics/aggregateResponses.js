// utils/aggregateResponses.js
// Re-usable aggregators for different question types

// helpers
const toNumber = (v) => (v === null || v === undefined ? NaN : Number(v));
export const sum = (arr) => arr.reduce((s, x) => s + (isNaN(Number(x)) ? 0 : Number(x)), 0);
export const mean = (arr) => { const vals = arr.map(toNumber).filter(n => !isNaN(n)); return vals.length ? sum(vals)/vals.length : 0; };
export const median = (arr) => {
  const vals = arr.map(toNumber).filter(n => !isNaN(n)).sort((a,b)=>a-b);
  if (!vals.length) return 0;
  const mid = Math.floor(vals.length/2);
  return vals.length % 2 ? vals[mid] : (vals[mid-1]+vals[mid])/2;
};
export const stddev = (arr) => {
  const m = mean(arr); const vals = arr.map(toNumber).filter(n => !isNaN(n));
  if (!vals.length) return 0;
  return Math.sqrt(vals.reduce((s,x)=>s+(x-m)*(x-m),0)/vals.length);
};

// ------------- Yes/No -------------
export function aggregateYesNo(rows = []) {
  // rows: [{ name: 'Yes'|'No', value }]
  const yes = sum(rows.filter(r => String(r.name).toLowerCase() === 'yes').map(r => r.value));
  const no = sum(rows.filter(r => String(r.name).toLowerCase() === 'no').map(r => r.value));
  const total = yes + no;
  return { yes, no, total, pctYes: total ? (yes/total)*100 : 0, pctNo: total ? (no/total)*100 : 0 };
}

// ------------- Multiple choice / select -------------
export function aggregateMultipleChoice(rows = []) {
  // rows: [{name, value}] where name is single-choice string
  const map = new Map();
  let total = 0;
  rows.forEach(r => { const name = String(r.name||''); const val = Number(r.value||0); if (!name) return; total += val; map.set(name, (map.get(name)||0)+val); });
  const aggregated = Array.from(map.entries()).map(([name, value]) => ({ name, value, pct: total ? (value/total)*100 : 0 })).sort((a,b)=>b.value-a.value);
  return { aggregated, total, byName: Object.fromEntries(map) };
}

// ------------- Rating (1..N) -------------
export function aggregateRating(rows = []) {
  // rows: [{ rating: number, value }]
  const map = new Map();
  let total = 0;
  rows.forEach(r => { const rating = String(r.rating); const val = Number(r.value||0); total += val; map.set(rating, (map.get(rating)||0)+val); });
  const aggregated = Array.from(map.entries()).map(([rating, count]) => ({ rating: Number(rating), count })).sort((a,b)=>a.rating-b.rating);
  const avg = aggregated.length ? aggregated.reduce((s, it) => s + it.rating * it.count, 0) / (total || 1) : 0;
  return { aggregated, total, avg, byRating: Object.fromEntries(aggregated.map(a => [a.rating,a.count])) };
}

// ------------- Numeric responses (numbers) -------------
export function aggregateNumeric(rows = [], { bins = 10 } = {}) {
  // rows: [{ value: number, weight? }]
  const values = rows.flatMap(r => {
    const v = toNumber(r.value);
    return isNaN(v) ? [] : [v];
  });
  if (!values.length) return { count: 0, mean: 0, median: 0, std: 0, min: 0, max: 0, histogram: [] };
  const cnt = values.length;
  const mn = Math.min(...values);
  const mx = Math.max(...values);
  const m = mean(values);
  const med = median(values);
  const sd = stddev(values);
  const range = mx - mn || 1;
  // simple equal-width bins
  const histogram = Array.from({ length: bins }).map(() => 0);
  values.forEach(v => {
    const idx = Math.min(bins-1, Math.floor(((v - mn) / range) * bins));
    histogram[idx] += 1;
  });
  const histBins = histogram.map((c, i) => ({ bin: i, count: c }));
  return { count: cnt, mean: m, median: med, std: sd, min: mn, max: mx, histogram: histBins };
}

// ------------- Matrix (rows x cols) -------------
export function aggregateMatrix(rows = [], cols = []) {
  // rows: [{ row, colValues: {col1: value, col2: value}}] OR rows from existing parser
  // We'll detect both forms
  if (!Array.isArray(rows)) return { rows: [], cols, totals: {} };
  // assume rows are already shaped: [{ row, ...col keys }]
  const matrix = [];
  const totals = {};
  rows.forEach(r => {
    const rowKey = r.row || r.label || r.name;
    const obj = { row: rowKey };
    cols.forEach(c => {
      const v = Number(r[c] ?? 0) || 0;
      obj[c] = v;
      totals[c] = (totals[c] || 0) + v;
    });
    matrix.push(obj);
  });
  return { matrix, cols, totals };
}

// ------------- Picture choice -------------
// same shape as multiple choice but images in name or value may be url. We'll keep same aggregator
export function aggregatePictureChoice(rows = []) {
  return aggregateMultipleChoice(rows);
}

// ------------- Free text (top tokens / examples) -------------
export function aggregateText(rows = [], { top = 10, stopwords = [] } = {}) {
  // rows: [{ text: '...' , value? }]
  const map = new Map();
  const examples = [];
  rows.forEach(r => {
    const txt = String(r.text || r.name || '').trim();
    if (!txt) return;
    examples.push(txt);
    txt.split(/\s+/).map(t => t.toLowerCase().replace(/[^\w'-]/g,'')).filter(Boolean).forEach(tok => {
      if (stopwords.includes(tok)) return;
      map.set(tok, (map.get(tok)||0)+1);
    });
  });
  const tokens = Array.from(map.entries()).map(([k,v])=>({ token:k, count:v })).sort((a,b)=>b.count-a.count).slice(0, top);
  return { tokens, examples, totalResponses: examples.length };
}
