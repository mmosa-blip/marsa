"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ListChecks,
  Search,
  Filter,
  Loader2,
  Play,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  CircleDot,
  Clock,
  CircleCheckBig,
  Layers,
  ArrowLeftRight,
  X,
  Lock,
  Archive,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useSession } from "next-auth/react";
import { useLang } from "@/contexts/LanguageContext";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";

interface TaskTimeSummary {
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  waitingDuration: number | null;
  executionDuration: number | null;
  totalDuration: number | null;
  isLate: boolean;
}

interface ExternalProviderLink {
  id: string;
  provider: { id: string; name: string; phone?: string | null };
  providerStatus: string;
  completedAt: string | null;
  completedByProvider: boolean;
  reminders: { id: string; remindedAt: string }[];
  _count: { reminders: number };
}

interface GovernmentHold {
  id: string;
  entity: string | null;
  isActive: boolean;
  updates: { id: string; note: string; addedAt: string; addedBy: { name: string } }[];
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  updatedAt: string;
  assignedAt: string | null;
  canStart: boolean;
  blockReason?: string | null;
  startedById?: string | null;
  startedBy?: { id: string; name: string } | null;
  assignments?: { user: { id: string; name: string } }[];
  service: { id: string; name: string } | null;
  project: {
    id: string;
    name: string;
    isQuickService?: boolean;
    client: { id: string; name: string } | null;
  } | null;
  timeSummary?: TaskTimeSummary | null;
  waitingMode?: string | null;
  externalProviders?: ExternalProviderLink[];
  governmentHolds?: GovernmentHold[];
  isTransferred?: boolean;
  transferInfo?: {
    id: string;
    status: string;
    reason: string;
    fromUser: string | null;
    toUser: string | null;
    targetUserId: string;
    requesterId: string;
  } | null;
}

interface ApiResponse {
  tasks: Task[];
  total: number;
  page: number;
  totalPages: number;
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO: { label: "جديدة", bg: "#EFF6FF", text: "#2563EB" },
  WAITING: { label: "في الانتظار", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#FFF7ED", text: "#EA580C" },
  IN_REVIEW: { label: "قيد المراجعة", bg: "#F5F3FF", text: "#7C3AED" },
  DONE: { label: "مكتملة", bg: "#ECFDF5", text: "#059669" },
  CANCELLED: { label: "ملغاة", bg: "#FEF2F2", text: "#DC2626" },
  WAITING_EXTERNAL: { label: "بانتظار جهة خارجية", bg: "#FEF3C7", text: "#92400E" },
};

const priorityConfig: Record<string, { label: string; bg: string; text: string }> = {
  LOW: { label: "منخفضة", bg: "#F1F5F9", text: "#94A3B8" },
  MEDIUM: { label: "متوسطة", bg: "#FFFBEB", text: "#D97706" },
  HIGH: { label: "عالية", bg: "#FFF7ED", text: "#EA580C" },
  URGENT: { label: "عاجلة", bg: "#FEF2F2", text: "#DC2626" },
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return "أقل من دقيقة";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "يوم" : "أيام"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "ساعة" : "ساعات"}`);
  if (mins > 0 && days === 0) parts.push(`${mins} دقيقة`);
  return parts.join(" ") || "—";
};

const getElapsedMinutes = (from: string): number => {
  return Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000));
};

export default function MyTasksPage() {
  const { data: session } = useSession();
  const { t } = useLang();
  const { refreshCounts } = useSidebarCounts();
  const currentUserId = session?.user?.id || "";
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Bulk selection
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Waiting mode
  const [providers, setProviders] = useState<{ id: string; name: string; phone?: string | null; specialization?: string | null }[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<Record<string, string>>({});
  const [govEntities, setGovEntities] = useState<Record<string, string>>({});
  const [govUpdateNotes, setGovUpdateNotes] = useState<Record<string, string>>({});
  const [waitingLoading, setWaitingLoading] = useState<Record<string, boolean>>({});

  // Transfer modal
  const [transferModal, setTransferModal] = useState<string | null>(null);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferUrgency, setTransferUrgency] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferUsers, setTransferUsers] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Completed tasks section
  const [completedData, setCompletedData] = useState<ApiResponse | null>(null);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);

  const [, setTick] = useState(0);

  useEffect(() => { document.title = `${t.tasks.myTasks} | ${t.brand.name}`; }, [t]);

  // Fetch external providers on mount
  useEffect(() => {
    fetch("/api/external-providers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, []);

  // Fetch users for transfer modal
  useEffect(() => {
    if (transferModal) {
      fetch("/api/users?transferTargets=true")
        .then((r) => r.json())
        .then((d) => {
          const users = d.users || (Array.isArray(d) ? d : []);
          setTransferUsers(users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
        })
        .catch(() => {});
    }
  }, [transferModal]);

  const handleTransferSubmit = async () => {
    if (!transferModal || !transferTargetId || !transferReason) return;
    setTransferLoading(true);
    try {
      const res = await fetch(`/api/tasks/${transferModal}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: transferTargetId, reason: transferReason, urgency: transferUrgency }),
      });
      if (res.ok) {
        setTransferModal(null);
        setTransferTargetId("");
        setTransferReason("");
        setTransferUrgency("NORMAL");
        fetchTasks();
        refreshCounts();
      }
    } catch {
      /* ignore */
    } finally {
      setTransferLoading(false);
    }
  };

  // Live timer tick every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    // If a specific status filter is chosen AND it's a completed status, search in completed section
    if (statusFilter && !["DONE", "CANCELLED"].includes(statusFilter)) {
      params.set("status", statusFilter);
    } else if (!statusFilter) {
      // Default: show only active tasks (exclude DONE and CANCELLED)
      params.set("status", "TODO,WAITING,IN_PROGRESS,IN_REVIEW,WAITING_EXTERNAL");
    }
    if (priorityFilter) params.set("priority", priorityFilter);
    if (projectFilter) params.set("project", projectFilter);
    if (serviceFilter) params.set("service", serviceFilter);
    if (timeFilter) params.set("time", timeFilter);
    if (search) params.set("search", search);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    params.set("limit", "15");

    fetch(`/api/my-tasks/all?${params}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, priorityFilter, projectFilter, serviceFilter, timeFilter, search, dateFrom, dateTo, page]);

  useEffect(() => {
    const timer = setTimeout(fetchTasks, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchTasks]);

  // Re-fetch when window gains focus (handles tab switching and navigation back)
  useEffect(() => {
    const handleFocus = () => fetchTasks();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchTasks]);

  // Fetch completed/cancelled tasks
  const fetchCompletedTasks = useCallback(() => {
    setCompletedLoading(true);
    const params = new URLSearchParams();
    params.set("status", "DONE,CANCELLED");
    params.set("page", String(completedPage));
    params.set("limit", "15");
    fetch(`/api/my-tasks/all?${params}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setCompletedData(d);
        setCompletedLoading(false);
      })
      .catch(() => setCompletedLoading(false));
  }, [completedPage]);

  // Fetch completed when expanded or page changes
  useEffect(() => {
    if (completedExpanded) {
      fetchCompletedTasks();
    }
  }, [completedExpanded, fetchCompletedTasks]);

  // Refresh completed count on actions + data changes
  const [completedTotal, setCompletedTotal] = useState(0);
  useEffect(() => {
    fetch("/api/my-tasks/all?status=DONE,CANCELLED&limit=1")
      .then((r) => r.json())
      .then((d: ApiResponse) => setCompletedTotal(d?.total || 0))
      .catch(() => {});
    // Also refresh completed list if expanded
    if (completedExpanded) {
      fetchCompletedTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionLoading, bulkLoading, data]);

  const tasks = data?.tasks || [];

  // Clear selection when data changes
  useEffect(() => {
    setSelectedTasks(new Set());
  }, [data]);

  // Stats counts from all tasks
  const [stats, setStats] = useState({ TODO: 0, IN_PROGRESS: 0, DONE: 0 });
  const [myServicesCount, setMyServicesCount] = useState(0);

  useEffect(() => {
    const statuses = ["TODO", "IN_PROGRESS", "DONE"];
    Promise.all([
      ...statuses.map((s) =>
        fetch(`/api/my-tasks/all?status=${s}&limit=1`)
          .then((r) => r.json())
          .then((d: ApiResponse) => ({ status: s, count: d?.total || 0 }))
      ),
      fetch("/api/my-tasks/all?limit=999")
        .then((r) => r.json())
        .then((d: ApiResponse) => {
          const serviceIds = new Set((d.tasks || []).map((t) => t.service?.id).filter(Boolean));
          setMyServicesCount(serviceIds.size);
        }),
    ]).then((results) => {
      const newStats: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
      results.forEach((r) => {
        if (r && typeof r === "object" && "status" in r) {
          newStats[r.status] = r.count;
        }
      });
      setStats(newStats as typeof stats);
    }).catch(() => {});
  }, [actionLoading, bulkLoading]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (actionLoading) return;
    setActionLoading(taskId);
    try {
      const res = await fetch(`/api/my-tasks/${taskId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTasks();
        refreshCounts();
      } else {
        fetchTasks();
      }
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  };

  const selectedTaskObjects = tasks.filter((t) => selectedTasks.has(t.id));
  const hasWaitingSelected = selectedTaskObjects.some((t) => t.canStart === false);
  const bulkDisabled = hasWaitingSelected || bulkLoading;

  const handleBulkAction = async (newStatus: string) => {
    if (bulkDisabled) return;
    const targetIds = selectedTaskObjects
      .filter((t) =>
        newStatus === "IN_PROGRESS" ? t.status === "TODO" :
        newStatus === "DONE" ? t.status === "IN_PROGRESS" : false
      )
      .map((t) => t.id);
    if (targetIds.length === 0) return;

    setBulkLoading(true);
    try {
      const res = await fetch("/api/my-tasks/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds: targetIds, status: newStatus }),
      });
      if (res.ok) {
        setSelectedTasks(new Set());
        fetchTasks();
        refreshCounts();
      }
    } catch {
      /* ignore */
    } finally {
      setBulkLoading(false);
    }
  };

  // Waiting mode handlers
  const setWaitingMode = async (taskId: string, mode: string | null, extras?: Record<string, string>) => {
    setWaitingLoading((p) => ({ ...p, [taskId]: true }));
    await fetch(`/api/my-tasks/${taskId}/waiting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, ...extras }),
    });
    setWaitingLoading((p) => ({ ...p, [taskId]: false }));
    fetchTasks();
  };

  const sendProviderReminder = async (taskId: string, linkId: string) => {
    setWaitingLoading((p) => ({ ...p, [taskId]: true }));
    await fetch(`/api/my-tasks/${taskId}/remind-provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    setWaitingLoading((p) => ({ ...p, [taskId]: false }));
    fetchTasks();
  };

  const markProviderDone = async (taskId: string, linkId: string, action?: string) => {
    await fetch(`/api/my-tasks/${taskId}/provider-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, action: action || "complete", completedByProvider: false }),
    });
    fetchTasks();
  };

  const addGovUpdate = async (taskId: string, holdId: string) => {
    const note = govUpdateNotes[taskId];
    if (!note?.trim()) return;
    await fetch(`/api/my-tasks/${taskId}/government-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId, note }),
    });
    setGovUpdateNotes((p) => ({ ...p, [taskId]: "" }));
    fetchTasks();
  };

  const completeTask = async (taskId: string) => {
    await fetch(`/api/my-tasks/${taskId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DONE" }),
    });
    fetchTasks();
  };

  const activeTotalTasks = data?.total || 0;

  const statCards = [
    { label: t.tasks.status.TODO, value: stats.TODO, icon: CircleDot, color: "#2563EB", bg: "rgba(37,99,235,0.06)" },
    { label: t.tasks.status.IN_PROGRESS, value: stats.IN_PROGRESS, icon: Clock, color: "#EA580C", bg: "rgba(234,88,12,0.06)" },
    { label: t.tasks.services, value: myServicesCount, icon: Layers, color: "#7C3AED", bg: "rgba(124,58,237,0.06)" },
    { label: t.tasks.status.DONE, value: stats.DONE, icon: CircleCheckBig, color: "#059669", bg: "rgba(5,150,105,0.06)" },
  ];

  const handleTransferAction = async (transferId: string, action: string) => {
    setActionLoading(transferId);
    try {
      const res = await fetch(`/api/task-transfers/${transferId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "حدث خطأ");
        return;
      }
      fetchTasks();
      refreshCounts();
    } catch {
      alert("حدث خطأ في الاتصال");
    } finally {
      setActionLoading(null);
    }
  };

  const getActionButton = (task: Task) => {
    if (actionLoading === task.id || (task.transferInfo && actionLoading === task.transferInfo.id)) {
      return (
        <Loader2 size={16} className="animate-spin" style={{ color: "#1C1B2E" }} />
      );
    }

    // Transfer actions take priority over everything
    if (task.transferInfo) {
      const ti = task.transferInfo;
      // PENDING_TARGET and current user is the target → show accept/decline/complete buttons
      if (ti.status === "PENDING_TARGET" && ti.targetUserId === currentUserId) {
        return (
          <div className="flex items-center gap-1">
            <MarsaButton
              onClick={() => handleTransferAction(ti.id, "accept")}
              variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
              style={{ backgroundColor: "#059669" }}
            >
              قبول
            </MarsaButton>
            <MarsaButton
              onClick={() => handleTransferAction(ti.id, "accept_complete")}
              variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
              style={{ backgroundColor: "#047857" }}
            >
              إكمال مباشرة
            </MarsaButton>
            <MarsaButton
              onClick={() => handleTransferAction(ti.id, "decline")}
              variant="danger" size="xs" icon={<X size={13} />}
            >
              رفض
            </MarsaButton>
          </div>
        );
      }
      // PENDING_ADMIN → show waiting text
      if (ti.status === "PENDING_ADMIN") {
        return (
          <span className="text-xs font-medium" style={{ color: "#A16207" }}>
            بانتظار موافقة الإدارة
          </span>
        );
      }
    }

    // Multi-executor lock: if IN_PROGRESS and started by someone else
    const startedByOther = task.status === "IN_PROGRESS" && task.startedById && task.startedById !== currentUserId;

    switch (task.status) {
      case "TODO":
        if (task.canStart === false) {
          return task.blockReason === "payment" ? (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#DC2626" }}>
              <Lock size={12} />
              {t.tasks.lockedByPayment}
            </span>
          ) : (
            <span className="text-xs" style={{ color: "#EA580C" }}>{t.tasks.cannotStart}</span>
          );
        }
        return (
          <MarsaButton
            onClick={() => handleStatusChange(task.id, "IN_PROGRESS")}
            variant="primary" size="xs" icon={<Play size={13} />}
            style={{ backgroundColor: "#2563EB" }}
            title={t.tasks.start}
          >
            {t.tasks.start}
          </MarsaButton>
        );
      case "IN_PROGRESS":
        if (startedByOther) {
          return (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: "#FEF9C3", color: "#CA8A04" }}>
              <Lock size={13} />
              {task.startedBy?.name || "—"}
            </div>
          );
        }
        return (
          <MarsaButton
            onClick={() => handleStatusChange(task.id, "DONE")}
            variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
            style={{ backgroundColor: "#059669" }}
            title={t.tasks.complete}
          >
            {t.tasks.complete}
          </MarsaButton>
        );
      default:
        return null;
    }
  };

  // Current + Next task computation
  const currentTask = tasks.find((t) => t.status === "IN_PROGRESS");
  const nextTask = tasks.find((t) => t.status === "TODO" && t.id !== currentTask?.id);

  // Pending acceptance — ONLY tasks that arrived via an admin-approved transfer.
  // Auto-assigned tasks always have acceptedAt set, so the (!acceptedAt + assigned)
  // filter naturally isolates transferred-and-not-yet-accepted tasks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingAcceptance = (tasks as any[]).filter((t) =>
    !t.acceptedAt && t.assignedAt && (t.status === "TODO" || t.status === "WAITING")
  );

  const handleAccept = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/accept`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } catch {}
  };

  const handleReject = async (taskId: string) => {
    const reason = prompt("سبب رفض المهمة:");
    if (!reason || !reason.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || "حدث خطأ");
      }
    } catch {
      alert("حدث خطأ");
    }
  };

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            {t.tasks.myTasks}
          </h1>
          <span
            className="px-3 py-1 rounded-full text-sm font-semibold"
            style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
          >
            {activeTotalTasks.toLocaleString("en-US")}
          </span>
        </div>
        <p className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>
          {t.tasks.allTasks}
        </p>
      </div>

      {/* Pending Acceptance Alert — only for tasks transferred from another executor */}
      {pendingAcceptance.length > 0 && (
        <div className="mb-6 rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(234,88,12,0.06)", border: "2px solid rgba(234,88,12,0.3)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: "rgba(234,88,12,0.1)" }}>
            <Clock size={18} style={{ color: "#EA580C" }} />
            <span className="text-sm font-bold" style={{ color: "#EA580C" }}>
              مهام محوّلة بانتظار القبول ({pendingAcceptance.length})
            </span>
            <span className="text-[10px]" style={{ color: "#EA580C" }}>
              — تم تحويلها إليك من منفذ آخر بموافقة الإدارة
            </span>
          </div>
          <div className="p-3 space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {pendingAcceptance.slice(0, 5).map((task: any) => (
              <div key={task.id} className="bg-white rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                    {task.title}
                  </p>
                  {task.service?.name && (
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      {task.service.name}
                    </p>
                  )}
                  {task.project?.name && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>
                      📁 {task.project.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <MarsaButton variant="gold" size="sm" onClick={() => handleAccept(task.id)}>
                    قبول
                  </MarsaButton>
                  <MarsaButton variant="dangerSoft" size="sm" onClick={() => handleReject(task.id)}>
                    رفض
                  </MarsaButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current + Next Task Panel */}
      {(currentTask || nextTask) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Current task */}
          <div className="bg-white rounded-2xl p-5 relative overflow-hidden" style={{ border: "2px solid rgba(234,88,12,0.3)" }}>
            <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-2xl text-[10px] font-bold" style={{ backgroundColor: "#EA580C", color: "#fff" }}>
              المهمة الحالية
            </div>
            <div className="flex items-center gap-2 mb-2 mt-3">
              <Clock size={16} style={{ color: "#EA580C" }} />
              <span className="text-xs font-semibold" style={{ color: "#EA580C" }}>قيد التنفيذ</span>
            </div>
            {currentTask ? (
              <>
                <p className="text-base font-bold mb-1" style={{ color: "#1C1B2E" }}>
                  {currentTask.title}
                </p>
                {currentTask.service && (
                  <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                    {currentTask.service.name}
                  </p>
                )}
                {currentTask.project && (
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    📁 {currentTask.project.name}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm py-4" style={{ color: "#9CA3AF" }}>لا توجد مهمة قيد التنفيذ — ابدأ مهمة من قائمة المهام أدناه</p>
            )}
          </div>

          {/* Next task */}
          <div className="bg-white rounded-2xl p-5 relative overflow-hidden" style={{ border: "2px solid rgba(201,168,76,0.3)" }}>
            <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-2xl text-[10px] font-bold" style={{ backgroundColor: "#C9A84C", color: "#fff" }}>
              المهمة القادمة
            </div>
            <div className="flex items-center gap-2 mb-2 mt-3">
              <ChevronLeft size={16} style={{ color: "#C9A84C" }} />
              <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>التالية</span>
            </div>
            {nextTask ? (
              <>
                <p className="text-base font-bold mb-1" style={{ color: "#1C1B2E" }}>
                  {nextTask.title}
                </p>
                {nextTask.service && (
                  <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                    {nextTask.service.name}
                  </p>
                )}
                {nextTask.project && (
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    📁 {nextTask.project.name}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm py-4" style={{ color: "#9CA3AF" }}>لا توجد مهام قادمة</p>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>
                {s.label}
              </span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: s.bg }}
              >
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value.toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`${t.common.search}...`}
            className="flex-1 py-2 text-sm outline-none"
            style={{ color: "#2D3748", backgroundColor: "transparent" }}
          />
        </div>
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">{t.common.all}</option>
          <option value="TODO">{t.tasks.status.TODO}</option>
          <option value="WAITING">{(t.tasks.status as Record<string, string>)["WAITING"] || "في الانتظار"}</option>
          <option value="IN_PROGRESS">{t.tasks.status.IN_PROGRESS}</option>
          <option value="IN_REVIEW">{(t.tasks.status as Record<string, string>)["IN_REVIEW"] || "قيد المراجعة"}</option>
          <option value="WAITING_EXTERNAL">{(t.tasks.status as Record<string, string>)["WAITING_EXTERNAL"] || "بانتظار جهة خارجية"}</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">{t.common.all}</option>
          <option value="LOW">{t.tasks.priority.LOW}</option>
          <option value="MEDIUM">{t.tasks.priority.MEDIUM}</option>
          <option value="HIGH">{t.tasks.priority.HIGH}</option>
          <option value="URGENT">{t.tasks.priority.URGENT}</option>
        </select>
        {/* Service Filter */}
        <select value={serviceFilter} onChange={e => { setServiceFilter(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ border: "1px solid #E2E0D8", backgroundColor: "white", color: "#1C1B2E" }}>
          <option value="">{t.tasks.allServices}</option>
          {tasks.flatMap((t: Task) => t.service?.name ? [t.service.name] : [])
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
            .map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* Project Filter */}
        <select value={projectFilter} onChange={e => { setProjectFilter(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ border: "1px solid #E2E0D8", backgroundColor: "white", color: "#1C1B2E" }}>
          <option value="">{t.tasks.allProjects}</option>
          {tasks.flatMap((t: Task) => t.project?.name ? [t.project.name] : [])
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
            .map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
        {/* Time Filter */}
        <select value={timeFilter} onChange={e => { setTimeFilter(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ border: "1px solid #E2E0D8", backgroundColor: "white", color: "#1C1B2E" }}>
          <option value="">{t.tasks.allTimes}</option>
          <option value="today">{t.tasks.today}</option>
          <option value="overdue">{t.tasks.overdue}</option>
          <option value="future">{t.tasks.upcoming}</option>
        </select>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} style={{ color: "#94A3B8" }} />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white cursor-pointer"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            title={t.common.from}
          />
          <span className="text-xs" style={{ color: "#94A3B8" }}>{t.common.to}</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white cursor-pointer"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            title={t.common.to}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
        </div>
      ) : !data || !data.tasks || data.tasks.length === 0 ? (
        <div
          className="text-center py-20 bg-white rounded-2xl"
          style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <ListChecks size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>
            {t.tasks.noTasks}
          </p>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>
            {t.tasks.noTasksDesc}
          </p>
        </div>
      ) : (
        <>
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                    <th className="px-3 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded cursor-pointer accent-[#1B2A4A]"
                      />
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.tasks.title}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.tasks.project}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.projects.client}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.tickets.priority}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.tasks.dueDate}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.common.status}
                    </th>
                    <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.reports.totalTime}
                    </th>
                    <th className="text-center px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map((task) => {
                    const st = statusConfig[task.status] || { label: task.status, bg: "#F3F4F6", text: "#6B7280" };
                    const pr = priorityConfig[task.priority] || { label: task.priority, bg: "#F3F4F6", text: "#6B7280" };
                    const isOverdue =
                      task.dueDate &&
                      task.status !== "DONE" &&
                      task.status !== "CANCELLED" &&
                      new Date(task.dueDate) < new Date();
                    const isSelected = selectedTasks.has(task.id);

                    return (
                    <React.Fragment key={task.id}>
                      <tr
                        className="transition-colors hover:bg-[#FAFAF8]"
                        style={{
                          borderBottom: "1px solid #F0EDE6",
                          backgroundColor: task.isTransferred ? "rgba(94,84,149,0.04)" : isSelected ? "rgba(201,168,76,0.04)" : undefined,
                          borderRight: task.isTransferred ? "3px solid #5E5495" : undefined,
                        }}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(task.id)}
                            className="w-4 h-4 rounded cursor-pointer accent-[#1B2A4A]"
                          />
                        </td>
                        {/* Title */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
                              {task.title}
                            </p>
                            {task.isTransferred && task.transferInfo && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
                                style={{
                                  backgroundColor: task.transferInfo.status === "PENDING_ADMIN" ? "#FEF9C3"
                                    : task.transferInfo.status === "PENDING_TARGET" ? "#DBEAFE"
                                    : "rgba(94,84,149,0.1)",
                                  color: task.transferInfo.status === "PENDING_ADMIN" ? "#A16207"
                                    : task.transferInfo.status === "PENDING_TARGET" ? "#1D4ED8"
                                    : "#5E5495",
                                }}
                                title={`${task.transferInfo.status === "PENDING_ADMIN" ? "بانتظار الإدارة" : task.transferInfo.status === "PENDING_TARGET" ? "بانتظار المستهدف" : "محولة"} — من: ${task.transferInfo.fromUser || "—"} إلى: ${task.transferInfo.toUser || "—"}`}
                              >
                                {task.transferInfo.status === "PENDING_ADMIN" ? "تحويل معلق" : task.transferInfo.status === "PENDING_TARGET" ? "بانتظار القبول" : "محولة"}
                              </span>
                            )}
                          </div>
                          {task.service && (
                            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                              {task.service.name}
                            </p>
                          )}
                          {task.assignedAt && (
                            <span className="text-xs" style={{ color: "#94A3B8" }}>
                              {t.tasks.assignedAt}: {formatDate(task.assignedAt)}
                            </span>
                          )}
                        </td>
                        {/* Project */}
                        <td className="px-5 py-4">
                          <span className="text-sm flex items-center gap-1.5" style={{ color: "#2D3748" }}>
                            {task.project?.name || "—"}
                            {task.project?.isQuickService && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>سريعة</span>
                            )}
                          </span>
                        </td>
                        {/* Client */}
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: "#2D3748" }}>
                            {task.project?.client?.name || "—"}
                          </span>
                        </td>
                        {/* Priority */}
                        <td className="px-5 py-4">
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ backgroundColor: pr.bg, color: pr.text }}
                          >
                            {(t.tasks.priority as Record<string, string>)[task.priority] || pr.label}
                          </span>
                        </td>
                        {/* Due Date */}
                        <td className="px-5 py-4">
                          <span
                            className="text-sm"
                            style={{ color: isOverdue ? "#DC2626" : "#2D3748", fontWeight: isOverdue ? 600 : 400 }}
                          >
                            {formatDate(task.dueDate)}
                          </span>
                          {isOverdue && (
                            <p className="text-xs mt-0.5" style={{ color: "#DC2626" }}>
                              {t.tasks.overdue}
                            </p>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-5 py-4">
                          <span
                            className="px-3 py-1.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: st.bg, color: st.text }}
                          >
                            {(t.tasks.status as Record<string, string>)[task.status] || st.label}
                          </span>
                        </td>
                        {/* Timer */}
                        <td className="px-5 py-4">
                          {(() => {
                            if (task.status === "DONE" && task.timeSummary?.executionDuration != null) {
                              return (
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} style={{ color: "#059669" }} />
                                  <span className="text-xs font-medium" style={{ color: "#059669" }}>
                                    {formatDuration(task.timeSummary.executionDuration)}
                                  </span>
                                </div>
                              );
                            }
                            if (task.status === "IN_PROGRESS") {
                              const from = task.timeSummary?.startedAt || task.updatedAt;
                              const elapsed = getElapsedMinutes(from);
                              return (
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} style={{ color: "#EA580C" }} />
                                  <span className="text-xs font-medium" style={{ color: "#EA580C" }}>
                                    {formatDuration(elapsed)}
                                  </span>
                                </div>
                              );
                            }
                            if (task.status === "TODO" && task.assignedAt) {
                              const elapsed = getElapsedMinutes(task.assignedAt);
                              const overdue = task.dueDate && new Date(task.dueDate) < new Date();
                              return (
                                <div className="flex items-center gap-1.5">
                                  <Clock size={14} style={{ color: overdue ? "#DC2626" : "#94A3B8" }} />
                                  <span className="text-xs font-medium" style={{ color: overdue ? "#DC2626" : "#94A3B8" }}>
                                    {formatDuration(elapsed)}
                                  </span>
                                </div>
                              );
                            }
                            return <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>;
                          })()}
                        </td>
                        {/* Actions */}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-1">
                            {getActionButton(task)}
                            {task.status !== "DONE" && task.status !== "CANCELLED" && !task.isTransferred && (
                              <MarsaButton
                                onClick={() => setTransferModal(task.id)}
                                variant="outline" size="xs" icon={<ArrowLeftRight size={13} />}
                                style={{ backgroundColor: "rgba(94,84,149,0.1)", border: "1px solid transparent" }}
                                title={t.tasks.transfer}
                              >
                                {t.tasks.transfer}
                              </MarsaButton>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* ── WAITING MODE PANEL ── */}
                      {task.status === "IN_PROGRESS" && (
                        <tr>
                          <td colSpan={9} className="px-5 pb-4 pt-0">
                            <div className="border-t pt-3" style={{ borderColor: "#F0EDE6" }}>
                              {/* Mode selector — no waiting mode yet */}
                              {!task.waitingMode && (
                                <div>
                                  <p className="text-xs font-semibold mb-2" style={{ color: "#6B7280" }}>
                                    هل تنتظر جهة خارجية؟
                                  </p>
                                  <div className="flex gap-2 max-w-md">
                                    <button
                                      onClick={() => setWaitingMode(task.id, "PROVIDER")}
                                      disabled={waitingLoading[task.id]}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                                      style={{ borderColor: "#C9A84C", color: "#C9A84C", backgroundColor: "rgba(201,168,76,0.05)" }}
                                    >
                                      مزود خارجي
                                    </button>
                                    <button
                                      onClick={() => setWaitingMode(task.id, "GOVERNMENT")}
                                      disabled={waitingLoading[task.id]}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                                      style={{ borderColor: "#5E5495", color: "#5E5495", backgroundColor: "rgba(94,84,149,0.05)" }}
                                    >
                                      جهة حكومية
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* PROVIDER MODE */}
                              {task.waitingMode === "PROVIDER" && (() => {
                                const link = task.externalProviders?.[0];
                                return (
                                  <div className="rounded-xl p-3 max-w-lg" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold" style={{ color: "#92400E" }}>انتظار مزود خارجي</span>
                                      </div>
                                      <MarsaButton
                                        onClick={() => setWaitingMode(task.id, null)}
                                        variant="secondary" size="xs"
                                      >
                                        إلغاء
                                      </MarsaButton>
                                    </div>

                                    {!link && (
                                      <div className="space-y-2">
                                        <select
                                          value={selectedProviderIds[task.id] || ""}
                                          onChange={(e) => setSelectedProviderIds((p) => ({ ...p, [task.id]: e.target.value }))}
                                          className="w-full px-3 py-2 rounded-lg text-xs outline-none bg-white"
                                          style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                                        >
                                          <option value="">-- اختر مزود الخدمة --</option>
                                          {providers.map((prov) => (
                                            <option key={prov.id} value={prov.id}>
                                              {prov.name}{prov.specialization ? ` — ${prov.specialization}` : ""}
                                            </option>
                                          ))}
                                        </select>
                                        <MarsaButton
                                          onClick={() => setWaitingMode(task.id, "PROVIDER", { providerId: selectedProviderIds[task.id] })}
                                          disabled={!selectedProviderIds[task.id]}
                                          variant="gold" size="sm"
                                          className="w-full"
                                        >
                                          ربط المزود بالمهمة
                                        </MarsaButton>
                                      </div>
                                    )}

                                    {link && (
                                      <div>
                                        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-white">
                                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: "#C9A84C" }}>
                                            {link.provider.name.charAt(0)}
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-bold" style={{ color: "#1C1B2E" }}>{link.provider.name}</p>
                                            {link.provider.phone && <p className="text-xs" style={{ color: "#6B7280" }}>{link.provider.phone}</p>}
                                          </div>
                                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FEF9C3", color: "#CA8A04" }}>
                                            {link._count?.reminders || 0} تذكير
                                          </span>
                                        </div>

                                        {link.providerStatus === "COMPLETED" && (
                                          <div className="p-2 rounded-lg mb-2" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
                                            <p className="text-xs font-bold">المزود أنهى المهمة</p>
                                            <MarsaButton
                                              onClick={() => markProviderDone(task.id, link.id, "reopen")}
                                              variant="ghost" size="xs"
                                              className="mt-1"
                                              style={{ backgroundColor: "#FEF9C3", color: "#CA8A04" }}
                                            >
                                              إعادة فتح — غير مقبول
                                            </MarsaButton>
                                          </div>
                                        )}

                                        {link.providerStatus !== "COMPLETED" && (
                                          <div className="flex gap-2">
                                            <MarsaButton
                                              onClick={() => sendProviderReminder(task.id, link.id)}
                                              disabled={waitingLoading[task.id]}
                                              variant="primary" size="sm"
                                              className="flex-1"
                                            >
                                              تذكير المزود
                                            </MarsaButton>
                                            <MarsaButton
                                              onClick={() => completeTask(task.id)}
                                              variant="primary" size="sm"
                                              className="flex-1"
                                              style={{ backgroundColor: "#059669" }}
                                            >
                                              إكمال المهمة
                                            </MarsaButton>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* GOVERNMENT MODE */}
                              {task.waitingMode === "GOVERNMENT" && (() => {
                                const hold = task.governmentHolds?.[0];
                                return (
                                  <div className="rounded-xl p-3 max-w-lg" style={{ backgroundColor: "rgba(94,84,149,0.06)", border: "1px solid rgba(94,84,149,0.2)" }}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold" style={{ color: "#3730A3" }}>
                                          معلق — {hold?.entity || "جهة حكومية"}
                                        </span>
                                      </div>
                                      <MarsaButton
                                        onClick={() => setWaitingMode(task.id, null)}
                                        variant="secondary" size="xs"
                                      >
                                        إلغاء
                                      </MarsaButton>
                                    </div>

                                    {!hold && (
                                      <div className="space-y-2">
                                        <input
                                          placeholder="اسم الجهة الحكومية (اختياري)"
                                          value={govEntities[task.id] || ""}
                                          onChange={(e) => setGovEntities((p) => ({ ...p, [task.id]: e.target.value }))}
                                          className="w-full px-3 py-2 rounded-lg text-xs outline-none bg-white"
                                          style={{ border: "1px solid #E2E0D8" }}
                                        />
                                        <MarsaButton
                                          onClick={() => setWaitingMode(task.id, "GOVERNMENT", { governmentEntity: govEntities[task.id] })}
                                          variant="primary" size="sm"
                                          className="w-full"
                                        >
                                          تعليق المهمة
                                        </MarsaButton>
                                      </div>
                                    )}

                                    {hold && (
                                      <div>
                                        {hold.updates?.length > 0 && (
                                          <div className="mb-2 space-y-1 max-h-24 overflow-y-auto">
                                            {hold.updates.map((u) => (
                                              <div key={u.id} className="flex gap-2 text-xs p-1.5 rounded-lg bg-white">
                                                <span style={{ color: "#94A3B8", flexShrink: 0 }}>
                                                  {new Date(u.addedAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                <span style={{ color: "#2D3748" }}>{u.note}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        <div className="flex gap-2 mb-2">
                                          <input
                                            placeholder="تحديث معلومات — اكتب ملاحظة..."
                                            value={govUpdateNotes[task.id] || ""}
                                            onChange={(e) => setGovUpdateNotes((p) => ({ ...p, [task.id]: e.target.value }))}
                                            className="flex-1 px-3 py-2 rounded-lg text-xs outline-none bg-white"
                                            style={{ border: "1px solid #E2E0D8" }}
                                            onKeyDown={(e) => e.key === "Enter" && addGovUpdate(task.id, hold.id)}
                                          />
                                          <MarsaButton
                                            onClick={() => addGovUpdate(task.id, hold.id)}
                                            variant="primary" size="sm"
                                          >
                                            ↑
                                          </MarsaButton>
                                        </div>

                                        <MarsaButton
                                          onClick={() => completeTask(task.id)}
                                          variant="primary" size="sm"
                                          className="w-full"
                                          style={{ backgroundColor: "#059669" }}
                                        >
                                          إكمال المهمة
                                        </MarsaButton>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-6 bg-white rounded-2xl px-6 py-4"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.7 }}>
                {t.common.showing} {((data.page - 1) * 15 + 1).toLocaleString("en-US")} - {Math.min(data.page * 15, data.total).toLocaleString("en-US")} {t.common.of} {data.total.toLocaleString("en-US")} {t.common.results}
              </p>
              <div className="flex items-center gap-2">
                <MarsaButton
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  variant="secondary" size="sm" iconOnly icon={<ChevronRight size={16} />}
                  title={t.common.previous}
                />
                <span className="text-sm font-medium px-3" style={{ color: "#1C1B2E" }}>
                  {data.page.toLocaleString("en-US")} / {data.totalPages.toLocaleString("en-US")}
                </span>
                <MarsaButton
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={data.page >= data.totalPages}
                  variant="secondary" size="sm" iconOnly icon={<ChevronLeft size={16} />}
                  title={t.common.next}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ Completed & Cancelled Section ══════════════════════ */}
      {completedTotal > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setCompletedExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-4 rounded-2xl transition-all hover:shadow-sm"
            style={{
              backgroundColor: completedExpanded ? "#F5F4F0" : "#FAFAF8",
              border: "1px solid #E2E0D8",
            }}
          >
            <div className="flex items-center gap-3">
              <Archive size={18} style={{ color: "#94A3B8" }} />
              <span className="text-sm font-semibold" style={{ color: "#2D3748" }}>
                المهام المكتملة والملغاة
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}
              >
                {completedTotal}
              </span>
            </div>
            <ChevronDown
              size={18}
              style={{
                color: "#94A3B8",
                transform: completedExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            />
          </button>

          {completedExpanded && (
            <div className="mt-3">
              {completedLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin" style={{ color: "#94A3B8" }} />
                </div>
              ) : completedData && completedData.tasks && completedData.tasks.length > 0 ? (
                <>
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ backgroundColor: "#FAFAF8", border: "1px solid #E2E0D8" }}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr style={{ backgroundColor: "#F5F4F0", borderBottom: "1px solid #E2E0D8" }}>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.tasks.title}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.tasks.project}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.projects.client}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.common.status}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.reports.totalTime}
                            </th>
                            <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                              {t.tasks.dueDate}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {completedData.tasks.map((task) => {
                            const st = statusConfig[task.status] || { label: task.status, bg: "#F3F4F6", text: "#6B7280" };
                            return (
                              <tr
                                key={task.id}
                                className="transition-colors hover:bg-[#F0EEE8]"
                                style={{ borderBottom: "1px solid #EAE8E0" }}
                              >
                                <td className="px-5 py-3.5">
                                  <p className="text-sm font-medium" style={{ color: "#6B7280" }}>
                                    {task.title}
                                  </p>
                                  {task.service && (
                                    <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                                      {task.service.name}
                                    </p>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-sm flex items-center gap-1.5" style={{ color: "#6B7280" }}>
                                    {task.project?.name || "—"}
                                    {task.project?.isQuickService && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>سريعة</span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-sm" style={{ color: "#6B7280" }}>
                                    {task.project?.client?.name || "—"}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span
                                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                                    style={{ backgroundColor: st.bg, color: st.text }}
                                  >
                                    {(t.tasks.status as Record<string, string>)[task.status] || st.label}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5">
                                  {task.timeSummary?.executionDuration != null ? (
                                    <div className="flex items-center gap-1.5">
                                      <Clock size={14} style={{ color: "#059669" }} />
                                      <span className="text-xs font-medium" style={{ color: "#059669" }}>
                                        {formatDuration(task.timeSummary.executionDuration)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="text-sm" style={{ color: "#6B7280" }}>
                                    {formatDate(task.dueDate)}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Completed Pagination */}
                  {completedData.totalPages > 1 && (
                    <div
                      className="flex items-center justify-between mt-4 rounded-2xl px-6 py-3"
                      style={{ backgroundColor: "#FAFAF8", border: "1px solid #E2E0D8" }}
                    >
                      <p className="text-sm" style={{ color: "#2D3748", opacity: 0.7 }}>
                        {((completedData.page - 1) * 15 + 1).toLocaleString("en-US")} - {Math.min(completedData.page * 15, completedData.total).toLocaleString("en-US")} {t.common.of} {completedData.total.toLocaleString("en-US")}
                      </p>
                      <div className="flex items-center gap-2">
                        <MarsaButton
                          onClick={() => setCompletedPage((p) => Math.max(1, p - 1))}
                          disabled={completedData.page <= 1}
                          variant="secondary" size="xs" iconOnly icon={<ChevronRight size={14} />}
                        />
                        <span className="text-xs font-medium px-2" style={{ color: "#1C1B2E" }}>
                          {completedData.page} / {completedData.totalPages}
                        </span>
                        <MarsaButton
                          onClick={() => setCompletedPage((p) => Math.min(completedData.totalPages, p + 1))}
                          disabled={completedData.page >= completedData.totalPages}
                          variant="secondary" size="xs" iconOnly icon={<ChevronLeft size={14} />}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-center py-8 text-sm" style={{ color: "#94A3B8" }}>
                  لا توجد مهام مكتملة أو ملغاة
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transfer Modal */}
      {transferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4"
            dir="rtl"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
              >
                <ArrowLeftRight size={20} style={{ color: "#5E5495" }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {t.tasks.transferRequest}
              </h3>
            </div>

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
              {t.tasks.transferTo}
            </label>
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white cursor-pointer mb-4"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            >
              <option value="">{t.permissions.selectUser}</option>
              {transferUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
              الأولوية
            </label>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTransferUrgency("NORMAL")}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={transferUrgency === "NORMAL"
                  ? { backgroundColor: "#5E5495", color: "#fff" }
                  : { border: "1px solid #E2E0D8", color: "#2D3748" }}
              >
                عادي (24 ساعة)
              </button>
              <button
                type="button"
                onClick={() => setTransferUrgency("URGENT")}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={transferUrgency === "URGENT"
                  ? { backgroundColor: "#DC2626", color: "#fff" }
                  : { border: "1px solid #E2E0D8", color: "#2D3748" }}
              >
                عاجل (ساعة واحدة)
              </button>
            </div>

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
              {t.tasks.transferReason}
            </label>
            <textarea
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              rows={3}
              placeholder={t.tasks.transferReasonPlaceholder}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-5"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "#FAFAFE" }}
            />

            <div className="flex gap-3">
              <MarsaButton
                onClick={handleTransferSubmit}
                disabled={!transferTargetId || !transferReason || transferLoading}
                loading={transferLoading}
                variant="primary"
                icon={<ArrowLeftRight size={16} />}
                className="flex-1"
              >
                {t.common.confirm}
              </MarsaButton>
              <MarsaButton
                onClick={() => {
                  setTransferModal(null);
                  setTransferTargetId("");
                  setTransferReason("");
                  setTransferUrgency("NORMAL");
                }}
                variant="secondary"
              >
                {t.common.cancel}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedTasks.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl shadow-xl"
          style={{ backgroundColor: "#5E5495", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          <span className="text-sm font-semibold text-white">
            {selectedTasks.size} {t.tasks.title}
          </span>

          <div className="w-px h-6 bg-white/20" />

          <div className="relative group">
            <MarsaButton
              onClick={() => handleBulkAction("IN_PROGRESS")}
              disabled={bulkDisabled}
              loading={bulkLoading}
              variant="primary" size="sm"
              icon={<Play size={14} />}
              style={{ backgroundColor: bulkDisabled ? "#4B5563" : "#2563EB" }}
            >
              {t.tasks.startAll}
            </MarsaButton>
            {hasWaitingSelected && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {t.tasks.cannotStart}
              </div>
            )}
          </div>

          <div className="relative group">
            <MarsaButton
              onClick={() => handleBulkAction("DONE")}
              disabled={bulkDisabled}
              loading={bulkLoading}
              variant="primary" size="sm"
              icon={<CheckCircle2 size={14} />}
              style={{ backgroundColor: bulkDisabled ? "#4B5563" : "#059669" }}
            >
              {t.tasks.completeAll}
            </MarsaButton>
            {hasWaitingSelected && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {t.tasks.cannotStart}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/20" />

          <MarsaButton
            onClick={() => setSelectedTasks(new Set())}
            variant="ghost" size="sm"
            icon={<X size={14} />}
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {t.tasks.cancelSelection}
          </MarsaButton>
        </div>
      )}
    </div>
  );
}
