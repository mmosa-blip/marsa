"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Search,
  Loader2,
  CheckCircle2,
  Play,
  X,
  Clock,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Status =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED";

interface IssueRow {
  id: string;
  severity: Severity;
  status: Status;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  reportedBy: { id: string; name: string };
  assignedTo: { id: string; name: string } | null;
  recordItem: {
    id: string;
    title: string;
    description: string | null;
    createdAt: string;
    project: {
      id: string;
      name: string;
      projectCode: string | null;
      status: string;
      client: { id: string; name: string } | null;
    } | null;
    service: { id: string; name: string } | null;
    taskLinks: { task: { id: string; title: string; assigneeId: string | null } }[];
  };
}

const SEVERITY_META: Record<Severity, { label: string; bg: string; color: string }> = {
  LOW: { label: "منخفضة", bg: "rgba(107,114,128,0.12)", color: "#6B7280" },
  MEDIUM: { label: "متوسطة", bg: "rgba(234,88,12,0.12)", color: "#EA580C" },
  HIGH: { label: "عالية", bg: "rgba(220,38,38,0.12)", color: "#DC2626" },
  CRITICAL: { label: "حرجة", bg: "rgba(127,29,29,0.15)", color: "#7F1D1D" },
};

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  OPEN: { label: "مفتوحة", color: "#DC2626", bg: "rgba(220,38,38,0.1)" },
  ACKNOWLEDGED: { label: "مستلمة", color: "#0EA5E9", bg: "rgba(14,165,233,0.1)" },
  IN_PROGRESS: { label: "قيد المعالجة", color: "#EA580C", bg: "rgba(234,88,12,0.1)" },
  RESOLVED: { label: "محلولة", color: "#16A34A", bg: "rgba(22,163,74,0.1)" },
  CLOSED: { label: "مغلقة", color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

export default function IssuesPage() {
  const { data: session, status: authStatus } = useSession();
  const [items, setItems] = useState<IssueRow[]>([]);
  const [counters, setCounters] = useState({ open: 0, inProgress: 0, resolvedToday: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | Status>("OPEN");
  const [severityFilter, setSeverityFilter] = useState<"" | Severity>("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<IssueRow | null>(null);
  const [resolveText, setResolveText] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      if (search.trim()) params.set("search", search.trim());
      params.set("take", "100");
      const res = await fetch(`/api/issues?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setCounters(data.counters || { open: 0, inProgress: 0, resolvedToday: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    if (authStatus === "authenticated") load();
  }, [authStatus, load]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">غير مصرح</p>
      </div>
    );
  }

  async function patchIssue(id: string, body: Record<string, unknown>) {
    setSubmitting(id);
    try {
      const res = await fetch(`/api/issues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || "تعذّر التحديث");
        return;
      }
      await load();
    } finally {
      setSubmitting(null);
    }
  }

  async function submitResolve() {
    if (!resolveModal) return;
    if (!resolveText.trim()) {
      alert("اكتب نص الحل");
      return;
    }
    await patchIssue(resolveModal.id, {
      action: "resolve",
      resolution: resolveText.trim(),
    });
    setResolveModal(null);
    setResolveText("");
  }

  return (
    <div className="p-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: "#1C1B2E" }}
        >
          <AlertTriangle size={24} style={{ color: "#DC2626" }} />
          المشاكل والإشكاليات
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          إدارة كل البلاغات اللي يرفعها المنفذون من شريط المهمة
        </p>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <CounterCard
          label="مفتوحة"
          value={counters.open}
          color="#DC2626"
          onClick={() => setStatusFilter("OPEN")}
          active={statusFilter === "OPEN"}
        />
        <CounterCard
          label="قيد المعالجة"
          value={counters.inProgress}
          color="#EA580C"
          onClick={() => setStatusFilter("IN_PROGRESS")}
          active={statusFilter === "IN_PROGRESS"}
        />
        <CounterCard
          label="حُلّت اليوم"
          value={counters.resolvedToday}
          color="#16A34A"
          onClick={() => setStatusFilter("RESOLVED")}
          active={statusFilter === "RESOLVED"}
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[200px]" style={{ backgroundColor: "#F8F8F4", border: "1px solid #E5E7EB" }}>
          <Search size={14} style={{ color: "#9CA3AF" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في العنوان أو الوصف…"
            className="bg-transparent outline-none text-sm flex-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: "#9CA3AF" }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "")}
            className="px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white"
          >
            <option value="">كل الحالات</option>
            {(Object.keys(STATUS_META) as Status[]).map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as Severity | "")}
            className="px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white"
          >
            <option value="">كل الدرجات</option>
            {(Object.keys(SEVERITY_META) as Severity[]).map((s) => (
              <option key={s} value={s}>{SEVERITY_META[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Issues list */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#16A34A" }} />
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>لا توجد مشاكل بهذه الفلاتر</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it) => {
            const sev = SEVERITY_META[it.severity];
            const st = STATUS_META[it.status];
            const expanded = expandedId === it.id;
            const project = it.recordItem.project;
            const linkedTask = it.recordItem.taskLinks?.[0]?.task ?? null;
            return (
              <div
                key={it.id}
                className="bg-white rounded-2xl border overflow-hidden"
                style={{
                  borderColor: it.status === "OPEN" && (it.severity === "HIGH" || it.severity === "CRITICAL") ? sev.color : "#E5E7EB",
                  borderRightWidth: 4,
                  borderRightColor: sev.color,
                }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: sev.bg, color: sev.color }}
                    >
                      {sev.label}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                    <h3 className="text-sm font-bold flex-1" style={{ color: "#1C1B2E" }}>
                      {it.recordItem.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs flex-wrap mb-2" style={{ color: "#6B7280" }}>
                    {project && (
                      <Link
                        href={`/dashboard/projects/${project.id}/record`}
                        className="inline-flex items-center gap-1 hover:underline"
                        style={{ color: "#5E5495" }}
                      >
                        <ExternalLink size={11} />
                        {project.projectCode ? `${project.projectCode} — ` : ""}
                        {project.name}
                      </Link>
                    )}
                    {it.recordItem.service && <span>· {it.recordItem.service.name}</span>}
                    {linkedTask && <span>· مهمة: {linkedTask.title}</span>}
                  </div>

                  <div className="flex items-center gap-3 text-[11px]" style={{ color: "#9CA3AF" }}>
                    <span className="inline-flex items-center gap-1">
                      <User size={11} />
                      {it.reportedBy.name}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(it.createdAt).toLocaleString("ar-SA-u-nu-latn", {
                        year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {it.assignedTo && (
                      <span className="inline-flex items-center gap-1">
                        · مُعيّنة لـ <strong>{it.assignedTo.name}</strong>
                      </span>
                    )}
                  </div>

                  {it.recordItem.description && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : it.id)}
                      className="mt-2 text-xs flex items-center gap-1"
                      style={{ color: "#5E5495" }}
                    >
                      {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {expanded ? "إخفاء الوصف" : "عرض الوصف"}
                    </button>
                  )}
                  {expanded && it.recordItem.description && (
                    <div
                      className="mt-2 p-3 rounded-xl text-xs"
                      style={{ backgroundColor: "#F8F8F4", color: "#374151", whiteSpace: "pre-wrap" }}
                    >
                      {it.recordItem.description}
                    </div>
                  )}

                  {it.resolution && (
                    <div
                      className="mt-3 p-3 rounded-xl"
                      style={{ backgroundColor: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.2)" }}
                    >
                      <p className="text-[11px] font-bold mb-1" style={{ color: "#15803D" }}>
                        الحل المقدّم {it.resolvedAt && `• ${new Date(it.resolvedAt).toLocaleDateString("ar-SA-u-nu-latn")}`}
                      </p>
                      <p className="text-xs" style={{ color: "#1C1B2E", whiteSpace: "pre-wrap" }}>
                        {it.resolution}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {it.status !== "RESOLVED" && it.status !== "CLOSED" && (
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {it.status === "OPEN" && (
                        <MarsaButton
                          size="xs"
                          variant="primary"
                          icon={<Play size={11} />}
                          onClick={() => patchIssue(it.id, { action: "start" })}
                          loading={submitting === it.id}
                          disabled={!!submitting}
                          style={{ backgroundColor: "#EA580C" }}
                        >
                          بدء المعالجة
                        </MarsaButton>
                      )}
                      <MarsaButton
                        size="xs"
                        variant="primary"
                        icon={<CheckCircle2 size={11} />}
                        onClick={() => { setResolveModal(it); setResolveText(""); }}
                        disabled={!!submitting}
                        style={{ backgroundColor: "#16A34A" }}
                      >
                        حل المشكلة
                      </MarsaButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolve modal */}
      {resolveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !submitting && setResolveModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                حل المشكلة
              </h3>
              <MarsaButton
                variant="ghost"
                size="sm"
                iconOnly
                icon={<X size={16} />}
                onClick={() => setResolveModal(null)}
                disabled={!!submitting}
              />
            </div>
            <div className="p-5">
              <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                {resolveModal.recordItem.title}
              </p>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                نص الحل / الإجراء المتّخذ <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                value={resolveText}
                onChange={(e) => setResolveText(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="اشرح الحل بإيجاز…"
                autoFocus
              />
            </div>
            <div className="flex gap-2 p-5 border-t border-gray-100">
              <button
                type="button"
                onClick={submitResolve}
                disabled={!!submitting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
                style={{ backgroundColor: "#16A34A", color: "white" }}
              >
                {submitting === resolveModal.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                تأكيد الحل
              </button>
              <MarsaButton
                variant="secondary"
                size="sm"
                onClick={() => setResolveModal(null)}
                disabled={!!submitting}
              >
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CounterCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl p-4 border text-right transition-all hover:shadow-sm"
      style={{
        borderColor: active ? color : "#E5E7EB",
        borderWidth: active ? 2 : 1,
      }}
    >
      <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </button>
  );
}
