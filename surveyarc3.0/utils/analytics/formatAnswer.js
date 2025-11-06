const EXCLUDED_KEYS = ["id", "projectId", "__v", "orgId", "surveyId"];

export const formatAnswer = (val) => {
  if (!val) return <span className="text-gray-400 text-sm">No answer</span>;

  if (typeof val === "object" && val?.type === "matrix" && val?.value) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-medium text-gray-700">Service</th>
              <th className="px-3 py-2 text-left font-medium text-gray-700">Rating</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(val.value).map(([key, value], idx) => (
              <tr key={key} className={idx % 2 === 0 ? "bg-gray-50/50" : ""}>
                <td className="px-3 py-2 text-gray-800">{key}</td>
                <td className="px-3 py-2 text-gray-600">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (
    typeof val === "string" &&
    val.startsWith("http") &&
    val.includes("firebase")
  ) {
    return (
      <a 
        href={val} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-block hover:opacity-80 transition-opacity"
      >
        <img 
          src={val} 
          alt="uploaded" 
          className="w-24 h-24 object-cover rounded border border-gray-200" 
        />
      </a>
    );
  }

  if (val?.seconds && val?.nanoseconds) {
    const date = new Date(val.seconds * 1000);
    return <span className="text-sm text-gray-700">{date.toLocaleString()}</span>;
  }

  if (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every((item) => item && typeof item === "object")
  ) {
    const keys = Object.keys(val[0]).filter((k) => !EXCLUDED_KEYS.includes(k));
    return (
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b">
              {keys.map((key) => (
                <th key={key} className="px-3 py-2 text-left font-medium text-gray-700 capitalize">
                  {key.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {val.map((item, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-gray-50/50" : ""}>
                {keys.map((key) => (
                  <td key={key} className="px-3 py-2 text-gray-600">
                    {formatAnswer(item[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (typeof val === "object") {
    const entries = Object.entries(val).filter(
      ([key]) => !EXCLUDED_KEYS.includes(key)
    );
    return (
      <div className="space-y-1 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium text-gray-700 min-w-[100px]">
              {key.replace(/_/g, " ")}:
            </span>
            <span className="text-gray-600">{formatAnswer(value)}</span>
          </div>
        ))}
      </div>
    );
  }

  return <span className="text-gray-800">{val.toString()}</span>;
};
