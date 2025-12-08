"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Checkbox, Grid, IconButton, LinearProgress, Link,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography
} from "@mui/material";
import { Pencil, Trash2 } from "lucide-react";

import {
  Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon, ContentCopy as CopyIcon, Bolt as BoltIcon,
  LibraryAdd as BulkIcon, UploadFile as ImportIcon, Download as ExportIcon,
  PublishedWithChanges as PublishIcon, Archive as ArchiveIcon,
  Science as TestIcon, Update as VersionIcon, Info as InfoIcon, CleaningServices as CleanupIcon
} from "@mui/icons-material";
import { useMakingSLA } from "@/providers/slaMakingProivder";
import { SLAFormDialog } from "./SLADialogForm";
import { SLATable } from "./SLATable";
import ObjectivesDialog from "./SLAObjectiveForm";
import CreditRulesDialog from "./SLA_CreditRuleForm";

const PRIORITIES = ["low", "normal", "high", "urgent"];
const SEVERITIES = ["sev4", "sev3", "sev2", "sev1"];
const DIMENSIONS = [
  { value: "first_response", label: "First Response" },
  { value: "resolution", label: "Resolution" },
  { value: "update_cadence", label: "Update Cadence" },
  { value: "custom", label: "Custom" },
];
const BREACH_GRADES = ["minor", "major", "critical"];
const CREDIT_UNITS = [
  { value: "percent_fee", label: "% of Fee" },
  { value: "fixed_usd", label: "Fixed USD" },
  { value: "service_days", label: "Service Days" },
];

export default function SLAAdminPanel({ orgId }) {
  const {
    // state
    slas, listSlas,
    // SLA ops
    createSla, updateSla, removeSla, activateSla, deactivateSla, duplicateSla,
    publishSla, archiveSla, validateSla, createNewVersion, listVersions, dependencies,
    // bulk
    bulkUpsert, bulkDelete,
    // objectives
    listObjectives, createObjective, updateObjective, removeObjective,
    // credit rules
    listCreditRules, createCreditRule, updateCreditRule, removeCreditRule,
    // org tools
    match, simulate, effective, stats, compliance, exportSlas, importSlas, cleanup,
  } = useMakingSLA();

  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [openSla, setOpenSla] = useState(false);
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    active: true,
    first_response_minutes: "",
    resolution_minutes: "",
    rules: { priority_map: {}, severity_map: {} },
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // dialogs: objectives / credits (CRUD)
  const [openObjective, setOpenObjective] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [objectiveForm, setObjectiveForm] = useState({
    objective: "first_response",
    target_minutes: 30,
    match: {},
    breach_grades: {},
    active: true,
  });

  const [openCredit, setOpenCredit] = useState(false);
  const [editingCredit, setEditingCredit] = useState(null);
  const [creditForm, setCreditForm] = useState({
    objective: "resolution",
    grade: "major",
    credit_unit: "percent_fee",
    credit_value: 10,
    cap_per_period: "",
    period_days: "",
    active: true,
  });

  // dialogs: import/export/bulk/test/stats/versions/dep/cleanup
  const [openImport, setOpenImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [openBulk, setOpenBulk] = useState(false);
  const [bulkJson, setBulkJson] = useState("[\n  {\"org_id\":\"" + orgId + "\",\"name\":\"Sample SLA\",\"slug\":\"sample\",\"active\":true}\n]");
  const [openTest, setOpenTest] = useState(false);
  const [testMode, setTestMode] = useState("match"); // match | simulate | effective
  const [testInput, setTestInput] = useState({ priority: "", severity: "", tags: "" });
  const [testOutput, setTestOutput] = useState(null);
  const [openStats, setOpenStats] = useState(false);
  const [statsData, setStatsData] = useState(null);
  const [complianceRange, setComplianceRange] = useState({ from: "", to: "" });
  const [complianceData, setComplianceData] = useState(null);
  const [openVersions, setOpenVersions] = useState(false);
  const [versionsOf, setVersionsOf] = useState({ sla: null, list: [] });
  const [openDeps, setOpenDeps] = useState(false);
  const [depsInfo, setDepsInfo] = useState(null);
  const [openCleanup, setOpenCleanup] = useState(false);
  const [cleanupOpts, setCleanupOpts] = useState({ days: 90, dry: true });
  const [cleanupResult, setCleanupResult] = useState(null);

  // load
  useEffect(() => {
    if (orgId) listSlas({ orgId, active: activeOnly });
  }, [orgId, activeOnly, listSlas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = Array.isArray(slas) ? slas : [];
    if (q) arr = arr.filter(s => (s.name || "").toLowerCase().includes(q) || (s.slug || "").toLowerCase().includes(q));
    return arr.sort((a, b) => (a.precedence ?? 100) - (b.precedence ?? 100));
  }, [slas, query]);

  // ---------------- SLA CRUD ----------------
  const handleOpenCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      active: true,
      first_response_minutes: "",
      resolution_minutes: "",
      rules: { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };
  const handleOpenEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "",
      slug: s.slug || "",
      description: s.description || "",
      active: !!s.active,
      first_response_minutes: s.first_response_minutes ?? "",
      resolution_minutes: s.resolution_minutes ?? "",
      rules: s.rules || { priority_map: {}, severity_map: {} },
    });
    setOpenSla(true);
  };
  const saveSla = async () => {
    setBusy(true);
    const payload = {
      org_id: orgId,
      name: form.name.trim(),
      slug: form.slug?.trim() || null,
      description: form.description?.trim() || null,
      active: !!form.active,
      first_response_minutes: form.first_response_minutes === "" ? null : Number(form.first_response_minutes),
      resolution_minutes: form.resolution_minutes === "" ? null : Number(form.resolution_minutes),
      rules: form.rules || {},
    };
    if (editing) await updateSla(editing.sla_id, payload);
    else await createSla(payload);
    setBusy(false);
    setOpenSla(false);
  };
  const onDuplicate = async (s) => { await duplicateSla(s.sla_id, { name: `${s.name} (Copy)`, slug: "" }); };
  const onActivateToggle = async (s) => { s.active ? await deactivateSla(s.sla_id) : await activateSla(s.sla_id); };
  const onDeleteSLA = async (s) => { if (confirm(`Delete SLA "${s.name}"?`)) await removeSla(s.sla_id); };

  // --------------- Publish/Archive/Validate/Versions/Deps ---------------
  const doPublish = async (s) => { await publishSla(s.sla_id, {}); };
  const doArchive = async (s) => { await archiveSla(s.sla_id); };
  const doValidate = async (s) => {
    const res = await validateSla(s.sla_id);
    alert(`${res.valid ? "VALID ✅" : "INVALID ❌"}\n\nErrors: ${res.errors?.join(", ") || "—"}\nWarnings: ${res.warnings?.join(", ") || "—"}`);
  };
  const openVersionList = async (s) => {
    const list = await listVersions(s.sla_id);
    setVersionsOf({ sla: s, list });
    setOpenVersions(true);
  };
  const makeNewVersion = async (s) => {
    const v = await createNewVersion(s.sla_id, {});
    setVersionsOf({ sla: v, list: await listVersions(v.sla_id) });
    setOpenVersions(true);
  };
  const openDepsDialog = async (s) => {
    setDepsInfo(await dependencies(s.sla_id, { limit: 100 }));
    setOpenDeps(true);
  };

// ---------------- Objectives ---------------
const openObjectiveFor = async (sla) => {
  setEditingObjective({ sla });
  setObjectiveForm({ objective: "first_response", target_minutes: 30, match: {}, breach_grades: {}, active: true });
  // pass orgId first (model expects orgId, slaId)
  await listObjectives( sla.sla_id);
  setOpenObjective(true);
};

const editObjective = (sla, obj) => {
  setEditingObjective({ sla, obj });
  setObjectiveForm({
    objective: obj.objective,
    target_minutes: obj.target_minutes ?? "",
    match: obj.match || {},
    breach_grades: obj.breach_grades || {},
    active: obj.active !== false,
  });
  setOpenObjective(true);
};

// Save objective — accepts payload from the dialog (first arg) and sla (second arg)
const saveObjective = async (payloadFromDialog, slaFromDialog) => {
  // debugging: inspect what we received from the dialog
  console.info("saveObjective called. payloadFromDialog:", payloadFromDialog, "slaFromDialog:", slaFromDialog, "editingObjective:", editingObjective);

  // if dialog didn't pass anything (back-compat), try to fallback to parent state
  const sla = slaFromDialog || editingObjective?.sla;
  if (!sla) {
    console.error("No SLA provided for objective save.");
    return;
  }

  // If payloadFromDialog is not provided for some reason, build it from parent's objectiveForm
  let payload = payloadFromDialog;
  if (!payload) {
    // normalize parent objectiveForm to expected shape
    const normalizedBreach = Object.fromEntries(
      Object.entries(objectiveForm.breach_grades || {})
        .map(([k, v]) => {
          if (v === "" || v === null || v === undefined) return [k, undefined];
          const n = Number(v);
          return [k, Number.isFinite(n) ? n : undefined];
        })
        .filter(([, v]) => v !== undefined)
    );

    payload = {
      objective: objectiveForm.objective,
      target_minutes: Number(objectiveForm.target_minutes),
      match: objectiveForm.match || {},
      breach_grades: normalizedBreach,
      active: !!objectiveForm.active,
    };
  }

  // debug again: what we'll actually send to the model
  console.info("Final objective payload ->", payload, "orgId:", orgId, "slaId:", sla.sla_id);

  try {
    const { obj } = editingObjective || {}; // existing objective if editing
    if (!obj) {
      // createObjective(orgId, slaId, payload)
      await createObjective( sla.sla_id, payload);
    } else {
      // updateObjective(orgId, objectiveId, patch)
      await updateObjective(obj.objective_id, payload);
    }

    // refresh the list (model expects orgId, slaId)
    await listObjectives( sla.sla_id);
    setOpenObjective(false);
  } catch (err) {
    console.error("Failed saving objective:", err);
    // show a toast/alert if you want
  }
};


const deleteObjective = async (slaId, objectiveId) => {
  if (!confirm("Delete this objective?")) return;
  try {
    // removeObjective(orgId, objectiveId)
    await removeObjective( objectiveId);
    await listObjectives( slaId);
  } catch (err) {
    console.error("Failed to delete objective:", err);
  }
};


  // --------------- Credit Rules ---------------
  const openCreditFor = async (sla) => {
    setEditingCredit({ sla });
    setCreditForm({ objective: "resolution", grade: "major", credit_unit: "percent_fee", credit_value: 10, cap_per_period: "", period_days: "", active: true });
    await listCreditRules(sla.sla_id);
    setOpenCredit(true);
  };
  const editCredit = (sla, rule) => {
    setEditingCredit({ sla, rule });
    setCreditForm({
      objective: rule.objective, grade: rule.grade, credit_unit: rule.credit_unit, credit_value: rule.credit_value,
      cap_per_period: rule.cap_per_period ?? "", period_days: rule.period_days ?? "", active: rule.active !== false,
    });
    setOpenCredit(true);
  };
const saveCredit = async (payloadFromDialog, slaFromDialog) => {
  const sla = slaFromDialog || editingCredit?.sla;
  if (!sla) { console.error("No SLA for saving credit"); return; }
  const { rule } = editingCredit || {};
  try {
    if (!rule) await createCreditRule(orgId, sla.sla_id, payloadFromDialog);
    else await updateCreditRule(orgId, rule.rule_id, payloadFromDialog);
    await listCreditRules(orgId, sla.sla_id);
    setOpenCredit(false);
  } catch (err) { console.error(err); }
};

  const deleteCredit = async (slaId, ruleId) => {
    if (!confirm("Delete this credit rule?")) return;
    await removeCreditRule(ruleId);
    await listCreditRules(slaId);
  };

  // --------------- Export / Import / Bulk / Cleanup ---------------
  const doExport = async () => {
    const { blob, filename } = await exportSlas(orgId, { includeObjectives: true, includeCreditRules: true });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "slas.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const doImport = async () => {
    if (!importFile) return;
    setBusy(true);
    await importSlas(orgId, importFile, { updateExisting: true });
    setBusy(false);
    setOpenImport(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doBulkUpsert = async () => {
    const payload = JSON.parse(bulkJson || "[]");
    await bulkUpsert(payload, { updateExisting: true });
    setOpenBulk(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doBulkDelete = async () => {
    const payload = JSON.parse(bulkJson || "[]"); // support array of ids or objects
    const ids = Array.isArray(payload) ? payload.map((x) => (typeof x === "string" ? x : x.sla_id)).filter(Boolean) : [];
    await bulkDelete(ids, { force: false });
    setOpenBulk(false);
    await listSlas({ orgId, active: activeOnly });
  };
  const doCleanup = async () => {
    const res = await cleanup(orgId, { olderThanDays: Number(cleanupOpts.days || 90), dryRun: !!cleanupOpts.dry });
    setCleanupResult(res);
  };

  // --------------- Match / Simulate / Effective / Stats / Compliance ---------------
  const runTest = async () => {
    setBusy(true);
    try {
      if (testMode === "match") {
        const criteria = {
          priority: testInput.priority || undefined,
          severity: testInput.severity || undefined,
          tags: (testInput.tags || "").split(",").map(t => t.trim()).filter(Boolean),
        };
        setTestOutput(await match(orgId, criteria));
      } else if (testMode === "simulate") {
        const criteria = {
          priority: testInput.priority || undefined,
          severity: testInput.severity || undefined,
          tags: (testInput.tags || "").split(",").map(t => t.trim()).filter(Boolean),
        };
        setTestOutput(await simulate(orgId, criteria));
      } else {
        const at = testInput.at_time ? new Date(testInput.at_time) : undefined;
        setTestOutput(await effective(orgId, { at_time: at }));
      }
    } finally { setBusy(false); }
  };
  const openStatsDialog = async () => {
    setStatsData(await stats(orgId));
    setOpenStats(true);
  };
  const loadCompliance = async () => {
    const from = complianceRange.from ? new Date(complianceRange.from) : undefined;
    const to = complianceRange.to ? new Date(complianceRange.to) : undefined;
    setComplianceData(await compliance(orgId, { from_date: from, to_date: to }));
  };

  
return (
  <div className="space-y-6">
    {/* Top toolbar */}
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">SLA Policies</h1>
        <p className="text-xs text-gray-500">
          Manage SLA rules, objectives, credits, and compliance in one place.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex items-center rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
          <input
            type="text"
            placeholder="Search by name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-40 bg-transparent px-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none md:w-56"
          />
        </div>

        {/* Active only */}
        <label className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-3 w-3 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
          />
          Active only
        </label>

        {/* Actions */}
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
        >
          {/* <AddIcon className="h-4 w-4" /> */}
          New SLA
        </button>

        <button
          onClick={doExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {/* <ExportIcon className="h-4 w-4" /> */}
          Export
        </button>

        <button
          onClick={() => setOpenImport(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {/* <ImportIcon className="h-4 w-4" /> */}
          Import
        </button>

        <button
          onClick={() => setOpenBulk(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {/* <BulkIcon className="h-4 w-4" /> */}
          Bulk
        </button>

        <button
          onClick={() => setOpenTest(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {/* <TestIcon className="h-4 w-4" /> */}
          Test
        </button>

        <button
          onClick={openStatsDialog}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          {/* <InfoIcon className="h-4 w-4" /> */}
          Stats
        </button>

        <button
          onClick={() => setOpenCleanup(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-100"
        >
          {/* <CleanupIcon className="h-4 w-4" /> */}
          Cleanup
        </button>
      </div>
    </div>

    {/* Busy indicator */}
    {busy && (
      <div className="h-1 w-full overflow-hidden rounded-full bg-orange-100">
        <div className="h-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite] bg-orange-500" />
      </div>
    )}

    {/* Table card */}
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          SLA list
        </p>
      </div>
      <div className="px-3 py-3">
        <SLATable
          slas={filtered}
          onAction={{
            edit: handleOpenEdit,
            duplicate: onDuplicate,
            activateToggle: onActivateToggle,
            delete: onDeleteSLA,
            publish: doPublish,
            archive: doArchive,
            validate: doValidate,
            versions: openVersionList,
            newVersion: makeNewVersion,
            dependencies: openDepsDialog,
            objectives: openObjectiveFor,
            creditRules: openCreditFor,
          }}
        />
      </div>
    </div>

    {/* SLA create/edit dialog (your existing component, just wrapped nicely) */}
    <SLAFormDialog
      open={openSla}
      onClose={() => setOpenSla(false)}
      editing={editing}
      formData={form}
      onUpdate={update}
      onSave={saveSla}
      busy={busy}
    />

    <ObjectivesDialog
      open={openObjective}
      onClose={() => setOpenObjective(false)}
      editingObjective={editingObjective}
      DIMENSIONS={DIMENSIONS}
      BREACH_GRADES={BREACH_GRADES}
      ObjectivesTable={ObjectivesTable}
      onEditObjective={editObjective}
      onDeleteObjective={deleteObjective}
      onSaveObjective={saveObjective}
    />

    <CreditRulesDialog
      open={openCredit}
      onClose={() => setOpenCredit(false)}
      editingCredit={editingCredit}
      DIMENSIONS={DIMENSIONS}
      BREACH_GRADES={BREACH_GRADES}
      CREDIT_UNITS={CREDIT_UNITS}
      CreditRulesTable={CreditRulesTable}
      onEditCredit={editCredit}
      onDeleteCredit={deleteCredit}
      onSaveCredit={saveCredit}
    />

    {/* Import dialog */}
    {openImport && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Import SLAs (JSON)
            </h2>
            <button
              onClick={() => setOpenImport(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 px-4 py-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              Uploads expect the same structure as the Export.
            </div>
            <input
              type="file"
              accept="application/json"
              onChange={(e) =>
                setImportFile(e.target.files?.[0] || null)
              }
              className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-gray-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-100"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenImport(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
            <button
              onClick={doImport}
              disabled={!importFile}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
            >
              Import
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Bulk dialog */}
    {openBulk && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Bulk Upsert / Delete
            </h2>
            <button
              onClick={() => setOpenBulk(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 px-4 py-4">
            <p className="text-xs text-gray-600">
              Paste JSON array. For delete, you can paste{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                ["sla_x","sla_y"]
              </code>{" "}
              (ids) or full objects containing{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                sla_id
              </code>
              .
            </p>
            <textarea
              rows={10}
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex justify-between gap-2 border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenBulk(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
            <div className="flex gap-2">
              <button
                onClick={doBulkDelete}
                className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
              >
                Bulk Delete
              </button>
              <button
                onClick={doBulkUpsert}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600"
              >
                Bulk Upsert
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Test dialog */}
    {openTest && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Test SLAs
            </h2>
            <button
              onClick={() => setOpenTest(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row">
                {/* Mode select */}
                <div className="w-full md:w-40">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Mode
                  </label>
                  <select
                    value={testMode}
                    onChange={(e) => setTestMode(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="match">Match</option>
                    <option value="simulate">Simulate</option>
                    <option value="effective">Effective</option>
                  </select>
                </div>

                {testMode === "effective" ? (
                  <div className="w-full md:w-60">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      At time
                    </label>
                    <input
                      type="datetime-local"
                      value={testInput.at_time || ""}
                      onChange={(e) =>
                        setTestInput((f) => ({
                          ...f,
                          at_time: e.target.value,
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-full md:w-40">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Priority
                      </label>
                      <input
                        type="text"
                        placeholder="low/normal/high/urgent"
                        value={testInput.priority}
                        onChange={(e) =>
                          setTestInput((f) => ({
                            ...f,
                            priority: e.target.value,
                          }))
                        }
                        className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="w-full md:w-36">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Severity
                      </label>
                      <input
                        type="text"
                        placeholder="sev4–sev1"
                        value={testInput.severity}
                        onChange={(e) =>
                          setTestInput((f) => ({
                            ...f,
                            severity: e.target.value,
                          }))
                        }
                        className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="w-full">
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Tags (comma separated)
                      </label>
                      <input
                        type="text"
                        value={testInput.tags}
                        onChange={(e) =>
                          setTestInput((f) => ({
                            ...f,
                            tags: e.target.value,
                          }))
                        }
                        className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={runTest}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600"
              >
                {/* <TestIcon className="h-4 w-4" /> */}
                Run
              </button>

              {testOutput && (
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-900 p-3 text-[11px] text-gray-100">
                  <pre className="overflow-x-auto">
                    {JSON.stringify(testOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenTest(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Stats & Compliance dialog */}
    {openStats && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Org Stats &amp; Compliance
            </h2>
            <button
              onClick={() => setOpenStats(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-4">
            {statsData ? (
              <div className="space-y-4 text-xs text-gray-700">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-1 text-[11px] font-semibold text-gray-600">
                    Counts
                  </p>
                  <p>
                    Total: <b>{statsData.total_slas}</b> • Active:{" "}
                    <b>{statsData.active_slas}</b>
                  </p>
                  <p className="mt-1">
                    By scope:{" "}
                    <span className="font-mono text-[11px]">
                      {JSON.stringify(statsData.by_scope || {})}
                    </span>
                  </p>
                  <p className="mt-1">
                    By aggregation:{" "}
                    <span className="font-mono text-[11px]">
                      {JSON.stringify(statsData.by_aggregation || {})}
                    </span>
                  </p>
                  <p className="mt-1">
                    With objectives:{" "}
                    <b>{statsData.with_objectives}</b> • With credit rules:{" "}
                    <b>{statsData.with_credit_rules}</b>
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="w-full md:w-40">
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">
                      From
                    </label>
                    <input
                      type="date"
                      value={complianceRange.from}
                      onChange={(e) =>
                        setComplianceRange((f) => ({
                          ...f,
                          from: e.target.value,
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="w-full md:w-40">
                    <label className="mb-1 block text-[11px] font-medium text-gray-600">
                      To
                    </label>
                    <input
                      type="date"
                      value={complianceRange.to}
                      onChange={(e) =>
                        setComplianceRange((f) => ({
                          ...f,
                          to: e.target.value,
                        }))
                      }
                      className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <button
                    onClick={loadCompliance}
                    className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-black/90"
                  >
                    Load Compliance
                  </button>
                </div>

                {Array.isArray(complianceData) && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                    <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-[11px] font-semibold text-gray-600">
                        Compliance
                      </p>
                    </div>
                    <div className="max-h-80 overflow-auto">
                      <table className="min-w-full divide-y divide-gray-100 text-[11px]">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-[11px] font-semibold text-gray-500">
                            <th className="px-3 py-2">SLA</th>
                            <th className="px-3 py-2">Total</th>
                            <th className="px-3 py-2">Met</th>
                            <th className="px-3 py-2">Breached</th>
                            <th className="px-3 py-2">In Progress</th>
                            <th className="px-3 py-2">Rate %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {complianceData.map((r) => (
                            <tr key={r.sla_id} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5">{r.sla_name}</td>
                              <td className="px-3 py-1.5">
                                {r.total_tickets}
                              </td>
                              <td className="px-3 py-1.5">{r.met}</td>
                              <td className="px-3 py-1.5">{r.breached}</td>
                              <td className="px-3 py-1.5">
                                {r.in_progress}
                              </td>
                              <td className="px-3 py-1.5">
                                {r.compliance_rate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-xs text-gray-500">
                Loading stats…
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenStats(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Versions dialog */}
    {openVersions && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Versions {versionsOf.sla ? `• ${versionsOf.sla.name}` : ""}
            </h2>
            <button
              onClick={() => setOpenVersions(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-4 text-xs text-gray-700">
            {Array.isArray(versionsOf.list) && versionsOf.list.length ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-100 text-[11px]">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-[11px] font-semibold text-gray-500">
                      <th className="px-3 py-2">Version</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2">Effective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {versionsOf.list.map((v) => (
                      <tr key={v.sla_id} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5">{v.version}</td>
                        <td className="px-3 py-1.5">
                          {v.active ? "Yes" : "No"}
                        </td>
                        <td className="px-3 py-1.5">
                          {v.effective_from || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No versions found.</p>
            )}
          </div>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenVersions(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Dependencies dialog */}
    {openDeps && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Dependencies
            </h2>
            <button
              onClick={() => setOpenDeps(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-4 text-xs text-gray-700">
            {depsInfo ? (
              <div className="space-y-3">
                <p>
                  Active tickets:{" "}
                  <b className="font-semibold">
                    {depsInfo.active_tickets}
                  </b>
                </p>
                <p>
                  Can delete:{" "}
                  <b className="font-semibold">
                    {depsInfo.can_delete ? "Yes" : "No"}
                  </b>
                </p>
                <div>
                  <p className="mb-1 text-[11px] font-semibold text-gray-600">
                    Sample Ticket IDs
                  </p>
                  <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-2 font-mono text-[11px]">
                    {depsInfo.affected_ticket_ids?.length
                      ? depsInfo.affected_ticket_ids.join("\n")
                      : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-gray-500">
                Loading dependencies…
              </div>
            )}
          </div>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenDeps(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Cleanup dialog */}
    {openCleanup && (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Cleanup old inactive SLAs
            </h2>
            <button
              onClick={() => setOpenCleanup(false)}
              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <div className="px-4 py-4 text-xs text-gray-700">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-end">
                <div className="w-full md:w-40">
                  <label className="mb-1 block text-[11px] font-medium text-gray-600">
                    Older than days
                  </label>
                  <input
                    type="number"
                    value={cleanupOpts.days}
                    onChange={(e) =>
                      setCleanupOpts((f) => ({
                        ...f,
                        days: e.target.value,
                      }))
                    }
                    className="block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-800 shadow-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!cleanupOpts.dry}
                    onChange={(e) =>
                      setCleanupOpts((f) => ({
                        ...f,
                        dry: e.target.checked,
                      }))
                    }
                    className="h-3 w-3 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  Dry run
                </label>
                <button
                  onClick={doCleanup}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600"
                >
                  {/* <CleanupIcon className="h-4 w-4" /> */}
                  Run
                </button>
              </div>

              {cleanupResult && (
                <div className="rounded-lg border border-gray-200 bg-gray-900 p-3 text-[11px] text-gray-100">
                  <pre className="overflow-x-auto">
                    {JSON.stringify(cleanupResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => setOpenCleanup(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);


}

/* ---------- small tables (reused) ---------- */
function ObjectivesTable({ slaId, onEdit, onDelete }) {
  const { objectivesBySla, listObjectives } = useMakingSLA();
  useEffect(() => { if (slaId) listObjectives(slaId); }, [slaId, listObjectives]);
  const rows = objectivesBySla[slaId] || [];
 // At the top of the file

// ...inside your component
return (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Objectives
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-semibold text-gray-500">
            <th className="px-4 py-2">Objective</th>
            <th className="px-4 py-2">Target (min)</th>
            <th className="px-4 py-2">Breach thresholds</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2 text-right w-32">Actions</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {rows.map((o) => (
            <tr
              key={o.objective_id}
              className="hover:bg-gray-50 transition-colors"
            >
              {/* Objective */}
              <td className="px-4 py-2 text-gray-900">
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{o.objective}</span>
                </div>
              </td>

              {/* Target */}
              <td className="px-4 py-2 text-gray-700">
                {o.target_minutes ?? "—"}
              </td>

              {/* Breach thresholds */}
              <td className="px-4 py-2">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(o.breach_grades || {}).map(([k, v]) => (
                    <span
                      key={k}
                      className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700"
                    >
                      {k}:{v}
                    </span>
                  ))}
                  {(!o.breach_grades ||
                    Object.keys(o.breach_grades || {}).length === 0) && (
                    <span className="text-[11px] text-gray-400">—</span>
                  )}
                </div>
              </td>

              {/* Status */}
              <td className="px-4 py-2">
                <span
                  className={
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold " +
                    (o.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-600")
                  }
                >
                  {o.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </td>

              {/* Actions */}
              <td className="px-4 py-2 text-right">
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onEdit(o)}
                    className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(o.objective_id)}
                    className="inline-flex items-center justify-center rounded-full bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-4">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                  No objectives yet.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
);

}

function CreditRulesTable({ slaId, onEdit, onDelete }) {
  const { creditRulesBySla, listCreditRules } = useMakingSLA();
  useEffect(() => { if (slaId) listCreditRules(slaId); }, [slaId, listCreditRules]);
  const rows = creditRulesBySla[slaId] || [];
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Credit Rules
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-semibold text-gray-500">
              <th className="px-4 py-2">Objective</th>
              <th className="px-4 py-2">Grade</th>
              <th className="px-4 py-2">Credit</th>
              <th className="px-4 py-2">Caps</th>
              <th className="px-4 py-2">Status</th>
              <th className="w-32 px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr
                key={r.rule_id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Objective */}
                <td className="px-4 py-2 text-gray-900">
                  <span className="text-xs font-medium">{r.objective}</span>
                </td>

                {/* Grade */}
                <td className="px-4 py-2 text-gray-700">
                  {r.grade ?? "—"}
                </td>

                {/* Credit */}
                <td className="px-4 py-2 text-gray-700">
                  {r.credit_value}{" "}
                  <span className="uppercase text-[10px] text-gray-500">
                    {r.credit_unit}
                  </span>
                </td>

                {/* Caps */}
                <td className="px-4 py-2 text-gray-700">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                    {(r.cap_per_period ?? "—")} / {(r.period_days ?? "—")}d
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-2">
                  <span
                    className={
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold " +
                      (r.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600")
                    }
                  >
                    {r.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(r)}
                      className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r.rule_id)}
                      className="inline-flex items-center justify-center rounded-full bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-4">
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
                    No credit rules yet.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
