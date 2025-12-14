"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useParticipantSources } from "@/providers/postGresPorviders/participantSourcePProvider";
import { ChevronDown, ChevronRight, Copy, Edit } from "lucide-react";

const PROVIDER_META = {
  dynata: { icon: "🔷", label: "Dynata / SSI" },
  cint: { icon: "🟢", label: "Cint" },
  lucid: { icon: "🟣", label: "Lucid" },
  azure: { icon: "🔵", label: "Azure / Xurway" },
  file: { icon: "📁", label: "File / CSV Upload" },
  custom_external: { icon: "⚙️", label: "Custom Panel" },
};

function copyToClipboard(text) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).catch((err) =>
    console.error("Failed to copy:", err)
  );
}

function Pill({ children, kind = "default" }) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
  const styles =
    kind === "required"
      ? "bg-red-50 text-red-700 ring-1 ring-red-100"
      : kind === "optional"
      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
      : kind === "active"
      ? "bg-green-50 text-green-700 ring-1 ring-green-100"
      : kind === "inactive"
      ? "bg-gray-100 text-gray-600"
      : "bg-gray-100 text-gray-700";

  return <span className={`${base} ${styles}`}>{children}</span>;
}

export default function PanelOverview({ onAddPanel, onEditPanel }) {
  const pathname = usePathname();
  const { sources, loading } = useParticipantSources();

  const [origin, setOrigin] = useState("");
  const [rows, setRows] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const { locale, orgId, surveyId } = useMemo(() => {
    const parts = (pathname || "").split("/").filter(Boolean);
    return {
      locale: parts[0] || "en",
      orgId: parts[2] || null,
      surveyId: parts[7] || parts[6] || null,
    };
  }, [pathname]);

  useEffect(() => {
    if (!origin || !orgId || !surveyId || !sources.length) return;

    const load = async () => {
      const enriched = await Promise.all(
        sources.map(async (src) => {
          const providerKey = src.meta_data?.provider || "custom_external";

          const baseFormUrl = `${origin}/${locale}/form?org_id=${encodeURIComponent(
            orgId
          )}&survey_id=${encodeURIComponent(
            surveyId
          )}&source_id=${encodeURIComponent(src.id)}`;

          let generated = null;
          let stats = null;

          try {
            const [urlRes, statsRes] = await Promise.all([
              fetch(
                `/api/post-gres-apis/participant-sources/${encodeURIComponent(
                  src.id
                )}/generate-url?base_url=${encodeURIComponent(baseFormUrl)}`
              ),
              fetch(
                `/api/post-gres-apis/participant-sources/${encodeURIComponent(
                  src.id
                )}/stats`
              ),
            ]);

            if (urlRes.ok) generated = await urlRes.json();
            if (statsRes.ok) stats = await statsRes.json();
          } catch (err) {
            console.error("Failed to load panel extras:", err);
          }

          return {
            ...src,
            providerKey,
            baseFormUrl,
            generated,
            stats,
          };
        })
      );

      setRows(enriched);
    };

    load();
  }, [origin, orgId, surveyId, locale, sources]);

  if (!orgId || !surveyId) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Cannot detect org/survey from URL. Open this page from a survey context.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
        Loading panels…
      </div>
    );
  }

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Panel Links & Status
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Click on any panel row to view detailed information and URLs
          </p>
          
        </div>
        {onAddPanel && (
          <button
            onClick={() => onAddPanel()}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Panel
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Panel Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Provider
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Clicks
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Starts
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                Completes
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                IR
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                CR
              </th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rows.map((src) => {
              const meta =
                PROVIDER_META[src.providerKey] || PROVIDER_META.custom_external;
              const gen = src.generated;
              const isExpanded = expandedRow === src.id;

              const completionRate =
                src.stats?.completion_rate ??
                (src.stats && src.stats.total_starts > 0
                  ? (src.stats.current_completes / src.stats.total_starts) * 100
                  : null);

              const ir =
                src.stats?.incidence_rate ??
                (src.stats && src.stats.total_clicks > 0
                  ? (src.stats.total_starts / src.stats.total_clicks) * 100
                  : null);

              const linkToShow = gen?.example_url || src.baseFormUrl;
              const requiredParams = Array.isArray(gen?.required_params)
                ? gen.required_params
                : [];
              const optionalParams = Array.isArray(gen?.optional_params)
                ? gen.optional_params
                : [];

              return (
                <>
                  <tr
                    key={src.id}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => toggleRow(src.id)}
                  >
                    <td className="px-3 py-4 text-gray-400">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {src.source_name}
                          </div>
                          {src.description && (
                            <div className="text-xs text-gray-500">
                              {src.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Pill>{meta.label}</Pill>
                    </td>
                    <td className="px-6 py-4">
                      <Pill kind={src.is_active ? "active" : "inactive"}>
                        {src.is_active ? "Active" : "Inactive"}
                      </Pill>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      {src.stats?.total_clicks ?? src.total_clicks ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      {src.stats?.total_starts ?? src.total_starts ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      {src.stats?.current_completes ?? src.current_completes ?? 0}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {ir != null ? `${ir.toFixed(0)}%` : "--"}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {completionRate != null
                        ? `${completionRate.toFixed(0)}%`
                        : "--"}
                    </td>
                    <td className="px-3 py-4">
                      {onEditPanel && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPanel(src.id);
                          }}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan="10" className="bg-gray-50 px-6 py-4">
                        <div className="space-y-4">
                          {/* Panel Entry Link */}
                          <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">
                              Panel Entry Link
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 overflow-hidden rounded-md border border-gray-300 bg-white px-3 py-2">
                                <p className="break-all font-mono text-sm text-gray-700">
                                  {linkToShow}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(linkToShow);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <Copy className="h-4 w-4" />
                                Copy
                              </button>
                            </div>
                          </div>

                          {/* Parameters */}
                          {gen && (requiredParams.length > 0 || optionalParams.length > 0) && (
                            <div className="grid gap-4 md:grid-cols-2">
                              {requiredParams.length > 0 && (
                                <div>
                                  <p className="mb-2 text-sm font-medium text-gray-700">
                                    Required Parameters
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {requiredParams.map((p) => (
                                      <Pill key={p} kind="required">
                                        {p}
                                      </Pill>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {optionalParams.length > 0 && (
                                <div>
                                  <p className="mb-2 text-sm font-medium text-gray-700">
                                    Optional Parameters
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {optionalParams.map((p) => (
                                      <Pill key={p} kind="optional">
                                        {p}
                                      </Pill>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Provider Documentation */}
                          {src.meta_data?.docs_url && (
                            <div>
                              <p className="text-sm text-gray-600">
                                Provider documentation:{" "}
                                <a
                                  href={src.meta_data.docs_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-blue-600 underline hover:text-blue-800"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {src.meta_data.docs_url}
                                </a>
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}