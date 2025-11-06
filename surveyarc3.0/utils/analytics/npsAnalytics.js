

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle, ThumbsUp, Users } from 'lucide-react';

// Utility functions
function toNum(n) {
  const x = typeof n === "number" ? n : parseFloat(String(n).trim());
  return Number.isFinite(x) ? Math.round(x) : null;
}

function normalizeNpsRows(rows = []) {
  const map = new Map();
  for (let s = 1; s <= 10; s++) map.set(s, 0);
  if (!Array.isArray(rows)) rows = [];
  rows.forEach((r) => {
    const score = toNum(r?.name);
    const count = Number(r?.value ?? 0) || 0;
    if (score >= 1 && score <= 10) map.set(score, map.get(score) + count);
  });
  return Array.from(map.entries()).map(([score, count]) => ({ score, count }));
}

export function computeNps(rows = []) {
  const buckets = normalizeNpsRows(rows);
  const totalResponses = buckets.reduce((s, b) => s + b.count, 0);
  
  if (totalResponses === 0) {
    return {
      buckets, totalResponses: 0, average: 0, median: 0, mode: null, nps: 0,
      breakdown: { promoters: 0, passives: 0, detractors: 0, promotersPct: 0, passivesPct: 0, detractorsPct: 0 }
    };
  }

  const detractors = buckets.filter(b => b.score >= 0 && b.score <= 6).reduce((s, b) => s + b.count, 0);
  const passives = buckets.filter(b => b.score >= 7 && b.score <= 8).reduce((s, b) => s + b.count, 0);
  const promoters = buckets.filter(b => b.score >= 9 && b.score <= 10).reduce((s, b) => s + b.count, 0);

  const promotersPct = (promoters / totalResponses) * 100;
  const detractorsPct = (detractors / totalResponses) * 100;
  const passivesPct = (passives / totalResponses) * 100;
  const nps = Math.round(promotersPct - detractorsPct);

  const sum = buckets.reduce((s, b) => s + b.score * b.count, 0);
  const average = +(sum / totalResponses).toFixed(2);

  let cum = 0, median = 0;
  for (const b of buckets) {
    cum += b.count;
    if (cum >= totalResponses/2) { median = b.score; break; }
  }

  let mode = null, maxc = -1;
  buckets.forEach(b => { if (b.count > maxc) { maxc = b.count; mode = b.score; } });

  return {
    buckets, totalResponses, average, median, mode, nps,
    breakdown: { promoters, passives, detractors, promotersPct, passivesPct, detractorsPct }
  };
}

export function npsInterpretation(nps) {
  if (nps >= 50) return { 
    label: "Excellent", 
    advice: "Your brand has strong traction",
    icon: TrendingUp,
    color: "text-green-600"
  };
  if (nps >= 30) return { 
    label: "Good", 
    advice: "Positive sentiment with room to grow",
    icon: ThumbsUp,
    color: "text-green-500"
  };
  if (nps >= 0) return { 
    label: "Neutral", 
    advice: "Mixed feedback requires attention",
    icon: Minus,
    color: "text-yellow-600"
  };
  return { 
    label: "Needs Improvement", 
    advice: "Critical issues need immediate action",
    icon: TrendingDown,
    color: "text-red-600"
  };
}