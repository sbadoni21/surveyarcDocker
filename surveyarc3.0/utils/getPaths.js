"use client";
import { usePathname } from "next/navigation";

export function useRouteParams() {
  const pathname = usePathname();
  const pathParts = pathname.split("/");

  const orgId = pathParts[3] || null;
  const projectId = pathParts[6] || null;
  const surveyId = pathParts[7] || null;

  return { orgId, projectId, surveyId };
}
