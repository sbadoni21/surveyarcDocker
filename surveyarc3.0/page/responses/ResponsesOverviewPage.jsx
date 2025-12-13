"use client";
import React, { useState, useMemo } from "react";
import { useResponse } from "@/providers/postGresPorviders/responsePProvider";
import { useParticipantSources } from "@/providers/postGresPorviders/participantSourcePProvider";

const ResponsesOverviewPage = () => {
  const { responses, loading: responsesLoading, surveyId } = useResponse();
  const { sources, loading: sourcesLoading } = useParticipantSources();

  const [mainTab, setMainTab] = useState("panels");
  const [responseTab, setResponseTab] = useState("all");
  const [selectedSource, setSelectedSource] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPanelDetails, setShowPanelDetails] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});

  const stats = useMemo(() => {
    const total = responses.length;
    const completed = responses.filter(r => r.status === "completed").length;
    const inProgress = responses.filter(r => r.status === "started" || r.status === "in_progress").length;
    const bySource = {};

    responses.forEach(r => {
      const sourceId = r.source_id || "direct";
      if (!bySource[sourceId]) {
        bySource[sourceId] = { total: 0, completed: 0, inProgress: 0, responses: [] };
      }
      bySource[sourceId].total++;
      bySource[sourceId].responses.push(r);
      if (r.status === "completed") bySource[sourceId].completed++;
      if (r.status === "started" || r.status === "in_progress") bySource[sourceId].inProgress++;
    });

    return { total, completed, inProgress, bySource };
  }, [responses]);

  const filteredResponses = useMemo(() => {
    let filtered = [...responses];

    if (responseTab === "completed") {
      filtered = filtered.filter(r => r.status === "completed");
    } else if (responseTab === "in-progress") {
      filtered = filtered.filter(r => r.status === "started" || r.status === "in_progress");
    }

    if (selectedSource) {
      filtered = filtered.filter(r =>
        selectedSource === "direct" ? !r.source_id : r.source_id === selectedSource
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.respondent_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.response_id?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [responses, responseTab, selectedSource, searchTerm]);

  const formatRelativeTime = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return "N/A";
    }
  };

  const getSourceInfo = (sourceId) => {
    if (!sourceId) return { name: "Direct", type: "direct", info: null };
    const source = sources.find(s => s.id === sourceId);
    return {
      name: source?.source_name || source?.name || sourceId,
      type: source?.source_type || "unknown",
      info: source
    };
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderValue = (value, key = '') => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">null</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <span className={value ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {value.toString()}
        </span>
      );
    }
    
    if (typeof value === 'string') {
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return (
          <span className="text-gray-700">
            {value} <span className="text-gray-500 text-xs">({formatRelativeTime(value)})</span>
          </span>
        );
      }
      if (value.startsWith('http://') || value.startsWith('https://')) {
        return (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {value}
          </a>
        );
      }
      return <span className="text-gray-700">{value}</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="text-purple-600 font-medium">{value}</span>;
    }
    
    if (Array.isArray(value)) {
      const arrayKey = `array-${key}`;
      return (
        <div className="ml-4 border-l-2 border-gray-200 pl-3">
          <button
            onClick={() => toggleSection(arrayKey)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm mb-2 flex items-center gap-1"
          >
            {expandedSections[arrayKey] ? '▼' : '▶'} Array ({value.length} items)
          </button>
          {expandedSections[arrayKey] && (
            <div className="space-y-2">
              {value.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-500 mb-1">Index {index}:</div>
                  {renderValue(item, `${arrayKey}-${index}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const objKey = `obj-${key}`;
      const entries = Object.entries(value);
      return (
        <div className="ml-4 border-l-2 border-gray-200 pl-3">
          <button
            onClick={() => toggleSection(objKey)}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm mb-2 flex items-center gap-1"
          >
            {expandedSections[objKey] ? '▼' : '▶'} Object ({entries.length} properties)
          </button>
          {expandedSections[objKey] && (
            <div className="space-y-1">
              {entries.map(([k, v]) => (
                <div key={k} className="py-1">
                  <span className="text-blue-700 font-medium text-sm">{k}:</span>{' '}
                  {renderValue(v, `${objKey}-${k}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return <span className="text-gray-700">{String(value)}</span>;
  };

  const PanelDetailsModal = ({ sourceId, onClose }) => {
    const sourceInfo = getSourceInfo(sourceId);
    const panelStats = stats.bySource[sourceId] || { total: 0, completed: 0, inProgress: 0, responses: [] };

    const completedResponses = panelStats.responses.filter(r => r.status === "completed" && r.meta_data?.totalTime);
    const avgTime = completedResponses.length > 0
      ? completedResponses.reduce((sum, r) => {
          const time = r.meta_data.totalTime;
          const match = time.match(/(\d+)m\s*(\d+)s/);
          if (match) {
            return sum + parseInt(match[1]) * 60 + parseInt(match[2]);
          }
          return sum;
        }, 0) / completedResponses.length
      : 0;

    const formatAvgTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}m ${secs}s`;
    };

    const panelData = sourceInfo.info || {};
    const excludeFromDetails = ['responses'];

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
            <h2 className="text-2xl font-bold">Panel Details: {sourceInfo.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-blue-600 font-medium">Total</div>
                <div className="text-3xl font-bold text-blue-700">{panelStats.total}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-green-600 font-medium">Completed</div>
                <div className="text-3xl font-bold text-green-700">{panelStats.completed}</div>
                <div className="text-sm text-green-600">
                  {panelStats.total > 0 ? Math.round((panelStats.completed / panelStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-sm text-yellow-600 font-medium">In Progress</div>
                <div className="text-3xl font-bold text-yellow-700">{panelStats.inProgress}</div>
                <div className="text-sm text-yellow-600">
                  {panelStats.total > 0 ? Math.round((panelStats.inProgress / panelStats.total) * 100) : 0}%
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm text-purple-600 font-medium">Avg Time</div>
                <div className="text-3xl font-bold text-purple-700">
                  {avgTime > 0 ? formatAvgTime(avgTime) : "N/A"}
                </div>
              </div>
            </div>

            {sourceInfo.info && (
              <div className="bg-white border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <h3 className="font-semibold text-lg">Panel Information</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-1/3">Field</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {Object.entries(panelData)
                        .filter(([key]) => !excludeFromDetails.includes(key))
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([key, value]) => (
                          <tr key={key} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-700 align-top">
                              {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {renderValue(value, key)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-lg mb-4">Recent Responses</h3>
              <div className="space-y-2">
                {panelStats.responses.slice(0, 20).map((response) => (
                  <div key={response.response_id} className="border rounded-lg p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-sm">{response.response_id}</div>
                        <div className="text-xs text-gray-600">
                          Respondent: {response.respondent_id || "Anonymous"}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          response.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {response.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-600">
                      <div>Duration: {response.meta_data?.totalTime || "N/A"}</div>
                      <div>Started: {formatRelativeTime(response.started_at)}</div>
                      {response.completedAt && (
                        <div>Completed: {formatRelativeTime(response.completedAt)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!surveyId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Survey Selected</h2>
          <p className="text-gray-600">Please select a survey to view responses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
    

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Responses</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">In Progress</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.inProgress}</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}% incomplete
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setMainTab("panels")}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                mainTab === "panels"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Panels ({sources.length + (stats.bySource["direct"] ? 1 : 0)})
            </button>
            <button
              onClick={() => setMainTab("responses")}
              className={`px-6 py-4 font-semibold border-b-2 transition-colors ${
                mainTab === "responses"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Responses ({stats.total})
            </button>
          </div>
        </div>

        {mainTab === "panels" && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-xl text-gray-900">All Sources</h3>
                    <p className="text-sm text-gray-600 mt-1">Combined statistics</p>
                  </div>
                  <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">All</span>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Total Responses</span>
                    <span className="font-bold text-lg">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Completed</span>
                    <span className="font-bold text-lg text-green-600">{stats.completed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">In Progress</span>
                    <span className="font-bold text-lg text-yellow-600">{stats.inProgress}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-blue-200">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% Complete
                  </p>
                </div>
              </div>

              {sources.map(source => {
                const sourceStats = stats.bySource[source.id] || { total: 0, completed: 0, inProgress: 0 };
                return (
                  <div
                    key={source.id}
                    className="bg-white rounded-lg p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:border-blue-300 cursor-pointer"
                    onClick={() => setShowPanelDetails(source.id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">{source.source_name || source.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{source.description || 'No description'}</p>
                      </div>
                      <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                        {source.source_type}
                      </span>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Total Responses</span>
                        <span className="font-bold text-lg">{sourceStats.total}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">Completed</span>
                        <span className="font-bold text-lg text-green-600">{sourceStats.completed}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700">In Progress</span>
                        <span className="font-bold text-lg text-yellow-600">{sourceStats.inProgress}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-600">Clicks: {source.total_clicks || 0}</span>
                        <span className="text-xs text-gray-600">Starts: {source.total_starts || 0}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${sourceStats.total > 0 ? (sourceStats.completed / sourceStats.total) * 100 : 0}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        {sourceStats.total > 0 ? Math.round((sourceStats.completed / sourceStats.total) * 100) : 0}% Complete
                      </p>
                    </div>

                    <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">
                      View Details
                    </button>
                  </div>
                );
              })}

              {stats.bySource["direct"] && (
                <div
                  className="bg-white rounded-lg p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow hover:border-blue-300 cursor-pointer"
                  onClick={() => setShowPanelDetails("direct")}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl text-gray-900">Direct Responses</h3>
                      <p className="text-sm text-gray-600 mt-1">No panel assigned</p>
                    </div>
                    <span className="bg-gray-200 text-gray-700 text-xs px-3 py-1 rounded-full">
                      direct
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Total Responses</span>
                      <span className="font-bold text-lg">{stats.bySource["direct"].total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Completed</span>
                      <span className="font-bold text-lg text-green-600">{stats.bySource["direct"].completed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">In Progress</span>
                      <span className="font-bold text-lg text-yellow-600">{stats.bySource["direct"].inProgress}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${stats.bySource["direct"].total > 0 ? (stats.bySource["direct"].completed / stats.bySource["direct"].total) * 100 : 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      {stats.bySource["direct"].total > 0 ? Math.round((stats.bySource["direct"].completed / stats.bySource["direct"].total) * 100) : 0}% Complete
                    </p>
                  </div>

                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors">
                    View Details
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {mainTab === "responses" && (
          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setResponseTab("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    responseTab === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => setResponseTab("completed")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    responseTab === "completed"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Completed ({stats.completed})
                </button>
                <button
                  onClick={() => setResponseTab("in-progress")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    responseTab === "in-progress"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  In Progress ({stats.inProgress})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select
                  value={selectedSource || ""}
                  onChange={(e) => setSelectedSource(e.target.value || null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Sources</option>
                  {sources.map(source => (
                    <option key={source.id} value={source.id}>
                      {source.source_name || source.name} ({stats.bySource[source.id]?.total || 0})
                    </option>
                  ))}
                  {stats.bySource["direct"] && (
                    <option value="direct">Direct Responses ({stats.bySource["direct"].total})</option>
                  )}
                </select>

                <input
                  type="text"
                  placeholder="Search by Response ID or Respondent ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              {responsesLoading || sourcesLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading responses...</p>
                </div>
              ) : filteredResponses.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-xl text-gray-600 mb-2">No responses found</p>
                  <p className="text-gray-500">Try adjusting your filters or search term</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Response ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Respondent</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source / Panel</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredResponses.map((response) => {
                        const sourceInfo = getSourceInfo(response.source_id);
                        return (
                          <tr key={response.response_id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{response.response_id}</td>
                            <td className="px-6 py-4 text-sm text-gray-900">{response.respondent_id || "Anonymous"}</td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-2">
                                {sourceInfo.name}
                                {response.source_id && (
                                  <button
                                    onClick={() => setShowPanelDetails(response.source_id)}
                                    className="text-blue-600 hover:text-blue-800 text-xs"
                                    title="View panel details"
                                  >
                                    ℹ️
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  response.status === "completed"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {response.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{response.meta_data?.totalTime || "N/A"}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{formatRelativeTime(response.started_at)}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {response.completed_at ? formatRelativeTime(response.completed_at) : "—"}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <button
                                onClick={() => {
                                  console.log("View response:", response.response_id);
                                }}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  console.log("Export response:", response.response_id);
                                }}
                                className="text-gray-600 hover:text-gray-900"
                              >
                                Export
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPanelDetails && (
        <PanelDetailsModal
          sourceId={showPanelDetails}
          onClose={() => setShowPanelDetails(null)}
        />
      )}
    </div>
  );
};

export default ResponsesOverviewPage;