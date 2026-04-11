"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  ArrowLeftRight,
  DollarSign,
  Clock,
  CheckCircle2,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ProjectCodeBadge from "@/components/ProjectCodeBadge";

// ─── Types ──────────────────────────────────────────────────────

interface TransferRequest {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  task: { id: string; title: string } | null;
  requester: { id: string; name: string } | null;
  targetUser: { id: string; name: string } | null;
}

interface InstallmentRequest {
  id: string;
  title: string;
  amount: number;
  paidAmount: number;
  partialPaymentRequest: number | null;
  partialPaymentType: string | null;
  gracePeriodDays: number | null;
  gracePeriodApproved: boolean;
  contract: {
    id: string;
    project: {
      id: string;
      name: string;
      projectCode: string | null;
      client: { id: string; name: string } | null;
    } | null;
  } | null;
  linkedTask: {
    id: string;
    title: string;
    assignee: { id: string; name: string } | null;
  } | null;
}

type Tab = "transfers" | "payments" | "grace";

// ─── Component ──────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { data: session, status: authStatus } = useSession();
  const [tab, setTab] = useState<Tab>("transfers");

  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [partialReqs, setPartialReqs] = useState<InstallmentRequest[]>([]);
  const [graceReqs, setGraceReqs] = useState<InstallmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect("/dashboard");
      }
    }
  }, [authStatus, session]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, iRes] = await Promise.all([
        fetch("/api/task-transfers?status=PENDING_ADMIN"),
        fetch("/api/installments/pending-approvals"),
      ]);
      if (tRes.ok) {
        const d = await tRes.json();
        setTransfers(Array.isArray(d) ? d : d.transfers || []);
      }
      if (iRes.ok) {
        const d = await iRes.json();
        setPartialReqs(d.partialRequests || []);
        setGraceReqs(d.graceRequests || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") fetchAll();
  }, [authStatus, fetchAll]);

  // ── Actions ──

  const handleTransfer = async (id: string, action: "approve" | "reject") => {
    setActing(id);
    try {
      await fetch(`/api/task-transfers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchAll();
    } finally {
      setActing(null);
    }
  };

  const handlePartialApprove = async (id: string) => {
    setActing(id);
    try {
      await fetch(`/api/installments/${id}/partial-approve`, { method: "POST" });
      fetchAll();
    } finally {
      setActing(null);
    }
  };

  const handlePartialReject = async (id: string) => {
    setActing(id);
    try {
      await fetch(`/api/installments/${id}/partial-reject`, { method: "POST" });
      fetchAll();
    } finally {
      setActing(null);
    }
  };

  const handleGraceApprove = async (id: string) => {
    setActing(id);
    try {
      await fetch(`/api/installments/${id}/grace-approve`, { method: "POST" });
      fetchAll();
    } finally {
      setActing(null);
    }
  };

  const handleGraceReject = async (id: string) => {
    setActing(id);
    try {
      await fetch(`/api/installments/${id}/grace-reject`, { method: "POST" });
      fetchAll();
    } finally {
      setActing(null);
    }
  };

  // ── Counts ──
  const counts = {
    transfers: transfers.length,
    payments: partialReqs.length,
    grace: graceReqs.length,
  };
  const totalPending = counts.transfers + counts.payments + counts.grace;

  // ── Tab config ──
  const tabs: { key: Tab; label: string; icon: typeof ArrowLeftRight; count: number; color: string }[] = [
    { key: "transfers", label: "تحويلات المهام", icon: ArrowLeftRight, count: counts.transfers, color: "#5E5495" },
    { key: "payments", label: "طلبات الدفع", icon: DollarSign, count: counts.payments, color: "#C9A84C" },
    { key: "grace", label: "طلبات الإمهال", icon: Clock, count: counts.grace, color: "#2563EB" },
  ];

  if (authStatus === "loading") {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            الموافقات
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {totalPending > 0
              ? `${totalPending} طلب بانتظار الموافقة`
              : "لا توجد طلبات معلّقة"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={
                active
                  ? { backgroundColor: t.color, color: "white" }
                  : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
              }
            >
              <Icon size={16} />
              {t.label}
              {t.count > 0 && (
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={
                    active
                      ? { backgroundColor: "rgba(255,255,255,0.3)", color: "white" }
                      : { backgroundColor: `${t.color}18`, color: t.color }
                  }
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : (
        <>
          {/* ── Tab 1: Transfers ── */}
          {tab === "transfers" && (
            <div className="space-y-3">
              {transfers.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} text="لا توجد طلبات تحويل معلّقة" />
              ) : (
                transfers.map((tr) => (
                  <div
                    key={tr.id}
                    className="bg-white rounded-2xl p-5"
                    style={{ border: "1px solid #E2E0D8" }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                          {tr.task?.title || "مهمة"}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                          من: <b>{tr.requester?.name || "—"}</b> → إلى: <b>{tr.targetUser?.name || "—"}</b>
                        </p>
                        {tr.reason && (
                          <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                            السبب: {tr.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <MarsaButton
                          variant="primary"
                          size="xs"
                          icon={<CheckCircle2 size={13} />}
                          disabled={acting === tr.id}
                          onClick={() => handleTransfer(tr.id, "approve")}
                          style={{ backgroundColor: "#059669" }}
                        >
                          قبول
                        </MarsaButton>
                        <MarsaButton
                          variant="danger"
                          size="xs"
                          icon={<X size={13} />}
                          disabled={acting === tr.id}
                          onClick={() => handleTransfer(tr.id, "reject")}
                        >
                          رفض
                        </MarsaButton>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Tab 2: Partial / Full Payment ── */}
          {tab === "payments" && (
            <div className="space-y-3">
              {partialReqs.length === 0 ? (
                <EmptyState icon={DollarSign} text="لا توجد طلبات دفع معلّقة" />
              ) : (
                partialReqs.map((inst) => {
                  const proj = inst.contract?.project;
                  const typeLabel = inst.partialPaymentType === "FULL" ? "سداد كامل" : "دفع جزئي";
                  return (
                    <div
                      key={inst.id}
                      className="bg-white rounded-2xl p-5"
                      style={{ border: "1px solid #E2E0D8" }}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                              {inst.title}
                            </p>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor:
                                  inst.partialPaymentType === "FULL"
                                    ? "rgba(5,150,105,0.1)"
                                    : "rgba(201,168,76,0.1)",
                                color:
                                  inst.partialPaymentType === "FULL" ? "#059669" : "#C9A84C",
                              }}
                            >
                              {typeLabel}
                            </span>
                          </div>
                          {proj && (
                            <p className="text-xs" style={{ color: "#6B7280" }}>
                              مشروع: <b>{proj.name}</b>{" "}
                              <ProjectCodeBadge code={proj.projectCode} size="xs" inline />
                              {proj.client && <> — عميل: <b>{proj.client.name}</b></>}
                            </p>
                          )}
                          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                            المبلغ المطلوب: <b style={{ color: "#C9A84C" }}>{(inst.partialPaymentRequest ?? 0).toLocaleString("en-US")}</b> من {inst.amount.toLocaleString("en-US")}
                            {inst.linkedTask?.assignee && <> — المنفذ: <b>{inst.linkedTask.assignee.name}</b></>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <MarsaButton
                            variant="primary"
                            size="xs"
                            icon={<CheckCircle2 size={13} />}
                            disabled={acting === inst.id}
                            onClick={() => handlePartialApprove(inst.id)}
                            style={{ backgroundColor: "#059669" }}
                          >
                            موافقة
                          </MarsaButton>
                          <MarsaButton
                            variant="danger"
                            size="xs"
                            icon={<X size={13} />}
                            disabled={acting === inst.id}
                            onClick={() => handlePartialReject(inst.id)}
                          >
                            رفض
                          </MarsaButton>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Tab 3: Grace Period ── */}
          {tab === "grace" && (
            <div className="space-y-3">
              {graceReqs.length === 0 ? (
                <EmptyState icon={Clock} text="لا توجد طلبات إمهال معلّقة" />
              ) : (
                graceReqs.map((inst) => {
                  const proj = inst.contract?.project;
                  return (
                    <div
                      key={inst.id}
                      className="bg-white rounded-2xl p-5"
                      style={{ border: "1px solid #E2E0D8" }}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                              {inst.title}
                            </p>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "rgba(37,99,235,0.1)", color: "#2563EB" }}
                            >
                              إمهال {inst.gracePeriodDays} يوم
                            </span>
                          </div>
                          {proj && (
                            <p className="text-xs" style={{ color: "#6B7280" }}>
                              مشروع: <b>{proj.name}</b>{" "}
                              <ProjectCodeBadge code={proj.projectCode} size="xs" inline />
                              {proj.client && <> — عميل: <b>{proj.client.name}</b></>}
                            </p>
                          )}
                          {inst.linkedTask?.assignee && (
                            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                              المنفذ: <b>{inst.linkedTask.assignee.name}</b>
                              {inst.linkedTask.title && <> — المهمة: {inst.linkedTask.title}</>}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <MarsaButton
                            variant="primary"
                            size="xs"
                            icon={<CheckCircle2 size={13} />}
                            disabled={acting === inst.id}
                            onClick={() => handleGraceApprove(inst.id)}
                            style={{ backgroundColor: "#059669" }}
                          >
                            موافقة
                          </MarsaButton>
                          <MarsaButton
                            variant="danger"
                            size="xs"
                            icon={<X size={13} />}
                            disabled={acting === inst.id}
                            onClick={() => handleGraceReject(inst.id)}
                          >
                            رفض
                          </MarsaButton>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof AlertTriangle; text: string }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
      <Icon size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
      <p className="text-sm" style={{ color: "#9CA3AF" }}>{text}</p>
    </div>
  );
}
