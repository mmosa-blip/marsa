"use client";

/**
 * Operations Room — admin/manager command center for project, service, and
 * task assignment.
 *
 * Layout: hierarchical tree
 *
 *   Department
 *     └─ Project   (+ ربط منفذ)
 *         └─ Service   (+ ربط منفذ)
 *             └─ Task   (+ إسناد)
 *
 * Each node has its own expand/collapse and its own "Assign Executor" button.
 * Department headers are NOT assignable — they're grouping containers only.
 *
 * Data comes from /api/operations/overview which now returns the full
 * service+task hierarchy alongside the executor pool.
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
  ChevronDown,
  Building2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface OverviewTask {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
}
interface OverviewService {
  id: string;
  name: string;
  status: string | null;
  tasks: OverviewTask[];
}
interface OverviewProject {
  id: string;
  name: string;
  department: { id: string; name: string; color: string | null } | null;
  progress: number;
  taskStats: { late: number; active: number; done: number };
  services: OverviewService[];
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

type AssignTarget =
  | { type: "project"; targetId: string; label: string }
  | { type: "service"; targetId: string; label: string }
  | { type: "task"; targetId: string; label: string };

const STATUS_LABELS: Record<string, string> = {
  TODO: "للتنفيذ",
  WAITING: "في الانتظار",
  IN_PROGRESS: "قيد التنفيذ",
  IN_REVIEW: "للمراجعة",
  WAITING_EXTERNAL: "بانتظار خارجي",
  DONE: "مكتمل",
  CANCELLED: "ملغي",
};

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case "DONE": return { bg: "rgba(34,197,94,0.1)", fg: "#22C55E" };
    case "IN_PROGRESS": return { bg: "rgba(201,168,76,0.1)", fg: "#C9A84C" };
    case "IN_REVIEW": return { bg: "rgba(139,92,246,0.1)", fg: "#8B5CF6" };
    case "WAITING": case "WAITING_EXTERNAL": return { bg: "rgba(234,88,12,0.1)", fg: "#EA580C" };
    case "CANCELLED": return { bg: "rgba(220,38,38,0.1)", fg: "#DC2626" };
    default: return { bg: "rgba(148,163,184,0.1)", fg: "#94A3B8" };
  }
}

function isLateTask(t: OverviewTask): boolean {
  if (!t.dueDate) return false;
  if (t.status === "DONE" || t.status === "CANCELLED") return false;
  return new Date(t.dueDate) < new Date();
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperationsRoomPage() {
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  // ── Fetch overview ──
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

  // ── Group projects by department ──
  const departments = useMemo(() => {
    if (!overview) return [];
    const map = new Map<string, {
      id: string;
      name: string;
      color: string | null;
      projects: OverviewProject[];
    }>();
    for (const p of overview.projects) {
      const key = p.department?.id ?? "__none__";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: p.department?.name ?? "غير مصنف",
          color: p.department?.color ?? null,
          projects: [],
        });
      }
      map.get(key)!.projects.push(p);
    }
    return Array.from(map.values());
  }, [overview]);

  // Default-expand all departments on first load
  useEffect(() => {
    if (overview && expanded.size === 0) {
      const next = new Set<string>();
      for (const d of departments) next.add("d:" + d.id);
      setExpanded(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
      refreshOverview();
      setAssignTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setAssigning(false);
    }
  };

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Radio size={24} style={{ color: "#C9A84C" }} />
          غرفة العمليات
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          إدارة الإسناد بشكل هرمي: قسم → مشروع → خدمة → مهمة
        </p>
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

      {/* Tree */}
      {!loading && !error && overview && (
        <div className="space-y-3">
          {departments.length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: "#9CA3AF" }}>لا توجد أقسام أو مشاريع</p>
          )}

          {departments.map((dept) => {
            const dKey = "d:" + dept.id;
            const dOpen = expanded.has(dKey);
            const totalProjects = dept.projects.length;
            return (
              <div key={dept.id} className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
                {/* Department row */}
                <button
                  type="button"
                  onClick={() => toggle(dKey)}
                  className="w-full flex items-center gap-3 p-4 text-right transition-colors hover:bg-gray-50"
                >
                  <ChevronDown
                    size={18}
                    className="transition-transform shrink-0"
                    style={{ color: "#9CA3AF", transform: dOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                  <Building2 size={20} style={{ color: dept.color || "#5E5495" }} />
                  <span className="text-base font-bold flex-1" style={{ color: "#1C1B2E" }}>{dept.name}</span>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                    {totalProjects} مشروع
                  </span>
                </button>

                {/* Department children: projects */}
                {dOpen && (
                  <div style={{ borderTop: "1px solid #F0EDE6" }}>
                    {dept.projects.length === 0 && (
                      <p className="text-center text-xs py-4" style={{ color: "#9CA3AF" }}>لا توجد مشاريع</p>
                    )}
                    {dept.projects.map((proj) => {
                      const pKey = "p:" + proj.id;
                      const pOpen = expanded.has(pKey);
                      return (
                        <div key={proj.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                          {/* Project row */}
                          <div className="flex items-center gap-3 p-3 pe-6 transition-colors hover:bg-gray-50" style={{ backgroundColor: "rgba(250,250,248,0.5)" }}>
                            <button
                              type="button"
                              onClick={() => toggle(pKey)}
                              className="flex items-center gap-2 flex-1 text-right min-w-0"
                            >
                              <ChevronDown
                                size={16}
                                className="transition-transform shrink-0"
                                style={{ color: "#9CA3AF", transform: pOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                              />
                              <FolderKanban size={16} style={{ color: "#5E5495" }} />
                              <span className="text-sm font-semibold truncate" style={{ color: "#1C1B2E" }} title={proj.name}>
                                {proj.name}
                              </span>
                              {/* progress */}
                              <span className="text-[10px] font-bold" style={{ color: "#6B7280" }}>{proj.progress}%</span>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${proj.progress}%`,
                                    background: "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                                  }}
                                />
                              </div>
                              {/* badges */}
                              {proj.taskStats.late > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
                                  <AlertTriangle size={9} /> {proj.taskStats.late}
                                </span>
                              )}
                              {proj.taskStats.active > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>
                                  <Clock size={9} /> {proj.taskStats.active}
                                </span>
                              )}
                              {proj.taskStats.done > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#22C55E" }}>
                                  <CheckCircle2 size={9} /> {proj.taskStats.done}
                                </span>
                              )}
                            </button>
                            <MarsaButton
                              variant="secondary"
                              size="xs"
                              icon={<UserPlus size={11} />}
                              onClick={() => setAssignTarget({ type: "project", targetId: proj.id, label: proj.name })}
                            >
                              ربط منفذ
                            </MarsaButton>
                          </div>

                          {/* Project children: services */}
                          {pOpen && (
                            <div>
                              {proj.services.length === 0 && (
                                <p className="text-center text-xs py-3" style={{ color: "#9CA3AF" }}>لا توجد خدمات</p>
                              )}
                              {proj.services.map((svc) => {
                                const sKey = "s:" + svc.id;
                                const sOpen = expanded.has(sKey);
                                const totalTasks = svc.tasks.length;
                                const doneTasks = svc.tasks.filter((t) => t.status === "DONE").length;
                                // distinct executors on this service
                                const execMap = new Map<string, string>();
                                for (const t of svc.tasks) if (t.assignee && !execMap.has(t.assignee.id)) execMap.set(t.assignee.id, t.assignee.name);
                                const executors = Array.from(execMap, ([id, name]) => ({ id, name }));
                                return (
                                  <div key={svc.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                                    {/* Service row */}
                                    <div className="flex items-center gap-3 p-3 pe-12 transition-colors hover:bg-gray-50">
                                      <button
                                        type="button"
                                        onClick={() => toggle(sKey)}
                                        className="flex items-center gap-2 flex-1 text-right min-w-0"
                                      >
                                        <ChevronDown
                                          size={14}
                                          className="transition-transform shrink-0"
                                          style={{ color: "#9CA3AF", transform: sOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                                        />
                                        <Layers size={14} style={{ color: "#C9A84C" }} />
                                        <span className="text-xs font-semibold truncate" style={{ color: "#1C1B2E" }} title={svc.name}>
                                          {svc.name}
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}>
                                          {doneTasks}/{totalTasks}
                                        </span>
                                        {executors.length > 0 && (
                                          <span className="text-[10px]" style={{ color: "#6B7280" }}>
                                            {executors.map((e) => e.name).join(" · ")}
                                          </span>
                                        )}
                                      </button>
                                      <MarsaButton
                                        variant="secondary"
                                        size="xs"
                                        icon={<UserPlus size={11} />}
                                        onClick={() => setAssignTarget({
                                          type: "service",
                                          targetId: svc.id,
                                          label: `${svc.name} — ${proj.name}`,
                                        })}
                                      >
                                        ربط منفذ
                                      </MarsaButton>
                                    </div>

                                    {/* Service children: tasks */}
                                    {sOpen && (
                                      <div>
                                        {svc.tasks.length === 0 && (
                                          <p className="text-center text-[11px] py-2" style={{ color: "#9CA3AF" }}>لا توجد مهام</p>
                                        )}
                                        {svc.tasks.map((task) => {
                                          const sc = statusColor(task.status);
                                          const late = isLateTask(task);
                                          return (
                                            <div key={task.id} className="flex items-center gap-3 p-2.5 pe-20" style={{ borderTop: "1px solid #F8F7F3", backgroundColor: "rgba(248,247,243,0.4)" }}>
                                              <ListChecks size={12} style={{ color: "#9CA3AF" }} />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium truncate" style={{ color: "#1C1B2E" }} title={task.title}>
                                                  {task.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: sc.bg, color: sc.fg }}>
                                                    {STATUS_LABELS[task.status] || task.status}
                                                  </span>
                                                  {task.dueDate && (
                                                    <span
                                                      className="text-[9px] flex items-center gap-0.5"
                                                      style={{ color: late ? "#DC2626" : "#9CA3AF", fontWeight: late ? 600 : 400 }}
                                                    >
                                                      {late && <AlertTriangle size={9} />}
                                                      {formatDate(task.dueDate)}
                                                    </span>
                                                  )}
                                                  {task.assignee ? (
                                                    <span className="text-[9px]" style={{ color: "#5E5495" }}>{task.assignee.name}</span>
                                                  ) : (
                                                    <span className="text-[9px] italic" style={{ color: "#9CA3AF" }}>غير مسند</span>
                                                  )}
                                                </div>
                                              </div>
                                              <MarsaButton
                                                variant="secondary"
                                                size="xs"
                                                icon={<UserPlus size={10} />}
                                                onClick={() => setAssignTarget({ type: "task", targetId: task.id, label: task.title })}
                                              >
                                                إسناد
                                              </MarsaButton>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
