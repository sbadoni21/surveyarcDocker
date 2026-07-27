"use client";
import { usePathname } from "next/navigation";

export function useRouteParams() {
  const pathname = usePathname();
  const parts = String(pathname || "")
    .split("/")
    .filter(Boolean);

  const locale = parts[0] || null;
  const appMode = ["org", "postgres-org"].includes(parts[1]) ? parts[1] : null;
  const orgId = appMode ? parts[2] || null : null;

  const projectsIdx = parts.indexOf("projects");
  const projectId = projectsIdx >= 0 ? parts[projectsIdx + 1] || null : null;
  const surveyId = projectsIdx >= 0 ? parts[projectsIdx + 2] || null : null;

  const dashboardBase =
    locale && appMode && orgId ? `/${locale}/${appMode}/${orgId}/dashboard` : null;

  return { locale, appMode, orgId, projectId, surveyId, dashboardBase };
}
