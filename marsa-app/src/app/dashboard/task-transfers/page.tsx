"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeftRight,
  Users,
  Filter,
  Loader2,
  Check,
  X,
  Plus,
  Trash2,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TransferRequest {
  id: string;
  task: { id: string; title: string };
  requester: { id: string; name: string };
  targetUser: { id: string; name: string };
  reason: string;
  status: string;
  urgency: string;
  expiresAt: string | null;
  autoExpired: boolean;
  adminNote: string | null;
  targetNote: string | null;
  reviewedBy: { id: string; name: string } | null;
  createdAt: string;
  reviewedAt: string | null;
  targetRespondedAt: string | null;
}

interface Delegation {
  id: string;
  fromProvider: { id: string; name: string };
  toProvider: { id: string; name: string };
  isPermanent: boolean;
  isActive: boolean;
}

interface Provider {
  id: string;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING_ADMIN: { label: "بانتظار الإدارة", bg: "#FEF9C3", text: "#A16207" },
  PENDING_TARGET: { label: "بانتظار المستهدف", bg: "#DBEAFE", text: "#1D4ED8" },
  APPROVED: { label: "مقبول", bg: "#DCFCE7", text: "#16A34A" },
  REJECTED_BY_ADMIN: { label: "مرفوض من الإدارة", bg: "#FEE2E2", text: "#DC2626" },
  REJECTED_BY_TARGET: { label: "مرفوض من المستهدف", bg: "#FEE2E2", text: "#DC2626" },
  CANCELLED: { label: "ملغي", bg: "#F3F4F6", text: "#6B7280" },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TaskTransfersPage() {
  const { t } = useLang();
  const { refreshCounts } = useSidebarCounts();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || "";
  const isAdmin = ["ADMIN", "MANAGER"].includes(session?.user?.role || "");

  const [activeTab, setActiveTab] = useState<"transfers" | "delegations">("transfers");

  /* ---- Transfer Requests state ---- */
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  /* ---- Review / Respond modal ---- */
  const [reviewModal, setReviewModal] = useState<{
    id: string;
    action: string;
    title: string;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  /* ---- Delegations state ---- */
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegationsLoading, setDelegationsLoading] = useState(true);

  /* ---- Add delegation modal ---- */
  const [showAddModal, setShowAddModal] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [newFromProvider, setNewFromProvider] = useState("");
  const [newToProvider, setNewToProvider] = useState("");
  const [newIsPermanent, setNewIsPermanent] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Fetchers                                                         */
  /* ---------------------------------------------------------------- */

  const fetchTransfers = useCallback(() => {
    setTransfersLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/task-transfers?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTransfers(d);
        setTransfersLoading(false);
      })
      .catch(() => setTransfersLoading(false));
  }, [statusFilter]);

  const fetchDelegations = useCallback(() => {
    setDelegationsLoading(true);
    fetch("/api/task-delegations")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setDelegations(d);
        setDelegationsLoading(false);
      })
      .catch(() => setDelegationsLoading(false));
  }, []);

  const fetchProviders = useCallback(() => {
    fetch("/api/service-provider-mappings/providers")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProviders(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Auto-check for expired transfers, then fetch
    fetch("/api/task-transfers/check-expired").finally(() => fetchTransfers());
  }, [fetchTransfers]);

  useEffect(() => {
    if (activeTab === "delegations") {
      fetchDelegations();
      fetchProviders();
    }
  }, [activeTab, fetchDelegations, fetchProviders]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const handleReviewSubmit = async () => {
    if (!reviewModal) return;
    setActionLoading(reviewModal.id);
    try {
      const res = await fetch(`/api/task-transfers/${reviewModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: reviewModal.action,
          note: reviewNote || undefined,
        }),
      });
      if (res.ok) { fetchTransfers(); refreshCounts(); }
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
      setReviewModal(null);
      setReviewNote("");
    }
  };

  const handleToggleDelegation = async (id: string, currentActive: boolean) => {
    if (actionLoading) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/task-delegations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) fetchDelegations();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteDelegation = async (id: string) => {
    if (actionLoading) return;
    if (!confirm("هل أنت متأكد من حذف هذا التفويض؟")) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/task-delegations/${id}`, { method: "DELETE" });
      if (res.ok) fetchDelegations();
    } catch { /* ignore */ } finally {
      setActionLoading(null);
    }
  };

  const handleAddDelegation = async () => {
    if (!newFromProvider || !newToProvider) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/task-delegations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterId: newFromProvider,
          targetUserId: newToProvider,
          isPermanent: newIsPermanent,
        }),
      });
      if (res.ok) {
        fetchDelegations();
        setShowAddModal(false);
        setNewFromProvider("");
        setNewToProvider("");
        setNewIsPermanent(false);
      }
    } catch { /* ignore */ } finally {
      setAddLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const getActionsForTransfer = (tr: TransferRequest) => {
    const actions: { label: string; action: string; color: string; bg: string; icon: "check" | "x" | "complete" }[] = [];

    // Admin actions for PENDING_ADMIN
    if (tr.status === "PENDING_ADMIN" && isAdmin) {
      actions.push(
        { label: "موافقة", action: "approve", color: "#16A34A", bg: "#DCFCE7", icon: "check" },
        { label: "رفض", action: "reject", color: "#DC2626", bg: "#FEE2E2", icon: "x" },
      );
    }

    // Target user actions for PENDING_TARGET
    if (tr.status === "PENDING_TARGET" && tr.targetUser.id === currentUserId) {
      actions.push(
        { label: "قبول", action: "accept", color: "#16A34A", bg: "#DCFCE7", icon: "check" },
        { label: "إكمال مباشرة", action: "accept_complete", color: "#fff", bg: "#16A34A", icon: "complete" },
        { label: "رفض", action: "decline", color: "#DC2626", bg: "#FEE2E2", icon: "x" },
      );
    }

    // Requester can cancel PENDING_ADMIN
    if (tr.status === "PENDING_ADMIN" && tr.requester.id === currentUserId && !isAdmin) {
      actions.push(
        { label: "إلغاء", action: "cancel", color: "#6B7280", bg: "#F3F4F6", icon: "x" },
      );
    }

    return actions;
  };

  const tabs = [
    { key: "transfers" as const, label: "طلبات النقل", icon: ArrowLeftRight },
    { key: "delegations" as const, label: "التفويضات", icon: Users },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            {t.transfers.title}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            مراجعة طلبات نقل المهام وإدارة التفويضات بين مقدمي الخدمات
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="bg-white rounded-2xl p-1.5 mb-6 inline-flex gap-1"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={active ? { backgroundColor: "#5E5495", color: "#fff" } : { color: "#2D3748", opacity: 0.6 }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/*  TAB 1 – Transfer Requests                                    */}
      {/* ============================================================ */}
      {activeTab === "transfers" && (
        <>
          {/* Filters */}
          <div
            className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <Filter size={16} style={{ color: "#94A3B8" }} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            >
              <option value="">{t.common.all || "الكل"}</option>
              <option value="PENDING_ADMIN">بانتظار الإدارة</option>
              <option value="PENDING_TARGET">بانتظار المستهدف</option>
              <option value="APPROVED">مقبول</option>
              <option value="REJECTED_BY_ADMIN">مرفوض من الإدارة</option>
              <option value="REJECTED_BY_TARGET">مرفوض من المستهدف</option>
              <option value="CANCELLED">ملغي</option>
            </select>
          </div>

          {/* Table */}
          {transfersLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
            </div>
          ) : transfers.length === 0 ? (
            <div
              className="text-center py-20 bg-white rounded-2xl"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <ArrowLeftRight size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
              <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد طلبات نقل</p>
              <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>ستظهر هنا طلبات نقل المهام عند إنشائها</p>
            </div>
          ) : (
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                      {["المهمة", "من", "إلى", "الأولوية", "الموعد النهائي", "السبب", "الحالة", "التاريخ", "الإجراءات"].map((h) => (
                        <th key={h} className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((tr) => {
                      const st = statusConfig[tr.status] || { label: tr.status, bg: "#F3F4F6", text: "#6B7280" };
                      const actions = getActionsForTransfer(tr);
                      return (
                        <tr key={tr.id} className="transition-colors hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                          <td className="px-5 py-4">
                            <span className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{tr.task.title}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm" style={{ color: "#2D3748" }}>{tr.requester.name}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm" style={{ color: "#2D3748" }}>{tr.targetUser.name}</span>
                          </td>
                          <td className="px-5 py-4">
                            {tr.urgency === "URGENT" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                                <AlertTriangle size={12} />
                                عاجل
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#F0F9FF", color: "#0369A1" }}>
                                عادي
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {tr.expiresAt && !tr.autoExpired && ["PENDING_ADMIN", "PENDING_TARGET"].includes(tr.status) ? (() => {
                              const exp = new Date(tr.expiresAt);
                              const nowMs = Date.now();
                              const diffMs = exp.getTime() - nowMs;
                              const isExpired = diffMs <= 0;
                              const hours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
                              const mins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
                              return (
                                <div className="flex items-center gap-1.5">
                                  <Clock size={13} style={{ color: isExpired ? "#DC2626" : diffMs < 3600000 ? "#EA580C" : "#6B7280" }} />
                                  <span className="text-xs font-semibold" style={{ color: isExpired ? "#DC2626" : diffMs < 3600000 ? "#EA580C" : "#2D3748" }}>
                                    {isExpired ? `متأخر ${hours}س ${mins}د` : `${hours}س ${mins}د`}
                                  </span>
                                </div>
                              );
                            })() : tr.autoExpired ? (
                              <span className="text-xs font-semibold" style={{ color: "#DC2626" }}>منتهي</span>
                            ) : (
                              <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                          <td className="px-5 py-4 max-w-[200px]">
                            <span className="text-sm truncate block" style={{ color: "#2D3748" }} title={tr.reason}>{tr.reason}</span>
                            {tr.adminNote && (
                              <span className="text-xs block mt-1 truncate" style={{ color: "#6B7280" }} title={`ملاحظة الإدارة: ${tr.adminNote}`}>
                                الإدارة: {tr.adminNote}
                              </span>
                            )}
                            {tr.targetNote && (
                              <span className="text-xs block mt-0.5 truncate" style={{ color: "#6B7280" }} title={`رد المستهدف: ${tr.targetNote}`}>
                                المستهدف: {tr.targetNote}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                              {st.label}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm" style={{ color: "#2D3748" }}>{formatDate(tr.createdAt)}</span>
                          </td>
                          <td className="px-5 py-4">
                            {actions.length > 0 ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                {actions.map((a) => (
                                  <MarsaButton
                                    key={a.action}
                                    onClick={() => {
                                      if (a.action === "cancel") {
                                        // Direct cancel without modal
                                        setActionLoading(tr.id);
                                        fetch(`/api/task-transfers/${tr.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ action: "cancel" }),
                                        }).then(() => { fetchTransfers(); refreshCounts(); setActionLoading(null); }).catch(() => setActionLoading(null));
                                      } else {
                                        setReviewModal({ id: tr.id, action: a.action, title: a.label });
                                      }
                                    }}
                                    disabled={actionLoading === tr.id}
                                    variant="ghost" size="xs"
                                    icon={a.icon === "check" ? <Check size={14} /> : a.icon === "complete" ? <CheckCircle2 size={14} /> : <X size={14} />}
                                    style={{ backgroundColor: a.bg, color: a.color }}
                                  >
                                    {a.label}
                                  </MarsaButton>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  TAB 2 – Delegations                                         */}
      {/* ============================================================ */}
      {activeTab === "delegations" && (
        <>
          <div className="flex justify-end mb-6">
            <MarsaButton
              onClick={() => setShowAddModal(true)}
              variant="gold"
              icon={<Plus size={18} />}
            >
              إضافة تفويض
            </MarsaButton>
          </div>

          {delegationsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
            </div>
          ) : delegations.length === 0 ? (
            <div
              className="text-center py-20 bg-white rounded-2xl"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <Users size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
              <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد تفويضات</p>
              <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>قم بإضافة تفويض جديد لتمكين نقل المهام تلقائيًا</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                      {["من المزود", "إلى المزود", "النوع", "الحالة", "الإجراءات"].map((h) => (
                        <th key={h} className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {delegations.map((d) => (
                      <tr key={d.id} className="transition-colors hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                        <td className="px-5 py-4">
                          <span className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{d.fromProvider.name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: "#2D3748" }}>{d.toProvider.name}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={d.isPermanent ? { backgroundColor: "#EFF6FF", color: "#2563EB" } : { backgroundColor: "#F5F3FF", color: "#7C3AED" }}
                          >
                            {d.isPermanent ? "دائم" : "لكل طلب"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleToggleDelegation(d.id, d.isActive)}
                            disabled={actionLoading === d.id}
                            className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-50"
                            style={{ backgroundColor: d.isActive ? "#16A34A" : "#D1D5DB" }}
                          >
                            <span
                              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                              style={{ left: d.isActive ? "2px" : "auto", right: d.isActive ? "auto" : "2px" }}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleDeleteDelegation(d.id)}
                            disabled={actionLoading === d.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#FEF2F2] disabled:opacity-50"
                            title="حذف"
                          >
                            <Trash2 size={16} style={{ color: "#DC2626" }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/*  Review / Respond Modal                                       */}
      {/* ============================================================ */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" dir="rtl" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: ["approve", "accept", "accept_complete"].includes(reviewModal.action) ? "#DCFCE7" : "#FEE2E2",
                }}
              >
                {["approve", "accept", "accept_complete"].includes(reviewModal.action) ? (
                  reviewModal.action === "accept_complete" ? <CheckCircle2 size={20} style={{ color: "#16A34A" }} /> : <Check size={20} style={{ color: "#16A34A" }} />
                ) : (
                  <X size={20} style={{ color: "#DC2626" }} />
                )}
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {reviewModal.title}
              </h3>
            </div>

            {reviewModal.action === "accept_complete" && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: "#ECFDF5", color: "#065F46" }}>
                سيتم قبول التحويل وإكمال المهمة مباشرة بنفس الوقت
              </div>
            )}

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
              <MessageSquare size={14} className="inline ml-1" style={{ color: "#94A3B8" }} />
              ملاحظات (اختياري)
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
              placeholder="أضف ملاحظاتك هنا..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none mb-5"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "#FAFAFE" }}
            />

            <div className="flex gap-3">
              <MarsaButton
                onClick={handleReviewSubmit}
                disabled={actionLoading !== null}
                loading={actionLoading !== null}
                variant={["approve", "accept", "accept_complete"].includes(reviewModal.action) ? "primary" : "danger"}
                icon={["approve", "accept", "accept_complete"].includes(reviewModal.action) ? <Check size={16} /> : <X size={16} />}
                className="flex-1"
                style={{
                  backgroundColor: ["approve", "accept", "accept_complete"].includes(reviewModal.action) ? "#16A34A" : undefined,
                }}
              >
                تأكيد
              </MarsaButton>
              <MarsaButton
                onClick={() => { setReviewModal(null); setReviewNote(""); }}
                variant="secondary"
              >
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  Add Delegation Modal                                         */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" dir="rtl" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
                <Plus size={20} style={{ color: "#C9A84C" }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>إضافة تفويض جديد</h3>
            </div>

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>من المزود</label>
            <select
              value={newFromProvider}
              onChange={(e) => setNewFromProvider(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white cursor-pointer mb-4"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            >
              <option value="">اختر المزود</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label className="block text-sm font-medium mb-2" style={{ color: "#2D3748" }}>إلى المزود</label>
            <select
              value={newToProvider}
              onChange={(e) => setNewToProvider(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none bg-white cursor-pointer mb-4"
              style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            >
              <option value="">اختر المزود</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            <label className="flex items-center gap-3 mb-5 cursor-pointer">
              <div
                className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                style={{ backgroundColor: newIsPermanent ? "#1C1B2E" : "#fff", border: newIsPermanent ? "none" : "2px solid #D1D5DB" }}
                onClick={() => setNewIsPermanent(!newIsPermanent)}
              >
                {newIsPermanent && <Check size={14} style={{ color: "#fff" }} />}
              </div>
              <span className="text-sm font-medium" style={{ color: "#2D3748" }} onClick={() => setNewIsPermanent(!newIsPermanent)}>
                تفويض دائم
              </span>
            </label>

            <div className="flex gap-3">
              <MarsaButton
                onClick={handleAddDelegation}
                disabled={!newFromProvider || !newToProvider || addLoading}
                loading={addLoading}
                variant="gold"
                icon={<Plus size={16} />}
                className="flex-1"
              >
                إضافة
              </MarsaButton>
              <MarsaButton
                onClick={() => { setShowAddModal(false); setNewFromProvider(""); setNewToProvider(""); setNewIsPermanent(false); }}
                variant="secondary"
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
