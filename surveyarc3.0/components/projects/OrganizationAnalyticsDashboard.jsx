import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useProject } from "@/providers/postGresPorviders/projectProvider";
import { useSurvey } from "@/providers/surveyPProvider";
import {
  BarChart3,
  ListChecks,
  Activity,
  Clock3,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  Target,
  Zap,
  Calendar,
  FolderKanban,
  FileText,
} from "lucide-react";

const STATUS_GROUPS = {
  planning: "Planning",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

const SURVEY_STATUS_LABELS = {
  draft: "Draft",
  active: "Active",
  test: "Test",
  archived: "Archived",
};

function isOverdue(project) {
  if (!project?.dueDate) return false;
  const due = new Date(project.dueDate);
  const now = new Date();
  const status = project.status || "planning";
  return due < now && !["completed", "cancelled"].includes(status);
}

export default function OrganizationAnalyticsDashboard({ orgId }) {
  const { projects, getAllProjects } = useProject();

  const {
    fetchAllOrgSurveys,
    countResponses,
    surveyLoading,
  } = useSurvey();

  const [allSurveys, setAllSurveys] = useState([]);
  const [responsesMap, setResponsesMap] = useState({});
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [surveysFetching, setSurveysFetching] = useState(false);

  useEffect(() => {
    if (orgId && getAllProjects) {
      console.log("Fetching projects for org:", orgId);
      getAllProjects(orgId);
    }
  }, [orgId, getAllProjects]);

  const fetchOrgSurveys = useCallback(
    async (currentOrgId) => {
      if (!currentOrgId) {
        setAllSurveys([]);
        return;
      }

      console.log(`Fetching all surveys for org: ${currentOrgId}`);
      setSurveysFetching(true);

      try {
        const raw = await fetchAllOrgSurveys(currentOrgId);
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.items)
          ? raw.items
          : [];

        console.log(`✅ Fetched ${list.length} surveys for org ${currentOrgId}`);
        setAllSurveys(list);
      } catch (error) {
        console.error("Error fetching org surveys:", error);
        setAllSurveys([]);
      } finally {
        setSurveysFetching(false);
      }
    },
    [fetchAllOrgSurveys]
  );

  useEffect(() => {
    if (orgId) {
      fetchOrgSurveys(orgId);
    } else {
      setAllSurveys([]);
    }
  }, [orgId, fetchOrgSurveys]);

  useEffect(() => {
    let cancelled = false;

    const fetchCounts = async () => {
      if (!Array.isArray(allSurveys) || allSurveys.length === 0) {
        setResponsesMap({});
        return;
      }

      console.log(`Fetching response counts for ${allSurveys.length} surveys`);
      setResponsesLoading(true);

      try {
        const countsObj = {};

        await Promise.all(
          allSurveys.map(async (s) => {
            const id = s.survey_id || s.id || s.surveyId;
            if (!id) return;

            try {
              const res = await countResponses(id);
              countsObj[id] = typeof res?.count === "number" ? res.count : 0;
            } catch (error) {
              console.error(`Error counting responses for survey ${id}:`, error);
              countsObj[id] = 0;
            }
          })
        );

        if (!cancelled) {
          console.log("Response counts:", countsObj);
          setResponsesMap(countsObj);
        }
      } catch (error) {
        console.error("Error fetching response counts:", error);
      } finally {
        if (!cancelled) setResponsesLoading(false);
      }
    };

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [allSurveys, countResponses]);

  const totalResponses = useMemo(() => {
    return Object.values(responsesMap).reduce((sum, count) => sum + count, 0);
  }, [responsesMap]);

  const projectAnalytics = useMemo(() => {
    if (!Array.isArray(projects) || projects.length === 0) {
      return {
        totalProjects: 0,
        totalSurveys: 0,
        avgProgress: 0,
        overdueCount: 0,
        activeProjects: 0,
        completedProjects: 0,
        statusCounts: {},
        projectsWithSurveys: 0,
        projectsWithoutSurveys: 0,
      };
    }

    let totalSurveys = 0;
    let progressSum = 0;
    let progressCount = 0;
    let overdueCount = 0;
    let activeProjects = 0;
    let completedProjects = 0;
    let projectsWithSurveys = 0;

    const statusCounts = Object.keys(STATUS_GROUPS).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    for (const p of projects) {
      const status = (p.status || "planning").toLowerCase();
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      }

      if (status === "in_progress") activeProjects += 1;
      if (status === "completed") completedProjects += 1;

      const surveysForProject = Array.isArray(p.surveyIds) ? p.surveyIds.length : 0;
      totalSurveys += surveysForProject;
      if (surveysForProject > 0) projectsWithSurveys += 1;

      if (typeof p.progressPercent === "number") {
        progressSum += p.progressPercent;
        progressCount += 1;
      }

      if (isOverdue(p)) overdueCount += 1;
    }

    const avgProgress =
      progressCount === 0 ? 0 : Math.round((progressSum / progressCount) * 10) / 10;

    return {
      totalProjects: projects.length,
      totalSurveys,
      avgProgress,
      overdueCount,
      activeProjects,
      completedProjects,
      statusCounts,
      projectsWithSurveys,
      projectsWithoutSurveys: projects.length - projectsWithSurveys,
    };
  }, [projects]);

  const surveyAnalytics = useMemo(() => {
    if (!Array.isArray(allSurveys) || allSurveys.length === 0) {
      return {
        totalSurveys: 0,
        avgQuestions: 0,
        activeSurveys: 0,
        draftSurveys: 0,
        archivedSurveys: 0,
        testSurveys: 0,
        statusCounts: {},
        avgResponsesPerSurvey: 0,
      };
    }

    const statusCounts = {};
    let totalQuestions = 0;
    let questionCounted = 0;
    let activeSurveys = 0;
    let draftSurveys = 0;
    let archivedSurveys = 0;
    let testSurveys = 0;

    for (const s of allSurveys) {
      const statusRaw = (s.status || "draft").toLowerCase();
      const key = SURVEY_STATUS_LABELS[statusRaw] ? statusRaw : "other";

      if (!statusCounts[key]) statusCounts[key] = 0;
      statusCounts[key] += 1;

      if (statusRaw === "active") activeSurveys += 1;
      if (statusRaw === "draft") draftSurveys += 1;
      if (statusRaw === "archived") archivedSurveys += 1;
      if (statusRaw === "test") testSurveys += 1;

      const qo = Array.isArray(s.question_order || s.questionOrder)
        ? s.question_order || s.questionOrder
        : [];
      if (qo.length) {
        totalQuestions += qo.length;
        questionCounted += 1;
      }
    }

    const avgQuestions =
      questionCounted === 0 ? 0 : Math.round((totalQuestions / questionCounted) * 10) / 10;

    const avgResponsesPerSurvey =
      allSurveys.length === 0 ? 0 : Math.round((totalResponses / allSurveys.length) * 10) / 10;

    return {
      totalSurveys: allSurveys.length,
      avgQuestions,
      activeSurveys,
      draftSurveys,
      archivedSurveys,
      testSurveys,
      statusCounts,
      avgResponsesPerSurvey,
    };
  }, [allSurveys, totalResponses]);

  const healthScore = useMemo(() => {
    const {
      totalProjects,
      avgProgress,
      overdueCount,
      activeProjects,
      completedProjects,
    } = projectAnalytics;

    if (totalProjects === 0) return 0;

    const progressScore = avgProgress;
    const overdueScore = Math.max(0, 100 - (overdueCount / totalProjects) * 100);
    const activeScore = (activeProjects / totalProjects) * 50;
    const completedScore = (completedProjects / totalProjects) * 50;

    const score =
      progressScore * 0.4 +
      overdueScore * 0.3 +
      activeScore * 0.15 +
      completedScore * 0.15;

    return Math.round(score);
  }, [projectAnalytics]);

  const engagementRate = useMemo(() => {
    if (surveyAnalytics.activeSurveys === 0) return 0;
    if (totalResponses === 0) return 0;
    return Math.round((totalResponses / surveyAnalytics.activeSurveys) * 10) / 10;
  }, [surveyAnalytics.activeSurveys, totalResponses]);

  const isLoading = surveysFetching || responsesLoading || surveyLoading;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-50">Organization Analytics</h2>
          <p className="text-sm text-slate-400 mt-1">
            Comprehensive insights across all projects and surveys
          </p>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading data...</span>
          </div>
        )}
      </div>

      {/* Debug Info - remove in production */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-slate-500 p-3 bg-slate-900/50 rounded border border-slate-800">
          <div>Directories: {projects?.length || 0}</div>
          <div>Surveys (org-wide): {allSurveys?.length || 0}</div>
          <div>Surveys Fetching: {surveysFetching ? "Yes" : "No"}</div>
          <div>Total Responses: {totalResponses}</div>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Target}
          label="Health Score"
          value={healthScore}
          suffix="/100"
          trend={healthScore >= 70 ? "up" : healthScore >= 50 ? "neutral" : "down"}
          subtitle={
            healthScore >= 70
              ? "Excellent performance"
              : healthScore >= 50
              ? "Moderate progress"
              : "Needs attention"
          }
          variant={healthScore >= 70 ? "success" : healthScore >= 50 ? "default" : "warning"}
        />
        <MetricCard
          icon={FolderKanban}
          label="Total Directories"
          value={projectAnalytics.totalProjects}
          subtitle={`${projectAnalytics.activeProjects} active • ${projectAnalytics.completedProjects} completed`}
        />
        <MetricCard
          icon={FileText}
          label="Total Surveys"
          value={surveyAnalytics.totalSurveys}
          subtitle={`${surveyAnalytics.activeSurveys} active • ${surveyAnalytics.draftSurveys} draft`}
          loading={surveysFetching || surveyLoading}
        />
        <MetricCard
          icon={Users}
          label="Total Responses"
          value={totalResponses}
          subtitle={`${engagementRate} avg per active survey`}
          loading={responsesLoading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MiniCard
          icon={Activity}
          label="Avg Progress"
          value={`${projectAnalytics.avgProgress}%`}
          sublabel="Across projects"
        />
        <MiniCard
          icon={AlertCircle}
          label="Overdue Directories"
          value={projectAnalytics.overdueCount}
          sublabel="Need attention"
          variant={projectAnalytics.overdueCount > 0 ? "warning" : "default"}
        />
        <MiniCard
          icon={ListChecks}
          label="Avg Questions"
          value={surveyAnalytics.avgQuestions}
          sublabel="Per survey"
        />
        <MiniCard
          icon={Zap}
          label="Engagement"
          value={surveyAnalytics.avgResponsesPerSurvey}
          sublabel="Responses/survey"
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Status Breakdown */}
        <StatusPanel
          title="Directory Status Distribution"
          data={Object.entries(STATUS_GROUPS).map(([key, label]) => ({
            key,
            label,
            count: projectAnalytics.statusCounts[key] || 0,
            total: projectAnalytics.totalProjects,
          }))}
          emptyMessage="No projects found. Create a project to see analytics."
        />

        {/* Survey Status Breakdown */}
        <StatusPanel
          title="Survey Status Distribution"
          data={Object.entries(SURVEY_STATUS_LABELS).map(([key, label]) => ({
            key,
            label,
            count: surveyAnalytics.statusCounts[key] || 0,
            total: surveyAnalytics.totalSurveys,
          }))}
          emptyMessage="No surveys found. Create a survey to see analytics."
          loading={surveysFetching || surveyLoading}
        />
      </div>

      {/* Insights Panel */}
      <InsightsPanel
        projectAnalytics={projectAnalytics}
        surveyAnalytics={surveyAnalytics}
        healthScore={healthScore}
        totalResponses={totalResponses}
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
  subtitle,
  trend,
  variant,
  loading,
}) {
  const Icon = icon;
  suffix = suffix || "";
  variant = variant || "default";
  loading = loading || false;

  const variantClasses = {
    success: "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5",
    warning: "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-600/5",
    default: "border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-slate-900/40",
  };

  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };

  return (
    <div
      className={`rounded-2xl border p-5 md:p-6 flex flex-col gap-3 transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl hover:border-slate-700/60 ${variantClasses[variant]}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <span className="rounded-xl bg-slate-800/90 p-2.5 shadow-md">
          <Icon className="h-4 w-4 text-slate-200" />
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-slate-50 tracking-tight">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin inline-block" />
          ) : (
            value
          )}
        </span>
        {suffix && !loading && (
          <span className="text-lg font-medium text-slate-400">{suffix}</span>
        )}
        {trend && !loading && (
          <TrendingUp
            className={`h-4 w-4 ml-auto ${trendColors[trend]} ${
              trend === "down" ? "rotate-180" : ""
            }`}
          />
        )}
      </div>
      {subtitle && (
        <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

function MiniCard({ icon, label, value, sublabel, variant }) {
  const Icon = icon;
  variant = variant || "default";

  const variantClasses = {
    warning: "border-amber-500/30 bg-amber-500/5",
    default: "border-slate-800/50 bg-slate-900/30",
  };

  return (
    <div
      className={`rounded-xl border p-4 flex items-center gap-3 transition-all duration-200 hover:border-slate-700/60 ${variantClasses[variant]}`}
    >
      <span className="rounded-lg bg-slate-800/80 p-2">
        <Icon className="h-4 w-4 text-slate-300" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 truncate">{label}</p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold text-slate-50">{value}</span>
          {sublabel && (
            <span className="text-xs text-slate-500">{sublabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  title,
  data,
  emptyMessage,
  loading,
}) {
  loading = loading || false;
  const hasData = data.some((item) => item.count > 0);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-slate-900/40 backdrop-blur-sm p-6 shadow-xl">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-slate-900/40 backdrop-blur-sm p-5 md:p-6 space-y-5 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
          {title}
        </h3>
        {hasData && (
          <span className="text-xs text-slate-400 font-medium">
            {data[0]?.total || 0} total
          </span>
        )}
      </div>

      {!hasData ? (
        <p className="text-sm text-slate-400 py-4">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {data
            .filter((item) => item.count > 0)
            .map((item) => {
              const pct =
                item.total === 0 ? 0 : Math.round((item.count / item.total) * 100);
              return (
                <StatusRow
                  key={item.key}
                  label={item.label}
                  count={item.count}
                  percent={pct}
                />
              );
            })}
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, count, percent }) {
  return (
    <div className="flex flex-col gap-2 group">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="text-slate-400 font-semibold">
          {count} <span className="text-slate-500">•</span> {percent}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-800/80 overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-500 ease-out shadow-sm group-hover:shadow-sky-500/50"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function InsightsPanel({
  projectAnalytics,
  surveyAnalytics,
  healthScore,
  totalResponses,
}) {
  const insights = useMemo(() => {
    const items = [];

    if (healthScore >= 70) {
      items.push({
        type: "success",
        icon: CheckCircle2,
        message: "Organization health is strong with excellent project progress",
      });
    } else if (healthScore < 50) {
      items.push({
        type: "warning",
        icon: AlertCircle,
        message: "Organization needs attention to improve overall health metrics",
      });
    }

    if (projectAnalytics.overdueCount > 0) {
      items.push({
        type: "warning",
        icon: Clock3,
        message: `${projectAnalytics.overdueCount} project${
          projectAnalytics.overdueCount > 1 ? "s are" : " is"
        } overdue and require immediate action`,
      });
    }

    if (surveyAnalytics.activeSurveys > 0 && totalResponses > 0) {
      const avgResponses = Math.round(
        totalResponses / surveyAnalytics.activeSurveys
      );
      items.push({
        type: "success",
        icon: TrendingUp,
        message: `Strong engagement with ${avgResponses} responses per active survey`,
      });
    } else if (surveyAnalytics.activeSurveys > 0 && totalResponses === 0) {
      items.push({
        type: "info",
        icon: Users,
        message: "Active surveys are awaiting responses to gather insights",
      });
    }

    if (surveyAnalytics.draftSurveys > 3) {
      items.push({
        type: "info",
        icon: ListChecks,
        message: `${surveyAnalytics.draftSurveys} draft surveys ready to be activated`,
      });
    }

    if (projectAnalytics.activeProjects > 0) {
      const percentage = Math.round(
        (projectAnalytics.activeProjects / projectAnalytics.totalProjects) * 100
      );
      items.push({
        type: "success",
        icon: Activity,
        message: `${percentage}% of projects (${projectAnalytics.activeProjects}) are actively in progress`,
      });
    }

    if (projectAnalytics.projectsWithoutSurveys > 0) {
      items.push({
        type: "info",
        icon: FileText,
        message: `${projectAnalytics.projectsWithoutSurveys} project${
          projectAnalytics.projectsWithoutSurveys > 1 ? "s" : ""
        } could benefit from surveys to gather feedback`,
      });
    }

    return items;
  }, [projectAnalytics, surveyAnalytics, healthScore, totalResponses]);

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-slate-900/40 backdrop-blur-sm p-5 md:p-6 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Key Insights
        </h3>
        <p className="text-sm text-slate-400 mt-4">
          Create projects and surveys to start seeing insights about your organization.
        </p>
      </div>
    );
  }

  const typeStyles = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-300",
    info: "border-sky-500/30 bg-sky-500/5 text-sky-300",
  };

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-gradient-to-br from-slate-900/60 to-slate-900/40 backdrop-blur-sm p-5 md:p-6 space-y-4 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider flex items-center gap-2">
        <Zap className="h-4 w-4" />
        Key Insights
      </h3>
      <div className="space-y-3">
        {insights.map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${typeStyles[insight.type]}`}
            >
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm leading-relaxed">{insight.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}