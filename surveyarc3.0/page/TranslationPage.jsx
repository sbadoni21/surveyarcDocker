"use client";
import { useEffect, useState } from "react";
import { 
  Languages, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Globe,
  Plus,
  RefreshCw,
  ChevronRight,
  FileText
} from "lucide-react";
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
  const [syncing, setSyncing] = useState(false);
  const [showTranslationGrid, setShowTranslationGrid] = useState(false);
  const [activeView, setActiveView] = useState("setup"); // "setup" | "translate"

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

  const handleResync = async () => {
    setSyncing(true);
    try {
      await resyncTranslations(surveyId);
      await loadCoverage();
    } finally {
      setSyncing(false);
    }
  };

  const initializedLocales = Object.keys(coverage?.coverage || {});
  const totalQuestions = coverage?.total_questions || questions?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Languages className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Translation Manager</h1>
                <p className="text-sm text-gray-500">
                  {totalQuestions} questions • {initializedLocales.length} active languages
                </p>
              </div>
            </div>

            {/* View Switcher */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveView("setup")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeView === "setup"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Globe className="w-4 h-4 inline-block mr-2" />
                Language Setup
              </button>
              <button
                onClick={() => setActiveView("translate")}
                disabled={initializedLocales.length === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeView === "translate"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <FileText className="w-4 h-4 inline-block mr-2" />
                Translate Content
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === "setup" ? (
          <div className="space-y-6">
            {/* Add Language Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <Plus className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Add New Language</h2>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Language
                  </label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="w-full border border-gray-300 px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Choose a language...</option>
                    {AVAILABLE_LANGUAGES
                      .filter(l => l.code !== "en" && !initializedLocales.includes(l.code))
                      .map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-7">
                  <button
                    onClick={handleInitialize}
                    disabled={!selectedLang || loading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Initialize
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Initializing a language will copy all base content (English) to the new language. 
                  You can then translate each field individually.
                </p>
              </div>
            </div>

            {/* Sync Card */}
            {initializedLocales.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Sync Translations</h2>
                      <p className="text-sm text-gray-500">
                        Apply existing languages to newly added questions
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleResync}
                    disabled={syncing}
                    className="px-5 py-2.5 border-2 border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center gap-2"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Sync Now
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <p className="text-sm text-emerald-800">
                    If you've added new questions after initializing translations, click "Sync Now" to create 
                    translation entries for them across all active languages.
                  </p>
                </div>
              </div>
            )}

            {/* Languages Status Grid */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Active Languages</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* English Base */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇬🇧</span>
                      <span className="font-semibold text-gray-900">English</span>
                    </div>
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-blue-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <span className="text-sm font-medium text-blue-800">100%</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">Base Language</p>
                </div>

                {/* Initialized Languages */}
                {AVAILABLE_LANGUAGES
                  .filter(l => l.code !== "en" && initializedLocales.includes(l.code))
                  .map(lang => {
                    const data = coverage?.coverage?.[lang.code];
                    const percentage = data?.percentage || 0;
                    const isComplete = percentage === 100;

                    return (
                      <div 
                        key={lang.code} 
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isComplete 
                            ? "bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200" 
                            : "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{lang.flag}</span>
                            <span className="font-semibold text-gray-900">{lang.name}</span>
                          </div>
                          {isComplete ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 rounded-full h-2 ${
                            isComplete ? "bg-emerald-200" : "bg-amber-200"
                          }`}>
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                isComplete ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${
                            isComplete ? "text-emerald-800" : "text-amber-800"
                          }`}>
                            {percentage}%
                          </span>
                        </div>
                        <p className={`text-xs mt-2 ${
                          isComplete ? "text-emerald-700" : "text-amber-700"
                        }`}>
                          {data?.count || 0} of {totalQuestions} translated
                        </p>
                      </div>
                    );
                  })}

                {/* Placeholder if no languages */}
                {initializedLocales.length === 0 && (
                  <div className="col-span-full p-8 text-center border-2 border-dashed border-gray-300 rounded-lg">
                    <Languages className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No additional languages yet</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Add your first language above to start translating
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {initializedLocales.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Ready to translate?
                    </h3>
                    <p className="text-sm text-gray-600">
                      Switch to translation mode to start editing content
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView("translate")}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium flex items-center gap-2 shadow-md"
                  >
                    Start Translating
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <TranslationUI />
        )}
      </div>
    </div>
  );
}