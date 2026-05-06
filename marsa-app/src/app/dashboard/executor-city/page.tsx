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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Building2, Trophy, Archive, X, Calendar, Clock } from "lucide-react";
import { getEffectiveDeadline } from "@/lib/project-deadline";
import MyTasksView from "@/components/MyTasksView";
import CityCanvas, {
  CityApiProject,
  isProjectComplete,
  getBuildingState,
} from "@/components/city/CityCanvas";
import CityStatsBar from "@/components/city/CityStatsBar";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/lib/logger";
import { pusherClient } from "@/lib/pusher-client";

interface BuilderTier {
  name: string;
  color: string;
  bg: string;
  border: string;
}

// Three tiers awarded purely on count of fully-completed buildings the
// executor has. Below 3 we show no badge so the early-state UI stays
// uncluttered.
function getBuilderTier(completedCount: number): BuilderTier | null {
  if (completedCount >= 15) {
    return { name: "بنّاء ذهبي", color: "#C9A84C", bg: "rgba(201,168,76,0.14)", border: "rgba(201,168,76,0.45)" };
  }
  if (completedCount >= 7) {
    return { name: "بنّاء فضي", color: "#94A3B8", bg: "rgba(148,163,184,0.16)", border: "rgba(148,163,184,0.45)" };
  }
  if (completedCount >= 3) {
    return { name: "بنّاء برونزي", color: "#CD7F32", bg: "rgba(205,127,50,0.14)", border: "rgba(205,127,50,0.45)" };
  }
  return null;
}

export default function ExecutorCityPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<CityApiProject[] | null>(null);
  // Project picker — null until the first fetch resolves; a project is always
  // selected after that so the embedded tasks view stays focused.
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);
  // Archive drawer — opt-in view of COMPLETED + COLLAPSED projects so
  // the main grid stays focused on what still needs work.
  const [archiveOpen, setArchiveOpen] = useState(false);
  // Auto-select runs once on the very first response. Real-time refetches
  // update `projects` without ever stomping on the user's current pick.
  const initialSelectDoneRef = useRef(false);
  // Celebration token — incrementing key + projectId is read by CityCanvas
  // to play a one-shot ring animation on the building of the completed task.
  const [celebrate, setCelebrate] = useState<{ key: number; projectId: string } | null>(null);

  const refetch = useCallback(() => {
    fetch("/api/projects?withServices=true")
      .then((r) => r.json())
      .then((d) => {
        const list: CityApiProject[] = Array.isArray(d) ? d : [];
        setProjects(list);

        if (!initialSelectDoneRef.current && list.length > 0) {
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
          initialSelectDoneRef.current = true;
        }
      })
      .catch((err) => {
        logger.error("executor-city: failed to fetch projects", err);
        setProjects([]);
      });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // ── Pusher real-time wiring ──
  // Public channel "task-updates": the server can broadcast lightweight
  // signals here whenever a task moves status. We coalesce bursts behind
  // a 500ms trailing debounce so a "all-tasks-done" cascade triggers one
  // refetch, not N. `task-completed` additionally fires a celebration on
  // its building so the user sees the immediate effect.
  useEffect(() => {
    if (!pusherClient) return;
    let timer: number | undefined;
    const debouncedRefetch = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => refetch(), 500);
    };
    const channel = pusherClient.subscribe("task-updates");
    channel.bind("status-changed", debouncedRefetch);
    channel.bind("task-completed", (payload: { projectId?: string }) => {
      debouncedRefetch();
      if (payload?.projectId) {
        setCelebrate({ key: Date.now(), projectId: payload.projectId });
      }
    });
    return () => {
      if (timer) window.clearTimeout(timer);
      channel.unbind_all();
      pusherClient.unsubscribe("task-updates");
    };
  }, [refetch]);

  // Tier badge counts only fully-complete projects. Routed through the
  // shared isProjectComplete helper so the canvas, stats bar and badge
  // never disagree on what counts as "done".
  const completedCount = useMemo(() => {
    if (!projects) return 0;
    return projects.reduce((acc, p) => acc + (isProjectComplete(p) ? 1 : 0), 0);
  }, [projects]);

  // Split into "active" (still needs work) vs "archived" (truly done).
  // Only state=COMPLETED goes to the archive — COLLAPSED projects have
  // a blown deadline but their tasks may still be in flight, and
  // hiding them from the executor's grid was effectively hiding
  // unfinished work.
  //
  // Sort priority within active: COLLAPSED first (deadline blown —
  // most urgent), then TASK_LATE, AT_RISK, the paused-family states,
  // then plain IN_PROGRESS. Tiebreak by closest deadline.
  const STATE_PRIORITY: Record<string, number> = {
    COLLAPSED: 0,
    TASK_LATE: 1,
    AT_RISK: 2,
    PAYMENT_FROZEN: 3,
    CLIENT_HOLD: 4,
    ADMIN_PAUSED: 5,
    IN_PROGRESS: 6,
    COMPLETED: 99,
  };

  const { activeProjects, archivedProjects } = useMemo(() => {
    if (!projects) return { activeProjects: [], archivedProjects: [] };
    const active: CityApiProject[] = [];
    const archived: CityApiProject[] = [];
    for (const p of projects) {
      const isComplete = isProjectComplete(p);
      const state = getBuildingState({ ...p, isComplete });
      if (state === "COMPLETED") {
        archived.push(p);
      } else {
        active.push(p);
      }
    }
    active.sort((a, b) => {
      const aState = getBuildingState({ ...a, isComplete: isProjectComplete(a) });
      const bState = getBuildingState({ ...b, isComplete: isProjectComplete(b) });
      const ap = STATE_PRIORITY[aState] ?? 50;
      const bp = STATE_PRIORITY[bState] ?? 50;
      if (ap !== bp) return ap - bp;
      // Tiebreak by effective deadline (earliest of project.endDate,
      // contractEndDate, contract.endDate). Ascending = most urgent /
      // most overdue first — matches CityCanvas's in-bucket order.
      const aDl = getEffectiveDeadline(a);
      const bDl = getEffectiveDeadline(b);
      const aT = aDl ? aDl.getTime() : Infinity;
      const bT = bDl ? bDl.getTime() : Infinity;
      return aT - bT;
    });
    return { activeProjects: active, archivedProjects: archived };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const tier = getBuilderTier(completedCount);
  const tierBadge = tier ? (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        backgroundColor: tier.bg,
        border: `1px solid ${tier.border}`,
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
      }}
      title={`${tier.name} — ${completedCount} مبنى مكتمل`}
    >
      <Trophy size={16} style={{ color: tier.color }} />
      <span className="text-xs font-bold" style={{ color: tier.color }}>
        {tier.name}
      </span>
      <span
        className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
        style={{ backgroundColor: "rgba(255,255,255,0.7)", color: tier.color }}
      >
        {completedCount}
      </span>
    </div>
  ) : null;

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

      {projects && projects.length > 0 && <CityStatsBar projects={projects} />}

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
        <CityCanvas
          projects={projects}
          viewMode="executor"
          topRightBadge={tierBadge}
          celebrate={celebrate}
        />
      )}

      {projects && projects.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-6 mt-3">
          {/* Wrapping grid — every active project visible in one shot,
              no scroll. Sorted by urgency (TASK_LATE first), then by
              closest deadline. Completed/collapsed land in the archive
              drawer instead. */}
          <div className="flex items-start gap-2 flex-wrap pb-2">
            {activeProjects.map((p) => (
              <ProjectChip
                key={p.id}
                project={p}
                isActive={pickedProjectId === p.id}
                onClick={() => setPickedProjectId(p.id)}
              />
            ))}
            {archivedProjects.length > 0 && (
              <button
                type="button"
                onClick={() => setArchiveOpen(true)}
                title="عرض المشاريع المكتملة"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:brightness-105"
                style={{
                  backgroundColor: "rgba(148,163,184,0.10)",
                  border: "1px dashed rgba(148,163,184,0.45)",
                  color: "#475569",
                }}
              >
                <Archive size={13} />
                الأرشيف
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "rgba(148,163,184,0.20)" }}
                >
                  {archivedProjects.length}
                </span>
              </button>
            )}
            {activeProjects.length === 0 && (
              <p className="text-xs px-1 py-2" style={{ color: "#9CA3AF" }}>
                لا توجد مشاريع نشطة حالياً.
                {archivedProjects.length > 0 && " افتح الأرشيف لعرض المنتهية."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Archive drawer */}
      {archiveOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setArchiveOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-3xl shadow-2xl max-h-[80vh] flex flex-col"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Archive size={18} style={{ color: "#5E5495" }} />
                <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                  أرشيف المشاريع
                </h3>
                <span
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                >
                  {archivedProjects.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "#9CA3AF" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {archivedProjects.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "#9CA3AF" }}>
                  لا توجد مشاريع مؤرشفة.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {archivedProjects.map((p) => (
                    <ProjectChip
                      key={p.id}
                      project={p}
                      isActive={pickedProjectId === p.id}
                      onClick={() => {
                        setPickedProjectId(p.id);
                        setArchiveOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
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

// ─── ProjectChip ────────────────────────────────────────────────────────
// Compact project card for the picker grid. Shows project name (truncated),
// client name underneath, a colored status dot per BuildingState, and the
// task progress fraction. Highlights when active (the project the executor
// is currently focused on).

const STATE_DOT: Record<string, { color: string; label: string }> = {
  TASK_LATE: { color: "#DC2626", label: "متأخر" },
  AT_RISK: { color: "#EA580C", label: "متهالك" },
  COLLAPSED: { color: "#7F1D1D", label: "منهار" },
  PAYMENT_FROZEN: { color: "#A855F7", label: "مجمّد" },
  ADMIN_PAUSED: { color: "#A16207", label: "متوقف" },
  CLIENT_HOLD: { color: "#475569", label: "بانتظار العميل" },
  COMPLETED: { color: "#16A34A", label: "مكتمل" },
  IN_PROGRESS: { color: "#2563EB", label: "جارٍ" },
};

function ProjectChip({
  project,
  isActive,
  onClick,
}: {
  project: CityApiProject;
  isActive: boolean;
  onClick: () => void;
}) {
  const isComplete = isProjectComplete(project);
  const state = getBuildingState({ ...project, isComplete });
  const dot = STATE_DOT[state] ?? STATE_DOT.IN_PROGRESS;
  const clientName = project.client?.name ?? null;

  // Contract date — earliest of signedAt → createdAt → null. Formatted
  // DD/MM/YYYY using the user's locale-agnostic Arabic-Latin numerals
  // so it lines up with the rest of the city UI.
  const signedRaw = project.contract?.signedAt ?? project.contract?.createdAt ?? null;
  const signedLabel = signedRaw
    ? (() => {
        const d = new Date(signedRaw);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `${dd}/${mm}/${d.getFullYear()}`;
      })()
    : null;

  // Days remaining (negative = overdue). We call getEffectiveDeadline
  // directly (instead of daysRemainingForProject) because the helper
  // clamps to 0, hiding overdue rows.
  const deadline = getEffectiveDeadline(project);
  const daysDelta = deadline
    ? Math.ceil((deadline.getTime() - Date.now()) / 86400000)
    : null;

  const daysLabel: string | null =
    daysDelta == null
      ? null
      : daysDelta > 0
        ? `متبقي ${daysDelta} يوم`
        : daysDelta === 0
          ? "تنتهي اليوم"
          : `متأخر ${Math.abs(daysDelta)} يوم`;

  const daysColor: string =
    daysDelta == null
      ? "#9CA3AF"
      : daysDelta <= 0
        ? "#DC2626"
        : daysDelta <= 7
          ? "#EA580C"
          : daysDelta <= 30
            ? "#A16207"
            : "#16A34A";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${project.projectCode ? project.projectCode + " — " : ""}${project.name}${clientName ? " — " + clientName : ""} (${dot.label})`}
      className="rounded-xl text-right transition-all flex flex-col gap-0.5 min-w-[180px] max-w-[240px]"
      style={
        isActive
          ? {
              backgroundColor: "#5E5495",
              color: "white",
              boxShadow: "0 2px 8px rgba(94,84,149,0.35)",
              border: "1.5px solid #5E5495",
              padding: "8px 10px",
            }
          : {
              backgroundColor: "white",
              color: "#1C1B2E",
              border: "1px solid #E2E0D8",
              padding: "8px 10px",
            }
      }
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: isActive ? "#FFFFFF" : dot.color }}
          title={dot.label}
        />
        <span className="text-xs font-bold truncate flex-1">{project.name}</span>
        {project.projectCode && (
          <span
            className="text-[9px] font-mono font-bold flex-shrink-0 px-1 py-0.5 rounded"
            style={{
              backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "rgba(94,84,149,0.1)",
              color: isActive ? "#FFFFFF" : "#5E5495",
            }}
          >
            {project.projectCode}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <span
          className="text-[10px] truncate"
          style={{ color: isActive ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}
        >
          {clientName ?? "—"}
        </span>
        <span
          className="text-[10px] font-bold flex-shrink-0 font-mono"
          style={{ color: isActive ? "rgba(255,255,255,0.85)" : "#9CA3AF" }}
        >
          {project.completedTasks}/{project.totalTasks}
        </span>
      </div>
      {(signedLabel || daysLabel) && (
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {signedLabel && (
            <span
              className="text-[9px] inline-flex items-center gap-0.5 font-mono"
              style={{
                color: isActive ? "rgba(255,255,255,0.7)" : "#9CA3AF",
                direction: "ltr",
              }}
            >
              <Calendar size={9} />
              {signedLabel}
            </span>
          )}
          {daysLabel && (
            <span
              className="text-[9px] inline-flex items-center gap-0.5 font-bold"
              style={{
                color: isActive ? "rgba(255,255,255,0.95)" : daysColor,
              }}
            >
              <Clock size={9} />
              {daysLabel}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

