"use client";
import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSurvey } from "@/providers/surveyPProvider";
import { useQuestion } from "@/providers/questionPProvider";
import SurveyFormComponent from "@/components/SurveyFormComponent";
import SurveyResponsePopup from "@/components/SurveyResponsePopup";
import { useUser } from "@/providers/postGresPorviders/UserProvider";
import { TemplateSelectionPopup } from "@/components/surveys/TemplateSelectionPopup";
import { createSurveyFromTemplate } from "@/utils/createSurveyFromTemplate";
import { format, formatDistanceToNow } from "date-fns";

// Icons (using Lucide React or similar)
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit2,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Archive,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Share2,
  Settings,
} from "lucide-react";

export default function SurveyPage() {
  const [name, setName] = useState("");
  const [time, setTime] = useState("10 min");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [orderBy, setOrderBy] = useState("updated_at");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Template-related states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const [surveyNameForTemplate, setSurveyNameForTemplate] = useState("");

  const { user, uid } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const orgId = pathParts[3];
  const projectId = pathParts[6];
  const [isEditing, setIsEditing] = useState(false);
  const [editSurveyId, setEditSurveyId] = useState(null);

  const {
    surveys,
    getAllSurveys,
    surveyLoading,
    saveSurvey,
    updateSurvey,
    deleteSurvey: deleteSurveyContext,
    listResponses,
    countResponses,
  } = useSurvey();

  const { saveQuestion } = useQuestion();

  const [surveysWithCounts, setSurveysWithCounts] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);
  const [responseData, setResponseData] = useState([]);
  const [openPopup, setOpenPopup] = useState(false);

  // Fetch all surveys
  useEffect(() => {
    if (!orgId || !projectId) return;
    getAllSurveys(orgId, projectId);
  }, [orgId, projectId]);

  // Count responses
  useEffect(() => {
    const fetchCounts = async () => {
      if (!surveys?.length) {
        setSurveysWithCounts([]);
        return;
      }
      const updated = await Promise.all(
        surveys.map(async (s) => {
          try {
            const { count } = await countResponses(s.survey_id || s.surveyId || s.id);
            return { ...s, surveyId: s.survey_id || s.surveyId || s.id, responseCount: count || 0 };
          } catch {
            return { ...s, surveyId: s.survey_id || s.surveyId || s.id, responseCount: 0 };
          }
        })
      );
      setSurveysWithCounts(updated);
    };
    fetchCounts();
  }, [surveys]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const filteredAndSortedSurveys = useMemo(() => {
    let filtered = surveysWithCounts.filter(
      (survey) =>
        survey.name.toLowerCase().includes(searchText.toLowerCase()) ||
        survey.time.toLowerCase().includes(searchText.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (order === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [surveysWithCounts, searchText, orderBy, order]);

  const paginatedSurveys = useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredAndSortedSurveys.slice(startIndex, endIndex);
  }, [filteredAndSortedSurveys, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedSurveys.length / rowsPerPage);

  useEffect(() => {
    setPage(0);
  }, [searchText]);

  const handleClick = (surveyId) => {
    router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${surveyId}`);
  };

  const handleCreateFromScratch = async () => {
    if (!surveyNameForTemplate.trim()) {
      alert("Please enter a survey name");
      return;
    }

    setLoading(true);
    try {
      const surveyData = {
        name: surveyNameForTemplate,
        time: "10 min",
        orgId,
        projectId,
        createdBy: uid,
        status: "draft",
      };
      
      const newSurvey = await saveSurvey(surveyData);
      
      setSurveyNameForTemplate("");
      setShowCreateDialog(false);
      
      if (newSurvey?.survey_id || newSurvey?.surveyId) {
        router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${newSurvey.survey_id || newSurvey.surveyId}`);
      }
      
      alert("Survey created successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to create survey");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = async (template) => {
    if (!template) {
      handleCreateFromScratch();
      return;
    }

    if (!surveyNameForTemplate.trim()) {
      alert("Please enter a survey name");
      return;
    }

    setLoading(true);
    try {
      const result = await createSurveyFromTemplate(
        template,
        orgId,
        projectId,
        uid,
        { create: saveSurvey, update: updateSurvey },
        { create: saveQuestion },
        surveyNameForTemplate,
      );

      if (result?.survey_id) {
        await updateSurvey(orgId, result.survey_id, {
          name: surveyNameForTemplate,
        });
      }

      setSurveyNameForTemplate("");
      setShowTemplatePopup(false);
      setShowCreateDialog(false);

      if (result?.survey_id) {
        router.push(`/postgres-org/${orgId}/dashboard/projects/${projectId}/${result.survey_id}`);
      }

      alert(`Survey "${surveyNameForTemplate}" created from template successfully!`);
    } catch (error) {
      console.error("Failed to create survey:", error);
      alert("Failed to create survey from template");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setSurveyNameForTemplate("");
    setShowCreateDialog(true);
  };

  const handleUseTemplate = () => {
    if (!surveyNameForTemplate.trim()) {
      alert("Please enter a survey name first");
      return;
    }
    setShowCreateDialog(false);
    setShowTemplatePopup(true);
  };

  const deleteSurvey = async (id) => {
    if (window.confirm("Are you sure you want to delete this survey?")) {
      setLoading(true);
      try {
        await deleteSurveyContext(orgId, id);
        setSurveysWithCounts((prev) => prev.filter((s) => s.surveyId !== id));
      } catch (error) {
        console.error(error);
        alert("Error deleting survey");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (survey) => {
    setName(survey.name);
    setTime(survey.time);
    setIsEditing(true);
    setEditSurveyId(survey.surveyId);
    setShowForm(true);
  };

  const getStatusConfig = (status) => {
    const configs = {
      active: {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-700 dark:text-emerald-400",
        icon: CheckCircle2,
        label: "Active"
      },
      published: {
        bg: "bg-orange-50 dark:bg-orange-950/30",
        text: "text-orange-700 dark:text-orange-400",
        icon: CheckCircle2,
        label: "Published"
      },
      draft: {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-700 dark:text-amber-400",
        icon: Clock,
        label: "Draft"
      },
      archived: {
        bg: "bg-gray-50 dark:bg-gray-900/30",
        text: "text-gray-700 dark:text-gray-400",
        icon: Archive,
        label: "Archived"
      },
      test: {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        text: "text-purple-700 dark:text-purple-400",
        icon: AlertCircle,
        label: "Test"
      }
    };
    return configs[status] || configs.draft;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                Surveys
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Directory: {projectId}
              </p>
            </div>
            
            <button
              onClick={handleOpenCreateDialog}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Create Survey
            </button>
          </div>

          {/* Search Bar */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search surveys..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {surveyLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
          </div>
        ) : surveysWithCounts?.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No surveys yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Get started by creating your first survey
            </p>
            <button
              onClick={handleOpenCreateDialog}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Survey
            </button>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                      {[
                        { key: "name", label: "Survey Name" },
                        { key: "survey_id", label: "Survey ID" },
                        { key: "status", label: "Status" },
                        { key: "updated_at", label: "Last Modified" },
                        { key: "actions", label: "Actions" }
                      ].map((col) => (
                        <th
                          key={col.key}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {col.key !== "actions" ? (
                            <button
                              onClick={() => handleRequestSort(col.key)}
                              className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                              {col.label}
                              {orderBy === col.key && (
                                order === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            col.label
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {paginatedSurveys.map((survey) => {
                      const statusConfig = getStatusConfig(survey.status);
                      const StatusIcon = statusConfig.icon;
                      
                      return (
                        <tr
                          key={survey.surveyId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleClick(survey.surveyId)}
                              className="flex items-center gap-3 group"
                            >
                              <div className="flex-shrink-0 w-10 h-10 bg-orange-50 dark:bg-orange-950/30 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400">
                                  {survey.name}
                                </div>
                              </div>
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                              {survey.surveyId}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {survey.updated_at
                                ? formatDistanceToNow(new Date(survey.updated_at), { addSuffix: true })
                                : "N/A"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === survey.surveyId ? null : survey.surveyId)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <MoreHorizontal className="w-5 h-5 text-gray-500" />
                              </button>
                              
                              {openMenuId === survey.surveyId && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setOpenMenuId(null)}
                                  />
                                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                                    <button
                                      onClick={() => {
                                        handleClick(survey.surveyId);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View Survey
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleEdit(survey);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                      Edit Details
                                    </button>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(survey.surveyId);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                    >
                                      <Copy className="w-4 h-4" />
                                      Copy Survey ID
                                    </button>
                                    <button
                                      onClick={() => {
                                        // Handle share
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3"
                                    >
                                      <Share2 className="w-4 h-4" />
                                      Share Survey
                                    </button>
                                    
                                    <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                                    
                                    <div className="px-3 py-2">
                                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Change Status</p>
                                      {["draft", "published", "archived", "test"].map((status) => (
                                        survey.status !== status && (
                                          <button
                                            key={status}
                                            onClick={() => {
                                              updateSurvey(orgId, survey.surveyId, { status });
                                              setOpenMenuId(null);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded flex items-center gap-2 mb-1"
                                          >
                                            {React.createElement(getStatusConfig(status).icon, { className: "w-3.5 h-3.5" })}
                                            {getStatusConfig(status).label}
                                          </button>
                                        )
                                      ))}
                                    </div>
                                    
                                    <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
                                    
                                    <button
                                      onClick={() => {
                                        deleteSurvey(survey.surveyId);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-3"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete Survey
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredAndSortedSurveys.length)} of {filteredAndSortedSurveys.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Survey Modal */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Create New Survey
              </h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Survey Name
              </label>
              <input
                type="text"
                value={surveyNameForTemplate}
                onChange={(e) => setSurveyNameForTemplate(e.target.value)}
                placeholder="Enter survey name..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Choose how you want to start your survey
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFromScratch}
                className="flex-1 px-4 py-2 border border-orange-600 text-orange-600 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-950/30"
                disabled={loading || !surveyNameForTemplate.trim()}
              >
                From Scratch
              </button>
              <button
                onClick={handleUseTemplate}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                disabled={loading || !surveyNameForTemplate.trim()}
              >
                Use Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keep existing components */}
      <TemplateSelectionPopup
        isOpen={showTemplatePopup}
        onClose={() => {
          setShowTemplatePopup(false);
          setShowCreateDialog(true);
        }}
        onSelectTemplate={handleSelectTemplate}
        orgId={orgId}
        projectId={projectId}
        name={surveyNameForTemplate}
      />

      <SurveyFormComponent
        show={showForm}
        name={name}
        time={time}
        setName={setName}
        setTime={setTime}
        loading={loading}
        isEditing={isEditing}
        handleSubmit={async () => {
          if (!name.trim()) return alert("Please enter a survey name");
          if (!time.trim()) return alert("Please enter survey duration");
          setLoading(true);
          try {
            if (isEditing && editSurveyId) {
              await updateSurvey(orgId, editSurveyId, {
                name,
                time,
                updatedBy: uid,
              });
              alert("Survey updated!");
            }
            setName("");
            setTime("10 min");
            setIsEditing(false);
            setEditSurveyId(null);
            setShowForm(false);
          } catch (error) {
            console.error(error);
            alert("Something went wrong.");
          } finally {
            setLoading(false);
          }
        }}
        handleCancel={() => {
          setName("");
          setTime("10 min");
          setIsEditing(false);
          setEditSurveyId(null);
          setShowForm(false);
        }}
      />

      {openPopup && (
        <SurveyResponsePopup
          open={openPopup}
          onClose={() => setOpenPopup(false)}
          responses={responseData}
          orgId={orgId}
          surveyId={selectedSurveyId}
        />
      )}
    </div>
  );
}