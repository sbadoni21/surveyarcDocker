"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";
import {
  Plus,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Link as LinkIcon,
  Eye,
} from "lucide-react";

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || "https://your-domain.com";
}

function normalizeDomain(d = "") {
  return String(d).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

function isLikelyDomain(d = "") {
  // super light check (example.com, sub.example.co.uk, etc.)
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d);
}

/** Build canonical survey URL used by iframe */
function buildSurveyUrl({ orgId, surveyId, campaignId, domain }) {
  const base = getBaseUrl();
  const path = `/surveyarcv2/form/${encodeURIComponent(orgId)}`;
  const q = new URLSearchParams({
    surveyId: String(surveyId || ""),
    campaignId: String(campaignId || ""),
    utm_medium: "embed",
    utm_source: "website",
    host: domain || "",
  });
  return `${base}${path}?${q.toString()}`;
}

/** Build a simple iframe embed snippet */
function buildIframeEmbed({ orgId, surveyId, campaignId, domain }) {
  const src = buildSurveyUrl({ orgId, surveyId, campaignId, domain });
  return [
    `<!-- SurveyArc Embed -->`,
    `<iframe`,
    `  src="${src}"`,
    `  width="100%"`,
    `  height="600"`,
    `  style="border:0; max-width: 100%;"`,
    `  loading="lazy"`,
    `  allow="clipboard-write; fullscreen"`,
    `  title="Survey">`,
    `</iframe>`,
  ].join("\n");
}

export default function EmbedCampaignsPage() {
  const { orgId, surveyId, projectId } = useRouteParams();

  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [reloading, setReloading] = useState(false);

  const canCreate = useMemo(
    () => !!orgId && !!surveyId && isLikelyDomain(normalizeDomain(domain)),
    [orgId, surveyId, domain]
  );

  const fetchCampaigns = useCallback(async () => {
    if (!orgId) return;
    setReloading(true);
    try {
      const qref = query(
        collection(db, "organizations", orgId, "campaigns"),
        where("channel", "==", "embed"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(qref);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCampaigns(rows);
    } finally {
      setReloading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  async function createCampaign() {
    if (!canCreate) return;
    try {
      setCreating(true);
      const user = auth.currentUser;
      const clean = normalizeDomain(domain);
      const name = `Website Embed • ${clean}`;

      const ref = await addDoc(collection(db, "organizations", orgId, "campaigns"), {
        name,
        channel: "embed",
        status: "active",
        createdAt: serverTimestamp(),
        orgId,
        projectId: projectId || null,
        surveyId,
        totals: { targets: 0, queued: 0, sent: 0, failed: 0, skipped: 0 },
        meta: { domain: clean },
        createdBy: user ? { uid: user.uid, email: user.email || null } : null,
      });

      await updateDoc(doc(db, "organizations", orgId, "campaigns", ref.id), { uid: ref.id });
      setDomain(clean);
      await fetchCampaigns();
    } catch (e) {
      console.error(e);
      alert("Failed to create embed campaign");
    } finally {
      setCreating(false);
    }
  }

  function codeForCampaign(c) {
    return buildIframeEmbed({
      orgId,
      surveyId: c.surveyId || surveyId,
      campaignId: c.uid || c.id,
      domain: c.meta?.domain || "",
    });
  }

  async function copy(text, key = "") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key || text);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Globe className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Website Embed Campaigns</h1>
              <p className="text-gray-600">
                Enter a website domain — we’ll create a campaign and give you an iframe embed code.
              </p>
            </div>
          </div>

          <button
            onClick={fetchCampaigns}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            disabled={reloading}
          >
            <RefreshCw size={16} className={reloading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Create form */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Create new embed campaign</h2>
          <div className="grid md:grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="w-full border rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Only the domain (no protocol), e.g. <code>example.com</code>
              </p>
            </div>
            <button
              onClick={createCampaign}
              disabled={!canCreate || creating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              <Plus size={16} />
              Create Campaign
            </button>
          </div>
        </div>

        {/* Existing campaigns */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">All embed campaigns</h2>
            <span className="text-sm text-gray-500">{campaigns.length} total</span>
          </div>

          {campaigns.length === 0 ? (
            <div className="text-gray-600">No embed campaigns yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 border text-left">Name</th>
                    <th className="px-4 py-2 border text-left">Domain</th>
                    <th className="px-4 py-2 border text-left">Survey</th>
                    <th className="px-4 py-2 border text-left">Campaign ID</th>
                    <th className="px-4 py-2 border w-64">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const campId = c.uid || c.id;
                    const domain = c.meta?.domain || "";
                    const url = buildSurveyUrl({
                      orgId,
                      surveyId: c.surveyId || surveyId,
                      campaignId: campId,
                      domain,
                    });
                    const snippet = codeForCampaign(c);

                    return (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border">{c.name || "Website Embed"}</td>
                        <td className="px-4 py-2 border">{domain || "-"}</td>
                        <td className="px-4 py-2 border">{c.surveyId || surveyId || "-"}</td>
                        <td className="px-4 py-2 border font-mono text-xs">{campId}</td>
                        <td className="px-4 py-2 border">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => copy(snippet, `code:${campId}`)}
                              className="inline-flex items-center gap-1 px-3 py-1 border rounded hover:bg-gray-50"
                              title="Copy embed code"
                            >
                              {copied === `code:${campId}` ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                              Embed code
                            </button>
                            <button
                              onClick={() => copy(url, `url:${campId}`)}
                              className="inline-flex items-center gap-1 px-3 py-1 border rounded hover:bg-gray-50"
                              title="Copy direct link"
                            >
                              {copied === `url:${campId}` ? (
                                <Check size={14} className="text-emerald-600" />
                              ) : (
                                <LinkIcon size={14} />
                              )}
                              Link
                            </button>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="Open preview"
                            >
                              <Eye size={14} />
                              Preview
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick embed preview for latest created domain */}
        {domain && isLikelyDomain(normalizeDomain(domain)) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-2">Example embed code (for latest domain)</h2>
            <p className="text-gray-600 mb-3">
              After creating a campaign, copy the embed code from the table above and paste it into your site.
            </p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`<!-- Example (after campaign exists) -->
<iframe
  src="${getBaseUrl()}/surveyarcv2/form/${orgId}?surveyId=${surveyId}&campaignId={YOUR_CAMPAIGN_ID}&utm_medium=embed&utm_source=website&host=${normalizeDomain(domain)}"
  width="100%"
  height="600"
  style="border:0; max-width: 100%;"
  loading="lazy"
  allow="clipboard-write; fullscreen"
  title="Survey">
</iframe>`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
