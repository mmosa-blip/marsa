"use client";

/**
 * Unified executor workspace at /dashboard/executor-city.
 *
 * Two stacked sections, both always visible — no view toggle:
 *   1. مدينتي — gamified canvas city via the shared CityCanvas component.
 *   2. مهامي — the regular tasks list, embedded via MyTasksView.
 *
 * /dashboard/my-tasks redirects here.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Building2 } from "lucide-react";
import MyTasksView from "@/components/MyTasksView";
import CityCanvas, { CityApiProject } from "@/components/city/CityCanvas";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/lib/logger";

export default function ExecutorCityPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<CityApiProject[] | null>(null);
  // Project picker — null until the first fetch resolves; a project is always
  // selected after that so the embedded tasks view stays focused.
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);

  // Fetch projects with services for the city. After loading, auto-select
  // the most delayed project so the executor lands on highest-priority work.
  useEffect(() => {
    fetch("/api/projects?withServices=true")
      .then((r) => r.json())
      .then((d) => {
        const list: CityApiProject[] = Array.isArray(d) ? d : [];
        setProjects(list);

        if (list.length > 0) {
          const now = Date.now();
          const sorted = [...list].sort((a, b) => {
            const aLate = (a.tasks || []).filter(
              (t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "DONE" && t.status !== "CANCELLED"
            ).length;
            const bLate = (b.tasks || []).filter(
              (t) => t.dueDate && new Date(t.dueDate).getTime() < now && t.status !== "DONE" && t.status !== "CANCELLED"
            ).length;
            if (bLate !== aLate) return bLate - aLate;
            const aEnd = a.contractEndDate ? new Date(a.contractEndDate).getTime() : Infinity;
            const bEnd = b.contractEndDate ? new Date(b.contractEndDate).getTime() : Infinity;
            return aEnd - bEnd;
          });
          setPickedProjectId(sorted[0].id);
        }
      })
      .catch((err) => {
        logger.error("executor-city: failed to fetch projects", err);
        setProjects([]);
      });
  }, []);

  if (status === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">
      <div className="flex-shrink-0 px-6 pt-4 pb-2">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Building2 size={22} style={{ color: "#C9A84C" }} />
          مدينتي
        </h1>
      </div>

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

      {projects && projects.length > 0 && (
        <CityCanvas projects={projects} viewMode="executor" />
      )}

      {projects && projects.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-6 mt-3">
          <div
            className="flex items-center gap-2 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "thin" }}
          >
            {projects.map((p) => {
              const active = pickedProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  // Always select — no toggle-off. A project is always
                  // active so the executor sees a focused task list.
                  onClick={() => setPickedProjectId(p.id)}
                  title={p.projectCode ? `${p.projectCode} — ${p.name}` : p.name}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 max-w-[260px]"
                  style={
                    active
                      ? {
                          backgroundColor: "#5E5495",
                          color: "white",
                          boxShadow: "0 2px 6px rgba(94,84,149,0.3)",
                          border: "1px solid #5E5495",
                        }
                      : {
                          backgroundColor: "white",
                          color: "#1C1B2E",
                          border: "1px solid #E2E0D8",
                        }
                  }
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: active ? "#FFFFFF" : (p.department?.color || "#C9A84C") }}
                  />
                  <span className="truncate">{p.name}</span>
                  {p.projectCode && (
                    <span
                      className="text-[9px] font-mono font-bold flex-shrink-0 px-1 py-0.5 rounded"
                      style={{
                        backgroundColor: active ? "rgba(255,255,255,0.2)" : "rgba(94,84,149,0.1)",
                        color: active ? "#FFFFFF" : "#5E5495",
                      }}
                    >
                      {p.projectCode}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold flex-shrink-0"
                    style={{ color: active ? "rgba(255,255,255,0.8)" : "#9CA3AF" }}
                  >
                    {p.completedTasks}/{p.totalTasks}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-shrink-0 mt-1">
        <MyTasksView
          key={pickedProjectId || "__all__"}
          projectId={pickedProjectId || undefined}
        />
      </div>
    </div>
  );
}
