"use client";

import { useState, useEffect } from "react";
import { CreditCard, Wallet, TrendingUp, Receipt } from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Payment {
  id: string;
  amount: number;
  method: string;
  referenceNumber: string | null;
  notes: string | null;
  paymentDate: string;
  invoice: { invoiceNumber: string; title: string; company: { name: string } };
}

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقداً",
  CHECK: "شيك",
  CREDIT_CARD: "بطاقة ائتمان",
  OTHER: "أخرى",
};

const methodColors: Record<string, { bg: string; text: string }> = {
  BANK_TRANSFER: { bg: "#EFF6FF", text: "#2563EB" },
  CASH: { bg: "#ECFDF5", text: "#059669" },
  CHECK: { bg: "#FFF7ED", text: "#EA580C" },
  CREDIT_CARD: { bg: "#F5F3FF", text: "#7C3AED" },
  OTHER: { bg: "#F3F4F6", text: "#6B7280" },
};

function fmt(d: string) { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/payments")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPayments(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonth = payments.filter((p) => {
    const d = new Date(p.paymentDate);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + p.amount, 0);

  const stats = [
    { label: "إجمالي المدفوعات", value: totalPayments, icon: Wallet, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "مدفوعات الشهر", value: thisMonth, icon: TrendingUp, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "عدد العمليات", value: payments.length, icon: CreditCard, color: "#C9A84C", bg: "rgba(201,168,76,0.1)", isCurrency: false },
  ];

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>المدفوعات</h1>
        <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>سجل جميع المدفوعات المالية</p>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {typeof s.value === "number" ? s.value.toLocaleString("en-US") : s.value}
              {s.isCurrency !== false && <SarSymbol size={12} />}
            </p>
          </div>
        ))}
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : payments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Receipt size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد مدفوعات</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          <table className="w-full">
            <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
              {["التاريخ", "الفاتورة", "الشركة", "المبلغ", "طريقة الدفع", "المرجع", "ملاحظات"].map((h, i) => (
                <th key={i} className="text-right px-4 py-3.5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {payments.map((p) => {
                const mc = methodColors[p.method] || methodColors.OTHER;
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors" style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-4 py-4 text-sm" style={{ color: "#2D3748" }}>{fmt(p.paymentDate)}</td>
                    <td className="px-4 py-4">
                      <MarsaButton href={`/dashboard/finance/invoices/${p.id}`} variant="link" size="xs" className="font-mono font-bold">{p.invoice.invoiceNumber}</MarsaButton>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{p.invoice.title}</p>
                    </td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#2D3748" }}>{p.invoice.company.name}</td>
                    <td className="px-4 py-4 text-sm font-bold" style={{ color: "#059669" }}>{p.amount.toLocaleString("en-US")} <SarSymbol size={14} /></td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: mc.bg, color: mc.text }}>{methodLabels[p.method] || p.method}</span>
                    </td>
                    <td className="px-4 py-4 text-sm font-mono" style={{ color: "#94A3B8" }}>{p.referenceNumber || "—"}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#94A3B8" }}>{p.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
