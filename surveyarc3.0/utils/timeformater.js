// utils/timeformater.js

const DEFAULT_TZ = 'Asia/Kolkata';

export function smartFormatDateTime(input, opts = {}) {
  if (!input && input !== 0) return '';
  const {
    mode = 'auto',         // 'auto' | 'relative' | 'absolute' | 'calendar' | 'compact'
    tz = DEFAULT_TZ,
    locale = 'en-IN',
    withTZ = true,
    now = new Date(),
  } = opts;

  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(+d)) return '';

  const n = now instanceof Date ? now : new Date(now);
  const diffMs = +n - +d;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr  = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);

  const tzShort = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'short', year: 'numeric' })
    .formatToParts(d).find(p => p.type === 'timeZoneName')?.value || '';
  const tzLabel = tz === DEFAULT_TZ && tzShort.includes('+5:30') ? 'IST' : tzShort;

  const fmt = (o) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...o });
  const ymd = (x) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const isSameDay = ymd(d) === ymd(n);

  const formatAbsolute = () => {
    const f = fmt({ day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const s = f.format(d);
    return withTZ ? `${s} ${tzLabel}` : s;
  };

  const formatCompact = () => {
    const thisYear = fmt({ year: 'numeric' }).format(n);
    const y = fmt({ year: 'numeric' }).format(d);
    const opts2 = { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
    if (y !== thisYear) opts2.year = '2-digit';
    return fmt(opts2).format(d);
  };

  const formatCalendar = () => {
    const timePart = fmt({ hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
    if (isSameDay) return withTZ ? `Today, ${timePart} ${tzLabel}` : `Today, ${timePart}`;
    const yest = new Date(n); yest.setDate(n.getDate() - 1);
    if (ymd(d) === ymd(yest)) return withTZ ? `Yesterday, ${timePart} ${tzLabel}` : `Yesterday, ${timePart}`;
    if (diffDay < 7) {
      const dayName = fmt({ weekday: 'short' }).format(d);
      return `${dayName}, ${timePart}`;
    }
    const datePart = fmt({ day: '2-digit', month: 'short', year: 'numeric' }).format(d);
    return withTZ ? `${datePart}, ${timePart} ${tzLabel}` : `${datePart}, ${timePart}`;
  };

  const formatRelative = () => {
    if (diffSec < 45) return 'just now';
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    if (diffHr  < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay < 7)  return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    return formatCalendar();
  };

  if (mode === 'relative') return formatRelative();
  if (mode === 'absolute') return formatAbsolute();
  if (mode === 'calendar') return formatCalendar();
  if (mode === 'compact')  return formatCompact();

  return diffHr < 36 ? formatRelative() : formatCalendar();
}

// Pure function version (no hooks) - use this for simple formatting
export function timeformater(input, opts = {}) {
  return smartFormatDateTime(input, opts);
}

// React hook version for auto-refreshing time display
import { useEffect, useMemo, useState } from 'react';

export function useTimeformater(input, opts = {}) {
  const [tick, setTick] = useState(0);
  const value = useMemo(() => smartFormatDateTime(input, { ...opts, now: new Date() }), [input, JSON.stringify(opts), tick]);

  useEffect(() => {
    if (!input && input !== 0) return;
    const t = input instanceof Date ? +input : +new Date(input);
    if (Number.isNaN(t)) return;

    const ageMs = Date.now() - t;
    let interval = 60_000;
    if (ageMs < 60_000) interval = 1_000;
    else if (ageMs < 3_600_000) interval = 30_000;
    else if (ageMs < 86_400_000) interval = 300_000;
    else interval = 3_600_000;

    const id = setInterval(() => setTick(x => x + 1), interval);
    return () => clearInterval(id);
  }, [input]);

  return value;
}

// Component version for auto-refreshing display
import React from 'react';

export function TimeDisplay({ input, opts = {}, ...props }) {
  const formattedTime = useTimeformater(input, opts);
  return <span {...props}>{formattedTime}</span>;
}