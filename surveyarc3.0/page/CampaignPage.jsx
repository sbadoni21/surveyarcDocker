"use client";
import { useCampaign } from "@/providers/postGresPorviders/campaignProvider";
import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import CampaignCreateModal from '@/components/CampaignCreateModal';
import { useContacts } from "@/providers/postGresPorviders/contactProvider";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import { usePathname } from "next/navigation";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useQuestion } from "@/providers/questionPProvider";
import { useSalesforceContacts } from "@/providers/postGresPorviders/SalesforceContactProvider";
import { useSalesforceAccounts } from "@/providers/postGresPorviders/SalesforceAccountProvider";
import { useCampaignResult } from "@/providers/postGresPorviders/campaginResultProvider";
import CampaignOverview from "@/components/campagins/CampaignOverview";
import CampaignAnalytics from "@/components/campagins/CampaignAnalytics";

const CampaignPage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const path = usePathname();
  const projectId = path.split("/")[6];
  const orgId = path.split("/")[3];
  const {uid} = useUser();
  
  const {
    campaigns,
    loading,
    error,
    create,
    createCampaign,
    deleteCampaign,
    sendCampaign,
    pauseCampaign,
    resumeCampaign,
    getAnalytics,
    setFilter,
    filters
  } = useCampaign();

    const { 
    lists, 
    contacts, 
    listLists, 
    listContacts,
    loading: contactsLoading 
  } = useContacts();
  
  const { organisation } = useOrganisation();
  const [surveyQuestions, setSurveyQuestions] = useState([]);
const { accounts, list: listAccounts } = useSalesforceAccounts();

  const { 
    surveys, 
    getAllSurveys 
  } = useSurvey();
const {getAllQuestions} = useQuestion();
  // FIXED: Use useCallback to memoize these functions
  const handleLoadSurveys = useCallback(async () => {
    if (organisation?.org_id && projectId) {
      try {
        await getAllSurveys(organisation.org_id, projectId);
      } catch (error) {
        console.error('Error loading surveys:', error);
      }
    }
  }, [organisation?.org_id, projectId, getAllSurveys]);

  const handleLoadLists = useCallback(async () => {
    if (organisation?.org_id) {
      try {
        await listLists(organisation.org_id);
      } catch (error) {
        console.error('Error loading lists:', error);
      }
    }
  }, [organisation?.org_id, listLists]);

  const handleLoadContacts = useCallback(async () => {
    if (organisation?.org_id) {
      try {
        await listContacts(organisation.org_id);
      } catch (error) {
        console.error('Error loading contacts:', error);
      }
    }
  }, [organisation?.org_id, listContacts]);

  // FIXED: Load surveys only once on mount or when dependencies change
  useEffect(() => {
    handleLoadSurveys();
  }, [organisation?.org_id, projectId]); // Removed handleLoadSurveys from dependencies


const handleLoadSurveyQuestions = useCallback(
  async (surveyId) => {
    if (!organisation?.org_id || !surveyId) return [];
    try {
      const qs = await getAllQuestions(organisation.org_id, surveyId);
      setSurveyQuestions(qs || []);
      return qs || [];
    } catch (err) {
      console.error("Error loading survey questions:", err);
      setSurveyQuestions([]);
      return [];
    }
  },
  [organisation?.org_id, getAllQuestions]
);

  // Calculate aggregate statistics
  const totals = campaigns.reduce((acc, c) => ({
    recipients: acc.recipients + c.totalRecipients,
    sent: acc.sent + c.sentCount,
    delivered: acc.delivered + c.deliveredCount,
    opened: acc.opened + c.openedCount,
    clicked: acc.clicked + c.clickedCount,
    failed: acc.failed + c.failedCount,
    bounced: acc.bounced + c.bouncedCount,
    surveyStarted: acc.surveyStarted + c.surveyStartedCount,
    surveyCompleted: acc.surveyCompleted + c.surveyCompletedCount
  }), {
    recipients: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    failed: 0,
    bounced: 0,
    surveyStarted: 0,
    surveyCompleted: 0
  });

  const openRate = totals.delivered > 0
    ? ((totals.opened / totals.delivered) * 100).toFixed(1)
    : 0;

  const responseRate = totals.delivered > 0
    ? ((totals.surveyStarted / totals.delivered) * 100).toFixed(1)
    : 0;

  useEffect(() => {
    if (selectedCampaign) {
      getAnalytics(selectedCampaign.campaignId).then(setAnalytics);
    }
  }, [selectedCampaign]);

  // Chart data
  const pieData = [
    { name: "Delivered", value: totals.delivered, color: "#10B981" },
    { name: "Failed", value: totals.failed, color: "#EF4444" },
    { name: "Bounced", value: totals.bounced, color: "#F59E0B" }
  ].filter(d => d.value > 0);

  const performanceData = campaigns.map(c => ({
    name: c.campaignName.substring(0, 15),
    sent: c.sentCount,
    delivered: c.deliveredCount,
    opened: c.openedCount,
    clicked: c.clickedCount
  }));

  const channelData = campaigns.reduce((acc, c) => {
    const existing = acc.find(x => x.name === c.channel);
    if (existing) {
      existing.count += 1;
      existing.sent += c.sentCount;
    } else {
      acc.push({ name: c.channel, count: 1, sent: c.sentCount });
    }
    return acc;
  }, []);

  // Status badge
  const StatusBadge = ({ status }) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      scheduled: "bg-blue-100 text-blue-800",
      sending: "bg-yellow-100 text-yellow-800",
      sent: "bg-green-100 text-green-800",
      paused: "bg-orange-100 text-orange-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.draft}`}>
        {status}
      </span>
    );
  };

  // Channel badge
  const ChannelBadge = ({ channel }) => {
    const colors = {
      email: "bg-blue-100 text-blue-800",
      sms: "bg-purple-100 text-purple-800",
      whatsapp: "bg-green-100 text-green-800",
      voice: "bg-orange-100 text-orange-800",
      multi: "bg-indigo-100 text-indigo-800"
    };
    const icons = {
      email: "✉️",
      sms: "💬",
      whatsapp: "📱",
      voice: "📞",
      multi: "🔀"
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[channel] || colors.email}`}>
        {icons[channel]} {channel}
      </span>
    );
  };



  // Render Campaigns Tab
  const renderCampaigns = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">All Campaigns</h2>
            <input
              type="text"
              placeholder="Search campaigns..."
              className="px-3 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setFilter("search", e.target.value)}
              value={filters.search}
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            + New Campaign
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Channel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivered
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opened
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign.campaignId} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{campaign.campaignName}</div>
                    <div className="text-sm text-gray-500">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <ChannelBadge channel={campaign.channel} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={campaign.status} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {campaign.totalRecipients}
                  </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                    {campaign.scheduledAt}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{campaign.deliveredCount}</div>
                    <div className="text-xs text-gray-500">
                      {((campaign.deliveredCount / campaign.totalRecipients) * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{campaign.openedCount}</div>
                    <div className="text-xs text-gray-500">
                      {campaign.deliveredCount > 0
                        ? ((campaign.openedCount / campaign.deliveredCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{campaign.surveyCompletedCount}</div>
                    <div className="text-xs text-gray-500">
                      {campaign.surveyStartedCount > 0
                        ? ((campaign.surveyCompletedCount / campaign.surveyStartedCount) * 100).toFixed(1)
                        : 0}%
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCampaign(campaign);
                          setActiveTab("details");
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View
                      </button>
                      {campaign.status === "draft" && (
                        <button
                          onClick={() => sendCampaign(campaign.campaignId)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Send
                        </button>
                      )}
                      {campaign.status === "sending" && (
                        <button
                          onClick={() => pauseCampaign(campaign.campaignId)}
                          className="text-orange-600 hover:text-orange-800 text-sm font-medium"
                        >
                          Pause
                        </button>
                      )}
                      {campaign.status === "paused" && (
                        <button
                          onClick={() => resumeCampaign(campaign.campaignId)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm(`Delete campaign "${campaign.campaignName}"?`)) {
                            deleteCampaign(campaign.campaignId);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {campaigns.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm">Create your first campaign to get started</p>
            </div>
          )}
        </div>
      </div>
  <CampaignCreateModal
  isOpen={showCreateModal}
  accounts={accounts}  // ✅ This is now passed correctly
  userId={uid}
  orgId={orgId}
  onClose={() => setShowCreateModal(false)}
  onCreate={create}
  lists={lists}
  contacts={contacts}
  surveyQuestions={surveyQuestions}
  onLoadSurveyQuestions={handleLoadSurveyQuestions}
  surveys={surveys}
  onLoadLists={handleLoadLists}
  onLoadContacts={handleLoadContacts}
  onLoadSurveys={handleLoadSurveys}
  onLoadAccounts={listAccounts}  // ✅ Add this too
/>
    </div>
  );

 

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-lg font-medium text-gray-900">Error loading campaigns</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 ">
      {/* Header */}
      <div className="bg-white border-b dark:bg-gray-900 ">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Campaign Dashboard</h1>
            <p className="text-gray-600 mt-1 dark:text-gray-300">Manage and monitor your survey campaigns</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
          <div className="flex space-x-8 ">
            {[
              { id: "overview", label: "Overview", icon: "📊" },
              { id: "campaigns", label: "Campaigns", icon: "📋" },
              { id: "analytics", label: "Analytics", icon: "📈" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-yellow-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-white hover:border-gray-300"
                }`}
              >
                <span className="mr-2 ">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "overview" && <CampaignOverview
  campaigns={campaigns}
  totals={totals}
  openRate={openRate}
  responseRate={responseRate}
  setSelectedCampaign={setSelectedCampaign}
  setActiveTab={setActiveTab}
/>
}
        {activeTab === "campaigns" && renderCampaigns()}
        {activeTab === "analytics" && <CampaignAnalytics
  pieData={pieData}
  channelData={channelData}
  performanceData={performanceData}
  totals={totals}
/>}
      </div>
    </div>
  );
};

export default CampaignPage;