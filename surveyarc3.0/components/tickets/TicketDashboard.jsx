"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
  CartesianGrid
} from "recharts";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Target,
  Timer,
  Activity,
  Zap,
  BarChart3,
  Download,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useTickets } from "@/providers/ticketsProvider";
import { usePathname } from "next/navigation";

const STATUS_LABELS = {
  new: "New",
  open: "Open",
  pending: "Pending",
  on_hold: "On Hold",
  resolved: "Resolved",
  closed: "Closed",
  canceled: "Canceled",
};

const STATUS_COLORS = {
  new: "#3b82f6",
  open: "#22c55e",
  pending: "#facc15",
  on_hold: "#f97316",
  resolved: "#10b981",
  closed: "#6b7280",
  canceled: "#ef4444",
};

const PRIORITY_COLORS = {
  low: "#3b82f6",
  normal: "#22c55e",
  high: "#f97316",
  critical: "#ef4444",
};

function formatDateLabel(dateString) {
  if (!dateString) return "";
  const [y, m, d] = dateString.split("-");
  return `${d}/${m}`;
}

export default function EnterpriseTicketDashboard() {
  const { tickets, list, loading } = useTickets();
  const { user, loading: userLoading } = useUser();
  const [initialLoading, setInitialLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30); // days
  const [selectedMetric, setSelectedMetric] = useState("all");
  
  const path = usePathname();
  const orgId = path.split('/')[3];

  useEffect(() => {
    const load = async () => {
      try {
        await list({ orgId, limit: 200 });
      } catch (e) {
        console.error("Failed to load tickets for dashboard", e);
      } finally {
        setInitialLoading(false);
      }
    };

    if (!userLoading) load();
  }, [user, userLoading, list, orgId]);

  // Filter tickets by time range
  const filteredTickets = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    
    return tickets.filter(t => {
      const createdDate = new Date(t.createdAt);
      return createdDate >= cutoffDate;
    });
  }, [tickets, timeRange]);

  // Advanced KPIs with trends
  const advancedKpis = useMemo(() => {
    const now = new Date();
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setDate(currentPeriodStart.getDate() - timeRange);
    
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setDate(previousPeriodStart.getDate() - timeRange);

    const currentTickets = tickets.filter(t => 
      new Date(t.createdAt) >= currentPeriodStart
    );
    
    const previousTickets = tickets.filter(t => {
      const d = new Date(t.createdAt);
      return d >= previousPeriodStart && d < currentPeriodStart;
    });

    const calculateTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    // Resolution metrics
    const resolvedCurrent = currentTickets.filter(t => 
      t.status === "resolved" || t.status === "closed"
    ).length;
    const resolvedPrevious = previousTickets.filter(t => 
      t.status === "resolved" || t.status === "closed"
    ).length;

    // Response time calculation (first response)
    const getAvgResponseTime = (ticketList) => {
      const times = ticketList
        .filter(t => t.firstResponseAt)
        .map(t => {
          const created = new Date(t.createdAt).getTime();
          const responded = new Date(t.firstResponseAt).getTime();
          return (responded - created) / (1000 * 60 * 60); // hours
        });
      return times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 0;
    };

    // Resolution time calculation
    const getAvgResolutionTime = (ticketList) => {
      const times = ticketList
        .filter(t => t.resolvedAt || t.closedAt)
        .map(t => {
          const created = new Date(t.createdAt).getTime();
          const resolved = new Date(t.resolvedAt || t.closedAt).getTime();
          return (resolved - created) / (1000 * 60 * 60); // hours
        });
      return times.length > 0 
        ? times.reduce((a, b) => a + b, 0) / times.length 
        : 0;
    };

    const avgResponseCurrent = getAvgResponseTime(currentTickets);
    const avgResponsePrevious = getAvgResponseTime(previousTickets);
    
    const avgResolutionCurrent = getAvgResolutionTime(currentTickets);
    const avgResolutionPrevious = getAvgResolutionTime(previousTickets);

    // Open tickets
    const openCurrent = tickets.filter(t => 
      ["new", "open", "pending", "on_hold"].includes(t.status)
    ).length;

    // SLA breach rate (tickets with dueAt passed)
    const slaBreachCurrent = currentTickets.filter(t => {
      if (!t.dueAt) return false;
      return new Date(t.dueAt) < now && !["resolved", "closed"].includes(t.status);
    }).length;

    const slaBreachRate = currentTickets.length > 0 
      ? (slaBreachCurrent / currentTickets.length) * 100 
      : 0;

    return {
      total: {
        value: currentTickets.length,
        trend: calculateTrend(currentTickets.length, previousTickets.length),
      },
      open: {
        value: openCurrent,
        trend: 0, // Not comparing open tickets across periods
      },
      resolved: {
        value: resolvedCurrent,
        trend: calculateTrend(resolvedCurrent, resolvedPrevious),
      },
      avgResponseTime: {
        value: avgResponseCurrent,
        trend: avgResponsePrevious > 0 
          ? -calculateTrend(avgResponseCurrent, avgResponsePrevious) // Negative because lower is better
          : 0,
      },
      avgResolutionTime: {
        value: avgResolutionCurrent,
        trend: avgResolutionPrevious > 0 
          ? -calculateTrend(avgResolutionCurrent, avgResolutionPrevious)
          : 0,
      },
      slaCompliance: {
        value: 100 - slaBreachRate,
        trend: 0,
      },
    };
  }, [tickets, timeRange]);

  // Daily ticket trends with status breakdown
  const dailyTrendData = useMemo(() => {
    const map = new Map();

    filteredTickets.forEach((t) => {
      if (!t.createdAt) return;
      const d = new Date(t.createdAt);
      if (Number.isNaN(d.getTime())) return;

      const key = d.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, {
          date: key,
          total: 0,
          new: 0,
          resolved: 0,
          closed: 0,
        });
      }
      
      const entry = map.get(key);
      entry.total += 1;
      if (t.status === "new") entry.new += 1;
      if (t.status === "resolved") entry.resolved += 1;
      if (t.status === "closed") entry.closed += 1;
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => a.date.localeCompare(b.date));
    return arr;
  }, [filteredTickets]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach((t) => {
      const priority = t.priority || "normal";
      const existing = map.get(priority) || { priority, count: 0 };
      existing.count += 1;
      map.set(priority, existing);
    });
    return Array.from(map.values());
  }, [filteredTickets]);

  // Status distribution
  const statusData = useMemo(() => {
    const map = new Map();
    filteredTickets.forEach((t) => {
      if (!t.status) return;
      const existing = map.get(t.status) || { status: t.status, count: 0 };
      existing.count += 1;
      map.set(t.status, existing);
    });
    return Array.from(map.values());
  }, [filteredTickets]);

  // Category/Product performance
  const categoryPerformance = useMemo(() => {
    const map = new Map();
    
    filteredTickets.forEach((t) => {
      const key = t.category || t.productId || "Uncategorized";
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          total: 0,
          resolved: 0,
          avgResolutionTime: [],
        });
      }
      
      const entry = map.get(key);
      entry.total += 1;
      
      if (t.status === "resolved" || t.status === "closed") {
        entry.resolved += 1;
        
        if (t.resolvedAt || t.closedAt) {
          const created = new Date(t.createdAt).getTime();
          const resolved = new Date(t.resolvedAt || t.closedAt).getTime();
          const hours = (resolved - created) / (1000 * 60 * 60);
          entry.avgResolutionTime.push(hours);
        }
      }
    });

    return Array.from(map.values())
      .map(entry => ({
        name: entry.name,
        total: entry.total,
        resolved: entry.resolved,
        resolutionRate: entry.total > 0 ? (entry.resolved / entry.total) * 100 : 0,
        avgResolutionTime: entry.avgResolutionTime.length > 0
          ? entry.avgResolutionTime.reduce((a, b) => a + b, 0) / entry.avgResolutionTime.length
          : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredTickets]);

  // Agent performance (if assigneeId exists)
  const agentPerformance = useMemo(() => {
    const map = new Map();
    
    filteredTickets.forEach((t) => {
      const agentId = t.assigneeId || t.agentId;
      if (!agentId) return;
      
      if (!map.has(agentId)) {
        map.set(agentId, {
          agentId,
          total: 0,
          resolved: 0,
          avgResolutionTime: [],
        });
      }
      
      const entry = map.get(agentId);
      entry.total += 1;
      
      if (t.status === "resolved" || t.status === "closed") {
        entry.resolved += 1;
        
        if (t.resolvedAt || t.closedAt) {
          const created = new Date(t.createdAt).getTime();
          const resolved = new Date(t.resolvedAt || t.closedAt).getTime();
          const hours = (resolved - created) / (1000 * 60 * 60);
          entry.avgResolutionTime.push(hours);
        }
      }
    });

    return Array.from(map.values())
      .map(entry => ({
        agentId: entry.agentId.slice(0, 8),
        total: entry.total,
        resolved: entry.resolved,
        resolutionRate: entry.total > 0 ? (entry.resolved / entry.total) * 100 : 0,
        avgResolutionTime: entry.avgResolutionTime.length > 0
          ? entry.avgResolutionTime.reduce((a, b) => a + b, 0) / entry.avgResolutionTime.length
          : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredTickets]);

  // Resolution rate over time
  const resolutionTrendData = useMemo(() => {
    const map = new Map();

    filteredTickets.forEach((t) => {
      if (!t.createdAt) return;
      const d = new Date(t.createdAt);
      const key = d.toISOString().slice(0, 10);
      
      if (!map.has(key)) {
        map.set(key, { date: key, created: 0, resolved: 0 });
      }
      
      const entry = map.get(key);
      entry.created += 1;
    });

    // Add resolved count by resolution date
    filteredTickets.forEach((t) => {
      if (!t.resolvedAt && !t.closedAt) return;
      const d = new Date(t.resolvedAt || t.closedAt);
      const key = d.toISOString().slice(0, 10);
      
      if (map.has(key)) {
        map.get(key).resolved += 1;
      }
    });

    const arr = Array.from(map.values());
    arr.sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate cumulative
    let cumulativeCreated = 0;
    let cumulativeResolved = 0;
    
    return arr.map(item => {
      cumulativeCreated += item.created;
      cumulativeResolved += item.resolved;
      return {
        date: item.date,
        created: item.created,
        resolved: item.resolved,
        backlog: cumulativeCreated - cumulativeResolved,
      };
    });
  }, [filteredTickets]);

  // Last 5 tickets and closed
  const last5Tickets = useMemo(() => {
    return [...filteredTickets]
      .filter((t) => !!t.createdAt)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [filteredTickets]);

  const last5Closed = useMemo(() => {
    return [...filteredTickets]
      .filter((t) => t.status === "closed" || t.closedAt)
      .sort((a, b) =>
        new Date(b.closedAt || b.updatedAt || b.createdAt).getTime() -
        new Date(a.closedAt || a.updatedAt || a.createdAt).getTime()
      )
      .slice(0, 5);
  }, [filteredTickets]);

  const isLoading = initialLoading || loading || userLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <div className="text-center">
            <p className="font-semibold">Loading Dashboard</p>
            <p className="text-sm text-gray-500">Analyzing ticket data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-900 rounded-2xl border-2 border-amber-200 shadow-lg">
        <AlertCircle className="h-12 w-12 mb-4" />
        <h3 className="text-xl font-bold mb-2">Authentication Required</h3>
        <p>Please sign in to access the Dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-gray-50 min-h-screen p-6">
      {/* Header with actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Analytics
          </h1>
       
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
            {[7, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timeRange === days
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
          
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
            <Download className="h-4 w-4" />
            <span className="text-sm font-medium">Export</span>
          </button>
        </div>
      </div>

      {/* Advanced KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          label="Total Tickets"
          value={advancedKpis.total.value}
          trend={advancedKpis.total.trend}
          icon={<Activity />}
          color="blue"
        />
        <MetricCard
          label="Open Tickets"
          value={advancedKpis.open.value}
          icon={<AlertCircle />}
          color="orange"
        />
        <MetricCard
          label="Resolved"
          value={advancedKpis.resolved.value}
          trend={advancedKpis.resolved.trend}
          icon={<CheckCircle2 />}
          color="green"
        />
        <MetricCard
          label="Avg Response Time"
          value={`${advancedKpis.avgResponseTime.value.toFixed(1)}h`}
          trend={advancedKpis.avgResponseTime.trend}
          icon={<Zap />}
          color="purple"
          invertTrend
        />
        <MetricCard
          label="Avg Resolution Time"
          value={`${advancedKpis.avgResolutionTime.value.toFixed(1)}h`}
          trend={advancedKpis.avgResolutionTime.trend}
          icon={<Timer />}
          color="indigo"
          invertTrend
        />
        <MetricCard
          label="SLA Compliance"
          value={`${advancedKpis.slaCompliance.value.toFixed(1)}%`}
          icon={<Target />}
          color="emerald"
        />
      </div>

      {/* Main Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Trend with multiple lines */}
        <div className="col-span-1 lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Ticket Volume Trends</h2>
              <p className="text-xs text-gray-500 mt-1">Daily creation, resolution, and backlog</p>
            </div>
          </div>
          {resolutionTrendData.length === 0 ? (
            <EmptyState label="No data available for selected period" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={resolutionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    fontSize={11}
                    stroke="#9ca3af"
                  />
                  <YAxis fontSize={11} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.96)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="backlog"
                    fill="#fbbf24"
                    stroke="#f59e0b"
                    fillOpacity={0.2}
                    name="Backlog"
                  />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Created"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Resolved"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Status Distribution</h2>
            <p className="text-xs text-gray-500 mt-1">Current ticket breakdown</p>
          </div>
          {statusData.length === 0 ? (
            <EmptyState label="No tickets found" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#6b7280"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.96)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => STATUS_LABELS[value] || value}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Priority Breakdown</h2>
            <p className="text-xs text-gray-500 mt-1">Ticket distribution by priority level</p>
          </div>
          {priorityData.length === 0 ? (
            <EmptyState label="No priority data" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={11} stroke="#9ca3af" />
                  <YAxis
                    dataKey="priority"
                    type="category"
                    fontSize={11}
                    stroke="#9ca3af"
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.96)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} name="Tickets">
                    {priorityData.map((entry, index) => (
                      <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] || "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Category Performance */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Top Categories</h2>
            <p className="text-xs text-gray-500 mt-1">Performance by category/product</p>
          </div>
          {categoryPerformance.length === 0 ? (
            <EmptyState label="No category data" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryPerformance.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis fontSize={11} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.96)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Total" />
                  <Bar dataKey="resolved" fill="#10b981" radius={[8, 8, 0, 0]} name="Resolved" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Agent Performance Table */}
      {agentPerformance.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Agent Performance Metrics
            </h2>
            <p className="text-xs text-gray-500 mt-1">Top performing agents by resolution rate and time</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Agent ID</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Resolved</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Resolution Rate</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Time (hrs)</th>
                </tr>
              </thead>
              <tbody>
                {agentPerformance.map((agent, idx) => (
                  <tr key={agent.agentId} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm font-medium text-gray-900">{agent.agentId}</span>
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-gray-900">{agent.total}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {agent.resolved}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(agent.resolutionRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {agent.resolutionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm font-medium ${
                        agent.avgResolutionTime < 24 ? 'text-green-600' :
                        agent.avgResolutionTime < 48 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {agent.avgResolutionTime.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Tickets */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Latest Tickets</h2>
              <p className="text-xs text-gray-500 mt-1">Most recently created</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Last {last5Tickets.length}
            </span>
          </div>
          {last5Tickets.length === 0 ? (
            <EmptyState label="No tickets created yet" />
          ) : (
            <AdvancedTicketList tickets={last5Tickets} />
          )}
        </div>

        {/* Recently Closed */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recently Closed</h2>
              <p className="text-xs text-gray-500 mt-1">Latest resolutions</p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Last {last5Closed.length}
            </span>
          </div>
          {last5Closed.length === 0 ? (
            <EmptyState label="No closed tickets yet" />
          ) : (
            <AdvancedTicketList tickets={last5Closed} showClosedAt />
          )}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border border-blue-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <FooterStat
            label="Total Dataset"
            value={tickets.length}
            sublabel="All time tickets"
          />
          <FooterStat
            label="Filtered View"
            value={filteredTickets.length}
            sublabel={`Last ${timeRange} days`}
          />
          <FooterStat
            label="Categories"
            value={categoryPerformance.length}
            sublabel="Active categories"
          />
          <FooterStat
            label="Active Agents"
            value={agentPerformance.length}
            sublabel="Working on tickets"
          />
        </div>
      </div>
    </div>
  );
}

// ============ Component Library ============

function MetricCard({ label, value, trend, icon, color, invertTrend = false }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    orange: 'from-orange-500 to-orange-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
  };

  const getTrendColor = () => {
    if (trend === undefined || trend === 0) return 'text-gray-500';
    const isPositive = invertTrend ? trend < 0 : trend > 0;
    return isPositive ? 'text-green-600' : 'text-red-600';
  };

  const getTrendIcon = () => {
    if (trend === undefined || trend === 0) return null;
    const isPositive = invertTrend ? trend < 0 : trend > 0;
    return isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-5 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} text-white shadow-md`}>
          {React.cloneElement(icon, { className: "h-5 w-5" })}
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 ${getTrendColor()} font-semibold text-sm`}>
            {getTrendIcon()}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Activity className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}

function AdvancedTicketList({ tickets, showClosedAt = false }) {
  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <div
          key={t.ticketId}
          className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 mr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  #{t.number || t.ticketId.slice(0, 6)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  STATUS_COLORS[t.status] ? 'text-white' : 'bg-gray-100 text-gray-700'
                }`} style={{
                  backgroundColor: STATUS_COLORS[t.status] || undefined
                }}>
                  {STATUS_LABELS[t.status] || t.status}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-1">
                {t.subject}
              </h3>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className={`font-semibold uppercase ${
                PRIORITY_COLORS[t.priority] ? 'text-current' : 'text-gray-600'
              }`} style={{
                color: PRIORITY_COLORS[t.priority] || undefined
              }}>
                {t.priority}
              </span>
              {t.category && (
                <span className="text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {t.category}
                </span>
              )}
            </div>
            <span className="text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(
                showClosedAt
                  ? t.closedAt || t.resolvedAt || t.updatedAt
                  : t.createdAt
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FooterStat({ label, value, sublabel }) {
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-blue-900">{value}</p>
      <p className="text-sm font-semibold text-blue-700 mt-1">{label}</p>
      <p className="text-xs text-blue-600 mt-0.5">{sublabel}</p>
    </div>
  );
}

// ============ Utility Functions ============

function formatRelativeTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}