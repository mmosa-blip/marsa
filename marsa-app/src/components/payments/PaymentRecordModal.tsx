"use client";

import { useState } from "react";
import { X, DollarSign, Loader2, CheckCircle2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Props {
  installmentId: string;
  installmentTitle: string;
  remainingAmount: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const METHODS = [
  { value: "CASH", label: "نقد" },
  { value: "BANK_TRANSFER", label: "تحويل بنكي" },
  { value: "CHEQUE", label: "شيك" },
  { value: "OTHER", label: "أخرى" },
];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PaymentRecordModal({
  installmentId,
  installmentTitle,
  remainingAmount,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState<string>(String(remainingAmount));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [note, setNote] = useState("");
  const [expectedRemainingDate, setExpectedRemainingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const numAmount = Number(amount);
  const isPartial = Number.isFinite(numAmount) && numAmount > 0 && numAmount < remainingAmount;

  async function submit() {
    setError("");
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("المبلغ غير صالح");
      return;
    }
    if (numAmount > remainingAmount + 0.01) {
      setError("المبلغ يتجاوز المتبقي");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${installmentId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          method,
          paymentDate,
          note: note.trim() || undefined,
          expectedRemainingDate: isPartial && expectedRemainingDate ? expectedRemainingDate : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر الحفظ");
        return;
      }
      onSuccess?.();
      onClose();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(22,163,74,0.12)" }}>
              <DollarSign size={18} style={{ color: "#16A34A" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>تسجيل سداد</h3>
              <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>{installmentTitle}</p>
            </div>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={submitting} />
        </div>
        <div className="p-5 space-y-3">
          <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.2)" }}>
            <p className="text-[11px]" style={{ color: "#374151" }}>المبلغ المتبقي</p>
            <p className="text-lg font-bold" style={{ color: "#16A34A" }}>{remainingAmount.toLocaleString("en-US")} <span className="text-xs font-normal">ريال</span></p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>المبلغ <span style={{ color: "#DC2626" }}>*</span></label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono"
              style={{ direction: "ltr", textAlign: "right" }} />
            {isPartial && <p className="text-[10px] mt-1" style={{ color: "#EA580C" }}>سداد جزئي — سيُسجَّل المتبقي {(remainingAmount - numAmount).toLocaleString("en-US")} ريال</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>طريقة السداد</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={submitting}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none">
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>تاريخ السداد</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} disabled={submitting}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                style={{ direction: "ltr", textAlign: "right" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>ملاحظة</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} disabled={submitting} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </div>
          {isPartial && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>تاريخ متوقع للباقي</label>
              <input type="date" value={expectedRemainingDate} onChange={(e) => setExpectedRemainingDate(e.target.value)} disabled={submitting} min={todayIso()}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" style={{ direction: "ltr", textAlign: "right" }} />
            </div>
          )}
          {error && <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{error}</div>}
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={submit} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#16A34A", color: "white" }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            تأكيد السداد
          </button>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}
