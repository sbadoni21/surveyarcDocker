"use client";

export default function WorklogList({ worklogs }) {
  if (worklogs.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-gray-500 text-center">
        No worklogs yet.
      </div>
    );
  }

  return (
    <div className="max-h-48 overflow-auto">
      <ul className="divide-y">
        {worklogs.map((worklog) => (
          <li key={worklog.worklog_id} className="px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{worklog.user_id}</span>{" "}
                <span className="text-gray-500">• {worklog.kind}</span>
              </div>
              <div className="text-gray-600 font-medium">{worklog.minutes}m</div>
            </div>
            {worklog.note && <div className="text-gray-600 mt-1">{worklog.note}</div>}
            <div className="text-xs text-gray-400 mt-1">
              {new Date(worklog.created_at).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
