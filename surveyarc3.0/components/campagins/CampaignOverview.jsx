"use client";

import React from "react";

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
export default function CampaignOverview({
  campaigns = [],
  totals = {
    sent: 0,
    delivered: 0,
    opened: 0,
    surveyStarted: 0,
  },
  openRate = 0,
  responseRate = 0,
  setSelectedCampaign,
  setActiveTab,
}) {
  return (
    <div className="space-y-6">
      {/* =====================
          KEY METRICS
      ===================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campaigns */}
        <MetricCard
          title="Total Campaigns"
          value={campaigns.length}
          icon="📋"
          border="border-blue-500"
        />

        {/* Messages Sent */}
        <MetricCard
          title="Messages Sent"
          value={totals.sent.toLocaleString()}
          icon="📤"
          border="border-green-500"
          footer={`↑ ${totals.delivered} delivered`}
          footerClass="text-green-600"
        />

        {/* Open Rate */}
        <MetricCard
          title="Open Rate"
          value={`${openRate}%`}
          icon="👁️"
          border="border-purple-500"
          footer={`${totals.opened} opened`}
        />

        {/* Response Rate */}
        <MetricCard
          title="Response Rate"
          value={`${responseRate}%`}
          icon="📊"
          border="border-orange-500"
          footer={`${totals.surveyStarted} started`}
        />
      </div>

      {/* =====================
          RECENT CAMPAIGNS
      ===================== */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Campaigns
          </h2>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {campaigns.slice(0, 5).map((campaign) => (
              <div
                key={campaign.campaignId}
                className="flex items-center justify-between p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                onClick={() => {
                  setSelectedCampaign?.(campaign);
                  setActiveTab?.("details");
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {campaign.campaignName}
                    </h3>
                    <StatusBadge status={campaign.status} />
                    <ChannelBadge channel={campaign.channel} />
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>📧 {campaign.sentCount}/{campaign.totalRecipients}</span>
                    <span>✅ {campaign.deliveredCount}</span>
                    <span>📖 {campaign.openedCount}</span>
                    <span>🎯 {campaign.surveyCompletedCount}</span>
                  </div>
                </div>

                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}

            {campaigns.length === 0 && (
              <div className="text-center text-gray-500 py-6">
                No campaigns yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================
   METRIC CARD SUBCOMPONENT
===================== */
function MetricCard({
  title,
  value,
  icon,
  border,
  footer,
  footerClass = "text-gray-600",
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow p-6 border-l-4 ${border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>

      {footer && (
        <p className={`text-xs mt-2 ${footerClass}`}>
          {footer}
        </p>
      )}
    </div>
  );
}
