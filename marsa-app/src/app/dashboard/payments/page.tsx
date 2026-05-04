"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DollarSign,
  Search,
  Loader2,
  AlertTriangle,
  Users,
  Clock,
  Phone,
  ExternalLink,
  Pause,
  FileX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Settings,
  ArrowLeft,
  Link2,
  Hourglass,
  Zap,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";
import PaymentRecordModal from "@/components/payments/PaymentRecordModal";
import FollowUpModal from "@/components/payments/FollowUpModal";
import WaiverModal from "@/components/payments/WaiverModal";
import PauseProjectModal from "@/components/city/PauseProjectModal";
import SetupInstallmentsModal from "@/components/payments/SetupInstallmentsModal";

// ─── Types ─────────────────────────────────────────────────────────────

interface InstallmentRow {
  id: string;
  title: string;
  amount: number;
  paidAmount: number;
  waiverAmount: string | null;
  paymentStatus: string;
  dueAfterDays: number | null;
  followUpStatus: string | null;
  nextContactDate: string | null;
  lastContactDate: string | null;
  contract: {
    id: string;
    contractNumber: number | null;
    signedAt: string | null;
    client: { id: string; name: string; phone: string | null } | null;
    project: {
      id: string;
      name: string;
      projectCode: string | null;
      status: string;
    } | null;
  } | null;
  linkedTask: {
    id: string;
    title: string;
    status: string;
    assignee: { id: string; name: string } | null;
    service: { id: string; name: string; serviceOrder: number } | null;
    timeSummary: { completedAt: string | null } | null;
  } | null;
  followUps: {
    id: string;
    outcome: string;
    contactedAt: string;
    notes: string;
    contactedByUser: { id: string; name: string };
  }[];
  // server-derived
  dueDate: string | null;
  daysOverdue: number;
  milestoneState: "DUE_NOW" | "WAITING_ON_TASK" | "TIME_BASED";
  taskCompletedAt: string | null;
  remainingAmount: number;
  isPaid: boolean;
}

interface Summary {
  totalDue: number;
  totalOverdue: number;
  overdueClientsCount: number;
  avgOverdueDays: number;
  totalCollected: number;
  overdueInstallmentsCount: number;
}

type TabKey = "all" | "overdue" | "week" | "month" | "paid" | "needs_setup";

interface NeedsSetupRow {
  id: string;
  contractNumber: number | null;
  status: string;
  signedAt: string | null;
  contractValue: number | null;
  effectiveValue: number | null;
  valueSource: "contract" | "project" | "missing";
  client: { id: string; name: string; phone: string | null } | null;
  project: {
    id: string;
    name: string;
    projectCode: string | null;
    status: string;
    totalPrice: number | null;
  } | null;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "overdue", label: "متأخرة الآن" },
  { key: "week", label: "هذا الأسبوع" },
  { key: "month", label: "هذا الشهر" },
  { key: "paid", label: "مدفوعة" },
  { key: "needs_setup", label: "🛠️ بحاجة إعداد" },
];

const OUTCOME_LABELS: Record<string, string> = {
  PROMISED_PAYMENT: "وعد",
  UNREACHABLE: "لم يرد",
  REFUSED: "رفض",
  RESCHEDULED: "إعادة جدولة",
  OTHER: "أخرى",
};

// ─── Page ──────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const { data: session, status: authStatus } = useSession();
  const [items, setItems] = useState<InstallmentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Modal state
  const [paymentModal, setPaymentModal] = useState<InstallmentRow | null>(null);
  const [followUpModal, setFollowUpModal] = useState<InstallmentRow | null>(null);
  const [waiverModal, setWaiverModal] = useState<InstallmentRow | null>(null);
  const [pauseModal, setPauseModal] = useState<{ projectId: string; projectName: string } | null>(null);

  // Setup-status banner — counts contracts that have no installments yet,
  // so the page can prompt the user to fix the missing schedules in bulk.
  const [setupStatus, setSetupStatus] = useState<{
    contractsWithoutInstallments: number;
    contractsToSign: number;
    eligibleContracts: number;
  } | null>(null);

  // Needs-setup tab data — fetched lazily when the tab is opened, kept
  // separate from the main installment list because the shapes differ.
  const [setupContracts, setSetupContracts] = useState<NeedsSetupRow[]>([]);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [setupTarget, setSetupTarget] = useState<NeedsSetupRow | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      // Skip the status filter when the tab is one of the synthetic
      // ones that the API doesn't recognise.
      if (tab !== "all" && tab !== "needs_setup") params.set("status", tab);
      if (search.trim()) params.set("search", search.trim());
      params.set("take", "200");
      const res = await fetch(`/api/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSummary(data.summary || null);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  const loadNeedsSetup = useCallback(async () => {
    setLoadingSetup(true);
    try {
      const res = await fetch("/api/payments/contracts-needing-setup");
      if (res.ok) {
        const data = await res.json();
        setSetupContracts(data.items ?? []);
      }
    } finally {
      setLoadingSetup(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") refetch();
  }, [authStatus, refetch]);

  useEffect(() => {
    if (authStatus === "authenticated" && tab === "needs_setup") loadNeedsSetup();
  }, [authStatus, tab, loadNeedsSetup]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let alive = true;
    fetch("/api/payments/setup-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) setSetupStatus(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [authStatus]);

  // Group rows by client for the table. MUST stay above the early
  // returns below — otherwise the hook count changes between the
  // "loading" render (returns null before useMemo) and the
  // "authenticated" render (reaches useMemo), which is React error
  // #310: "Rendered more hooks than during the previous render".
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        clientPhone: string | null;
        rows: InstallmentRow[];
        totalDue: number;
        overdueCount: number;
      }
    >();
    for (const r of items) {
      const cid = r.contract?.client?.id ?? "_none";
      if (!map.has(cid)) {
        map.set(cid, {
          clientId: cid,
          clientName: r.contract?.client?.name ?? "—",
          clientPhone: r.contract?.client?.phone ?? null,
          rows: [],
          totalDue: 0,
          overdueCount: 0,
        });
      }
      const g = map.get(cid)!;
      g.rows.push(r);
      g.totalDue += r.remainingAmount;
      if (r.daysOverdue > 0) g.overdueCount++;
    }
    return Array.from(map.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [items]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);
  if (
    !["ADMIN", "MANAGER", "FINANCE_MANAGER", "TREASURY_MANAGER"].includes(
      session.user.role
    )
  ) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">غير مصرح</p>
      </div>
    );
  }

  return (
    <div className="p-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold flex items-center gap-2"
          style={{ color: "#1C1B2E" }}
        >
          <DollarSign size={24} style={{ color: "#16A34A" }} />
          إدارة الدفعات
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          متابعة وتحصيل الأقساط من العملاء
        </p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="إجمالي المستحق" value={summary.totalDue} icon={DollarSign} color="#0EA5E9" suffix="ريال" />
          <SummaryCard label="إجمالي المتأخر" value={summary.totalOverdue} icon={AlertTriangle} color="#DC2626" suffix="ريال" emphasize={summary.totalOverdue > 0} />
          <SummaryCard label="عملاء متأخرون" value={summary.overdueClientsCount} icon={Users} color="#EA580C" />
          <SummaryCard label="متوسط أيام التأخير" value={summary.avgOverdueDays} icon={Clock} color="#A16207" suffix="يوم" />
        </div>
      )}

      {/* Setup-status banner */}
      {setupStatus && setupStatus.contractsWithoutInstallments > 0 && (
        <div
          className="mb-4 rounded-2xl p-4 flex items-center gap-3 flex-wrap"
          style={{
            backgroundColor: "rgba(234,88,12,0.06)",
            border: "1px solid rgba(234,88,12,0.30)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(234,88,12,0.15)" }}
          >
            <AlertTriangle size={18} style={{ color: "#EA580C" }} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              يوجد {setupStatus.contractsWithoutInstallments} عقد بدون جدول دفعات معرّف
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
              هذه العقود لن تظهر دفعاتها في الصفحة حتى يتم تحديد جدول الأقساط لها.
            </p>
          </div>
          <Link
            href="/dashboard/payments/setup"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-105"
            style={{ backgroundColor: "#EA580C", color: "white" }}
          >
            <Settings size={13} />
            إعداد جداول الدفعات الآن
            <ArrowLeft size={13} />
          </Link>
        </div>
      )}

      {/* Tabs + search */}
      <div className="bg-white rounded-2xl p-3 border border-gray-100 mb-4 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count =
              t.key === "overdue" && summary
                ? summary.overdueInstallmentsCount
                : t.key === "needs_setup" && setupStatus
                  ? setupStatus.contractsWithoutInstallments
                  : null;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: active ? "#5E5495" : "white",
                  color: active ? "white" : "#6B7280",
                  border: `1px solid ${active ? "#5E5495" : "#E5E7EB"}`,
                }}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      backgroundColor: active
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(220,38,38,0.12)",
                      color: active ? "white" : "#DC2626",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1 min-w-[200px]" />
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ backgroundColor: "#F8F8F4", border: "1px solid #E5E7EB" }}
        >
          <Search size={14} style={{ color: "#9CA3AF" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="عميل / مشروع / جوال…"
            className="bg-transparent outline-none text-sm w-56"
          />
        </div>
      </div>

      {/* Body — needs-setup tab is rendered separately because the
          API returns a different shape than the regular installment
          list. */}
      {tab === "needs_setup" ? (
        loadingSetup ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
          </div>
        ) : setupContracts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#16A34A" }} />
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              كل العقود لها جداول دفعات معرّفة.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {setupContracts.map((c) => (
              <NeedsSetupRowView
                key={c.id}
                contract={c}
                onSetup={() => setSetupTarget(c)}
              />
            ))}
          </div>
        )
      ) : loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
        </div>
      ) : grouped.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#16A34A" }} />
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
            لا توجد دفعات بهذه الفلاتر
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((g) => {
            const expanded = expandedClientId === g.clientId;
            return (
              <div
                key={g.clientId}
                className="bg-white rounded-2xl border overflow-hidden"
                style={{
                  borderColor: g.overdueCount > 0 ? "#FECACA" : "#E5E7EB",
                  borderRightWidth: 4,
                  borderRightColor: g.overdueCount > 0 ? "#DC2626" : "#5E5495",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedClientId(expanded ? null : g.clientId)}
                  className="w-full flex items-center gap-3 p-4 text-right hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                        {g.clientName}
                      </h3>
                      {g.clientPhone && (
                        <span className="text-[11px] font-mono" style={{ color: "#6B7280", direction: "ltr" }}>
                          {g.clientPhone}
                        </span>
                      )}
                      {g.overdueCount > 0 && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#DC2626" }}
                        >
                          {g.overdueCount} متأخرة
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                      {g.rows.length} دفعة
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px]" style={{ color: "#9CA3AF" }}>إجمالي مستحق</p>
                    <p className="text-base font-bold font-mono" style={{ color: g.overdueCount > 0 ? "#DC2626" : "#1C1B2E" }}>
                      {g.totalDue.toLocaleString("en-US")}
                    </p>
                  </div>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {expanded && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {g.rows.map((r) => (
                      <InstallmentRowView
                        key={r.id}
                        row={r}
                        isAdmin={isAdmin}
                        onPay={() => setPaymentModal(r)}
                        onFollowUp={() => setFollowUpModal(r)}
                        onWaiver={() => setWaiverModal(r)}
                        onPauseProject={() =>
                          r.contract?.project &&
                          setPauseModal({
                            projectId: r.contract.project.id,
                            projectName: r.contract.project.name,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {paymentModal && (
        <PaymentRecordModal
          installmentId={paymentModal.id}
          installmentTitle={paymentModal.title}
          remainingAmount={paymentModal.remainingAmount}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => refetch()}
        />
      )}
      {followUpModal && (
        <FollowUpModal
          installmentId={followUpModal.id}
          installmentTitle={followUpModal.title}
          clientName={followUpModal.contract?.client?.name}
          onClose={() => setFollowUpModal(null)}
          onSuccess={() => refetch()}
        />
      )}
      {waiverModal && (
        <WaiverModal
          installmentId={waiverModal.id}
          installmentTitle={waiverModal.title}
          remainingAmount={waiverModal.remainingAmount}
          onClose={() => setWaiverModal(null)}
          onSuccess={() => refetch()}
        />
      )}
      {pauseModal && (
        <PauseProjectModal
          projectId={pauseModal.projectId}
          projectName={pauseModal.projectName}
          onClose={() => setPauseModal(null)}
          onSuccess={() => refetch()}
        />
      )}
      {setupTarget && (
        <SetupInstallmentsModal
          target={{
            contractId: setupTarget.id,
            displayName:
              setupTarget.project?.name ?? setupTarget.client?.name ?? "—",
            effectiveValue: setupTarget.effectiveValue,
            valueSource: setupTarget.valueSource,
          }}
          onClose={() => setSetupTarget(null)}
          onSuccess={() => {
            setSetupTarget(null);
            // After saving, refresh both the list of contracts that
            // still need setup AND the main installment list (the
            // newly-created rows now belong to "all").
            loadNeedsSetup();
            refetch();
            // Refresh the banner counter too.
            fetch("/api/payments/setup-status")
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data) setSetupStatus(data);
              })
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  emphasize,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  suffix?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-4 border"
      style={{
        borderColor: emphasize ? color : "#E5E7EB",
        borderWidth: emphasize ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} style={{ color }} />
        <p className="text-[11px] font-semibold" style={{ color: "#6B7280" }}>
          {label}
        </p>
      </div>
      <p className="text-xl font-bold font-mono" style={{ color }}>
        {value.toLocaleString("en-US")}
        {suffix && <span className="text-xs font-normal ms-1" style={{ color: "#6B7280" }}>{suffix}</span>}
      </p>
    </div>
  );
}

function InstallmentRowView({
  row,
  isAdmin,
  onPay,
  onFollowUp,
  onWaiver,
  onPauseProject,
}: {
  row: InstallmentRow;
  isAdmin: boolean;
  onPay: () => void;
  onFollowUp: () => void;
  onWaiver: () => void;
  onPauseProject: () => void;
}) {
  const project = row.contract?.project;
  const overdueColor =
    row.daysOverdue > 30 ? "#DC2626" : row.daysOverdue > 7 ? "#EA580C" : "#A16207";
  const lastFollowUp = row.followUps?.[0] ?? null;

  return (
    <div className="p-4 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              {row.title}
            </p>
            {row.isPaid ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16A34A" }}>
                مدفوعة
              </span>
            ) : row.daysOverdue > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${overdueColor}15`, color: overdueColor }}>
                متأخرة {row.daysOverdue} يوم
              </span>
            ) : row.milestoneState === "DUE_NOW" ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: "rgba(22,163,74,0.12)", color: "#16A34A" }}>
                <Zap size={10} />
                مستحقة الآن
              </span>
            ) : row.milestoneState === "WAITING_ON_TASK" ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: "rgba(14,165,233,0.10)", color: "#0EA5E9" }}>
                <Hourglass size={10} />
                بانتظار إنجاز المهمة
              </span>
            ) : (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                {row.paymentStatus === "PARTIAL" ? "جزئية" : "قادمة"}
              </span>
            )}
            {row.followUpStatus && (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(14,165,233,0.08)", color: "#0EA5E9" }}>
                {row.followUpStatus === "PROMISED" ? "وعد" : row.followUpStatus === "UNREACHABLE" ? "لم يرد" : row.followUpStatus === "EVADING" ? "متهرب" : "متابع"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] mt-1 flex-wrap" style={{ color: "#6B7280" }}>
            {project && (
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="inline-flex items-center gap-1 hover:underline"
                style={{ color: "#5E5495" }}
              >
                <ExternalLink size={10} />
                {project.projectCode ? `${project.projectCode} — ` : ""}
                {project.name}
              </Link>
            )}
            {row.dueDate && (
              <span>· استحقاق {new Date(row.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" })}</span>
            )}
          </div>
          {row.linkedTask && (
            <div
              className="flex items-center gap-1.5 text-[10px] mt-1.5 px-2 py-1 rounded-md inline-flex"
              style={{
                backgroundColor:
                  row.linkedTask.status === "DONE"
                    ? "rgba(22,163,74,0.06)"
                    : "rgba(94,84,149,0.05)",
                color:
                  row.linkedTask.status === "DONE" ? "#16A34A" : "#5E5495",
                border: `1px solid ${
                  row.linkedTask.status === "DONE"
                    ? "rgba(22,163,74,0.20)"
                    : "rgba(94,84,149,0.18)"
                }`,
              }}
            >
              <Link2 size={10} />
              <span>
                مرتبطة بـ <strong>{row.linkedTask.title}</strong>
                {row.linkedTask.service && (
                  <>
                    {" — "}
                    <span style={{ color: "#9CA3AF" }}>{row.linkedTask.service.name}</span>
                  </>
                )}
                {" · "}
                <span style={{ fontWeight: 700 }}>
                  {row.linkedTask.status === "DONE"
                    ? "✓ مكتملة"
                    : row.linkedTask.status === "IN_PROGRESS"
                      ? "قيد التنفيذ"
                      : row.linkedTask.status === "TODO"
                        ? "لم تبدأ"
                        : row.linkedTask.status}
                </span>
              </span>
            </div>
          )}
          {lastFollowUp && (
            <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>
              آخر متابعة: {OUTCOME_LABELS[lastFollowUp.outcome] ?? lastFollowUp.outcome} —{" "}
              {new Date(lastFollowUp.contactedAt).toLocaleDateString("ar-SA-u-nu-latn")}
              {" — "}
              {lastFollowUp.contactedByUser?.name}
            </p>
          )}
        </div>

        <div className="text-left shrink-0">
          <p className="text-[10px]" style={{ color: "#9CA3AF" }}>المبلغ</p>
          <p className="text-sm font-bold font-mono" style={{ color: "#1C1B2E" }}>
            {row.amount.toLocaleString("en-US")}
          </p>
          <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
            مدفوع {row.paidAmount.toLocaleString("en-US")}
          </p>
          {row.waiverAmount && Number(row.waiverAmount) > 0 && (
            <p className="text-[10px]" style={{ color: "#DC2626" }}>
              تنازل {Number(row.waiverAmount).toLocaleString("en-US")}
            </p>
          )}
          <p className="text-sm font-bold font-mono mt-1" style={{ color: row.isPaid ? "#16A34A" : "#DC2626" }}>
            متبقي {row.remainingAmount.toLocaleString("en-US")}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {!row.isPaid && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          <MarsaButton size="xs" variant="primary" icon={<DollarSign size={11} />} onClick={onPay} style={{ backgroundColor: "#16A34A" }}>
            سداد
          </MarsaButton>
          <MarsaButton size="xs" variant="outline" icon={<Phone size={11} />} onClick={onFollowUp}>
            متابعة
          </MarsaButton>
          {project && row.daysOverdue > 0 && (
            <MarsaButton size="xs" variant="outline" icon={<Pause size={11} />} onClick={onPauseProject}>
              إيقاف المشروع
            </MarsaButton>
          )}
          {isAdmin && (
            <MarsaButton size="xs" variant="ghost" icon={<FileX size={11} />} onClick={onWaiver}>
              تنازل
            </MarsaButton>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Needs-setup tab row ───────────────────────────────────────────────

function NeedsSetupRowView({
  contract,
  onSetup,
}: {
  contract: NeedsSetupRow;
  onSetup: () => void;
}) {
  const project = contract.project;
  const isDraft = contract.status === "DRAFT";
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderRightWidth: 4, borderRightColor: "#EA580C" }}>
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isDraft ? "rgba(234,88,12,0.10)" : "rgba(22,163,74,0.10)",
              color: isDraft ? "#EA580C" : "#16A34A",
            }}
          >
            {isDraft ? "مسودة" : contract.status}
          </span>
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
            {project?.name ?? "—"}
          </p>
          {contract.contractNumber != null && (
            <span className="text-[10px] font-mono" style={{ color: "#5E5495" }}>
              عقد #{contract.contractNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] mt-1 flex-wrap" style={{ color: "#6B7280" }}>
          <span>{contract.client?.name ?? "—"}</span>
          {contract.client?.phone && (
            <span style={{ direction: "ltr", color: "#9CA3AF" }}>{contract.client.phone}</span>
          )}
          {contract.signedAt && (
            <span>· وُقّع {new Date(contract.signedAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
          )}
        </div>
      </div>
      <div className="text-left shrink-0">
        <p className="text-[10px]" style={{ color: "#9CA3AF" }}>قيمة العقد</p>
        <p
          className="text-sm font-bold font-mono"
          style={{
            color:
              contract.valueSource === "missing"
                ? "#DC2626"
                : contract.valueSource === "project"
                  ? "#EA580C"
                  : "#1C1B2E",
          }}
        >
          {contract.effectiveValue ? contract.effectiveValue.toLocaleString("en-US") : "—"}
          {contract.valueSource === "project" && (
            <span className="text-[9px] font-normal ms-1" style={{ color: "#EA580C" }}>(من المشروع)</span>
          )}
        </p>
      </div>
      <MarsaButton size="sm" variant="primary" icon={<Settings size={13} />} onClick={onSetup}>
        إعداد دفعات الآن
      </MarsaButton>
    </div>
  );
}

// Reference unused imports so eslint doesn't complain.
void TrendingDown;
