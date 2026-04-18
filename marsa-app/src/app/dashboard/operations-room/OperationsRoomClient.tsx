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
  ChevronUp,
  Flame,
  Pause,
  Play,
  BarChart3,
  Download,
  UserPlus,
  Radio,
  CheckCircle2,
  Clock,
  ChevronDown,
  Building2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ProjectCodeBadge from "@/components/ProjectCodeBadge";
import DepartmentPoolManager from "@/components/DepartmentPoolManager";
import { exportDelayReportPDF } from "@/lib/delay-report-pdf";

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
  // serviceTemplateId — needed to manage the catalog-level escalation
  // list directly from the operations room. Null on ad-hoc services
  // that were created outside the template catalog.
  serviceTemplateId?: string | null;
  // Distinct executors derived from this service's tasks (server-side now,
  // but we still recompute on the client where needed for resilience).
  executors?: { id: string; name: string }[];
  // UserService rows — the authoritative "qualified employees" pool
  // that the operations room can add to / remove from.
  qualifiedEmployees?: { id: string; name: string; role: string }[];
  // ServiceTemplate.escalationEmployees, sorted by priority asc. Managed
  // via /api/service-catalog/templates/[templateId]/escalation.
  escalationEmployees?: {
    id: string;
    priority: number;
    user: { id: string; name: string; role: string };
  }[];
  tasks: OverviewTask[];
}
interface OverviewProject {
  // Contract timeline
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  // Execution timeline
  projectStartDate?: string | null;
  projectEndDate?: string | null;
  // Delay indicators
  daysRemaining?: number | null;
  lateTasks?: number;
  contractOverdue?: boolean;
  taskOverdue?: boolean;
  isOverdue?: boolean;
  hasMissingDates?: boolean;
  isPaused?: boolean;
  currentPause?: { reason: string; startDate: string } | null;
  id: string;
  name: string;
  projectCode: string | null;
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

// First letter of first word + first letter of last word; falls back to the
// first 2 chars for single-word names.
function initialsFor(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[parts.length - 1][0] || "");
}

// Stable colour per user id so the same person always gets the same avatar tint.
const AVATAR_COLORS = ["#5E5495", "#1B2A4A", "#0F766E", "#7C3AED", "#0891B2", "#B45309", "#C9A84C", "#DC2626"];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// Tiny inline avatar — 24px circle with initials, full name in title tooltip.
// When onRemove is provided, a small × button appears at top-end on hover.
function Avatar({
  id,
  name,
  onRemove,
  disabled,
}: {
  id: string;
  name: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="relative inline-block group" style={{ width: 24, height: 24 }}>
      <span
        title={name}
        className="inline-flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
        style={{
          width: 24,
          height: 24,
          fontSize: 10,
          backgroundColor: avatarColor(id),
          border: "1.5px solid white",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {initialsFor(name)}
      </span>
      {onRemove && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title={`إزالة ${name}`}
          aria-label={`إزالة ${name}`}
          className="absolute -top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full"
          style={{
            insetInlineEnd: -4,
            width: 14,
            height: 14,
            backgroundColor: "#DC2626",
            color: "white",
            fontSize: 10,
            lineHeight: 1,
            border: "1.5px solid white",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// Stack of avatars for a list of users (overlapping with negative margin).
// Renders nothing when the list is empty so the layout doesn't shift.
// onRemoveOne is forwarded to each Avatar so the × button can fire.
function AvatarStack({
  users,
  onRemoveOne,
  disabled,
}: {
  users: { id: string; name: string }[];
  onRemoveOne?: (userId: string, name: string) => void;
  disabled?: boolean;
}) {
  if (users.length === 0) return null;
  // Cap at 4 avatars + "+N" overflow chip
  const visible = users.slice(0, 4);
  const overflow = users.length - visible.length;
  return (
    <span className="inline-flex items-center" style={{ direction: "ltr" }}>
      {visible.map((u, idx) => (
        <span key={u.id} style={{ marginInlineStart: idx === 0 ? 0 : -8 }}>
          <Avatar
            id={u.id}
            name={u.name}
            onRemove={onRemoveOne ? () => onRemoveOne(u.id, u.name) : undefined}
            disabled={disabled}
          />
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={users.slice(4).map((u) => u.name).join(" · ")}
          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
          style={{
            width: 24,
            height: 24,
            backgroundColor: "#F0EEF5",
            color: "#6B7280",
            border: "1.5px solid white",
            marginInlineStart: -8,
          }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}

// Distinct executors across an arbitrary list of tasks (preserves first
// occurrence order).
function distinctExecutors(tasks: OverviewTask[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const t of tasks) {
    if (t.assignee && !seen.has(t.assignee.id)) {
      seen.set(t.assignee.id, t.assignee.name);
    }
  }
  return Array.from(seen, ([id, name]) => ({ id, name }));
}

// This file is loaded via next/dynamic({ ssr: false }) so it never runs on
// the server. `new Date()` and locale formatting are completely safe here.
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

export default function OperationsRoomClient() {
  const { data: session, status } = useSession();
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [assigning, setAssigning] = useState(false);
  // Multi-select state for the assign modal — reset whenever the modal opens.
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  // Per-service "add qualified employee" picker state (open + pending user id)
  const [qePicker, setQePicker] = useState<{ serviceId: string; userId: string } | null>(null);
  const [qeMutating, setQeMutating] = useState(false);
  // Per-service "add escalation employee" picker state. Keyed by
  // serviceTemplateId (not serviceId) since the underlying table is at
  // catalog level — one template escalation list is shared by every
  // project service instance derived from that template.
  const [escPicker, setEscPicker] = useState<{ templateId: string; userId: string } | null>(null);
  const [escMutating, setEscMutating] = useState(false);
  // Pause-project modal state.
  const [pauseModal, setPauseModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [pauseReason, setPauseReason] = useState<"PAYMENT_DELAY" | "CLIENT_REQUEST" | "OTHER">("PAYMENT_DELAY");
  const [pauseNotes, setPauseNotes] = useState("");
  const [pauseMutating, setPauseMutating] = useState(false);
  // Delay-report modal state — lazily fetches /api/projects/[id]/pause-report
  // when the user opens it on a given project row.
  const [delayModal, setDelayModal] = useState<{
    projectId: string;
    projectName: string;
    projectCode: string | null;
    departmentName: string | null;
  } | null>(null);
  const [delayReport, setDelayReport] = useState<{
    startDate: string | null;
    originalEndDate: string | null;
    adjustedEndDate: string | null;
    isPaused: boolean;
    totalPausedDays: number;
    periods: {
      id: string;
      reason: string;
      notes: string | null;
      startDate: string;
      endDate: string | null;
      isOpen: boolean;
      days: number;
      pausedBy: { id: string; name: string } | null;
      resumedBy: { id: string; name: string } | null;
    }[];
  } | null>(null);
  const [delayLoading, setDelayLoading] = useState(false);

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

  // ── Qualified employees (per service) mutations ──
  const addQualifiedEmployee = async (serviceId: string, userId: string) => {
    if (!userId) return;
    setQeMutating(true);
    try {
      const res = await fetch(`/api/services/${serviceId}/qualified-employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setQePicker(null);
        refreshOverview();
      }
    } finally {
      setQeMutating(false);
    }
  };

  const removeQualifiedEmployee = async (serviceId: string, userId: string) => {
    if (!confirm("إزالة هذا المنفذ من قائمة المؤهلين للخدمة؟")) return;
    setQeMutating(true);
    try {
      const res = await fetch(
        `/api/services/${serviceId}/qualified-employees/${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) refreshOverview();
    } finally {
      setQeMutating(false);
    }
  };

  // ── Escalation employees (per ServiceTemplate) mutations ──
  const addEscalationEmployee = async (templateId: string, userId: string) => {
    if (!userId) return;
    setEscMutating(true);
    try {
      const res = await fetch(
        `/api/service-catalog/templates/${templateId}/escalation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        }
      );
      if (res.ok) {
        setEscPicker(null);
        refreshOverview();
      }
    } finally {
      setEscMutating(false);
    }
  };

  const removeEscalationEmployee = async (templateId: string, userId: string) => {
    if (!confirm("إزالة هذا الموظف من قائمة الطوارئ؟")) return;
    setEscMutating(true);
    try {
      const res = await fetch(
        `/api/service-catalog/templates/${templateId}/escalation?userId=${userId}`,
        { method: "DELETE" }
      );
      if (res.ok) refreshOverview();
    } finally {
      setEscMutating(false);
    }
  };

  // ── Project pause / resume ──
  const openPauseModal = (projectId: string, projectName: string) => {
    setPauseModal({ projectId, projectName });
    setPauseReason("PAYMENT_DELAY");
    setPauseNotes("");
  };
  const submitPause = async () => {
    if (!pauseModal) return;
    setPauseMutating(true);
    try {
      const res = await fetch(`/api/projects/${pauseModal.projectId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: pauseReason, notes: pauseNotes || undefined }),
      });
      if (res.ok) {
        setPauseModal(null);
        refreshOverview();
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "تعذر إيقاف المشروع");
      }
    } finally {
      setPauseMutating(false);
    }
  };
  const openDelayModal = async (
    projectId: string,
    projectName: string,
    projectCode: string | null,
    departmentName: string | null
  ) => {
    setDelayModal({ projectId, projectName, projectCode, departmentName });
    setDelayReport(null);
    setDelayLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/pause-report`);
      if (res.ok) {
        setDelayReport(await res.json());
      }
    } finally {
      setDelayLoading(false);
    }
  };

  const resumeProject = async (projectId: string) => {
    if (!confirm("استئناف هذا المشروع؟")) return;
    setPauseMutating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/resume`, { method: "POST" });
      if (res.ok) {
        refreshOverview();
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "تعذر الاستئناف");
      }
    } finally {
      setPauseMutating(false);
    }
  };

  const reorderEscalationEmployee = async (
    templateId: string,
    currentOrder: string[],
    userId: string,
    direction: "up" | "down"
  ) => {
    const idx = currentOrder.indexOf(userId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === currentOrder.length - 1) return;
    const next = [...currentOrder];
    const swap = direction === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setEscMutating(true);
    try {
      const res = await fetch(
        `/api/service-catalog/templates/${templateId}/escalation`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: next }),
        }
      );
      if (res.ok) refreshOverview();
    } finally {
      setEscMutating(false);
    }
  };

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

  // ── Remove actions ──
  const [removing, setRemoving] = useState(false);

  const removeFromTask = async (taskId: string) => {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "تعذّر إلغاء الإسناد");
        return;
      }
      refreshOverview();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setRemoving(false);
    }
  };

  const removeFromService = async (userId: string, serviceId: string) => {
    if (removing) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/users/${userId}/services`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "تعذّر إلغاء الربط");
        return;
      }
      refreshOverview();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setRemoving(false);
    }
  };

  const removeFromProject = async (
    userId: string,
    serviceIds: string[]
  ) => {
    if (removing) return;
    setRemoving(true);
    try {
      // Sequential — keeps the load on Supabase pgbouncer light and matches
      // the assign route's per-service pattern. Each call is idempotent.
      for (const sid of serviceIds) {
        const res = await fetch(`/api/users/${userId}/services`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: sid }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          alert((j as { error?: string }).error || "تعذّر إلغاء الربط من بعض الخدمات");
          return;
        }
      }
      refreshOverview();
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setRemoving(false);
    }
  };

  // ── Assign action ──
  // Multi-executor: posts the full set of selected userIds in one request.
  // The server distributes tasks round-robin per service for project/service
  // types and adds collaborators via TaskAssignment for the task type.
  const performAssign = async () => {
    if (!assignTarget) return;
    if (selectedUserIds.size === 0) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/operations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: assignTarget.type,
          targetId: assignTarget.targetId,
          userIds: Array.from(selectedUserIds),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error || "تعذّر تنفيذ الإسناد");
        return;
      }
      refreshOverview();
      setAssignTarget(null);
      setSelectedUserIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setAssigning(false);
    }
  };

  // Reset the multi-select set whenever the modal target changes (open/close).
  const openAssign = (target: AssignTarget) => {
    setSelectedUserIds(new Set());
    setAssignTarget(target);
  };
  const closeAssign = () => {
    if (assigning) return;
    setAssignTarget(null);
    setSelectedUserIds(new Set());
  };
  const toggleUserSelect = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (status === "loading") return null;
  if (!session) redirect("/auth/login");

  return (
    <div className="p-4 md:p-8 overflow-x-hidden" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Radio size={24} style={{ color: "#C9A84C" }} />
          إدارة العمليات
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
                      // Distinct executors across every task in every service of this project
                      const projectExecutors = distinctExecutors(proj.services.flatMap((s) => s.tasks));
                      return (
                        <div key={proj.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                          {/* Project row — vertical card on mobile, horizontal on desktop */}
                          <div className="p-3 pe-4 md:pe-6 transition-colors hover:bg-gray-50" style={{ backgroundColor: "rgba(250,250,248,0.5)" }}>
                            {/* Line 1: name + chevron */}
                            <button
                              type="button"
                              onClick={() => toggle(pKey)}
                              className="flex items-center gap-2 w-full text-right min-w-0 mb-1 md:mb-0"
                            >
                              <ChevronDown
                                size={16}
                                className="transition-transform shrink-0"
                                style={{ color: "#9CA3AF", transform: pOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                              />
                              <FolderKanban size={16} className="shrink-0" style={{ color: "#5E5495" }} />
                              <span className="text-sm font-semibold truncate max-w-[200px] md:max-w-none" style={{ color: "#1C1B2E" }} title={proj.name}>
                                {proj.name}
                              </span>
                              <ProjectCodeBadge code={proj.projectCode} size="xs" />
                            </button>

                            {/* Line 2: stats + badges (wrap on mobile) */}
                            <div className="flex flex-wrap items-center gap-1.5 mr-8 md:mr-0 md:mt-0 mt-1 mb-1.5 md:mb-0">
                              {/* Days remaining pill — sourced from contractEndDate */}
                              {(() => {
                                const d = proj.daysRemaining;
                                let bg = "rgba(148,163,184,0.15)";
                                let fg = "#64748B";
                                let label: string;
                                if (d == null) {
                                  label = "بدون تاريخ";
                                } else {
                                  label = `${d} يوم متبقٍ`;
                                  if (d < 15) { bg = "rgba(220,38,38,0.1)"; fg = "#DC2626"; }
                                  else if (d <= 30) { bg = "rgba(234,88,12,0.1)"; fg = "#EA580C"; }
                                  else { bg = "rgba(34,197,94,0.1)"; fg = "#22C55E"; }
                                }
                                return (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                    style={{ backgroundColor: bg, color: fg }}
                                    title={
                                      proj.contractEndDate
                                        ? `أيام عمل متبقية حتى انتهاء العقد: ${new Date(proj.contractEndDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" })}`
                                        : "لا يوجد تاريخ انتهاء للعقد"
                                    }
                                  >
                                    📄 العقد: {label}
                                  </span>
                                );
                              })()}
                              {/* Late tasks pill — sourced from task dueDate */}
                              {(proj.lateTasks ?? proj.taskStats.late) > 0 && (
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#DC2626" }}
                                  title="عدد المهام التي تجاوزت تاريخ استحقاقها"
                                >
                                  ⚠️ {proj.lateTasks ?? proj.taskStats.late} مهمة متأخرة
                                </span>
                              )}
                              {/* progress */}
                              <span className="text-[10px] font-bold" style={{ color: "#6B7280" }}>{proj.progress}%</span>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                                <div className="h-full rounded-full" style={{ width: `${proj.progress}%`, background: "linear-gradient(90deg, #1B2A4A, #C9A84C)" }} />
                              </div>
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
                              {proj.isPaused && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#DC2626" }}>
                                  <Pause size={9} /> موقوف
                                </span>
                              )}
                            </div>

                            {/* Line 3: action buttons — own row on mobile */}
                            <div className="flex flex-wrap items-center gap-1.5 mr-8 md:mr-0">
                              <AvatarStack
                                users={projectExecutors}
                                disabled={removing}
                                onRemoveOne={(uid) => removeFromProject(uid, proj.services.map((s) => s.id))}
                              />
                              <MarsaButton
                                variant="secondary"
                                size="xs"
                                icon={<UserPlus size={11} />}
                                onClick={() => openAssign({ type: "project", targetId: proj.id, label: proj.name })}
                              >
                                ربط منفذ
                              </MarsaButton>
                            {proj.isPaused ? (
                              <MarsaButton
                                variant="secondary"
                                size="xs"
                                icon={<Play size={11} />}
                                disabled={pauseMutating}
                                onClick={() => resumeProject(proj.id)}
                                style={{ color: "#059669" }}
                              >
                                استئناف
                              </MarsaButton>
                            ) : (
                              <MarsaButton
                                variant="secondary"
                                size="xs"
                                icon={<Pause size={11} />}
                                disabled={pauseMutating}
                                onClick={() => openPauseModal(proj.id, proj.name)}
                                style={{ color: "#DC2626" }}
                              >
                                إيقاف
                              </MarsaButton>
                            )}
                            <MarsaButton
                              variant="secondary"
                              size="xs"
                              icon={<BarChart3 size={11} />}
                              onClick={() =>
                                openDelayModal(
                                  proj.id,
                                  proj.name,
                                  proj.projectCode,
                                  proj.department?.name || null
                                )
                              }
                              style={{ color: "#5E5495" }}
                            >
                              📊 تقرير التأخير
                            </MarsaButton>
                            </div>
                          </div>

                          {/* Timeline + delay summary strip */}
                          {pOpen && (
                            <div
                              className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[10px]"
                              style={{ borderTop: "1px solid #F0EDE6", backgroundColor: "rgba(250,250,248,0.7)" }}
                            >
                              {/* Contract timeline */}
                              <span className="flex items-center gap-1" style={{ color: "#5E5495" }}>
                                📄 العقد:
                                {proj.contractStartDate
                                  ? new Date(proj.contractStartDate).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" })
                                  : "—"}
                                {" ← "}
                                {proj.contractEndDate
                                  ? new Date(proj.contractEndDate).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" })
                                  : "—"}
                              </span>
                              {/* Execution timeline */}
                              <span className="flex items-center gap-1" style={{ color: "#6B7280" }}>
                                ⚙️ التنفيذ:
                                {proj.projectStartDate
                                  ? new Date(proj.projectStartDate).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" })
                                  : "—"}
                                {" ← "}
                                {proj.projectEndDate
                                  ? new Date(proj.projectEndDate).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" })
                                  : "—"}
                              </span>
                              {/* Delay badges */}
                              {proj.contractOverdue && (
                                <span className="font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
                                  🔴 متأخر بالعقد
                                </span>
                              )}
                              {(proj.lateTasks ?? 0) > 0 && (
                                <span className="font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(234,88,12,0.1)", color: "#EA580C" }}>
                                  ⚠️ {proj.lateTasks} مهمة متأخرة
                                </span>
                              )}
                              {proj.hasMissingDates && (
                                <span className="font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(234,88,12,0.08)", color: "#EA580C" }}>
                                  ⚠️ تواريخ العقد مفقودة
                                </span>
                              )}
                            </div>
                          )}

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
                                // Distinct executors across this service's tasks
                                const serviceExecutors = distinctExecutors(svc.tasks);
                                return (
                                  <div key={svc.id} style={{ borderTop: "1px solid #F0EDE6" }}>
                                    {/* Service row */}
                                    <div className="flex flex-wrap items-center gap-2 md:gap-3 p-3 pe-4 md:pe-12 transition-colors hover:bg-gray-50">
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
                                      </button>
                                      <AvatarStack
                                        users={serviceExecutors}
                                        disabled={removing}
                                        onRemoveOne={(uid) => removeFromService(uid, svc.id)}
                                      />
                                      <MarsaButton
                                        variant="secondary"
                                        size="xs"
                                        icon={<UserPlus size={11} />}
                                        onClick={() => openAssign({
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
                                        {/* Qualified employees for this service.
                                            Uses UserService rows — the authoritative
                                            pool the projects POST handler consults
                                            when a service template has no own
                                            qualifiedEmployees. */}
                                        <div
                                          className="flex items-center gap-2 px-2 md:px-4 py-2 flex-wrap"
                                          style={{ borderTop: "1px solid #F8F7F3", backgroundColor: "rgba(201,168,76,0.04)" }}
                                        >
                                          <span className="text-[10px] font-bold" style={{ color: "#5E5495" }}>
                                            المؤهلون:
                                          </span>
                                          {(svc.qualifiedEmployees || []).length === 0 && (
                                            <span className="text-[10px] italic" style={{ color: "#9CA3AF" }}>
                                              لا يوجد مؤهلون
                                            </span>
                                          )}
                                          {(svc.qualifiedEmployees || []).map((qe) => (
                                            <span
                                              key={qe.id}
                                              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                              style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                                            >
                                              {qe.name}
                                              <button
                                                type="button"
                                                onClick={() => removeQualifiedEmployee(svc.id, qe.id)}
                                                disabled={qeMutating}
                                                className="hover:text-red-600 transition-colors"
                                                title="إزالة"
                                              >
                                                <X size={9} />
                                              </button>
                                            </span>
                                          ))}

                                          {qePicker?.serviceId === svc.id ? (
                                            <div className="flex items-center gap-1">
                                              <select
                                                value={qePicker.userId}
                                                onChange={(e) =>
                                                  setQePicker({ serviceId: svc.id, userId: e.target.value })
                                                }
                                                disabled={qeMutating}
                                                className="text-[10px] px-1.5 py-0.5 rounded border bg-white outline-none"
                                                style={{ borderColor: "#E2E0D8", color: "#1C1B2E" }}
                                              >
                                                <option value="">— اختر —</option>
                                                {overview?.executors
                                                  .filter(
                                                    (ex) =>
                                                      !(svc.qualifiedEmployees || []).some((qe) => qe.id === ex.id)
                                                  )
                                                  .map((ex) => (
                                                    <option key={ex.id} value={ex.id}>
                                                      {ex.name}
                                                    </option>
                                                  ))}
                                              </select>
                                              <button
                                                type="button"
                                                disabled={!qePicker.userId || qeMutating}
                                                onClick={() => addQualifiedEmployee(svc.id, qePicker.userId)}
                                                className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-white disabled:bg-gray-200 disabled:text-gray-400"
                                              >
                                                حفظ
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setQePicker(null)}
                                                disabled={qeMutating}
                                                className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                                              >
                                                إلغاء
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setQePicker({ serviceId: svc.id, userId: "" })}
                                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-amber-100 transition-colors"
                                              style={{ color: "#C9A84C" }}
                                            >
                                              <UserPlus size={10} />
                                              إضافة مؤهل
                                            </button>
                                          )}
                                        </div>

                                        {/* Escalation employees (template-level).
                                            Edits travel through the existing
                                            /api/service-catalog/templates/[id]/escalation
                                            endpoints — shown inline here so
                                            admins don't need to jump to the
                                            catalog page to maintain the late
                                            task fallback chain. */}
                                        {svc.serviceTemplateId && (() => {
                                          const esc = svc.escalationEmployees || [];
                                          const escOrder = esc.map((e) => e.user.id);
                                          const tmplId = svc.serviceTemplateId;
                                          return (
                                            <div
                                              className="flex items-center gap-2 px-2 md:px-4 py-2 flex-wrap"
                                              style={{ borderTop: "1px solid #F8F7F3", backgroundColor: "rgba(234,88,12,0.04)" }}
                                            >
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: "#9A3412" }}>
                                                <Flame size={10} />
                                                موظفو الطوارئ:
                                              </span>
                                              {esc.length === 0 && (
                                                <span className="text-[10px] italic" style={{ color: "#9CA3AF" }}>
                                                  لا يوجد
                                                </span>
                                              )}
                                              {esc.map((e, idx) => (
                                                <span
                                                  key={e.id}
                                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                                  style={{ backgroundColor: "rgba(234,88,12,0.1)", color: "#9A3412" }}
                                                >
                                                  <span
                                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                                    style={{ backgroundColor: "#EA580C" }}
                                                  >
                                                    {e.priority}
                                                  </span>
                                                  {e.user.name}
                                                  <button
                                                    type="button"
                                                    disabled={escMutating || idx === 0}
                                                    onClick={() =>
                                                      reorderEscalationEmployee(tmplId, escOrder, e.user.id, "up")
                                                    }
                                                    className="hover:text-orange-700 disabled:opacity-30"
                                                    title="رفع الأولوية"
                                                  >
                                                    <ChevronUp size={10} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={escMutating || idx === esc.length - 1}
                                                    onClick={() =>
                                                      reorderEscalationEmployee(tmplId, escOrder, e.user.id, "down")
                                                    }
                                                    className="hover:text-orange-700 disabled:opacity-30"
                                                    title="إنزال الأولوية"
                                                  >
                                                    <ChevronDown size={10} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={escMutating}
                                                    onClick={() => removeEscalationEmployee(tmplId, e.user.id)}
                                                    className="hover:text-red-600"
                                                    title="إزالة"
                                                  >
                                                    <X size={9} />
                                                  </button>
                                                </span>
                                              ))}

                                              {escPicker?.templateId === tmplId ? (
                                                <div className="flex items-center gap-1">
                                                  <select
                                                    value={escPicker.userId}
                                                    onChange={(e) =>
                                                      setEscPicker({ templateId: tmplId, userId: e.target.value })
                                                    }
                                                    disabled={escMutating}
                                                    className="text-[10px] px-1.5 py-0.5 rounded border bg-white outline-none"
                                                    style={{ borderColor: "#FED7AA", color: "#1C1B2E" }}
                                                  >
                                                    <option value="">— اختر —</option>
                                                    {overview?.executors
                                                      .filter((ex) => !esc.some((e) => e.user.id === ex.id))
                                                      .map((ex) => (
                                                        <option key={ex.id} value={ex.id}>
                                                          {ex.name}
                                                        </option>
                                                      ))}
                                                  </select>
                                                  <button
                                                    type="button"
                                                    disabled={!escPicker.userId || escMutating}
                                                    onClick={() => addEscalationEmployee(tmplId, escPicker.userId)}
                                                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500 text-white disabled:bg-gray-200 disabled:text-gray-400"
                                                  >
                                                    حفظ
                                                  </button>
                                                  <button
                                                    type="button"
                                                    disabled={escMutating}
                                                    onClick={() => setEscPicker(null)}
                                                    className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                                                  >
                                                    إلغاء
                                                  </button>
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => setEscPicker({ templateId: tmplId, userId: "" })}
                                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full hover:bg-orange-100 transition-colors"
                                                  style={{ color: "#EA580C" }}
                                                >
                                                  <UserPlus size={10} />
                                                  إضافة طوارئ
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })()}

                                        {svc.tasks.length === 0 && (
                                          <p className="text-center text-[11px] py-2" style={{ color: "#9CA3AF" }}>لا توجد مهام</p>
                                        )}
                                        {svc.tasks.map((task) => {
                                          const sc = statusColor(task.status);
                                          const late = isLateTask(task);
                                          return (
                                            <div key={task.id} className="flex flex-wrap items-center gap-2 md:gap-3 p-2.5 pe-4 md:pe-20" style={{ borderTop: "1px solid #F8F7F3", backgroundColor: "rgba(248,247,243,0.4)" }}>
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
                                                  {!task.assignee && (
                                                    <span className="text-[9px] italic" style={{ color: "#9CA3AF" }}>غير مسند</span>
                                                  )}
                                                </div>
                                              </div>
                                              {task.assignee && (
                                                <Avatar
                                                  id={task.assignee.id}
                                                  name={task.assignee.name}
                                                  disabled={removing}
                                                  onRemove={() => removeFromTask(task.id)}
                                                />
                                              )}
                                              <MarsaButton
                                                variant="secondary"
                                                size="xs"
                                                icon={<UserPlus size={10} />}
                                                onClick={() => openAssign({ type: "task", targetId: task.id, label: task.title })}
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

      {/* ─── ASSIGN MODAL (shared, multi-select) ─── */}
      {assignTarget && overview && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeAssign}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: "85vh" }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 flex-shrink-0" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                  <UserPlus size={18} style={{ color: "#C9A84C" }} />
                  {assignTarget.type === "task" ? "إسناد لعدة منفذين" : "ربط عدة منفذين"}
                </h2>
                <button
                  type="button"
                  onClick={closeAssign}
                  className="p-1.5 rounded-lg"
                  style={{ color: "#9CA3AF" }}
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-xs mb-1" style={{ color: "#6B7280" }}>
                {assignTarget.type === "project" && "ربط منفذين بكل خدمات المشروع: "}
                {assignTarget.type === "service" && "ربط منفذين بالخدمة: "}
                {assignTarget.type === "task" && "إسناد المهمة: "}
                <span className="font-bold" style={{ color: "#1C1B2E" }}>{assignTarget.label}</span>
              </p>
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                {assignTarget.type === "task"
                  ? "أول منفذ يصبح المسؤول الرئيسي والباقون يظهرون كمتعاونين."
                  : "تُوزَّع المهام بالتساوي بين المنفذين المختارين (round-robin)."}
              </p>
            </div>

            {/* List */}
            <div className="p-4 space-y-2 overflow-y-auto flex-1 min-h-0">
              {overview.executors.length === 0 && (
                <p className="text-center text-xs py-4" style={{ color: "#9CA3AF" }}>لا يوجد منفذون متاحون</p>
              )}
              {overview.executors.map((ex) => {
                const loadColor =
                  ex.loadPercent >= 90 ? "#DC2626" :
                  ex.loadPercent >= 60 ? "#EA580C" :
                  ex.loadPercent >= 30 ? "#C9A84C" : "#22C55E";
                const selected = selectedUserIds.has(ex.id);
                return (
                  <button
                    key={ex.id}
                    type="button"
                    disabled={assigning}
                    onClick={() => toggleUserSelect(ex.id)}
                    className="w-full p-3 rounded-xl text-right transition-all hover:shadow-sm disabled:opacity-50"
                    style={{
                      border: selected ? "2px solid #C9A84C" : "1px solid #E2E0D8",
                      backgroundColor: selected ? "rgba(201,168,76,0.06)" : "white",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox indicator */}
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                        style={{
                          backgroundColor: selected ? "#C9A84C" : "white",
                          border: selected ? "2px solid #C9A84C" : "2px solid #D1D5DB",
                        }}
                      >
                        {selected && <CheckCircle2 size={12} style={{ color: "white" }} />}
                      </div>
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

            {/* Sticky footer with submit */}
            <div className="p-4 flex-shrink-0 flex items-center justify-between gap-3" style={{ borderTop: "1px solid #F0EDE6" }}>
              <span className="text-xs" style={{ color: "#6B7280" }}>
                {selectedUserIds.size === 0
                  ? "لم يُحدَّد أحد"
                  : `تم تحديد ${selectedUserIds.size.toLocaleString("en-US")} منفذ`}
              </span>
              <MarsaButton
                variant="primary"
                size="sm"
                disabled={assigning || selectedUserIds.size === 0}
                icon={assigning ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                onClick={performAssign}
              >
                {assigning ? "جاري التنفيذ…" : "تنفيذ الإسناد"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      <DepartmentPoolManager />

      {/* Pause-project modal */}
      {pauseModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !pauseMutating && setPauseModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-5"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(220,38,38,0.12)" }}
              >
                <Pause size={18} style={{ color: "#DC2626" }} />
              </div>
              <div>
                <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                  إيقاف المشروع
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                  {pauseModal.projectName}
                </p>
              </div>
            </div>

            <label className="block text-xs font-bold mb-1.5" style={{ color: "#1C1B2E" }}>
              سبب الإيقاف
            </label>
            <select
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value as typeof pauseReason)}
              disabled={pauseMutating}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-3 bg-white"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
            >
              <option value="PAYMENT_DELAY">تأخر الدفعة</option>
              <option value="CLIENT_REQUEST">طلب العميل</option>
              <option value="OTHER">أخرى</option>
            </select>

            <label className="block text-xs font-bold mb-1.5" style={{ color: "#1C1B2E" }}>
              ملاحظات (اختياري)
            </label>
            <textarea
              value={pauseNotes}
              onChange={(e) => setPauseNotes(e.target.value)}
              rows={3}
              disabled={pauseMutating}
              placeholder="أضف تفاصيل عن سبب الإيقاف"
              className="w-full px-3 py-2 rounded-lg text-sm outline-none mb-4 bg-white"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
            />

            <div className="flex gap-2">
              <MarsaButton
                variant="primary"
                size="md"
                className="flex-1"
                onClick={submitPause}
                loading={pauseMutating}
                disabled={pauseMutating}
                icon={!pauseMutating ? <Pause size={14} /> : undefined}
                style={{ backgroundColor: "#DC2626" }}
              >
                إيقاف المشروع
              </MarsaButton>
              <MarsaButton
                variant="secondary"
                size="md"
                onClick={() => setPauseModal(null)}
                disabled={pauseMutating}
              >
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Delay / pause-report modal */}
      {delayModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDelayModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
                >
                  <BarChart3 size={20} style={{ color: "#5E5495" }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                    تقرير التأخير
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                    {delayModal.projectName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MarsaButton
                  variant="secondary"
                  size="sm"
                  icon={<Download size={13} />}
                  disabled={!delayReport || delayLoading}
                  onClick={() => {
                    if (!delayReport || !delayModal) return;
                    exportDelayReportPDF({
                      projectName: delayModal.projectName,
                      projectCode: delayModal.projectCode,
                      departmentName: delayModal.departmentName,
                      clientName: null,
                      startDate: delayReport.startDate,
                      originalEndDate: delayReport.originalEndDate,
                      adjustedEndDate: delayReport.adjustedEndDate,
                      isPaused: delayReport.isPaused,
                      totalPausedDays: delayReport.totalPausedDays,
                      periods: delayReport.periods,
                    });
                  }}
                  style={{ color: "#5E5495" }}
                >
                  ⬇ تصدير PDF
                </MarsaButton>
                <button
                  onClick={() => setDelayModal(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                  style={{ color: "#9CA3AF" }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5">
              {delayLoading || !delayReport ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : (
                (() => {
                  const report = delayReport;
                  const reasonLabel = (r: string) => {
                    if (r === "PAYMENT_DELAY") return "تأخر الدفعة";
                    if (r === "CLIENT_REQUEST") return "طلب العميل";
                    if (r === "OTHER") return "أخرى";
                    return r;
                  };
                  const dateFmt = (d: string | null) =>
                    d
                      ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—";

                  if (report.periods.length === 0 && report.totalPausedDays === 0) {
                    return (
                      <div className="text-center py-10">
                        <CheckCircle2 size={48} className="mx-auto mb-3" style={{ color: "#22C55E" }} />
                        <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
                          لا يوجد تأخير مسجّل ✓
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                          هذا المشروع لم يُوقَف من قبل.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {/* Summary cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: "rgba(220,38,38,0.06)" }}
                        >
                          <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                            إجمالي أيام الإيقاف
                          </p>
                          <p className="text-xl font-bold" style={{ color: "#DC2626" }}>
                            {report.totalPausedDays.toLocaleString("en-US")} يوم
                          </p>
                        </div>
                        <div
                          className="p-3 rounded-xl"
                          style={{
                            backgroundColor: report.isPaused ? "rgba(220,38,38,0.1)" : "rgba(34,197,94,0.06)",
                          }}
                        >
                          <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                            الحالة
                          </p>
                          <p
                            className="text-sm font-bold"
                            style={{ color: report.isPaused ? "#DC2626" : "#16A34A" }}
                          >
                            {report.isPaused ? "موقوف حالياً" : "نشط"}
                          </p>
                        </div>
                        <div
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: "rgba(94,84,149,0.06)" }}
                        >
                          <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                            تاريخ الانتهاء الأصلي
                          </p>
                          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                            {dateFmt(report.originalEndDate)}
                          </p>
                        </div>
                        <div
                          className="p-3 rounded-xl"
                          style={{ backgroundColor: "rgba(201,168,76,0.08)" }}
                        >
                          <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                            تاريخ الانتهاء المعدّل
                          </p>
                          <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                            {dateFmt(report.adjustedEndDate)}
                          </p>
                        </div>
                      </div>

                      {/* Periods list */}
                      {report.periods.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold mb-2" style={{ color: "#1C1B2E" }}>
                            فترات الإيقاف ({report.periods.length})
                          </h4>
                          <div className="space-y-2">
                            {report.periods.map((p, idx) => (
                              <div
                                key={p.id}
                                className="p-3 rounded-xl"
                                style={{
                                  border: "1px solid #F0EDE6",
                                  backgroundColor: p.isOpen ? "rgba(220,38,38,0.04)" : "#FAFAF7",
                                }}
                              >
                                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>
                                    #{idx + 1} — {reasonLabel(p.reason)}
                                  </span>
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: p.isOpen
                                        ? "rgba(220,38,38,0.12)"
                                        : "rgba(148,163,184,0.15)",
                                      color: p.isOpen ? "#DC2626" : "#64748B",
                                    }}
                                  >
                                    {p.days} يوم{p.isOpen ? " (جارٍ)" : ""}
                                  </span>
                                </div>
                                <div className="text-[11px]" style={{ color: "#6B7280" }}>
                                  {dateFmt(p.startDate)} → {p.endDate ? dateFmt(p.endDate) : "حتى الآن"}
                                </div>
                                <div
                                  className="flex items-center gap-3 text-[10px] mt-1"
                                  style={{ color: "#9CA3AF" }}
                                >
                                  {p.pausedBy && <span>أوقف: {p.pausedBy.name}</span>}
                                  {p.resumedBy && <span>استأنف: {p.resumedBy.name}</span>}
                                </div>
                                {p.notes && (
                                  <p
                                    className="text-[11px] mt-2 p-2 rounded"
                                    style={{ backgroundColor: "#F8F6EE", color: "#4B5563" }}
                                  >
                                    {p.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
