"use client"
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import {
  Activity, TrendingUp, Clock, Users, Target, AlertTriangle,
  Settings, Play, Pause, RefreshCw, Eye, CheckCircle, XCircle,
  Router, Zap, Brain, Globe, Shield
} from 'lucide-react';
import { usePathname } from 'next/navigation';

// Routing Analytics Dashboard
const RoutingAnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const path = usePathname();
  const orgId = path.split[3]

  useEffect(() => {
    loadAnalytics();
  }, [orgId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/routing/analytics?org_id=${orgId}&range=${timeRange}`);
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          Routing Analytics
        </h2>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={loadAnalytics}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tickets Routed</p>
              <p className="text-2xl font-bold">{analytics.total_routed?.toLocaleString()}</p>
            </div>
            <Router className="w-8 h-8 text-blue-600" />
          </div>
          <div className="mt-4 flex items-center">
            <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-sm text-green-600">+{analytics.routing_growth}% vs previous period</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold">{analytics.avg_response_time}m</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <div className="mt-4 flex items-center">
            <span className={`text-sm ${analytics.response_time_trend > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {analytics.response_time_trend > 0 ? '+' : ''}{analytics.response_time_trend}% response time
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Routing Accuracy</p>
              <p className="text-2xl font-bold">{analytics.routing_accuracy}%</p>
            </div>
            <Target className="w-8 h-8 text-green-600" />
          </div>
          <div className="mt-4 flex items-center">
            <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-sm text-green-600">High accuracy maintained</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SLA Compliance</p>
              <p className="text-2xl font-bold">{analytics.sla_compliance}%</p>
            </div>
            <Shield className="w-8 h-8 text-purple-600" />
          </div>
          <div className="mt-4 flex items-center">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mr-1" />
            <span className="text-sm text-yellow-600">{analytics.sla_breaches} breaches this period</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Routing Methods Distribution */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Routing Methods
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.routing_methods}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.routing_methods?.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Response Time Trends */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Response Time Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.response_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="avg_response" 
                stroke="#8884d8" 
                name="Avg Response (min)"
              />
              <Line 
                type="monotone" 
                dataKey="sla_target" 
                stroke="#ff7300" 
                strokeDasharray="5 5"
                name="SLA Target"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Performance */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Performance
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.team_performance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="team_name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="tickets_handled" fill="#8884d8" name="Tickets Handled" />
              <Bar dataKey="avg_resolution" fill="#82ca9d" name="Avg Resolution (hrs)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Load Distribution */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Load Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.load_distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="ticket_volume" 
                stackId="1"
                stroke="#8884d8" 
                fill="#8884d8"
                name="Ticket Volume"
              />
              <Area 
                type="monotone" 
                dataKey="capacity_used" 
                stackId="2"
                stroke="#82ca9d" 
                fill="#82ca9d"
                name="Capacity Used %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Routing Quality Metrics */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Brain className="w-5 h-5" />
          Routing Quality Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{analytics.first_contact_resolution}%</div>
            <div className="text-sm text-gray-600">First Contact Resolution</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{analytics.escalation_rate}%</div>
            <div className="text-sm text-gray-600">Escalation Rate</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{analytics.customer_satisfaction}%</div>
            <div className="text-sm text-gray-600">Customer Satisfaction</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Real-time Routing Monitor
const RealTimeRoutingMonitor = ({ orgId }) => {
  const [realtimeData, setRealtimeData] = useState({
    active_tickets: 0,
    queue_depth: 0,
    avg_wait_time: 0,
    active_agents: 0,
    routing_rate: 0,
    recent_routes: []
  });

  useEffect(() => {
    const interval = setInterval(() => {
      loadRealtimeData();
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [orgId]);

  const loadRealtimeData = async () => {
    try {
      const response = await fetch(`/api/routing/realtime?org_id=${orgId}`);
      const data = await response.json();
      setRealtimeData(data);
    } catch (error) {
      console.error('Error loading realtime data:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Real-time Monitoring
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* Real-time Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow border text-center">
          <div className="text-xl font-bold text-blue-600">{realtimeData.active_tickets}</div>
          <div className="text-xs text-gray-600">Active Tickets</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border text-center">
          <div className="text-xl font-bold text-orange-600">{realtimeData.queue_depth}</div>
          <div className="text-xs text-gray-600">Queue Depth</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border text-center">
          <div className="text-xl font-bold text-purple-600">{realtimeData.avg_wait_time}m</div>
          <div className="text-xs text-gray-600">Avg Wait</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border text-center">
          <div className="text-xl font-bold text-green-600">{realtimeData.active_agents}</div>
          <div className="text-xs text-gray-600">Active Agents</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border text-center">
          <div className="text-xl font-bold text-red-600">{realtimeData.routing_rate}/min</div>
          <div className="text-xs text-gray-600">Routing Rate</div>
        </div>
      </div>

      {/* Recent Routing Decisions */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b">
          <h4 className="font-medium">Recent Routing Decisions</h4>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {realtimeData.recent_routes?.map((route, index) => (
            <div key={index} className="p-3 border-b last:border-b-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  route.confidence > 0.8 ? 'bg-green-500' : 
                  route.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <div>
                  <div className="text-sm font-medium">Ticket #{route.ticket_id}</div>
                  <div className="text-xs text-gray-600">{route.reasoning}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{route.target_name}</div>
                <div className="text-xs text-gray-600">{route.confidence * 100}% confidence</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Routing Configuration Panel
const RoutingConfigurationPanel = ({ orgId }) => {
  const [config, setConfig] = useState({
    enabled: true,
    load_balancing_weight: 0.4,
    sla_weight: 0.3,
    skills_weight: 0.3,
    max_queue_depth: 50,
    escalation_threshold: 3,
    business_hours_only: false,
    follow_the_sun: false
  });

  const [isModified, setIsModified] = useState(false);

  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsModified(true);
  };

  const saveConfig = async () => {
    try {
      await fetch(`/api/routing/config?org_id=${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      setIsModified(false);
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Routing Configuration
        </h3>
        <button
          onClick={saveConfig}
          disabled={!isModified}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isModified 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border p-6 space-y-6">
        {/* Global Settings */}
        <div>
          <h4 className="font-medium mb-4">Global Settings</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Enable Routing Engine</label>
              <button
                onClick={() => updateConfig('enabled', !config.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.enabled ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  config.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Business Hours Only</label>
              <button
                onClick={() => updateConfig('business_hours_only', !config.business_hours_only)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.business_hours_only ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  config.business_hours_only ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Follow-the-Sun Routing</label>
              <button
                onClick={() => updateConfig('follow_the_sun', !config.follow_the_sun)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.follow_the_sun ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  config.follow_the_sun ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Routing Weights */}
        <div>
          <h4 className="font-medium mb-4">Routing Algorithm Weights</h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Load Balancing</label>
                <span className="text-sm text-gray-600">{(config.load_balancing_weight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.load_balancing_weight}
                onChange={(e) => updateConfig('load_balancing_weight', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">SLA Priority</label>
                <span className="text-sm text-gray-600">{(config.sla_weight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.sla_weight}
                onChange={(e) => updateConfig('sla_weight', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium">Skills Matching</label>
                <span className="text-sm text-gray-600">{(config.skills_weight * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.skills_weight}
                onChange={(e) => updateConfig('skills_weight', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Thresholds */}
        <div>
          <h4 className="font-medium mb-4">Thresholds</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Max Queue Depth</label>
              <input
                type="number"
                value={config.max_queue_depth}
                onChange={(e) => updateConfig('max_queue_depth', parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Escalation Threshold</label>
              <input
                type="number"
                value={config.escalation_threshold}
                onChange={(e) => updateConfig('escalation_threshold', parseInt(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Routing Dashboard
const RobustRoutingDashboard = ({ orgId }) => {
  const [activeTab, setActiveTab] = useState('analytics');

  const tabs = [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'monitor', label: 'Real-time', icon: Eye },
    { id: 'config', label: 'Configuration', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-600" />
            Robust Routing System
          </h1>
          <p className="text-gray-600 mt-2">
            Intelligent ticket routing with multi-layered decision making and real-time optimization
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'analytics' && <RoutingAnalyticsDashboard orgId={orgId} />}
          {activeTab === 'monitor' && <RealTimeRoutingMonitor orgId={orgId} />}
          {activeTab === 'config' && <RoutingConfigurationPanel orgId={orgId} />}
        </div>
      </div>
    </div>
  );
};

export default RobustRoutingDashboard;