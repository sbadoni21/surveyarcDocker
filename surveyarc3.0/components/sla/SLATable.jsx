import React, { useState } from 'react';
import { 
  Edit, Trash2,Power, Archive, 
  Upload,
  Search, MoreVertical, X, Info
} from 'lucide-react';

const ActionMenu = ({ sla, onAction }) => {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Edit, label: 'Edit', action: 'edit', color: 'text-gray-700' },
    { icon: Power, label: sla.active ? 'Deactivate' : 'Activate', action: 'toggle', color: 'text-gray-700' },
    { icon: Upload, label: 'Publish', action: 'publish', color: 'text-purple-600' },
    { icon: Archive, label: 'Archive', action: 'archive', color: 'text-orange-600' },
    { icon: Trash2, label: 'Delete', action: 'delete', color: 'text-red-600' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <MoreVertical size={18} className="text-gray-600" />
      </button>

      {open && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {actions.map((item) => (
              <button
                key={item.action}
                onClick={() => {
                  onAction(item.action, sla);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${item.color}`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const OverridesPopover = ({ sla }) => {
  const [open, setOpen] = useState(false);
  
  const priorityOverrides = Object.entries(sla.rules?.priority_map || {}).filter(([, v]) => v != null && v !== '');
  const severityOverrides = Object.entries(sla.rules?.severity_map || {}).filter(([, v]) => v != null && v !== '');
  const totalOverrides = priorityOverrides.length + severityOverrides.length;

  if (totalOverrides === 0) {
    return <span className="text-xs text-gray-400">None</span>;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
      >
        <span>{totalOverrides}</span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div 
            className="fixed inset-0 z-90" 
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 mt-1 w-72 bg-white rounded-lg shadow-xl border border-gray-300 py-2 z-20">
            {priorityOverrides.length > 0 && (
              <div className="px-3 py-2">
                <div className="text-[10px]  text-gray-500 uppercase  mb-1.5">Priority</div>
                <div className="space-y-1">
                  {priorityOverrides.map(([k, v]) => (
                    <div key={`p-${k}`} className="flex items-center justify-between py-1 px-2 bg-blue-50 rounded border border-blue-100">
                      <span className="text-xs font-medium text-blue-900 capitalize">{k}</span>
                      <span className="text-xs  text-blue-700">{v}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {priorityOverrides.length > 0 && severityOverrides.length > 0 && (
              <div className="border-t border-gray-200 my-1" />
            )}
            
            {severityOverrides.length > 0 && (
              <div className="px-3 py-2">
                <div className="text-[10px]  text-gray-500 uppercase  mb-1.5">Severity</div>
                <div className="space-y-1">
                  {severityOverrides.map(([k, v]) => (
                    <div key={`s-${k}`} className="flex items-center justify-between py-1 px-2 bg-purple-50 rounded border border-purple-100">
                      <span className="text-xs font-medium text-purple-900 uppercase">{k}</span>
                      <span className="text-xs  text-purple-700">{v}m</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const SLATable = ({ slas = [], onAction = {} }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const filtered = slas.filter(sla => {
    const matchesSearch = !searchQuery || 
      sla.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sla.slug?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesActive = !showActiveOnly || sla.active;
    
    return matchesSearch && matchesActive;
  });

  const handleAction = (actionName, sla) => {
    const actionMap = {
      'edit': onAction.edit,
      'toggle': onAction.activateToggle,
      'publish': onAction.publish,
      'archive': onAction.archive,
      'delete': onAction.delete,
    };

    const handler = actionMap[actionName];
    if (handler && typeof handler === 'function') {
      handler(sla);
    }
  };

  return (
    <div className="space-y-4 ">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Active only</span>
          </label>
          <div className="h-5 w-px bg-gray-300" />
          <span className="text-sm text-gray-600 font-medium">
            {filtered.length} {filtered.length === 1 ? 'SLA' : 'SLAs'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-screen">
        <div className="">
          <table className="w-full overflow-x-scroll  min-h-full">
            <thead className="bg-gradient-to-r from-slate-50 to-gray-50 border-b-2 border-gray-300">
              <tr>
                <th className="px-6 py-4 text-left text-xs  text-gray-700 uppercase ">
                  Service Level Agreement
                </th>
                <th className="px-6 py-4 text-left text-xs  text-gray-800 uppercase ">
                  First Response
                </th>
                <th className="px-6 py-4 text-left text-xs  text-gray-800 uppercase ">
                  Resolution Time
                </th>
                <th className="px-6 py-4 text-left text-xs  text-gray-800 uppercase ">
                  Overrides
                </th>
                <th className="px-6 py-4 text-left text-xs  text-gray-800 uppercase ">
                  Status
                </th>
                <th className="px-6 py-4 text-right text-xs  text-gray-800 uppercase  w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((sla) => (
                <tr key={sla.sla_id} className="hover:bg-slate-50 transition-all duration-150 border-b border-gray-100">
                  {/* Name Column */}
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold text-gray-900 text-sm">{sla.name}</div>
                      <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-0.5 rounded inline-block w-fit">
                        {sla.slug || 'No identifier'}
                      </div>
                    </div>
                  </td>

                  {/* First Response */}
                  <td className="px-6 py-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {sla.first_response_minutes ?? '—'}
                      </span>
                      {sla.first_response_minutes && (
                        <span className="text-xs text-gray-500">min</span>
                      )}
                    </div>
                  </td>

                  {/* Resolution */}
                  <td className="px-6 py-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {sla.resolution_minutes ?? '—'}
                      </span>
                      {sla.resolution_minutes && (
                        <span className="text-xs text-gray-500">min</span>
                      )}
                    </div>
                  </td>

                  {/* Overrides */}
                  <td className="px-6 py-5">
                    <OverridesPopover sla={sla} />
                  </td>

                  {/* Status */}
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs  uppercase tracking-wide ${
                        sla.active
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {sla.active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-end gap-2">
                      {/* More Actions Menu */}
                      <ActionMenu sla={sla} onAction={handleAction} />
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Info size={24} className="text-gray-400" />
                      <p className="text-sm text-gray-600 font-medium">
                        {searchQuery
                          ? 'No SLAs match your search'
                          : 'No SLAs found'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend for overrides */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Understanding Policy Overrides</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Priority Overrides (P:):</strong> Custom resolution times for priority levels (low, normal, high, urgent)</p>
              <p><strong>Severity Overrides (S:):</strong> Custom resolution times for severity levels (sev4, sev3, sev2, sev1)</p>
              <p>Example: "P:urgent→30m" means urgent priority tickets must be resolved within 30 minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Demo data and wrapper
const demoSLAs = [
  {
    sla_id: 1,
    name: 'Enterprise Gold',
    slug: 'enterprise-gold',
    first_response_minutes: 15,
    resolution_minutes: 240,
    active: true,
    rules: {
      priority_map: { urgent: 60, high: 120 },
      severity_map: { sev1: 30, sev2: 120 }
    }
  },
  {
    sla_id: 2,
    name: 'Standard Support',
    slug: 'standard-support',
    first_response_minutes: 60,
    resolution_minutes: 480,
    active: true,
    rules: {
      priority_map: { urgent: 180 },
      severity_map: {}
    }
  },
  {
    sla_id: 3,
    name: 'Basic Tier',
    slug: 'basic-tier',
    first_response_minutes: 240,
    resolution_minutes: 1440,
    active: false,
    rules: {
      priority_map: {},
      severity_map: {}
    }
  },
];

export default function App() {
  const handleAction = (action, sla) => {
    console.log(`Action: ${action} on SLA:`, sla);
    alert(`Action "${action}" triggered for: ${sla.name}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl  text-gray-900 mb-2">SLA Management</h1>
          <p className="text-gray-600">Manage service level agreements and response time policies</p>
        </div>
        
        <SLATable 
          slas={demoSLAs}
          onAction={{
            edit: handleAction.bind(null, 'edit'),
            activateToggle: handleAction.bind(null, 'toggle'),
            publish: handleAction.bind(null, 'publish'),
            archive: handleAction.bind(null, 'archive'),
            delete: handleAction.bind(null, 'delete'),
          }}
        />
      </div>
    </div>
  );
}