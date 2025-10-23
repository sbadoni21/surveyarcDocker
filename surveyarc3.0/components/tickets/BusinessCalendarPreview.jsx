"use client";
import { Calendar, Clock, Flag } from "lucide-react";

// calendar.hours: [{ weekday: 0..6 (Mon..Sun), startMin, endMin }]
// calendar.holidays: [{ dateIso: 'YYYY-MM-DD', name }]  // (date_iso works too; we normalize)
// calendar.timezone, calendar.name, calendar.calendarId

const WD_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const pad2 = (n) => String(n).padStart(2, "0");
const minsToHHMM = (mins) => `${pad2(Math.floor(mins/60))}:${pad2(mins%60)}`;

/** Normalize holidays to {dateIso, name} */
function normalizeHolidays(holidays) {
  if (!Array.isArray(holidays)) return [];
  return holidays
    .map(h => {
      const dateIso = h?.dateIso ?? h?.date_iso;
      if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
      return { dateIso, name: h?.name || "Holiday" };
    })
    .filter(Boolean);
}

/** Build array-of-arrays by weekday with [startMin, endMin] windows */
function buildWeekMap(calendar) {
  const map = Array.from({length: 7}, () => []);
  (calendar?.hours || []).forEach(h => {
    const idx = Math.max(0, Math.min(6, Number(h.weekday)));
    const start = Number(h.startMin ?? h.start_min);
    const end   = Number(h.endMin   ?? h.end_min);
    if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end <= 1440 && start < end) {
      map[idx].push([start, end]);
    }
  });
  map.forEach(list => list.sort((a,b)=>a[0]-b[0]));
  return map;
}

function getMinutesFromMidnight(date, timezone="UTC") {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
    return parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10);
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/** ISO weekday: Mon=0 .. Sun=6, in calendar TZ */
function getISOWeekday(date, timezone="UTC") {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
    const name = fmt.format(date); // e.g., "Mon"
    const map = { Mon:0, Tue:1, Wed:2, Thu:3, Fri:4, Sat:5, Sun:6 };
    return map[name] ?? ((date.getUTCDay() + 6) % 7);
  } catch {
    return (date.getUTCDay() + 6) % 7;
  }
}

function isTodayHoliday(date, calendar) {
  const holidays = normalizeHolidays(calendar?.holidays);
  if (!holidays.length) return false;

  // Format date as YYYY-MM-DD in calendar TZ
  let ymd;
  try {
    ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: calendar?.timezone ?? "UTC", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date); // "YYYY-MM-DD"
  } catch {
    const y = date.getUTCFullYear();
    const m = pad2(date.getUTCMonth()+1);
    const d = pad2(date.getUTCDate());
    ymd = `${y}-${m}-${d}`;
  }
  return holidays.some(h => h.dateIso === ymd);
}

function isNowWorking(calendar) {
  if (!calendar?.hours?.length) return false;
  const tz = calendar.timezone ?? "UTC";
  const now = new Date();

  if (isTodayHoliday(now, calendar)) return false;

  const weekday = getISOWeekday(now, tz);
  const minutes = getMinutesFromMidnight(now, tz);

  // check windows for this weekday using the object shape
  const todays = (calendar.hours || [])
    .filter(h => (h.weekday === weekday))
    .map(h => [Number(h.startMin ?? h.start_min), Number(h.endMin ?? h.end_min)])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e));

  return todays.some(([s,e]) => minutes >= s && minutes < e);
}

export default function BusinessCalendarPreview({ calendar }) {
  if (!calendar) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 text-gray-600 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          No calendar selected — SLA will use real elapsed minutes (24×7).
        </div>
      </div>
    );
  }

  const tz = calendar.timezone ?? "UTC";
  const weekMap = buildWeekMap(calendar);
  const workingNow = isNowWorking(calendar);
  const holidays = normalizeHolidays(calendar.holidays);

  // next 4 upcoming holidays (future only)
  const upcoming = holidays
    .map(h => ({ ...h, ts: Date.parse(`${h.dateIso}T00:00:00Z`) }))
    .filter(h => Number.isFinite(h.ts) && h.ts >= Date.now())
    .sort((a,b)=>a.ts-b.ts)
    .slice(0,4);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              {calendar.name ?? "Team Business Calendar"}
            </div>
            <div className="text-gray-500">
              TZ: {tz} • ID: {calendar.calendarId ?? calendar.calendar_id ?? "—"}
            </div>
          </div>
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          workingNow ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
        }`}>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {workingNow ? "Inside working hours" : "Outside working hours"}
          </span>
        </div>
      </div>

      {/* weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekMap.map((windows, idx) => (
          <div key={idx} className="rounded-lg border bg-gray-50 p-3">
            <div className="text-xs font-medium text-gray-600 mb-2">{WD_LABELS[idx]}</div>
            {windows.length ? (
              <div className="space-y-1">
                {windows.map(([startMin, endMin], i) => (
                  <div key={i} className="text-sm inline-flex px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
                    {minsToHHMM(startMin)} – {minsToHHMM(endMin)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400">No working hours</div>
            )}
          </div>
        ))}
      </div>

      {/* holidays */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Flag className="h-4 w-4 text-rose-600" />
          Upcoming Holidays
        </div>
        {upcoming.length ? (
          <ul className="space-y-1 text-sm">
            {upcoming.map(h => (
              <li key={`${h.dateIso}-${h.name}`} className="flex items-center justify-between">
                <span className="text-gray-700">{h.name || "Holiday"}</span>
                <span className="text-gray-500">{h.dateIso}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-400">No upcoming holidays</div>
        )}
      </div>
    </div>
  );
}
