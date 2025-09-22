// app/(your-route)/CampaignPage.jsx
"use client";
import { useCampaign } from "@/providers/campaginProviders";
import { useCampaignResult } from "@/providers/campaginResultProvider";
import { useRouteParams } from "@/utils/getPaths";
import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

const CampaignPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [campaigns, setCampaigns] = useState([]);
  const [campaignResults, setCampaignResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const { orgId, projectId, surveyId } = useRouteParams()
  const {
    loadProjectCampaigns,
    createCampaign,
    deleteCampaign,
    updateCampaignStatus,
    getAllCampaignsForProject,
  } = useCampaign();

  const { getCampaignResults } = useCampaignResult();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const docs = await loadProjectCampaigns(projectId);
      const list = getAllCampaignsForProject(projectId);
      setCampaigns(list);
      if (list.length) {
        setSelectedCampaign(list[0]);
        const results = await getCampaignResults(list[0].id);
        setCampaignResults(results);
      } else {
        setSelectedCampaign(null);
        setCampaignResults([]);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const totalsAgg = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => {
        const t = c.totals || {};
        acc.sent += t.sent || 0;
        acc.failed += t.failed || 0;
        acc.queued += t.queued || 0;
        acc.skipped += t.skipped || 0;
        acc.targets += t.targets || 0;
        return acc;
      },
      { sent: 0, failed: 0, queued: 0, skipped: 0, targets: 0 }
    );
  }, [campaigns]);

  const pieData = [
    { name: "Sent", value: totalsAgg.sent, color: "#10B981" },
    { name: "Failed", value: totalsAgg.failed, color: "#EF4444" },
    { name: "Queued", value: totalsAgg.queued, color: "#F59E0B" },
    { name: "Skipped", value: totalsAgg.skipped, color: "#6B7280" },
  ];

  const perfData = campaigns.map((c) => ({
    name: c.name || c.id,
    sent: c.totals?.sent || 0,
    failed: c.totals?.failed || 0,
  }));

  const successRate =
    totalsAgg.targets > 0 ? Math.round((totalsAgg.sent / totalsAgg.targets) * 100) : 0;

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Campaign Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600">Total Campaigns</h3>
            <p className="text-2xl font-bold text-blue-900">{campaigns.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600">Messages Sent</h3>
            <p className="text-2xl font-bold text-green-900">{totalsAgg.sent}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-red-600">Failed</h3>
            <p className="text-2xl font-bold text-red-900">{totalsAgg.failed}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-600">Success Rate</h3>
            <p className="text-2xl font-bold text-yellow-900">{successRate}%</p>
          </div>
        </div>

        {selectedCampaign && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Selected Campaign Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium">Name:</span> {selectedCampaign.name}</div>
              <div>
                <span className="font-medium">Status:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-xs ${
                    selectedCampaign.status === "completed"
                      ? "bg-green-100 text-green-800"
                      : selectedCampaign.status === "running"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {selectedCampaign.status}
                </span>
              </div>
              <div><span className="font-medium">Channel:</span> {selectedCampaign.channel}</div>
              <div><span className="font-medium">Template:</span> {selectedCampaign.templateId}</div>
              <div>
                <span className="font-medium">Created:</span>{" "}
                {selectedCampaign.createdAt?.seconds
                  ? new Date(selectedCampaign.createdAt.seconds * 1000).toLocaleDateString()
                  : "N/A"}
              </div>
              <div><span className="font-medium">Contact Count:</span> {selectedCampaign.contactCount || 0}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Campaign Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Delivery Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Campaign Performance Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perfData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sent" fill="#10B981" name="Sent" />
                <Bar dataKey="failed" fill="#EF4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCampaigns = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">All Campaigns</h2>
            <button
              onClick={() =>
                createCampaign(projectId, { name: `New Campaign ${Date.now()}`, channel: "email", contactCount: 0 })
                  .then(() => loadProjectCampaigns(projectId).then(() => setCampaigns(getAllCampaignsForProject(projectId))))
              }
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Campaign
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Targets</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => {
                const t = c.totals || {};
                const rate = t.targets > 0 ? Math.round((t.sent / t.targets) * 100) : 0;
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{c.name || c.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          c.channel === "whatsapp"
                            ? "bg-green-100 text-green-800"
                            : c.channel === "email"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {c.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          c.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : c.status === "running"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{t.targets || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-green-600">{t.sent || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-red-600">{t.failed || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{rate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => setSelectedCampaign(c)} className="text-blue-600 hover:text-blue-800 mr-3">
                        View
                      </button>
                      <button
                        onClick={() =>
                          updateCampaignStatus(projectId, c.id, "running").then(() =>
                            loadProjectCampaigns(projectId).then(() => setCampaigns(getAllCampaignsForProject(projectId)))
                          )
                        }
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        Start
                      </button>
                      <button
                        onClick={() =>
                          deleteCampaign(projectId, c.id).then(() =>
                            loadProjectCampaigns(projectId).then(() => setCampaigns(getAllCampaignsForProject(projectId)))
                          )
                        }
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-center text-gray-500" colSpan={8}>
                    No campaigns found for this project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    const failed = campaignResults.filter((r) => r.status === "failed");
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Campaign Results</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Delivery Summary</h3>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Total Messages</span>
                    <span className="text-blue-600 font-bold">{totalsAgg.targets}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Successfully Delivered</span>
                    <span className="text-green-600 font-bold">
                      {totalsAgg.sent}/{totalsAgg.targets}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{
                        width: `${totalsAgg.targets ? (totalsAgg.sent / totalsAgg.targets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">Failed Deliveries</span>
                    <span className="text-red-600 font-bold">
                      {totalsAgg.failed}/{totalsAgg.targets}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-600 h-2 rounded-full"
                      style={{
                        width: `${totalsAgg.targets ? (totalsAgg.failed / totalsAgg.targets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Error Analysis</h3>
              <div className="space-y-3">
                {failed.map((r) => (
                  <div key={r.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="font-medium text-red-800">
                      {r.channel === "whatsapp" ? "WhatsApp API Error" : "Email Delivery Error"}
                    </div>
                    <div className="text-sm text-red-600">{r.error || "Unknown error occurred"}</div>
                    <div className="text-xs text-red-500">
                      {r.failedAt?.seconds ? new Date(r.failedAt.seconds * 1000).toLocaleString() : "Unknown time"}
                    </div>
                  </div>
                ))}
                {failed.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-green-700">No errors to display. All campaigns are running smoothly!</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContacts = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Contact Management</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold">Contact Lists</h3>
              </div>
              <div className="p-4 space-y-3">
                {campaigns.flatMap((c) =>
                  (c.listIds || []).map((listId, i) => (
                    <div key={`${c.id}-${i}`} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <h4 className="font-medium">{listId}</h4>
                        <p className="text-sm text-gray-600">{c.contactCount || 0} contacts</p>
                      </div>
                      <div className="flex space-x-2">
                        <button className="text-blue-600 text-sm">Edit</button>
                        <button className="text-red-600 text-sm">Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="border rounded-lg">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="font-semibold">Quick Stats</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {campaigns.reduce((sum, c) => sum + (c.contactCount || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Contacts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {campaigns.reduce((sum, c) => sum + ((c.listIds || []).length || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Active Lists</div>
                </div>
                <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                  Import Contacts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Campaign Settings</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">General Settings</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Chunk Size</label>
                <input type="number" defaultValue="50" className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Retry Attempts</label>
                <input type="number" defaultValue="3" className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4">Integration Settings</h3>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Salesforce Integration</h4>
                    <p className="text-sm text-gray-600">Sync campaign results to Salesforce</p>
                  </div>
                  <button className="bg-green-600 text-white px-3 py-1 rounded text-sm">Connected</button>
                </div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">WhatsApp Business API</h4>
                    <p className="text-sm text-gray-600">Send WhatsApp messages</p>
                  </div>
                  <button className="bg-red-600 text-white px-3 py-1 rounded text-sm">Error</button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    switch (activeTab) {
      case "overview":
        return renderOverview();
      case "analytics":
        return renderAnalytics();
      case "campaigns":
        return renderCampaigns();
      case "contacts":
        return renderContacts();
      case "results":
        return renderResults();
      case "settings":
        return renderSettings();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-lg relative">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-800">Campaign Hub</h1>
          <p className="text-sm text-gray-600">Manage your campaigns</p>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "analytics", label: "Analytics", icon: "📈" },
              { id: "campaigns", label: "Campaigns", icon: "📋" },
              { id: "contacts", label: "Contacts", icon: "👥" },
              { id: "results", label: "Results", icon: "🎯" },
              { id: "settings", label: "Settings", icon: "⚙️" },
            ].map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setActiveTab(t.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                    activeTab === t.id
                      ? "bg-blue-100 text-blue-700 border-r-2 border-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <span className="mr-3 text-lg">{t.icon}</span>
                  <span className="font-medium">{t.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="p-6">{renderContent()}</div>
      </div>
    </div>
  );
};

export default CampaignPage;
