"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

export default function CampaignAnalytics({
  pieData = [],
  channelData = [],
  performanceData = [],
  totals = {
    sent: 0,
    delivered: 0,
    opened: 0,
    surveyStarted: 0,
    surveyCompleted: 0,
  },
}) {
  return (
    <div className="space-y-6">
      {/* =====================
          CHARTS GRID
      ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Status Distribution */}
        <ChartCard title="Delivery Status Distribution">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Channel Distribution */}
        <ChartCard title="Channel Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#3B82F6" name="Campaigns" />
              <Bar dataKey="sent" fill="#10B981" name="Sent" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* =====================
          PERFORMANCE COMPARISON
      ===================== */}
      <ChartCard title="Campaign Performance Comparison">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="sent" fill="#3B82F6" name="Sent" />
            <Bar dataKey="delivered" fill="#10B981" name="Delivered" />
            <Bar dataKey="opened" fill="#F59E0B" name="Opened" />
            <Bar dataKey="clicked" fill="#8B5CF6" name="Clicked" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* =====================
          ENGAGEMENT FUNNEL
      ===================== */}
      <ChartCard title="Engagement Funnel">
        <EngagementFunnel totals={totals} />
      </ChartCard>
    </div>
  );
}

/* =====================
   SUBCOMPONENTS
===================== */

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {title}
      </h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center text-gray-500">
      No data available
    </div>
  );
}

function EngagementFunnel({ totals }) {
  const sent = totals.sent || 1; // prevent divide by zero

  const steps = [
    { label: "Sent", value: totals.sent, color: "bg-blue-600" },
    { label: "Delivered", value: totals.delivered, color: "bg-green-600" },
    { label: "Opened", value: totals.opened, color: "bg-yellow-600" },
    { label: "Survey Started", value: totals.surveyStarted, color: "bg-purple-600" },
    { label: "Completed", value: totals.surveyCompleted, color: "bg-pink-600" },
  ];

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const width = Math.min((step.value / sent) * 100, 100);

        return (
          <div key={step.label} className="flex items-center gap-4">
            <div className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300">
              {step.label}
            </div>
            <div className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-full h-8">
              <div
                className={`${step.color} h-8 rounded-full flex items-center justify-end pr-3 text-white text-sm font-medium transition-all`}
                style={{ width: `${width}%` }}
              >
                {step.value > 0 && step.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
