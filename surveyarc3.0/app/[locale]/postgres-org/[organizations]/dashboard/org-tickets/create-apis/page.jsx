// app/tickets/templates/page.jsx
"use client";
import { useState } from "react";
import { Plus, Edit, Trash2, Power, PowerOff, BarChart3 } from "lucide-react";
import { useOrganisation } from "@/providers/postGresPorviders/organisationProvider";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { useTicketTemplate } from "@/providers/postGresPorviders/ticketTemplateProvider";
import TicketTemplateForm from "@/components/tickets/TicketTemplateForm";

export default function TemplateManagementPage() {
  const { organisation } = useOrganisation();
  const { user } = useUser();
  const {
    templates,
    loading,
    activate,
    deactivate,
    deleteTemplate,
    getStats,
  } = useTicketTemplate();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormOpen(true);
  };

  const handleDelete = async (templateId, templateName) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteTemplate(templateId, user.uid);
      alert("Template deleted successfully");
    } catch (error) {
      alert("Failed to delete template: " + error.message);
    }
  };
  const handleToggleActive = async (template) => {
    try {
      if (template.isActive) {
        await deactivate(template.templateId);
      } else {
        await activate(template.templateId);
      }
    } catch (error) {
      alert(`Failed to ${template.isActive ? "deactivate" : "activate"} template: ` + error.message);
    }
  };

  const handleViewStats = async (templateId) => {
    try {
      const stats = await getStats(templateId);
      alert(JSON.stringify(stats, null, 2));
    } catch (error) {
      alert("Failed to fetch stats: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#1A1A1E] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Ticket Templates
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create and manage templates for automated ticket creation via API
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTemplate(null);
                setFormOpen(true);
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Create Template</span>
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Templates</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {templates.length}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <Edit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Templates</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {templates.filter((t) => t.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <Power className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Usage</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Templates List */}
        {templates.length === 0 ? (
          <div className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Edit className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Templates Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first template to start automating ticket creation via API
              </p>
              <button
                onClick={() => setFormOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Create Your First Template</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template.templateId}
                className="bg-white dark:bg-[#242428] border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {template.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          template.isActive
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {template.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {template.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">
                        Subject: {template.subjectTemplate}
                      </span>
                      {template.allowedVariables?.length > 0 && (
                        <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded">
                          {template.allowedVariables.length} variable{template.allowedVariables.length !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 rounded capitalize">
                        Priority: {template.defaultPriority}
                      </span>
                      <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded uppercase">
                        {template.defaultSeverity}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>Used {template.usageCount || 0} times</span>
                      {template.lastUsedAt && (
                        <>
                          <span>•</span>
                          <span>Last: {new Date(template.lastUsedAt).toLocaleDateString()}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Created {new Date(template.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewStats(template.templateId)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View Statistics"
                    >
                      <BarChart3 className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`p-2 rounded-lg transition-colors ${
                        template.isActive
                          ? "text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      title={template.isActive ? "Deactivate" : "Activate"}
                    >
                      {template.isActive ? (
                        <Power className="h-5 w-5" />
                      ) : (
                        <PowerOff className="h-5 w-5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleEdit(template)}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                      title="Edit Template"
                    >
                      <Edit className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleDelete(template.templateId, template.name)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete Template"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template Form Modal */}
      <TicketTemplateForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingTemplate(null);
        }}
        onSuccess={(created) => {
          console.log("Template created:", created);
        }}
        initial={editingTemplate}
        orgId={organisation?.org_id}
        currentUserId={user?.uid}
        title={editingTemplate ? "Edit Template" : "Create Ticket Template"}
      />
    </div>
  );
}