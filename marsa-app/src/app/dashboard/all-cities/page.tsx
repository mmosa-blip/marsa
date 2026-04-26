"use client";

/**
 * Admin "unified city" view at /dashboard/all-cities.
 *
 * Renders the SAME canvas city as /dashboard/executor-city but pulls
 * data from /api/admin/all-cities, which returns every project (not
 * filtered by assignee). Each building also gets a small executor-name
 * label above it so admins can tell whose work belongs to which tower.
 *
 * Permission: ADMIN / MANAGER only.
 *
 * The per-executor /dashboard/executor-city page is intentionally left
 * untouched — both pages coexist, executors keep their personal city.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Building2 } from "lucide-react";
import CityCanvas, { CityApiProject } from "@/components/city/CityCanvas";
import CityStatsBar from "@/components/city/CityStatsBar";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/lib/logger";

export default function AllCitiesPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<CityApiProject[] | null>(null);
  // Optional filter — show only one executor's buildings. null = all.
  const [executorFilter, setExecutorFilter] = useState<string | null>(null);

  // Hard role gate. Middleware already blocks /api/admin/* for non-staff,
  // but the page itself is reachable by any signed-in user, so we redirect
  // non-admins to the dashboard the moment we know their role.
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect("/dashboard");
      }
    }
  }, [status, session]);

  useEffect(() => {
    fetch("/api/admin/all-cities")
      .then((r) => r.json())
      .then((d) => {
        const list: CityApiProject[] = Array.isArray(d?.projects) ? d.projects : [];
        setProjects(list);
      })
      .catch((err) => {
        logger.error("all-cities: failed to fetch projects", err);
        setProjects([]);
      });
  }, []);

  if (status === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  const filteredProjects = projects
    ? executorFilter
      ? projects.filter((p) => (p.executors || []).some((e) => e.id === executorFilter))
      : projects
    : null;

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">
      <div className="flex-shrink-0 px-6 pt-4 pb-2 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <Building2 size={22} style={{ color: "#C9A84C" }} />
            مدينة المنفذين الموحّدة
          </h1>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
            كل مشاريع كل المنفذين في عرض واحد
          </p>
        </div>
        {projects && projects.length > 0 && (() => {
          const allExecs = new Map<string, string>();
          for (const p of projects) for (const e of p.executors || []) allExecs.set(e.id, e.name);
          const list = Array.from(allExecs.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar"));
          if (list.length === 0) return null;
          return (
            <select
              value={executorFilter ?? ""}
              onChange={(e) => setExecutorFilter(e.target.value || null)}
              className="px-4 py-2 rounded-xl text-sm bg-white"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
            >
              <option value="">كل المنفذين ({list.length})</option>
              {list.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          );
        })()}
      </div>

      {filteredProjects && filteredProjects.length > 0 && (
        <CityStatsBar projects={filteredProjects} />
      )}

      {!projects && (
        <div
          className="flex-shrink-0 mx-4 lg:mx-6 bg-white rounded-2xl flex items-center justify-center"
          style={{ height: "clamp(180px, 35vh, 400px)", border: "1px solid #E2E0D8" }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      )}

      {projects && projects.length === 0 && (
        <div
          className="flex-shrink-0 mx-4 lg:mx-6 bg-white rounded-2xl flex flex-col items-center justify-center"
          style={{ height: "clamp(180px, 35vh, 400px)", border: "1px solid #E2E0D8" }}
        >
          <Building2 size={32} className="mb-2" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#6B7280" }}>لا توجد مشاريع لعرضها بعد</p>
        </div>
      )}

      {filteredProjects && filteredProjects.length > 0 && (
        <CityCanvas projects={filteredProjects} viewMode="admin" />
      )}

      {projects && projects.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-6 mt-3">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {projects.map((p) => (
              <a
                key={p.id}
                href={`/dashboard/projects/${p.id}`}
                title={p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 max-w-[260px]"
                style={{
                  backgroundColor: "white",
                  color: "#1C1B2E",
                  border: "1px solid #E2E0D8",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.department?.color || "#C9A84C" }}
                />
                <span className="truncate">{p.name}</span>
                {p.projectCode && (
                  <span
                    className="text-[9px] font-mono font-bold flex-shrink-0 px-1 py-0.5 rounded"
                    style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                  >
                    {p.projectCode}
                  </span>
                )}
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: "#9CA3AF" }}>
                  {p.completedTasks}/{p.totalTasks}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
