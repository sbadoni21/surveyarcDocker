// utils/checkboxAnalytics.js
// Utility functions for checkbox / multi-select analytics

export function normalizeName(n) {
  return String(n || "").trim();
}

/**
 * aggregateCheckboxResponses (improved)
 * rows: [{ name, value }]
 * options:
 *  - splitCombined: boolean (default true)
 *  - distribution: "full"|"even" (default "full")
 *  - separators: regex (default /[,;]+/)
 */
export function aggregateCheckboxResponses(rows = [], options = {}) {
  const { splitCombined = true, distribution = "full", separators = /,(?![^(]*\))/
 } = options;
  const byName = new Map();
  let totalRows = 0;
  let totalSelections = 0; // sum of values
  if (!Array.isArray(rows)) rows = [];

  rows.forEach((r) => {
    totalRows += 1;
    const rawCount = Number(r?.value ?? 0) || 0;
    totalSelections += rawCount;

    const rawName = normalizeName(r?.name);
    if (!rawName) return;

    const parts = splitCombined ? rawName.split(separators).map(s => normalizeName(s)).filter(Boolean) : [rawName];

    if (distribution === "full" || parts.length === 1) {
      parts.forEach(choice => byName.set(choice, (byName.get(choice) || 0) + rawCount));
    } else {
      const share = rawCount / parts.length;
      parts.forEach(choice => byName.set(choice, (byName.get(choice) || 0) + share));
    }
  });

  const aggregated = Array.from(byName.entries()).map(([name, value]) => ({ name, value }));
  aggregated.sort((a, b) => b.value - a.value);

  return {
    aggregated,
    byName: Object.fromEntries(byName),
    totalRows,
    totalSelections,
  };
}

/**
 * countSelectionsPerRow
 * returns distribution: {0: count, 1: count, 2: count, ...}
 * For each input row, counts how many choices are present (after splitting, if enabled)
 */
export function countSelectionsPerRow(rows = [], options = {}) {
  const { splitCombined = true, separators = /,(?![^(]*\))/} = options;
  const dist = new Map(); // count -> rows
  let totalRows = 0;
  if (!Array.isArray(rows)) rows = [];

  rows.forEach(r => {
    totalRows += 1;
    const rawName = normalizeName(r?.name);
    if (!rawName) {
      dist.set(0, (dist.get(0) || 0) + 1);
      return;
    }
    const parts = splitCombined ? rawName.split(separators).map(s => normalizeName(s)).filter(Boolean) : [rawName];
    const count = parts.length;
    dist.set(count, (dist.get(count) || 0) + 1);
  });

  // convert to sorted array of {count, rows, pct}
  const arr = Array.from(dist.entries()).sort((a,b) => a[0]-b[0]).map(([count, rowsCount]) => ({ count, rows: rowsCount }));
  return { distribution: arr, totalRows };
}

/**
 * topCombinations(rows, topN)
 * returns the top exact submitted combinations (string bucket) with value sums
 */
export function topCombinations(rows = [], topN = 10) {
  const map = new Map();
  rows.forEach(r => {
    const rawName = normalizeName(r?.name);
    if (!rawName) return;
    const key = rawName; // keep exact string (order as submitted)
    const val = Number(r?.value ?? 0) || 0;
    map.set(key, (map.get(key) || 0) + val);
  });
  const arr = Array.from(map.entries()).map(([comb, value]) => ({ comb, value }));
  arr.sort((a,b) => b.value - a.value);
  return arr.slice(0, topN);
}

/**
 * cooccurrenceMatrix(rows)
 * returns { labels: [..], matrix: { labelA: { labelB: count } }, totals }
 * counts are computed using splitCombined=true and distribution = full
 */
export function cooccurrenceMatrix(rows = [], options = {}) {
  const { splitCombined = true, separators = /,(?![^(]*\))/ } = options;
  const labelsSet = new Set();
  const rowChoices = [];

  rows.forEach(r => {
    const rawName = normalizeName(r?.name);
    if (!rawName) return;
    const parts = splitCombined ? rawName.split(separators).map(s => normalizeName(s)).filter(Boolean) : [rawName];
    const count = Number(r?.value ?? 1) || 1;
    const uniq = Array.from(new Set(parts));
    uniq.forEach(l => labelsSet.add(l));
    rowChoices.push({ choices: uniq, count });
  });

  const labels = Array.from(labelsSet);
  // build zeroed matrix
  const matrix = {};
  labels.forEach(a => {
    matrix[a] = {};
    labels.forEach(b => matrix[a][b] = 0);
  });

  // fill matrix: for each row, for all pair permutations (a,b) increment by row.count
  rowChoices.forEach(({ choices, count }) => {
    for (let i = 0; i < choices.length; i++) {
      for (let j = 0; j < choices.length; j++) {
        const a = choices[i], b = choices[j];
        matrix[a][b] = (matrix[a][b] || 0) + count;
      }
    }
  });

  // totals (how many times each label selected)
  const totals = {};
  labels.forEach(l => {
    totals[l] = rowChoices.reduce((s, rc) => s + (rc.choices.includes(l) ? rc.count : 0), 0);
  });

  return { labels, matrix, totals };
}

/**
 * cumulativeCoverage(aggregated, thresholdPct)
 * aggregated = [{name, value}], returns array of steps until threshold
 */
export function cumulativeCoverage(aggregated = [], thresholdPct = 80) {
  const total = aggregated.reduce((s,r) => s + r.value, 0) || 1;
  const steps = [];
  let cum = 0;
  for (const item of aggregated) {
    cum += item.value;
    const pct = (cum/total)*100;
    steps.push({ name: item.name, value: item.value, cumPct: pct });
    if (pct >= thresholdPct) break;
  }
  return { total, steps };
}
