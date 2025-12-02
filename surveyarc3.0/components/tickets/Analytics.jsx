"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import TicketModel from "@/models/ticketModel";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock3,
  MoreHorizontal,
  CheckSquare,
  Square,
  RefreshCw,
  Users,
  User,
} from "lucide-react";
import { useTicketTaxonomies } from "@/providers/postGresPorviders/TicketTaxonomyProvider";
import { useTicketCategories } from "@/providers/postGresPorviders/TicketCategoryProvider";
import Link from "next/link";

const PAGE_SIZE = 30;

function formatDate(d) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function priorityBadgeClass(priority) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "normal":
    case "medium":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "low":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case "new":
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "open":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "resolved":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "closed":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

const STATUS_OPTIONS = ["new", "open", "pending", "resolved", "closed"];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

export default function TicketDashboard({ orgId, currentUserId, teamId = null }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [filters, setFilters] = useState({
    view: "all", // all | my | unassigned
    status: "",
    priority: "",
    categoryId: "",
    subcategoryId: "",
    productId: "",
    featureId: "",
    impactId: "",
    rcaId: "",
    slaBreached: "any", // any | first | resolution
    search: "",
  });

  const [sort, setSort] = useState({
    field: "lastActivityAt", // createdAt | priority | status | lastActivityAt
    dir: "desc", // asc | desc
  });

  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // Providers
  const {
    categories,
    subcategories,
    products,
    listCategories,
    listSubcategories,
    listProducts,
  } = useTicketCategories();

  const {
    features,
    impacts,
    rootCauses,
    listFeatures,
    listImpacts,
    listRootCauses,
  } = useTicketTaxonomies();

  // Load static lookup data
  useEffect(() => {
    if (!orgId) return;
    listCategories(orgId);
    listSubcategories(orgId);
    listProducts(orgId);
    listFeatures(orgId);
    listImpacts(orgId);
    listRootCauses(orgId);
  }, [
    orgId,
    listCategories,
    listSubcategories,
    listProducts,
    listFeatures,
    listImpacts,
    listRootCauses,
  ]);

  const handleChangeFilter = useCallback((key, value) => {
    setPage(0); // reset pagination when filters change
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { field, dir: "asc" };
    });
  }, []);

  const isAllSelected = useMemo(() => {
    if (!tickets.length) return false;
    return tickets.every((t) => selectedIds.includes(t.ticketId));
  }, [tickets, selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tickets.map((t) => t.ticketId));
    }
  }, [isAllSelected, tickets]);

  const toggleSelectTicket = useCallback((ticketId) => {
    setSelectedIds((prev) =>
      prev.includes(ticketId)
        ? prev.filter((id) => id !== ticketId)
        : [...prev, ticketId]
    );
  }, []);

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setFetchError(null);

    try {
      const offset = page * PAGE_SIZE;

      const params = {
        orgId,
        limit: PAGE_SIZE,
        offset,
        q: filters.search || undefined,
        status: filters.status || undefined,
        categoryId: filters.categoryId || undefined,
        subcategoryId: filters.subcategoryId || undefined,
        productId: filters.productId || undefined,
        featureId: filters.featureId || undefined,
        impactId: filters.impactId || undefined,
        rcaId: filters.rcaId || undefined,
      };

      // View filters
      if (filters.view === "my") {
        params.assigneeId = currentUserId;
      } else if (filters.view === "unassigned") {
        // backend does not have explicit "unassigned" param, so we'll fetch all
        // and filter client side by !assigneeId
      }

      const data = await TicketModel.list(params);

      // Client-side view filtering for "unassigned"
      let filtered = data;
      if (filters.view === "unassigned") {
        filtered = filtered.filter((t) => !t.assigneeId);
      }

      // Client-side SLA breach filter (using slaStatus)
      if (filters.slaBreached === "first") {
        filtered = filtered.filter(
          (t) => t.slaStatus && t.slaStatus.breachedFirstResponse
        );
      } else if (filters.slaBreached === "resolution") {
        filtered = filtered.filter(
          (t) => t.slaStatus && t.slaStatus.breachedResolution
        );
      }

      // Client-side priority filter (API doesn't support priority list filter)
      if (filters.priority) {
        filtered = filtered.filter((t) => t.priority === filters.priority);
      }

      // Sorting (client-side)
      filtered.sort((a, b) => {
        const dirMul = sort.dir === "asc" ? 1 : -1;
        const field = sort.field;

        if (field === "priority") {
          const order = { urgent: 4, high: 3, normal: 2, medium: 2, low: 1 };
          return (order[a.priority] || 0 - (order[b.priority] || 0)) * dirMul;
        }

        if (field === "status") {
          return String(a.status).localeCompare(String(b.status)) * dirMul;
        }

        const av = a[field];
        const bv = b[field];

        if (!av && !bv) return 0;
        if (!av) return -1 * dirMul;
        if (!bv) return 1 * dirMul;

        const da = new Date(av).getTime();
        const db = new Date(bv).getTime();
        return (da - db) * dirMul;
      });

      setTickets(filtered);
      setSelectedIds([]); // reset selection on reload
    } catch (err) {
      console.error(err);
      setFetchError(err.message || "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [
    orgId,
    currentUserId,
    filters.view,
    filters.status,
    filters.priority,
    filters.categoryId,
    filters.subcategoryId,
    filters.productId,
    filters.featureId,
    filters.impactId,
    filters.rcaId,
    filters.search,
    filters.slaBreached,
    page,
    sort.field,
    sort.dir,
  ]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Bulk actions
  const handleBulkUpdate = useCallback(
    async (patch) => {
      if (!selectedIds.length) return;
      setBulkUpdating(true);
      try {
        await Promise.all(selectedIds.map((id) => TicketModel.update(id, patch)));
        await fetchTickets();
      } catch (err) {
        console.error(err);
        alert("Bulk update failed: " + (err.message || ""));
      } finally {
        setBulkUpdating(false);
      }
    },
    [selectedIds, fetchTickets]
  );

  const handleAssignToMe = useCallback(() => {
    handleBulkUpdate({ assigneeId: currentUserId });
  }, [handleBulkUpdate, currentUserId]);

  // Render helpers
  const renderSortIcon = (field) => {
    if (sort.field !== field) {
      return (
        <span className="inline-flex flex-col ml-1 opacity-30">
          <ChevronUp className="w-3 h-3 -mb-1" />
          <ChevronDown className="w-3 h-3 -mt-1" />
        </span>
      );
    }
    return sort.dir === "asc" ? (
      <ChevronUp className="w-3 h-3 ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 ml-1" />
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-900">
            Ticket Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Monitor, triage, and act on tickets across your organization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-300 min-w-[220px]"
              placeholder="Search by subject, description..."
              value={filters.search}
              onChange={(e) => handleChangeFilter("search", e.target.value)}
            />
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={fetchTickets}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters area */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 md:p-4 flex flex-col gap-3">
        {/* Top row: view + quick SLA + status/priority */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center text-xs font-medium text-slate-500 mr-1">
            <Filter className="w-3 h-3 mr-1" /> View
          </span>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
            {[
              { id: "all", label: "All" },
              { id: "my", label: "My tickets" },
              { id: "unassigned", label: "Unassigned" },
            ].map((v) => (
              <button
                key={v.id}
                className={`px-3 py-1 text-xs rounded-full font-medium transition ${
                  filters.view === v.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white"
                }`}
                onClick={() => handleChangeFilter("view", v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />

          {/* SLA quick filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">SLA</span>
            <select
              className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              value={filters.slaBreached}
              onChange={(e) => handleChangeFilter("slaBreached", e.target.value)}
            >
              <option value="any">All</option>
              <option value="first">Breached: 1st response</option>
              <option value="resolution">Breached: resolution</option>
            </select>
          </div>

          <div className="h-4 w-px bg-slate-200 mx-2 hidden md:block" />

          {/* Status / priority */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              value={filters.status}
              onChange={(e) => handleChangeFilter("status", e.target.value)}
            >
              <option value="">Status: All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>

            <select
              className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              value={filters.priority}
              onChange={(e) => handleChangeFilter("priority", e.target.value)}
            >
              <option value="">Priority: All</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second row: taxonomy filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3 text-xs">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.categoryId}
            onChange={(e) => handleChangeFilter("categoryId", e.target.value)}
          >
            <option value="">Category: All</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.subcategoryId}
            onChange={(e) => handleChangeFilter("subcategoryId", e.target.value)}
          >
            <option value="">Subcategory: All</option>
            {subcategories.map((s) => (
              <option key={s.subcategoryId} value={s.subcategoryId}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.productId}
            onChange={(e) => handleChangeFilter("productId", e.target.value)}
          >
            <option value="">Product: All</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.featureId}
            onChange={(e) => handleChangeFilter("featureId", e.target.value)}
          >
            <option value="">Feature: All</option>
            {features.map((f) => (
              <option key={f.featureId} value={f.featureId}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3 text-xs">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.impactId}
            onChange={(e) => handleChangeFilter("impactId", e.target.value)}
          >
            <option value="">Impact: All</option>
            {impacts.map((i) => (
              <option key={i.impactId} value={i.impactId}>
                {i.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
            value={filters.rcaId}
            onChange={(e) => handleChangeFilter("rcaId", e.target.value)}
          >
            <option value="">RCA: All</option>
            {rootCauses.map((r) => (
              <option key={r.rootCauseId || r.rcaId} value={r.rootCauseId || r.rcaId}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by</span>
            <select
              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
              value={sort.field + ":" + sort.dir}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(":");
                setSort({ field, dir });
              }}
            >
              <option value="lastActivityAt:desc">Last activity (newest)</option>
              <option value="lastActivityAt:asc">Last activity (oldest)</option>
              <option value="createdAt:desc">Created (newest)</option>
              <option value="createdAt:asc">Created (oldest)</option>
              <option value="priority:desc">Priority (high → low)</option>
              <option value="priority:asc">Priority (low → high)</option>
              <option value="status:asc">Status (A → Z)</option>
              <option value="status:desc">Status (Z → A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions + info bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center text-xs text-slate-600 hover:text-slate-900"
          >
            {isAllSelected ? (
              <CheckSquare className="w-4 h-4 mr-1" />
            ) : (
              <Square className="w-4 h-4 mr-1" />
            )}
            Select all on page
          </button>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">
                {selectedIds.length} selected
              </span>
              <button
                disabled={bulkUpdating}
                onClick={() => handleBulkUpdate({ status: "open" })}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium hover:bg-slate-50"
              >
                Mark as Open
              </button>
              <button
                disabled={bulkUpdating}
                onClick={() => handleBulkUpdate({ status: "pending" })}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 font-medium hover:bg-slate-50"
              >
                Mark as Pending
              </button>
              <button
                disabled={bulkUpdating}
                onClick={() => handleBulkUpdate({ status: "resolved" })}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Resolve
              </button>
              <button
                disabled={bulkUpdating}
                onClick={() => handleBulkUpdate({ priority: "urgent" })}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-medium text-red-700 hover:bg-red-100"
              >
                Set Urgent
              </button>
              <button
                disabled={bulkUpdating}
                onClick={handleAssignToMe}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 font-medium hover:bg-slate-50"
              >
                <User className="w-3 h-3 mr-1" />
                Assign to me
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            Showing{" "}
            <span className="font-medium">{tickets.length}</span> tickets (page{" "}
            <span className="font-medium">{page + 1}</span>)
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              disabled={tickets.length < PAGE_SIZE || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {fetchError}
        </div>
      )}

      {/* Ticket table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">
                  <button onClick={toggleSelectAll}>
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th
                  className="px-3 py-2 cursor-pointer select-none"
                  onClick={() => toggleSort("lastActivityAt")}
                >
                  Last activity {renderSortIcon("lastActivityAt")}
                </th>
                <th className="px-3 py-2">Assignee</th>
                <th className="px-3 py-2">SLA</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-xs text-slate-500"
                  >
                    Loading tickets...
                  </td>
                </tr>
              )}
              {!loading && tickets.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-6 text-center text-xs text-slate-500"
                  >
                    No tickets found for the selected filters.
                  </td>
                </tr>
              )}
              {!loading &&
                tickets.map((t) => {
                  const selected = selectedIds.includes(t.ticketId);
                  const sla = t.slaStatus || {};
                  const hasFirstBreach = sla.breachedFirstResponse;
                  const hasResBreach = sla.breachedResolution;

                  return (
                    <tr
                      key={t.ticketId}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 ${
                        selected ? "bg-slate-50" : ""
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        <button
                          onClick={() => toggleSelectTicket(t.ticketId)}
                          className="mt-1"
                        >
                          {selected ? (
                            <CheckSquare className="w-4 h-4 text-slate-800" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-[11px] text-slate-500">
                        {t.number || t.ticketId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`./tickets/${t.ticketId}`} className="text-xs font-medium text-slate-900 line-clamp-1">
                            {t.subject || "(no subject)"}
                          </Link>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {t.description || ""}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.tags &&
                              t.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600"
                                >
                                  {tag}
                                </span>
                              ))}
                            {t.tags && t.tags.length > 3 && (
                              <span className="text-[10px] text-slate-400">
                                +{t.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-slate-600 whitespace-nowrap">
                        {t.category || "-"}
                        {t.subcategory && (
                          <span className="text-slate-400"> / {t.subcategory}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                            t.status
                          )}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityBadgeClass(
                            t.priority
                          )}`}
                        >
                          {t.priority || "normal"}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-[11px] text-slate-600">
                        <div>{formatDate(t.lastActivityAt || t.updatedAt)}</div>
                        <div className="text-[10px] text-slate-400">
                          Created: {formatDate(t.createdAt)}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-[11px] text-slate-600">
                        {t.assigneeId ? (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                            <User className="w-3 h-3 mr-1 text-slate-400" />
                            {t.assigneeId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                            <Users className="w-3 h-3 mr-1" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top whitespace-nowrap text-[11px]">
                        <div className="flex flex-col gap-1">
                          {hasFirstBreach && (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              1st response breached
                            </span>
                          )}
                          {hasResBreach && (
                            <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                              <Clock3 className="w-3 h-3 mr-1" />
                              Resolution breached
                            </span>
                          )}
                          {!hasFirstBreach && !hasResBreach && (
                            <span className="text-[11px] text-slate-400">
                              On track
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
