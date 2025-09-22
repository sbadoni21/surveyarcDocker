"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Play, Pause, Square, RotateCcw, MessageCircle, CheckCircle2 as CheckCircle,
  Users, FileText, AlertTriangle, Loader2, ChevronRight, Settings2, Plus
} from "lucide-react";
import {
  collection, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc
} from "firebase/firestore";
import { db, auth } from "@/firebase/firebase";
import { useRouteParams } from "@/utils/getPaths";

/* ----------------- helpers ----------------- */
function getCFBase() {
  return ("http://127.0.0.1:5001/surveyarc-v2/asia-south1/" || "").replace(/\/+$/, "");
}
async function callCF(name, body) {
  const token = await auth.currentUser?.getIdToken?.();
  const res = await fetch(`${getCFBase()}/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
      const res2 = await fetch(`${getCFBase()}/deliverWhatsAppChunk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  }
  if (!res2.ok) throw new Error(data?.message || data?.error?.message || "Request failed");
  return data;
}
function pretty(n = 0) { return new Intl.NumberFormat().format(n || 0); }
function pct(t) {
  const p = t?.targets || 0;
  const d = (t?.sent || 0) + (t?.failed || 0) + (t?.skipped || 0);
  return p ? Math.round((d / p) * 100) : 0;
}
function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "c_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* ----------------- page ----------------- */
export default function WhatsappDistributionPage() {
  const { orgId, projectId, surveyId } = useRouteParams();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [lists, setLists] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [progress, setProgress] = useState(null);
  const [totals, setTotals] = useState(null);
  const [step, setStep] = useState(1);

  // form state
  const [templateId, setTemplateId] = useState("");
  const [listIds, setListIds] = useState([]);
  const [name, setName] = useState("");
  const [chunkSize, setChunkSize] = useState("");
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [err, setErr] = useState(null);

  // load templates & lists
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    (async () => {
      try {
        const tCol = collection(db, "organizations", orgId, "whatsappTemplates");
        const tSnap = await getDocs(query(tCol, orderBy("status", "desc")));
        const t = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const lCol = collection(db, "organizations", orgId, "whatsappLists");
        const lSnap = await getDocs(lCol);
        const l = lSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setTemplates(t);
        setLists(l);
      } catch (e) {
        setErr(e.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === templateId || t.uid === templateId || t.name === templateId),
    [templates, templateId]
  );
  const selectedLists = useMemo(() => lists.filter((l) => listIds.includes(l.id)), [lists, listIds]);
  const estTargets = useMemo(
    () => selectedLists.reduce((sum, l) => sum + (l.contactIds?.length || 0), 0),
    [selectedLists]
  );

  // live subscribe after campaign created
  useEffect(() => {
    if (!orgId || !campaign?.id) return;
    const campRef = doc(db, "organizations", orgId, "campaigns", campaign.id);
    const unsubCamp = onSnapshot(campRef, (snap) => snap.exists() && setTotals(snap.data().totals || null));
    const progRef = doc(db, "organizations", orgId, "campaignProgress", campaign.id);
    const unsubProg = onSnapshot(progRef, (snap) => snap.exists() && setProgress(snap.data()));
    return () => { unsubCamp(); unsubProg(); };
  }, [orgId, campaign?.id]);

  async function createCampaign() {
    try {
      setErr(null);
      setCreating(true);
      if (!orgId) throw new Error("Missing orgId");
      if (!templateId) throw new Error("Choose a WhatsApp template");
      if (!listIds.length) throw new Error("Pick at least one list");

      const nm = name?.trim() || `WhatsApp • ${new Date().toLocaleString()}`;
      const campId = makeId();
      const ref = doc(db, "organizations", orgId, "campaigns", campId);
      const base = {
        id: campId,
        name: nm,
        channel: "whatsapp",
        status: "draft",
        templateId: selectedTemplate?.id || selectedTemplate?.uid || templateId,
        listIds,
        projectId: projectId || null,
        surveyId: surveyId || null,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email || null } : null,
        totals: { targets: estTargets, queued: 0, sent: 0, failed: 0, skipped: 0 },
        chunkSize: Number(chunkSize) || null,
      };
      await setDoc(ref, base, { merge: true });
      setCampaign(base);
      setStep(3);
    } catch (e) {
      setErr(e.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  }

  async function startCampaign() {
    try {
      if (!campaign) return;
      setStarting(true);
      await callCF("startWhatsAppCampaign", { orgId, campaignId: campaign.id });
      setStep(4);
    } catch (e) {
      setErr(e.message || "Failed to start campaign");
    } finally {
      setStarting(false);
    }
  }

  async function doAction(kind) {
    if (!campaign) return;
    try {
      setActionBusy(true);
      const cf =
        kind === "pause" ? "pauseWhatsAppCampaign" :
        kind === "resume" ? "resumeWhatsAppCampaign" :
        "cancelWhatsAppCampaign";
      await callCF(cf, { orgId, campaignId: campaign.id });
    } catch (e) {
      setErr(e.message || `Failed to ${kind} campaign`);
    } finally {
      setActionBusy(false);
    }
  }

  function StepBadge({ n, active }) {
    return (
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold
        ${active ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700"}`}>
        {n}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-gray-600">
        <Loader2 className="animate-spin" /> Loading WhatsApp templates & lists…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl border p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <MessageCircle className="text-emerald-700" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">WhatsApp Survey Distribution</h1>
              <p className="text-gray-600">Create a campaign with an approved template, pick recipient lists, and send.</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className={`bg-white border rounded-xl p-5 ${step >= 1 ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge n={1} active={step === 1} />
              <div className="font-medium">Choose Template</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-gray-600">WhatsApp templates (APPROVED preferred)</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Select template —</option>
                {templates
                  .sort((a, b) => {
                    const aa = a.status === "APPROVED";
                    const bb = b.status === "APPROVED";
                    return aa === bb ? 0 : aa ? -1 : 1;
                  })
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} • {t.language || "en_US"} • {t.status}
                    </option>
                  ))}
              </select>

              {selectedTemplate && (
                <div className="text-xs text-gray-600 bg-gray-50 border rounded p-3">
                  <div className="font-semibold mb-1">Preview</div>
                  <div className="whitespace-pre-wrap">
                    {selectedTemplate?.components?.header?.type === "TEXT" && (
                      <div className="mb-2 text-gray-800">{selectedTemplate.components.header.text}</div>
                    )}
                    <div className="text-gray-800">
                      {selectedTemplate?.components?.body?.text || "(no body?)"}
                    </div>
                    {selectedTemplate?.components?.footer?.text && (
                      <div className="mt-2 text-gray-500 italic">
                        {selectedTemplate.components.footer.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setStep(2)}
                disabled={!templateId}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className={`bg-white border rounded-xl p-5 ${step >= 2 ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge n={2} active={step === 2} />
              <div className="font-medium">Select Recipient Lists</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-gray-600">Lists</label>
              <div className="max-h-52 overflow-auto border rounded">
                {lists.length === 0 && (
                  <div className="p-3 text-sm text-gray-500">No WhatsApp lists yet.</div>
                )}
                {lists.map((l) => {
                  const checked = listIds.includes(l.id);
                  return (
                    <label key={l.id} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setListIds((prev) =>
                              e.target.checked ? [...prev, l.id] : prev.filter((x) => x !== l.id)
                            );
                          }}
                        />
                        <span className="text-sm">{l.name || l.id}</span>
                      </div>
                      <div className="text-xs text-gray-500">{pretty(l.contactIds?.length || 0)} contacts</div>
                    </label>
                  );
                })}
              </div>

              <div className="text-xs text-gray-600 flex items-center gap-2">
                <Users size={14} /> Estimated recipients (before phone dedupe): <b>{pretty(estTargets)}</b>
              </div>

              <button
                className="mt-2 inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
                onClick={() => setStep(3)}
                disabled={!templateId || listIds.length === 0}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className={`bg-white border rounded-xl p-5 ${step >= 3 ? "" : "opacity-60"}`}>
            <div className="flex items-center gap-2 mb-3">
              <StepBadge n={3} active={step === 3} />
              <div className="font-medium">Create & Start</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm text-gray-600">Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Survey follow-up (Sep)"
                className="w-full border rounded px-3 py-2"
              />

              <label className="text-sm text-gray-600">Chunk size (optional)</label>
              <input
                type="number"
                min={50}
                max={1000}
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="Auto"
              />

              {!campaign ? (
                <button
                  onClick={createCampaign}
                  disabled={!templateId || listIds.length === 0 || creating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? <Loader2 className="animate-spin" /> : <Plus size={16} />}
                  Create campaign
                </button>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle size={18} /> Campaign <b>{campaign.name}</b> created.
                  </div>
                  <button
                    onClick={startCampaign}
                    disabled={starting}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="animate-spin" /> : <Play size={16} />}
                    Start sending
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Monitor */}
        <div className={`bg-white border rounded-xl p-6 ${campaign ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={18} />
            <div className="font-medium">Monitor & Control</div>
          </div>

          {!campaign ? (
            <div className="text-sm text-gray-600">Create your campaign first to see live stats here.</div>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <Stat title="Targets" value={totals?.targets} />
                <Stat title="Queued" value={totals?.queued} />
                <Stat title="Sent" value={totals?.sent} />
                <Stat title="Failed / Skipped" value={`${pretty(totals?.failed || 0)} / ${pretty(totals?.skipped || 0)}`} />
              </div>

              <div className="mt-4">
                <ProgressBar percent={pct(totals)} />
                <div className="text-xs text-gray-600 mt-2">
                  {pct(totals)}% processed • Updated {progress?.timestamp?.toDate ? progress.timestamp.toDate().toLocaleString() : "…"}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => doAction("pause")} className="px-3 py-2 border rounded hover:bg-gray-50" disabled={actionBusy}>
                  <Pause size={16} className="inline mr-1" /> Pause
                </button>
                <button onClick={() => doAction("resume")} className="px-3 py-2 border rounded hover:bg-gray-50" disabled={actionBusy}>
                  <RotateCcw size={16} className="inline mr-1" /> Resume
                </button>
                <button
                  onClick={() => doAction("cancel")}
                  className="px-3 py-2 border rounded text-red-600 hover:bg-red-50 border-red-200"
                  disabled={actionBusy}
                >
                  <Square size={16} className="inline mr-1" /> Cancel
                </button>
              </div>
            </>
          )}
        </div>

        {err && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 flex items-center gap-2">
            <AlertTriangle size={16} /> {err}
          </div>
        )}

        {/* FYI */}
        <div className="bg-emerald-50 border border-emerald-200 rounded p-4 text-sm text-emerald-900">
          <div className="font-semibold mb-1 flex items-center gap-2"><FileText size={16}/> How variables are filled</div>
          <p>
            WhatsApp placeholders <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>, … are auto-filled from each contact
            (firstName, custom1/2/3, org name). To control order, add <code>varKeys</code> on the template document,
            e.g. <code>["firstName","appointmentDate","providerName"]</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------- tiny UI ------- */
function Stat({ title, value }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
      <div className="text-xl font-semibold mt-1">{typeof value === "string" ? value : pretty(value || 0)}</div>
    </div>
  );
}
function ProgressBar({ percent }) {
  const p = Math.min(100, Math.max(0, percent || 0));
  return (
    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-3 bg-emerald-600" style={{ width: `${p}%` }} />
    </div>
  );
}
