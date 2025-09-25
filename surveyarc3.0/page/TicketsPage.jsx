"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Plus, RefreshCcw, Search, Filter, ChevronLeft, ChevronRight,
  X, Trash2, Pencil, Tag, User, ArrowUpDown, CheckCircle2, Clock, Pause, Ban,
} from "lucide-react";
import { LoadingSpinner } from "@/utils/loadingSpinner"; // <- simple spinner (provide your util)
import clsx from "clsx";
import { useTickets } from "@/providers/ticketsProvider";
import { usePathname } from "next/navigation";

/* ------------------------ helpers ------------------------ */
const humanDate = (s) => (s ? new Date(s).toLocaleString() : "—");
const truncate = (s = "", n = 120) => (s.length > n ? s.slice(0, n) + "…" : s);

/* Some demo assignees (replace with your users lookup) */
const AGENTS = [
  { id: "agent_amy", name: "Amy" },
  { id: "agent_ben", name: "Ben" },
  { id: "agent_cara", name: "Cara" },
];

/* canned status chips */
const StatusChip = ({ status }) => {
  const map = {
    new: { color: "bg-slate-100 text-slate-800", icon: <Clock className="w-3.5 h-3.5" /> },
    open: { color: "bg-blue-100 text-blue-800", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
    pending: { color: "bg-amber-100 text-amber-800", icon: <Pause className="w-3.5 h-3.5" /> },
    on_hold: { color: "bg-purple-100 text-purple-800", icon: <Pause className="w-3.5 h-3.5" /> },
    resolved: { color: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    closed: { color: "bg-slate-200 text-slate-800", icon: <Ban className="w-3.5 h-3.5" /> },
    canceled: { color: "bg-rose-100 text-rose-800", icon: <Ban className="w-3.5 h-3.5" /> },
  };
  const s = map[status] || map.open;
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", s.color)}>
      {s.icon} {status.replace("_", " ")}
    </span>
  );
};

const PriorityDot = ({ priority }) => {
  const color =
    priority === "urgent" ? "bg-rose-500" :
    priority === "high" ? "bg-red-500" :
    priority === "medium" ? "bg-amber-500" : "bg-slate-400";
  return <span className={clsx("inline-block w-2.5 h-2.5 rounded-full", color)} />;
};

/* ------------------------ Create / Edit Modal ------------------------ */
const TicketModal = ({ open, onClose, onSubmit, defaults }) => {
  const [form, setForm] = useState({
    subject: "",
    description: "",
    priority: "medium",
    status: "new",
    requesterId: "",
    assigneeId: "",
    channel: "web",
    category: "",
    subcategory: "",
    tags: [],
  });

  useEffect(() => {
    if (open) {
      setForm({
        subject: defaults?.subject || "",
        description: defaults?.description || "",
        priority: defaults?.priority || "medium",
        status: defaults?.status || "new",
        requesterId: defaults?.requesterId || "",
        assigneeId: defaults?.assigneeId || "",
        channel: defaults?.channel || "web",
        category: defaults?.category || "",
        subcategory: defaults?.subcategory || "",
        tags: defaults?.tags || [],
      });
    }
  }, [open, defaults]);

  if (!open) return null;

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{defaults ? "Edit Ticket" : "Create Ticket"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Subject</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.subject}
              onChange={(e) => onChange("subject", e.target.value)}
              placeholder="Short summary"
            />
          </label>
          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Requester ID</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.requesterId}
              onChange={(e) => onChange("requesterId", e.target.value)}
              placeholder="customer_123"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="block text-slate-600 mb-1">Description</span>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[90px]"
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="What happened?"
            />
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Priority</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.priority}
              onChange={(e) => onChange("priority", e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Status</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.status}
              onChange={(e) => onChange("status", e.target.value)}
            >
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="on_hold">On Hold</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="canceled">Canceled</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Assignee</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.assigneeId}
              onChange={(e) => onChange("assigneeId", e.target.value)}
            >
              <option value="">— Unassigned</option>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Channel</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.channel}
              onChange={(e) => onChange("channel", e.target.value)}
            >
              <option value="web">Web</option>
              <option value="email">Email</option>
              <option value="chat">Chat</option>
              <option value="phone">Phone</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Category</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.category}
              onChange={(e) => onChange("category", e.target.value)}
              placeholder="Billing"
            />
          </label>

          <label className="text-sm">
            <span className="block text-slate-600 mb-1">Subcategory</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.subcategory}
              onChange={(e) => onChange("subcategory", e.target.value)}
              placeholder="Refunds"
            />
          </label>

          <label className="text-sm md:col-span-2">
            <span className="block text-slate-600 mb-1">Tags (comma separated)</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={(form.tags || []).join(", ")}
              onChange={(e) => onChange("tags", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
              placeholder="vip, escalation"
            />
          </label>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>Cancel</button>
          <button
            className="px-3 py-2 rounded bg-orange-600 text-white hover:bg-orange-700"
            onClick={() => onSubmit(form)}
          >
            {defaults ? "Save Changes" : "Create Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------ Detail Drawer ------------------------ */
const DetailDrawer = ({ open, ticket, onClose, onUpdate, onDelete }) => {
  const [local, setLocal] = useState(ticket);

  useEffect(() => setLocal(ticket), [ticket]);

  if (!open || !ticket) return null;

  const set = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  const saveQuick = async (patch) => {
    const updated = await onUpdate(ticket.ticketId, patch);
    setLocal(updated);
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Ticket #{ticket.ticketId}</div>
            <h3 className="font-semibold">{ticket.subject}</h3>
          </div>
          <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-auto">
          <section className="grid grid-cols-2 gap-4">
            <div className="text-sm">
              <div className="text-slate-500 mb-1">Status</div>
              <select
                className="border rounded px-2 py-1"
                value={local.status}
                onChange={(e) => saveQuick({ status: e.target.value })}
              >
                {["new","open","pending","on_hold","resolved","closed","canceled"].map(s => (
                  <option key={s} value={s}>{s.replace("_"," ")}</option>
                ))}
              </select>
            </div>

            <div className="text-sm">
              <div className="text-slate-500 mb-1">Priority</div>
              <select
                className="border rounded px-2 py-1"
                value={local.priority}
                onChange={(e) => saveQuick({ priority: e.target.value })}
              >
                {["low","medium","high","urgent"].map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="text-sm">
              <div className="text-slate-500 mb-1">Assignee</div>
              <select
                className="border rounded px-2 py-1"
                value={local.assigneeId || ""}
                onChange={(e) => saveQuick({ assigneeId: e.target.value || null })}
              >
                <option value="">— Unassigned</option>
                {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="text-sm">
              <div className="text-slate-500 mb-1">Requester</div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <span>{ticket.requesterId || "—"}</span>
              </div>
            </div>
          </section>

          <section>
            <div className="text-slate-700 font-medium mb-1">Description</div>
            <div className="text-sm whitespace-pre-wrap border rounded p-3 bg-slate-50">
              {ticket.description || "—"}
            </div>
          </section>

          <section>
            <div className="text-slate-700 font-medium mb-1">Tags</div>
            <div className="flex flex-wrap gap-2">
              {(local.tags || []).map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded">
                  <Tag className="w-3 h-3" /> {t}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                className="border rounded px-2 py-1 text-sm flex-1"
                placeholder="Add tag (press Enter)"
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    const next = Array.from(new Set([...(local.tags || []), e.currentTarget.value.trim()]));
                    await saveQuick({ tags: next });
                    e.currentTarget.value = "";
                  }
                }}
              />
              <button
                className="px-2 py-1 border rounded text-sm"
                onClick={async () => {
                  await saveQuick({ tags: [] });
                }}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Created</span><div>{humanDate(ticket.createdAt)}</div></div>
            <div><span className="text-slate-500">Updated</span><div>{humanDate(ticket.updatedAt)}</div></div>
            <div><span className="text-slate-500">Due</span><div>{humanDate(ticket.dueAt)}</div></div>
            <div><span className="text-slate-500">Closed</span><div>{humanDate(ticket.closedAt)}</div></div>
          </section>

          {/* Placeholder for activity/comments if you add endpoints later */}
          <section>
            <div className="text-slate-700 font-medium mb-1">Activity</div>
            <div className="text-sm text-slate-500 border rounded p-3 bg-slate-50">
              Hook your comments / events feed here when endpoints are ready.
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t flex justify-between">
          <button
            className="px-3 py-2 rounded border text-rose-600 border-rose-300 hover:bg-rose-50 flex items-center gap-2"
            onClick={() => onDelete(ticket.ticketId)}
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button className="px-3 py-2 rounded border" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------ Table row ------------------------ */
const Row = ({ t, onOpen, onInlineUpdate }) => {
  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="px-3 py-2 text-sm whitespace-nowrap">
        <button className="text-left text-blue-600 hover:underline" onClick={() => onOpen(t)}>
          {t.subject || "(no subject)"}
        </button>
        <div className="text-xs text-slate-500">{truncate(t.description, 80)}</div>
      </td>
      <td className="px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <PriorityDot priority={t.priority} />
          <select
            className="border rounded px-2 py-1 text-xs"
            value={t.priority}
            onChange={(e) => onInlineUpdate(t.ticketId, { priority: e.target.value })}
          >
            <option>low</option><option>medium</option><option>high</option><option>urgent</option>
          </select>
        </div>
      </td>
      <td className="px-3 py-2 text-sm">
        <StatusChip status={t.status} />
      </td>
      <td className="px-3 py-2 text-sm">
        <select
          className="border rounded px-2 py-1 text-xs"
          value={t.assigneeId || ""}
          onChange={(e) => onInlineUpdate(t.ticketId, { assigneeId: e.target.value || null })}
        >
          <option value="">—</option>
          {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 text-sm">{humanDate(t.createdAt)}</td>
      <td className="px-3 py-2 text-right">
        <button className="p-1 rounded hover:bg-slate-100" onClick={() => onOpen(t)} title="Open">
          <Pencil className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

/* ------------------------ Top-level screen ------------------------ */
const TicketsScreen = () => {
  const { tickets, list, create, update, remove, count, loading, setSelectedTicket, selectedTicket } = useTickets();
  const path = usePathname();
  const ORG_ID = path.split("/")[3]; // crude but works for now
  // filters/sort/pager
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  const [openCreate, setOpenCreate] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    await list({ orgId: ORG_ID, q, status, assigneeId: assignee, limit, offset });
  }, [list, ORG_ID, q, status, assignee, limit, offset]);

  useEffect(() => { refresh(); }, [refresh]);

  const sorted = useMemo(() => {
    const arr = [...tickets];
    arr.sort((a, b) => {
      const A = a[sortKey]; const B = b[sortKey];
      if (A == null && B != null) return 1;
      if (B == null && A != null) return -1;
      if (typeof A === "string" && typeof B === "string") {
        const r = A.localeCompare(B);
        return sortDir === "asc" ? r : -r;
      }
      const r = (A > B) - (A < B);
      return sortDir === "asc" ? r : -r;
    });
    return arr;
  }, [tickets, sortKey, sortDir]);

  const [countOpen, setCountOpen] = useState(0);
  const [countPending, setCountPending] = useState(0);
  const [countResolved, setCountResolved] = useState(0);
  const [countAll, setCountAll] = useState(0);

  const loadCounts = useCallback(async () => {
    const all = await count({ orgId: ORG_ID }).catch(() => ({ count: 0 }));
    const open = await count({ orgId: ORG_ID, status: "open" }).catch(() => ({ count: 0 }));
    const pend = await count({ orgId: ORG_ID, status: "pending" }).catch(() => ({ count: 0 }));
    const reso = await count({ orgId: ORG_ID, status: "resolved" }).catch(() => ({ count: 0 }));
    setCountAll(all.count || 0);
    setCountOpen(open.count || 0);
    setCountPending(pend.count || 0);
    setCountResolved(reso.count || 0);
  }, [count, ORG_ID]);

  useEffect(() => { loadCounts(); }, [loadCounts, tickets.length]);

  const onCreate = async (form) => {
    const t = await create({ ...form, orgId: ORG_ID });
    setOpenCreate(false);
    setDrawerOpen(true);
    setSelectedTicket(t);
    await refresh();
  };

  const onInlineUpdate = async (id, patch) => {
    await update(id, patch);
    await refresh();
  };

  const openDetail = (t) => {
    setSelectedTicket(t);
    setDrawerOpen(true);
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this ticket?")) return;
    await remove(id);
    setDrawerOpen(false);
    setSelectedTicket(null);
    await refresh();
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const pageForward = () => setOffset((o) => o + limit);
  const pageBack = () => setOffset((o) => Math.max(0, o - limit));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Tickets</h1>
            {loading && <LoadingSpinner size="sm" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="px-3 py-2 border rounded hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOpenCreate(true)}
              className="px-3 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New Ticket
            </button>
          </div>
        </div>
      </div>

      {/* stats bar */}
      <div className="max-w-7xl mx-auto px-6 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open" value={countOpen} />
        <StatCard label="Pending" value={countPending} />
        <StatCard label="Resolved (24h)" value={countResolved} />
        <StatCard label="All" value={countAll} />
      </div>

      {/* filters */}
      <div className="max-w-7xl mx-auto px-6 mt-4">
        <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border rounded pl-9 pr-3 py-2"
              placeholder="Search subject/description…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select className="border rounded px-2 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All status</option>
              {["new","open","pending","on_hold","resolved","closed","canceled"].map(s => (
                <option key={s} value={s}>{s.replace("_"," ")}</option>
              ))}
            </select>
            <select className="border rounded px-2 py-2 text-sm" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">All assignees</option>
              {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button
              className="px-3 py-2 border rounded hover:bg-gray-50"
              onClick={() => { setQ(""); setStatus(""); setAssignee(""); setOffset(0); }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="max-w-7xl mx-auto px-6 mt-4 bg-white border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <Th onClick={() => toggleSort("subject")} active={sortKey === "subject"} dir={sortDir}>Subject</Th>
              <Th onClick={() => toggleSort("priority")} active={sortKey === "priority"} dir={sortDir}>Priority</Th>
              <Th onClick={() => toggleSort("status")} active={sortKey === "status"} dir={sortDir}>Status</Th>
              <Th onClick={() => toggleSort("assigneeId")} active={sortKey === "assigneeId"} dir={sortDir}>Assignee</Th>
              <Th onClick={() => toggleSort("createdAt")} active={sortKey === "createdAt"} dir={sortDir}>Created</Th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-slate-500">No tickets</td></tr>
            ) : (
              sorted.map(t => (
                <Row key={t.ticketId} t={t} onOpen={openDetail} onInlineUpdate={onInlineUpdate} />
              ))
            )}
          </tbody>
        </table>

        {/* pager */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
          <div className="text-sm text-slate-600">
            Showing {offset + 1}–{offset + Math.min(limit, sorted.length)} (page size {limit})
          </div>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 border rounded disabled:opacity-50" disabled={offset === 0} onClick={pageBack}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="px-2 py-1 border rounded" onClick={pageForward}>
              <ChevronRight className="w-4 h-4" />
            </button>
            <select className="border rounded px-2 py-1 text-sm" value={limit} onChange={(e) => { setOffset(0); setLimit(Number(e.target.value)); }}>
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* modals/drawers */}
      <TicketModal open={openCreate} onClose={() => setOpenCreate(false)} onSubmit={onCreate} />
      <DetailDrawer
        open={drawerOpen}
        ticket={selectedTicket}
        onClose={() => setDrawerOpen(false)}
        onUpdate={update}
        onDelete={onDelete}
      />
    </div>
  );
};

export default TicketsScreen;

/* ------------------------ small components ------------------------ */
const Th = ({ children, onClick, active, dir }) => (
  <th
    onClick={onClick}
    className={clsx(
      "px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500 select-none",
      "cursor-pointer hover:bg-slate-100"
    )}
  >
    <span className="inline-flex items-center gap-1">
      {children}
      <ArrowUpDown className={clsx("w-3.5 h-3.5", active ? "text-slate-700" : "text-slate-400")} />
      {active && <span className="text-slate-400">{dir === "asc" ? "▲" : "▼"}</span>}
    </span>
  </th>
);

const StatCard = ({ label, value }) => (
  <div className="bg-white border rounded-lg p-3">
    <div className="text-xs uppercase text-slate-500">{label}</div>
    <div className="text-2xl font-semibold">{value}</div>
  </div>
);
