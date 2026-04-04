"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import {
  ArrowRight,
  Check,
  X,
  Clock,
  DollarSign,
  User,
  CreditCard,
  FileText,
  ChevronDown,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface PaymentRequestDetail {
  id: string;
  requestNumber: string;
  amount: number;
  status: string;
  notes: string | null;
  supervisorApproval: boolean | null;
  supervisorApprovedAt: string | null;
  supervisorNotes: string | null;
  financeApproval: boolean | null;
  financeApprovedAt: string | null;
  financeNotes: string | null;
  treasuryApproval: boolean | null;
  treasuryApprovedAt: string | null;
  treasuryNotes: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
  provider: { id: string; name: string; specialization: string | null; bankName: string | null; bankIban: string | null; supervisorId: string | null };
  taskCost: { id: string; amount: number; task: { id: string; title: string; service: { name: string } | null; project: { name: string } | null } };
  requestedBy: { name: string };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_SUPERVISOR: { label: "بانتظار المسؤول", color: "#D97706", bg: "#FFFBEB" },
  PENDING_FINANCE: { label: "بانتظار المدير المالي", color: "#2563EB", bg: "#EFF6FF" },
  PENDING_TREASURY: { label: "بانتظار مدير الصندوق", color: "#7C3AED", bg: "#F5F3FF" },
  APPROVED: { label: "تمت الموافقة", color: "#059669", bg: "#ECFDF5" },
  PAID: { label: "تم الصرف", color: "#047857", bg: "#D1FAE5" },
  REJECTED: { label: "مرفوض", color: "#DC2626", bg: "#FEF2F2" },
};

const paymentMethods: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقدي",
  CREDIT_CARD: "بطاقة ائتمان",
  CHECK: "شيك",
};

export default function PaymentRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const { refreshCounts } = useSidebarCounts();
  const [request, setRequest] = useState<PaymentRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("BANK_TRANSFER");
  const [paymentRef, setPaymentRef] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [id]);

  async function fetchRequest() {
    try {
      const res = await fetch(`/api/payment-requests/${id}`);
      if (res.ok) setRequest(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setProcessing(true);
    const body: Record<string, string> = { notes: actionNotes };
    if (session?.user.role === "TREASURY_MANAGER") {
      body.paymentMethod = selectedPaymentMethod;
      body.paymentReference = paymentRef;
    }
    const res = await fetch(`/api/payment-requests/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setActionNotes("");
      fetchRequest();
      refreshCounts();
    }
    setProcessing(false);
  }

  async function handleReject() {
    setProcessing(true);
    const res = await fetch(`/api/payment-requests/${id}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: actionNotes }),
    });
    if (res.ok) {
      setActionNotes("");
      setShowRejectModal(false);
      fetchRequest();
      refreshCounts();
    }
    setProcessing(false);
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  // Determine if current user can act
  function canAct(): boolean {
    if (!session || !request) return false;
    const role = session.user.role;
    const status = request.status;

    if (status === "PENDING_SUPERVISOR") {
      return (role === "ADMIN" || role === "MANAGER" || (role === "EXECUTOR" && request.provider.supervisorId === session.user.id));
    }
    if (status === "PENDING_FINANCE") return role === "FINANCE_MANAGER" || role === "ADMIN";
    if (status === "PENDING_TREASURY") return role === "TREASURY_MANAGER" || role === "ADMIN";
    return false;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">طلب الصرف غير موجود</p>
        <MarsaButton href="/dashboard/payment-requests" variant="link" size="sm" className="mt-2">العودة</MarsaButton>
      </div>
    );
  }

  const st = statusConfig[request.status] || statusConfig.PENDING_SUPERVISOR;

  const approvalSteps = [
    {
      label: "الموظف المسؤول",
      status: request.supervisorApproval === true ? "approved" : request.supervisorApproval === false ? "rejected" : request.status === "PENDING_SUPERVISOR" ? "current" : "pending",
      date: request.supervisorApprovedAt,
      notes: request.supervisorNotes,
    },
    {
      label: "المدير المالي",
      status: request.financeApproval === true ? "approved" : request.financeApproval === false ? "rejected" : request.status === "PENDING_FINANCE" ? "current" : "pending",
      date: request.financeApprovedAt,
      notes: request.financeNotes,
    },
    {
      label: "مدير الصندوق",
      status: request.treasuryApproval === true ? "approved" : request.treasuryApproval === false ? "rejected" : request.status === "PENDING_TREASURY" ? "current" : "pending",
      date: request.treasuryApprovedAt,
      notes: request.treasuryNotes,
    },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <MarsaButton href="/dashboard/payment-requests" variant="link" size="xs" style={{ color: "inherit" }}>طلبات الصرف</MarsaButton>
        <ArrowRight size={14} />
        <span style={{ color: "#1C1B2E" }}>{request.requestNumber}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{request.requestNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">تاريخ الإنشاء: {formatDate(request.createdAt)}</p>
          </div>
          <span className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><DollarSign size={16} /><span className="text-xs">المبلغ</span></div>
            <p className="text-xl font-bold flex items-center gap-1" style={{ color: "#C9A84C" }}>{request.amount.toLocaleString("en-US")} <SarSymbol size={18} /></p>
          </div>
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><User size={16} /><span className="text-xs">مقدم الخدمة</span></div>
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{request.provider.name}</p>
            {request.provider.specialization && <p className="text-xs text-gray-400">{request.provider.specialization}</p>}
          </div>
          <div className="p-4 rounded-xl bg-gray-50">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><FileText size={16} /><span className="text-xs">المهمة</span></div>
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{request.taskCost.task.title}</p>
            {request.taskCost.task.service && <p className="text-xs text-gray-400">{request.taskCost.task.service.name}</p>}
          </div>
        </div>

        {request.provider.bankName && (
          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-xs text-blue-600 mb-1">بيانات الحساب البنكي</p>
            <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{request.provider.bankName} — {request.provider.bankIban}</p>
          </div>
        )}
      </div>

      {/* Approval Timeline */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
        <h2 className="text-lg font-bold mb-6" style={{ color: "#1C1B2E" }}>مسار الاعتماد</h2>
        <div className="space-y-6">
          {approvalSteps.map((step, idx) => (
            <div key={idx} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: step.status === "approved" ? "#ECFDF5" : step.status === "rejected" ? "#FEF2F2" : step.status === "current" ? "#FFFBEB" : "#F3F4F6",
                    border: step.status === "current" ? "2px solid #D97706" : "none",
                  }}
                >
                  {step.status === "approved" ? <Check size={18} className="text-green-600" /> :
                   step.status === "rejected" ? <X size={18} className="text-red-600" /> :
                   step.status === "current" ? <Clock size={18} className="text-amber-600" /> :
                   <span className="text-xs text-gray-400">{idx + 1}</span>}
                </div>
                {idx < approvalSteps.length - 1 && (
                  <div className="w-0.5 h-full min-h-[40px] mt-2" style={{
                    backgroundColor: step.status === "approved" ? "#22C55E" : "#E5E7EB",
                  }} />
                )}
              </div>
              <div className="flex-1 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{step.label}</h3>
                  {step.status === "approved" && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">تمت الموافقة</span>}
                  {step.status === "rejected" && <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">مرفوض</span>}
                  {step.status === "current" && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">بانتظار</span>}
                </div>
                {step.date && <p className="text-xs text-gray-400 mb-1">{formatDate(step.date)}</p>}
                {step.notes && <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">{step.notes}</p>}
              </div>
            </div>
          ))}
        </div>

        {request.status === "PAID" && request.paymentMethod && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-700 mb-1">تم الصرف</p>
            <div className="flex items-center gap-4 text-xs text-green-600">
              <span>طريقة الدفع: {paymentMethods[request.paymentMethod] || request.paymentMethod}</span>
              {request.paymentReference && <span>رقم المرجع: {request.paymentReference}</span>}
              <span>تاريخ الصرف: {formatDate(request.paidAt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Action Section */}
      {canAct() && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>إجراء</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                rows={2}
                placeholder="ملاحظات (اختياري)"
              />
            </div>

            {session?.user.role === "TREASURY_MANAGER" && request.status === "PENDING_TREASURY" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                  >
                    <option value="BANK_TRANSFER">تحويل بنكي</option>
                    <option value="CASH">نقدي</option>
                    <option value="CHECK">شيك</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم المرجع</label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                    placeholder="رقم الحوالة أو الشيك"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <MarsaButton
                variant="gold"
                size="md"
                icon={<Check size={16} />}
                onClick={handleApprove}
                disabled={processing}
                loading={processing}
                className="flex-1"
                style={{ backgroundColor: "#22C55E" }}
              >
                {session?.user.role === "TREASURY_MANAGER" ? "الموافقة والصرف" : "موافقة"}
              </MarsaButton>
              <MarsaButton
                variant="danger"
                size="md"
                icon={<X size={16} />}
                onClick={() => setShowRejectModal(true)}
                disabled={processing}
                className="flex-1"
              >
                رفض
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>تأكيد الرفض</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">سبب الرفض *</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-200 text-sm"
                rows={3}
                placeholder="يرجى ذكر سبب الرفض"
              />
            </div>
            <div className="flex gap-3 mt-4">
              <MarsaButton
                variant="danger"
                size="md"
                onClick={handleReject}
                disabled={!actionNotes || processing}
                loading={processing}
                className="flex-1"
              >
                تأكيد الرفض
              </MarsaButton>
              <MarsaButton variant="secondary" size="md" onClick={() => setShowRejectModal(false)}>
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
