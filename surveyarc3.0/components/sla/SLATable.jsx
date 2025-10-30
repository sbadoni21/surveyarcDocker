import React, { useState } from 'react';
import { 
  Edit, Trash2, Copy, Zap, DollarSign, Power, Archive, 
  Upload, CheckCircle, GitBranch, Plus, Link2,
  Search, MoreVertical, X, Info
} from 'lucide-react';

const ActionMenu = ({ sla, onAction }) => {
  const [open, setOpen] = useState(false);

  const actions = [
    { icon: Zap, label: 'Objectives', action: 'objectives', color: 'text-blue-600' },
    { icon: DollarSign, label: 'Credits', action: 'credits', color: 'text-green-600' },
    { icon: Edit, label: 'Edit', action: 'edit', color: 'text-gray-700' },
    { icon: Power, label: sla.active ? 'Deactivate' : 'Activate', action: 'toggle', color: 'text-gray-700' },
    { icon: Upload, label: 'Publish', action: 'publish', color: 'text-purple-600' },
    { icon: Archive, label: 'Archive', action: 'archive', color: 'text-orange-600' },
    { icon: CheckCircle, label: 'Validate', action: 'validate', color: 'text-teal-600' },
    { icon: Copy, label: 'Duplicate', action: 'duplicate', color: 'text-gray-700' },
    { icon: GitBranch, label: 'Versions', action: 'versions', color: 'text-indigo-600' },
    { icon: Plus, label: 'New Version', action: 'newVersion', color: 'text-indigo-600' },
    { icon: Link2, label: 'Dependencies', action: 'dependencies', color: 'text-gray-700' },
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
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 ${item.color}`}
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
      'objectives': onAction.objectives,
      'credits': onAction.creditRules,
      'edit': onAction.edit,
      'toggle': onAction.activateToggle,
      'publish': onAction.publish,
      'archive': onAction.archive,
      'validate': onAction.validate,
      'duplicate': onAction.duplicate,
      'versions': onAction.versions,
      'newVersion': onAction.newVersion,
      'dependencies': onAction.dependencies,
      'delete': onAction.delete,
    };

    const handler = actionMap[actionName];
    if (handler && typeof handler === 'function') {
      handler(sla);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <span className="text-sm text-gray-600">
            {filtered.length} {filtered.length === 1 ? 'SLA' : 'SLAs'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 ">
        <div className="overflow-x-auto">
          <table className="w-full overflow-x-scroll table-fixed min-h-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  FR (min)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  RES (min)
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Overrides
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((sla) => (
                <tr key={sla.sla_id} className="hover:bg-gray-50 transition-colors">
                  {/* Name Column */}
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium text-gray-900">{sla.name}</div>
                      <div className="text-xs text-gray-500">{sla.slug || '—'}</div>
                    </div>
                  </td>

                  {/* First Response */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {sla.first_response_minutes ?? '—'}
                  </td>

                  {/* Resolution */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {sla.resolution_minutes ?? '—'}
                  </td>

                  {/* Overrides */}
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(sla.rules?.priority_map || {})
                        .filter(([, v]) => v != null && v !== '')
                        .map(([k, v]) => (
                          <span
                            key={`p-${k}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                            title={`Priority: ${k} → ${v} minutes`}
                          >
                            P:{k}→{v}
                          </span>
                        ))}
                      {Object.entries(sla.rules?.severity_map || {})
                        .filter(([, v]) => v != null && v !== '')
                        .map(([k, v]) => (
                          <span
                            key={`s-${k}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                            title={`Severity: ${k} → ${v} minutes`}
                          >
                            S:{k}→{v}
                          </span>
                        ))}
                      {!Object.keys(sla.rules?.priority_map || {}).length && 
                       !Object.keys(sla.rules?.severity_map || {}).length && (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sla.active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {sla.active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Quick Actions - visible on larger screens */}
                      <div className="hidden 2xl:flex items-center gap-1">
                        <button
                          onClick={() => handleAction('objectives', sla)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Objectives"
                        >
                          <Zap size={14} />
                        </button>
                        <button
                          onClick={() => handleAction('credits', sla)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                          title="Credits"
                        >
                          <DollarSign size={14} />
                        </button>
                        <button
                          onClick={() => handleAction('edit', sla)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                      </div>

                      {/* More Actions Menu */}
                      <ActionMenu sla={sla} onAction={handleAction} />
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Info size={24} className="text-gray-400" />
                      <p className="text-sm text-gray-600">
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">Understanding Overrides</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Priority Overrides (P:):</strong> Custom resolution times for priority levels (low, normal, high, urgent)</p>
              <p><strong>Severity Overrides (S:):</strong> Custom resolution times for severity levels (sev4, sev3, sev2, sev1)</p>
              <p>Example: "P:urgent→30" means urgent priority tickets must be resolved within 30 minutes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};