"use client";
import { useEffect, useState } from "react";
import { Languages, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { AVAILABLE_LANGUAGES } from "@/utils/availableLanguages";
import { useQuestion } from "@/providers/questionPProvider";
import TranslationUI from "@/components/TranslationGrid";

export default function TranslationSetup() {
  const {
    surveyId,
    initializeTranslations,
    getTranslationStatus,
    resyncTranslations,
    questions
  } = useQuestion();

  const [coverage, setCoverage] = useState(null);
  const [selectedLang, setSelectedLang] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (surveyId) loadCoverage();
  }, [surveyId]);

  const loadCoverage = async () => {
    const res = await getTranslationStatus(surveyId);
    setCoverage(res);
  };

  const handleInitialize = async () => {
    if (!selectedLang) return;
    setLoading(true);
    try {
      await initializeTranslations(surveyId, selectedLang);
      await loadCoverage();
      setSelectedLang("");
    } finally {
      setLoading(false);
    }
  };

  const initializedLocales = Object.keys(coverage?.coverage || {});

  return (
    <div className="mx-auto p-6 bg-white rounded-lg border">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Languages className="w-6 h-6 text-blue-600" />
        <h1 className="text-xl font-bold">Translation Setup</h1>
      </div>
<button
  onClick={() => resyncTranslations(surveyId)}
  className="px-4 py-2 border rounded bg-gray-100 hover:bg-gray-200"
>
  Sync new questions to all languages
</button>

      {/* Initialize Section */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="border px-3 py-2 rounded w-64"
        >
          <option value="">Select language</option>
          {AVAILABLE_LANGUAGES
            .filter(l => l.code !== "en")
            .map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
        </select>

        <button
          onClick={handleInitialize}
          disabled={!selectedLang || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Initializing…" : "Initialize Translation"}
        </button>
      </div>

      {/* Coverage */}
      <div className="space-y-3">
        <h2 className="font-medium text-gray-700">
          Translation Status
        </h2>

        {/* English base */}
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>English (Base language)</span>
        </div>
<TranslationUI/>
        {AVAILABLE_LANGUAGES
          .filter(l => l.code !== "en")
          .map(lang => {
            const data = coverage?.coverage?.[lang.code];
            const isInit = Boolean(data);

            return (
              <div key={lang.code} className="flex items-center gap-2">
                {isInit ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-gray-400" />
                )}
                <span>
                  {lang.flag} {lang.name}
                  {isInit && (
                    <span className="text-sm text-gray-500 ml-2">
                      ({data.percentage}% complete)
                    </span>
                  )}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
