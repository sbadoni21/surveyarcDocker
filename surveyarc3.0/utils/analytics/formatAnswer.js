const EXCLUDED_KEYS = ["id", "projectId", "__v", "orgId", "surveyId"];

export const formatAnswer = (val) => {
  if (!val) return "-";

  if (typeof val === "object" && val?.type === "matrix" && val?.value) {
    return (
      <table className="border w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Service</th>
            <th className="border px-2 py-1 text-left">Rating</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(val.value).map(([key, value]) => (
            <tr key={key}>
              <td className="border px-2 py-1">{key}</td>
              <td className="border px-2 py-1">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (
    typeof val === "string" &&
    val.startsWith("http") &&
    val.includes("firebase")
  ) {
    return (
      <a href={val} target="_blank" rel="noopener noreferrer">
        <img src={val} alt="uploaded" className="w-20 h-20 object-contain" />
      </a>
    );
  }

  if (val?.seconds && val?.nanoseconds) {
    const date = new Date(val.seconds * 1000);
    return date.toLocaleString();
  }

  if (Array.isArray(val) && val.every((item) => typeof item === "object")) {
    const keys = Object.keys(val[0]).filter((k) => !EXCLUDED_KEYS.includes(k));
    return (
      <table className="border w-full text-sm mt-1">
        <thead>
          <tr className="bg-gray-50">
            {keys.map((key) => (
              <th key={key} className="border px-2 py-1 capitalize text-left">
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {val.map((item, i) => (
            <tr key={i}>
              {keys.map((key) => (
                <td key={key} className="border px-2 py-1">
                  {formatAnswer(item[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (typeof val === "object") {
    const entries = Object.entries(val).filter(
      ([key]) => !EXCLUDED_KEYS.includes(key)
    );
    return (
      <table className="border w-full text-sm mt-1">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="border px-2 py-1 font-semibold">{key}</td>
              <td className="border px-2 py-1">{formatAnswer(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } 

  return val.toString();
};