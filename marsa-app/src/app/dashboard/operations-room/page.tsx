"use client";

/**
 * Operations Room — admin/manager command center for project, service, and
 * task assignment. Replaces the old service-provider-mappings UI.
 *
 * Three tabs:
 *   1. المشاريع — project cards with progress + status badges, click to see
 *      currently linked executors and re-assign.
 *   2. الخدمات — flat service list with project name + executors + assign.
 *   3. المهام — unassigned / late task lists with per-task assign.
 *
 * All assignment actions hit POST /api/operations/assign and refresh the
 * overview locally without a full reload.
 */

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Loader2,
  X,
  FolderKanban,
  Layers,
  ListChecks,
  AlertTriangle,
  UserPlus,
  Radio,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface OverviewProject {
  id: string;
  name: string;
  department: { id: string; name: string; color: string | null } | null;
  progress: number;
  taskStats: { late: number; active: number; done: number };
}

interface OverviewExecutor {
  id: string;
  name: string;
  initials: string;
  activeTasks: number;
  lateTasks: number;
  loadPercent: number;
}

interface OverviewResponse {
  projects: OverviewProject[];
  executors: OverviewExecutor[];
}

interface DetailService {
  id: string;
  name: string;
  status: string | null;
  projectId: string;
  projectName: string;
  executors: { id: string; name: string }[];
}

interface DetailTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  serviceName: string | null;
  projectId: string | null;
  projectName: string | null;
  assignee: { id: string; name: string } | null;
}

type AssignTarget =
  | { type: "project"; targetId: string; label: string }
  | { type: "service"; targetId: string; label: string }
  | { type: "task"; targetId: string; label: string };

type Tab = "projects" | "services" | "tasks";
type TaskFilter = "unassigned" | "late";

export default function OperationsRoomPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<Tab>("projects");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Detail data fetched lazily per tab
  const [services, setServices] = useState<DetailService[] | null>(null);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [tasks, setTasks] = useState<DetailTask[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("unassigned");

  // Project drill-down panel
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  // Assign modal
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [assigning, setAssigning] = useState(false);

  // ── Auth gate ──
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect("/dashboard");
      }
    }
  }, [status, session]);

  // ── Fetch overview on mount ──
  const refreshOverview = () => {
    setLoading(true);
    fetch("/api/operations/overview")
      .then((r) => r.json())
      .then((d: OverviewResponse | { error: string }) => {
        if ("error" in d) {
          setError(d.error);
        } else {
          setOverview(d);
          setError("");
        }
      })
      .catch(() => setError("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { refreshOverview(); }, []);

  // ── Lazy-load services list when entering "services" tab ──
  const loadServices = () => {
    setServicesLoading(true);
    fetch("/api/projects?withServices=true")
      .then((r) => r.json())
      .then((projects: Array<{ id: string; name: string; services?: Array<{ id: string; name: string; status: string | null; tasks?: Array<{ id: string; assigneeId: string | null; assignee?: { id: string; name: string } | null }> }> }>) => {
        const flat: DetailService[] = [];
        for (const p of projects || []) {
          for (const s of p.services || []) {
            // Distinct assignees on the service's tasks form the "executors" list
            const seen = new Map<string, string>();
            for (const t of s.tasks || []) {
              if (t.assignee?.id && !seen.has(t.assignee.id)) {
                seen.set(t.assignee.id, t.assignee.name);
              }
            }
            flat.push({
              id: s.id,
              name: s.name,
              status: s.status,
              projectId: p.id,
              projectName: p.name,
              executors: Array.from(seen, ([id, name]) => ({ id, name })),
            });
          }
        }
        setServices(flat);
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  };

  // ── Lazy-load tasks when entering "tasks" tab ──
  const loadTasks = () => {
    setTasksLoading(true);
    fetch("/api/operations/tasks-pool")
      .then(async (r) => {
        if (r.status === 404) {
          // No dedicated endpoint — fall back to scanning projects+services
          return fetch("/api/projects?withServices=true").then((r2) => r2.json()).then((projects: Array<{
            id: string; name: string;
            services?: Array<{
              id: string; name: string;
              tasks?: Array<{ id: string; title?: string; status: string; dueDate?: string | null; assigneeId?: string | null; assignee?: { id: string; name: string } | null }>;
            }>;
          }>) => {
            const flat: DetailTask[] = [];
            for (const p of projects || []) {
              for (const s of p.services || []) {
                for (const t of s.tasks || []) {
                  flat.push({
                    id: t.id,
                    title: t.title || "—",
                    status: t.status,
                    dueDate: t.dueDate || null,
                    serviceName: s.name,
                    projectId: p.id,
                    projectName: p.name,
                    assignee: t.assignee || null,
                  });
                }
              }
            }
            return { tasks: flat };
          });
        }
        return r.json();
      })
      .then((data: { tasks: DetailTask[] }) => setTasks(data.tasks || []))
      .catch(() => setTasks([]))
      .finally(() => setTasksLoading(false));
  };

  // Trigger lazy loads when the user opens a tab for the first time
  useEffect(() => {
    if (tab === "services" && services === null && !servicesLoading) loadServices();
    if (tab === "tasks" && tasks === null && !tasksLoading) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Assign action ──
  const performAssign = async (userId: string) => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/operations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: assignTarget.type,
          targetId: assignTarget.targetId,
          userId,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "تعذّر تنفيذ الإسناد");
        return;
      }
      // Refresh overview + relevant detail list
      refreshOverview();
      if (assignTarget.type === "service" || assignTarget.type === "project") {
        if (services !== null) loadServices();
      }
      if (assignTarget.type === "task" || assignTarget.type === "service") {
        if (tasks !== null) loadTasks();
      }
      setAssignTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setAssigning(false);
    }
  };

  // ── Project drill-down: derive currently-linked executors from services list ──
  const projectExecutors = useMemo(() => {
    if (!openProjectId || !services) return [];
    const map = new Map<string, string>();
    for (const s of services) {
      if (s.projectId !== openProjectId) continue;
      for (const e of s.executors) if (!map.has(e.id)) map.set(e.id, e.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [openProjectId, services]);

  // Lazy-load services if we open a project drill-down before entering the tab
  useEffect(() => {
    if (openProjectId && services === null && !servicesLoading) loadServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProjectId]);

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");

  const tabs: { id: Tab; label: string; icon: typeof FolderKanban }[] = [
    { id: "projects", label: "المشاريع", icon: FolderKanban },
    { id: "services", label: "الخدمات", icon: Layers },
    { id: "tasks", label: "المهام", icon: ListChecks },
  ];

  const filteredTasks = (tasks || []).filter((t) => {
    if (taskFilter === "unassigned") return !t.assignee;
    if (taskFilter === "late") {
      return (
        t.dueDate &&
        new Date(t.dueDate) < new Date() &&
        t.status !== "DONE" &&
        t.status !== "CANCELLED"
      );
    }
    return true;
  });

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <Radio size={24} style={{ color: "#C9A84C" }} />
            غرفة العمليات
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            مركز إسناد المنفذين على المشاريع والخدمات والمهام
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-xl mb-6 max-w-md" style={{ backgroundColor: "#F0EEF5", border: "1px solid #E2E0D8" }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={
                active
                  ? { backgroundColor: "#5E5495", color: "white", boxShadow: "0 2px 6px rgba(94,84,149,0.3)" }
                  : { backgroundColor: "transparent", color: "#6B7280" }
              }
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Loading / error */}
      {loading && (
        <div className="bg-white rounded-2xl p-12 flex justify-center" style={{ border: "1px solid #E2E0D8" }}>
          <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      )}
      {error && !loading && (
        <div className="bg-white rounded-2xl p-6 text-center text-sm" style={{ border: "1px solid #FCA5A5", color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* ─── PROJECTS TAB ─── */}
      {!loading && !error && tab === "projects" && overview && (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${openProjectId ? "lg:grid-cols-2" : "lg:grid-cols-3"} gap-4`}>
          <div className={`${openProjectId ? "lg:col-span-1" : "lg:col-span-3"} grid grid-cols-1 md:grid-cols-2 ${openProjectId ? "" : "lg:grid-cols-3"} gap-4`}>
            {overview.projects.length === 0 && (
              <p className="col-span-full text-center text-sm py-8" style={{ color: "#9CA3AF" }}>
                لا توجد مشاريع
              </p>
            )}
            {overview.projects.map((p) => {
              const isOpen = openProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpenProjectId(isOpen ? null : p.id)}
                  className="text-right bg-white rounded-2xl p-4 transition-all hover:shadow-md"
                  style={{
                    border: isOpen ? "2px solid #5E5495" : "1px solid #E2E0D8",
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }} title={p.name}>
                        {p.name}
                      </p>
                      {p.department && (
                        <p className="text-[10px] mt-0.5" style={{ color: p.department.color || "#6B7280" }}>
                          {p.department.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>{p.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: "#F0EEF5" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.progress}%`,
                        background: "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.taskStats.late > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
                        <AlertTriangle size={10} /> {p.taskStats.late} متأخر
                      </span>
                    )}
                    {p.taskStats.active > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>
                        <Clock size={10} /> {p.taskStats.active} جارٍ
                      </span>
                    )}
                    {p.taskStats.done > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E" }}>
                        <CheckCircle2 size={10} /> {p.taskStats.done} مكتمل
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Project drill-down side panel */}
          {openProjectId && (
            <div className="bg-white rounded-2xl p-5 lg:col-span-1" style={{ border: "1px solid #E2E0D8", boxShadow: "0 4px 18px rgba(0,0,0,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>منفذو المشروع الحاليون</h3>
                <button onClick={() => setOpenProjectId(null)} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}>
                  <X size={16} />
                </button>
              </div>
              {servicesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : (
                <>
                  {projectExecutors.length === 0 ? (
                    <p className="text-xs text-center py-3" style={{ color: "#9CA3AF" }}>لا يوجد منفذون مرتبطون</p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {projectExecutors.map((e) => (
                        <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: "rgba(94,84,149,0.06)" }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: "#5E5495" }}>
                            {(e.name || "—").slice(0, 2)}
                          </div>
                          <span className="text-xs font-medium" style={{ color: "#1C1B2E" }}>{e.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <MarsaButton
                    variant="gold"
                    size="sm"
                    icon={<UserPlus size={14} />}
                    className="w-full"
                    onClick={() => {
                      const proj = overview.projects.find((p) => p.id === openProjectId);
                      if (proj) {
                        setAssignTarget({ type: "project", targetId: proj.id, label: proj.name });
                      }
                    }}
                  >
                    ربط منفذ بالمشروع
                  </MarsaButton>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── SERVICES TAB ─── */}
      {!loading && !error && tab === "services" && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          {servicesLoading && (
            <div className="p-12 flex justify-center">
              <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
            </div>
          )}
          {!servicesLoading && services && services.length === 0 && (
            <p className="p-8 text-center text-sm" style={{ color: "#9CA3AF" }}>لا توجد خدمات</p>
          )}
          {!servicesLoading && services && services.length > 0 && (
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: "#FAFAF8" }}>
                <tr>
                  <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>الخدمة</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>المشروع</th>
                  <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>المنفذون</th>
                  <th className="text-center px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "#1C1B2E" }}>{s.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6B7280" }}>{s.projectName}</td>
                    <td className="px-4 py-3">
                      {s.executors.length === 0 ? (
                        <span className="text-[10px] italic" style={{ color: "#9CA3AF" }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.executors.map((e) => (
                            <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                              {e.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <MarsaButton
                        variant="secondary"
                        size="xs"
                        icon={<UserPlus size={12} />}
                        onClick={() => setAssignTarget({ type: "service", targetId: s.id, label: `${s.name} — ${s.projectName}` })}
                      >
                        ربط منفذ
                      </MarsaButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── TASKS TAB ─── */}
      {!loading && !error && tab === "tasks" && (
        <>
          <div className="flex p-1 rounded-xl mb-4 max-w-xs" style={{ backgroundColor: "#F0EEF5", border: "1px solid #E2E0D8" }}>
            <button
              type="button"
              onClick={() => setTaskFilter("unassigned")}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={taskFilter === "unassigned" ? { backgroundColor: "#5E5495", color: "white" } : { color: "#6B7280" }}
            >
              بدون منفذ
            </button>
            <button
              type="button"
              onClick={() => setTaskFilter("late")}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={taskFilter === "late" ? { backgroundColor: "#DC2626", color: "white" } : { color: "#6B7280" }}
            >
              متأخرة
            </button>
          </div>

          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
            {tasksLoading && (
              <div className="p-12 flex justify-center">
                <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
              </div>
            )}
            {!tasksLoading && filteredTasks.length === 0 && (
              <p className="p-8 text-center text-sm" style={{ color: "#9CA3AF" }}>
                {taskFilter === "unassigned" ? "كل المهام مُسندة" : "لا توجد مهام متأخرة"}
              </p>
            )}
            {!tasksLoading && filteredTasks.length > 0 && (
              <table className="w-full text-sm">
                <thead style={{ backgroundColor: "#FAFAF8" }}>
                  <tr>
                    <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>المهمة</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>الخدمة</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>المشروع</th>
                    <th className="text-right px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>الاستحقاق</th>
                    <th className="text-center px-4 py-3 font-semibold text-xs" style={{ color: "#6B7280" }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t) => {
                    const isLate =
                      t.dueDate &&
                      new Date(t.dueDate) < new Date() &&
                      t.status !== "DONE" &&
                      t.status !== "CANCELLED";
                    return (
                      <tr key={t.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                        <td className="px-4 py-3 font-medium" style={{ color: "#1C1B2E" }}>{t.title}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6B7280" }}>{t.serviceName || "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6B7280" }}>{t.projectName || "—"}</td>
                        <td className="px-4 py-3 text-xs">
                          {t.dueDate ? (
                            <span style={{ color: isLate ? "#DC2626" : "#6B7280", fontWeight: isLate ? 600 : 400 }}>
                              {new Date(t.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          ) : (
                            <span style={{ color: "#9CA3AF" }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <MarsaButton
                            variant="secondary"
                            size="xs"
                            icon={<UserPlus size={12} />}
                            onClick={() => setAssignTarget({ type: "task", targetId: t.id, label: t.title })}
                          >
                            إسناد
                          </MarsaButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ─── ASSIGN MODAL (shared) ─── */}
      {assignTarget && overview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !assigning && setAssignTarget(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sticky top-0 bg-white" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                  <UserPlus size={18} style={{ color: "#C9A84C" }} />
                  ربط منفذ
                </h2>
                <button
                  type="button"
                  onClick={() => !assigning && setAssignTarget(null)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "#9CA3AF" }}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs" style={{ color: "#6B7280" }}>
                {assignTarget.type === "project" && "ربط منفذ بكل خدمات المشروع: "}
                {assignTarget.type === "service" && "ربط منفذ بالخدمة: "}
                {assignTarget.type === "task" && "إسناد المهمة: "}
                <span className="font-bold" style={{ color: "#1C1B2E" }}>{assignTarget.label}</span>
              </p>
            </div>

            <div className="p-4 space-y-2">
              {overview.executors.length === 0 && (
                <p className="text-center text-xs py-4" style={{ color: "#9CA3AF" }}>لا يوجد منفذون متاحون</p>
              )}
              {overview.executors.map((ex) => {
                const loadColor =
                  ex.loadPercent >= 90 ? "#DC2626" :
                  ex.loadPercent >= 60 ? "#EA580C" :
                  ex.loadPercent >= 30 ? "#C9A84C" : "#22C55E";
                return (
                  <button
                    key={ex.id}
                    type="button"
                    disabled={assigning}
                    onClick={() => performAssign(ex.id)}
                    className="w-full p-3 rounded-xl text-right transition-all hover:shadow-sm disabled:opacity-50"
                    style={{ border: "1px solid #E2E0D8", backgroundColor: "white" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: "#5E5495" }}>
                        {ex.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>{ex.name}</p>
                          {ex.lateTasks > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
                              <AlertTriangle size={9} /> {ex.lateTasks}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${ex.loadPercent}%`, backgroundColor: loadColor }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: loadColor }}>
                            {ex.activeTasks}/20
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {assigning && (
              <div className="p-3 flex justify-center" style={{ borderTop: "1px solid #F0EDE6" }}>
                <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
