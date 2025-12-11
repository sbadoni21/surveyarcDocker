// components/panel/PanelOverview.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useParticipantSources } from "@/providers/postGresPorviders/participantSourcePProvider";

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
      : "bg-gray-100 text-gray-700";

  return <span className={`${base} ${styles}`}>{children}</span>;
}

export default function PanelOverview() {
  const pathname = usePathname();
  const { sources, loading } = useParticipantSources();

  const [origin, setOrigin] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  // Expected path: /en/org/[orgId]/dashboard/projects/[projectId]/surveys/[surveyId]/panel
  const { locale, orgId, surveyId } = useMemo(() => {
    const parts = (pathname || "").split("/").filter(Boolean);
    return {
      locale: parts[0] || "en",
      orgId: parts[2] || null,
      surveyId: parts[7] || parts[6] || null,
    };
  }, [pathname]);

  // Load stats + generated URLs for each source
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

  if (!sources.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
        No participant sources configured yet. Create a panel in the “Panel /
        Participant Sources” tab first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Panel Links & Status
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Give these URLs to panel providers like Dynata, Cint, Lucid, etc.
            They already include the correct <code>source_id</code> and
            placeholders for respondent IDs.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((src) => {
          const meta =
            PROVIDER_META[src.providerKey] || PROVIDER_META.custom_external;
          const gen = src.generated;

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

          // 🔹 SAFE DEFAULTS for params
          const requiredParams = Array.isArray(gen?.required_params)
            ? gen.required_params
            : [];
          const optionalParams = Array.isArray(gen?.optional_params)
            ? gen.optional_params
            : [];

          return (
            <div
              key={src.id}
              className="flex max-w-7xl justify-center flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-2xl">
                    {meta.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {src.source_name}
                      </h3>
                      <Pill>{meta.label}</Pill>
                    </div>
                    {src.description && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {src.description}
                      </p>
                    )}
                  </div>
                </div>
                <Pill kind={src.is_active ? "default" : "optional"}>
                  {src.is_active ? "Active" : "Inactive"}
                </Pill>
              </div>

              {/* Main URL */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700">
                  Panel entry link
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 overflow-hidden rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                    <p className="truncate text-xs font-mono text-gray-700">
                      {linkToShow}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(linkToShow)}
                    className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>

                {gen && (
                  <p className="text-[11px] text-gray-500">
                    Required params:{" "}
                    {requiredParams.length ? (
                      requiredParams.map((p) => (
                        <Pill key={p} kind="required">
                          {p}
                        </Pill>
                      ))
                    ) : (
                      <span className="italic">none</span>
                    )}{" "}
                    {optionalParams.length > 0 && (
                      <>
                        &nbsp;• Optional:{" "}
                        {optionalParams.map((p) => (
                          <Pill key={p} kind="optional">
                            {p}
                          </Pill>
                        ))}
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="mt-2 grid grid-cols-4 gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-[11px] text-gray-500">Clicks</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {src.stats?.total_clicks ?? src.total_clicks ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Starts</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {src.stats?.total_starts ?? src.total_starts ?? 0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">Completes</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {src.stats?.current_completes ??
                      src.current_completes ??
                      0}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-500">IR / CR</p>
                  <p className="text-[11px] font-medium text-gray-900">
                    {ir != null ? `${ir.toFixed(0)}% IR` : "--"}{" "}
                    <span className="text-gray-400">·</span>{" "}
                    {completionRate != null
                      ? `${completionRate.toFixed(0)}% CR`
                      : "--"}
                  </p>
                </div>
              </div>

              {src.meta_data?.docs_url && (
                <p className="mt-1 text-[11px] text-gray-400">
                  Provider docs:{" "}
                  <a
                    href={src.meta_data.docs_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-gray-600"
                  >
                    {src.meta_data.docs_url}
                  </a>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
