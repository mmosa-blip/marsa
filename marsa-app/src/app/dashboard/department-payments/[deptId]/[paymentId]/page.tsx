"use client";

import { useState, useEffect, use } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Calendar,
  User,
  Building2,
  Loader2,
  CircleDot,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import SarSymbol from "@/components/SarSymbol";

/* ─── Types ─── */
interface Installment {
  id: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "PAID" | "OVERDUE";
  paidDate: string | null;
}

interface PaymentDetail {
  id: string;
  amount: number;
  paidAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  paymentType: "FULL" | "INSTALLMENTS";
  paymentMethod: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  client: { id: string; name: string };
  department: { id: string; name: string };
  project: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  installments: Installment[];
}

/* ─── Helpers ─── */
const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "معلق", bg: "#F3F4F6", text: "#6B7280" },
  PARTIAL: { label: "جزئي", bg: "#FFF7ED", text: "#EA580C" },
  PAID:    { label: "مدفوع", bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخر", bg: "#FEF2F2", text: "#DC2626" },
};

const installmentStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "قيد الانتظار", bg: "#F3F4F6", text: "#6B7280" },
  PAID:    { label: "مدفوع",       bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخر",       bg: "#FEF2F2", text: "#DC2626" },
};

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقدا",
  CHECK: "شيك",
  CREDIT_CARD: "بطاقة ائتمان",
  OTHER: "أخرى",
};

const typeLabels: Record<string, string> = {
  FULL: "كامل",
  INSTALLMENTS: "أقساط",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pct(paid: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}

/* ─── Page ─── */
export default function PaymentDetailPage({ params }: { params: Promise<{ deptId: string; paymentId: string }> }) {
  const { deptId, paymentId } = use(params);

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const loadPayment = () => {
    fetch(`/api/department-payments/${paymentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.id) setPayment(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadPayment();
  }, [paymentId]);

  const markInstallmentPaid = async (installmentId: string) => {
    setMarkingPaid(installmentId);
    try {
      const res = await fetch(`/api/department-payments/${paymentId}/installments/${installmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (res.ok) {
        loadPayment();
      }
    } catch {
      /* ignore */
    }
    setMarkingPaid(null);
  };

  /* ─── Loading / Not found ─── */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-8 text-center text-lg" style={{ color: "#DC2626" }}>
        الدفعة غير موجودة
      </div>
    );
  }

  const st = statusConfig[payment.status] || statusConfig.PENDING;
  const progress = pct(payment.paidAmount, payment.amount);

  /* ─── Info rows helper ─── */
  const infoRows: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "طريقة الدفع", value: payment.paymentMethod ? (methodLabels[payment.paymentMethod] || payment.paymentMethod) : "—", icon: <CreditCard size={14} style={{ color: "#C9A84C" }} /> },
    { label: "نوع الدفع", value: typeLabels[payment.paymentType] || payment.paymentType, icon: <FileText size={14} style={{ color: "#C9A84C" }} /> },
    { label: "تاريخ الاستحقاق", value: fmt(payment.dueDate), icon: <Calendar size={14} style={{ color: "#C9A84C" }} /> },
    { label: "القسم", value: payment.department?.name || "—", icon: <Building2 size={14} style={{ color: "#C9A84C" }} /> },
    { label: "المشروع", value: payment.project?.name || "—", icon: <FileText size={14} style={{ color: "#C9A84C" }} /> },
    { label: "الخدمة", value: payment.service?.name || "—", icon: <FileText size={14} style={{ color: "#C9A84C" }} /> },
    { label: "أنشأ بواسطة", value: payment.createdBy?.name || "—", icon: <User size={14} style={{ color: "#C9A84C" }} /> },
    { label: "تاريخ الإنشاء", value: fmt(payment.createdAt), icon: <Clock size={14} style={{ color: "#C9A84C" }} /> },
  ];

  return (
    <div className="p-8" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <MarsaButton
            href={`/dashboard/department-payments/${deptId}`}
            variant="ghost"
            size="md"
            iconOnly
            icon={<ArrowRight size={20} style={{ color: "#1C1B2E" }} />}
            style={{ border: "1px solid #E2E0D8" }}
          />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
                {payment.client.name}
              </h1>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: st.bg, color: st.text }}
              >
                {st.label}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
              {payment.department?.name} — {typeLabels[payment.paymentType] || payment.paymentType}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column: Amount + Info ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Amount & Progress card */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>إجمالي المبلغ</p>
                <p className="text-3xl font-bold" style={{ color: "#1C1B2E" }}>
                  {payment.amount.toLocaleString("en-US")} <SarSymbol size={16} />
                </p>
              </div>
              <div className="text-left">
                <p className="text-xs font-medium mb-1" style={{ color: "#6B7280" }}>المدفوع</p>
                <p className="text-2xl font-bold" style={{ color: "#059669" }}>
                  {payment.paidAmount.toLocaleString("en-US")} <SarSymbol size={14} />
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span style={{ color: "#6B7280" }}>
                  المتبقي: {(payment.amount - payment.paidAmount).toLocaleString("en-US")} ر.س
                </span>
                <span
                  className="font-bold"
                  style={{ color: progress === 100 ? "#059669" : "#C9A84C" }}
                >
                  {progress}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    backgroundColor: progress === 100 ? "#059669" : "#C9A84C",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>تفاصيل الدفعة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {infoRows.map((row, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: "#F8F7F4" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                    {row.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium" style={{ color: "#9CA3AF" }}>{row.label}</p>
                    <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {payment.notes && (
              <div className="mt-5 p-4 rounded-xl" style={{ backgroundColor: "#F8F7F4" }}>
                <p className="text-[11px] font-medium mb-1" style={{ color: "#9CA3AF" }}>ملاحظات</p>
                <p className="text-sm" style={{ color: "#2D3748" }}>{payment.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Installments ── */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
              {payment.paymentType === "INSTALLMENTS" ? "الأقساط" : "سجل الدفعات"}
            </h2>

            {payment.installments.length === 0 ? (
              <div className="text-center py-8">
                <CircleDot size={32} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
                <p className="text-sm" style={{ color: "#9CA3AF" }}>
                  لا توجد أقساط مسجلة
                </p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 rounded-full"
                  style={{
                    backgroundColor: "#E2E0D8",
                    right: "15px",
                  }}
                />

                <div className="space-y-0">
                  {payment.installments.map((inst, idx) => {
                    const instSt = installmentStatusConfig[inst.status] || installmentStatusConfig.PENDING;
                    const isPaid = inst.status === "PAID";
                    const isLast = idx === payment.installments.length - 1;

                    return (
                      <div key={inst.id} className={`relative flex items-start gap-4 ${isLast ? "" : "pb-6"}`}>
                        {/* Timeline dot */}
                        <div
                          className="w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 z-10"
                          style={{
                            backgroundColor: isPaid ? "#059669" : inst.status === "OVERDUE" ? "#DC2626" : "#E2E0D8",
                          }}
                        >
                          {isPaid ? (
                            <CheckCircle2 size={16} style={{ color: "#FFFFFF" }} />
                          ) : inst.status === "OVERDUE" ? (
                            <Clock size={14} style={{ color: "#FFFFFF" }} />
                          ) : (
                            <CircleDot size={14} style={{ color: "#6B7280" }} />
                          )}
                        </div>

                        {/* Content */}
                        <div
                          className="flex-1 p-4 rounded-xl transition-all"
                          style={{
                            backgroundColor: isPaid ? "rgba(5,150,105,0.04)" : "#F8F7F4",
                            border: `1px solid ${isPaid ? "rgba(5,150,105,0.15)" : "#E2E0D8"}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                              {inst.amount.toLocaleString("en-US")} <SarSymbol size={10} />
                            </span>
                            <span
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-medium"
                              style={{ backgroundColor: instSt.bg, color: instSt.text }}
                            >
                              {instSt.label}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] mb-2" style={{ color: "#9CA3AF" }}>
                            <Calendar size={11} />
                            <span>الاستحقاق: {fmt(inst.dueDate)}</span>
                          </div>

                          {isPaid && inst.paidDate && (
                            <div className="flex items-center gap-1 text-[11px]" style={{ color: "#059669" }}>
                              <CheckCircle2 size={11} />
                              <span>تم الدفع: {fmt(inst.paidDate)}</span>
                            </div>
                          )}

                          {inst.status === "PENDING" && (
                            <MarsaButton
                              variant="gold"
                              size="xs"
                              loading={markingPaid === inst.id}
                              icon={<CheckCircle2 size={12} />}
                              onClick={() => markInstallmentPaid(inst.id)}
                              className="mt-2"
                            >
                              تم الدفع
                            </MarsaButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
