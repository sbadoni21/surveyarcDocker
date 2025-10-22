"use client";
import { Calendar, Clock, Flag } from "lucide-react";

// calendar.hours: [{ weekday: 0..6 (Mon..Sun), startMin, endMin }]
// calendar.holidays: [{ dateIso: 'YYYY-MM-DD', name }]
// calendar.timezone, calendar.name, calendar.calendarId

const WD_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function pad2(n){ return String(n).padStart(2,"0"); }
function minsToHHMM(mins){ const h = Math.floor(mins/60), m = mins%60; return `${pad2(h)}:${pad2(m)}`; }

function buildWeekMap(calendar){
  const map = Array.from({length:7},()=>[]);
  (calendar?.hours || []).forEach(h=>{
    const idx = Math.max(0, Math.min(6, h.weekday));
    map[idx].push([h.startMin, h.endMin]);
  });
  // sort each day by start time
  map.forEach(list => list.sort((a,b)=>a[0]-b[0]));
  return map;
}

function isNowWorking(calendar){
  if (!calendar?.hours?.length) return false;
  const now = new Date();
  // treat hours as in calendar.timezone, but we’ll show a logical approximation:
  // map “today in that TZ” by using Intl.DateTimeFormat
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: calendar.timezone ?? "UTC", hour12:false,
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map(p=>[p.type,p.value]));
  const weekdayJS = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`).getUTCDay();
  // our model uses Mon=0..Sun=6; JS uses Sun=0..Sat=6
  const mon0 = (weekdayJS + 6) % 7;

  const minutes = parseInt(parts.hour,10)*60 + parseInt(parts.minute,10);
  const todays = (calendar.hours || []).filter(h=>h.weekday === mon0);
  return todays.some(([s,e])=>{
    // normalize shape if object
    const start = Array.isArray(s) ? s[0] : (s.startMin ?? s[0] ?? s);
    const end   = Array.isArray(e) ? e[1] : (e.endMin ?? e[1] ?? e);
    return minutes >= (s.startMin ?? s[0] ?? s) && minutes < (e.endMin ?? e[1] ?? e);
  });
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

  const weekMap = buildWeekMap(calendar);
  const workingNow = isNowWorking(calendar);

  // next 4 upcoming holidays (future only)
  const upcoming = (calendar.holidays || [])
    .map(h => ({ ...h, ts: Date.parse(`${h.dateIso}T00:00:00Z`) }))
    .filter(h => h.ts >= Date.now())
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
              TZ: {calendar.timezone ?? "UTC"} • ID: {calendar.calendarId}
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
