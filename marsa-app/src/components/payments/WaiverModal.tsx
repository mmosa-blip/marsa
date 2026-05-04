"use client";

import { useState } from "react";
import { X, FileX, Loader2, AlertTriangle } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Props {
  installmentId: string;
  installmentTitle: string;
  remainingAmount: number;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function WaiverModal({
  installmentId,
  installmentTitle,
  remainingAmount,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("المبلغ غير صالح");
      return;
    }
    if (numAmount > remainingAmount + 0.01) {
      setError(`لا يتجاوز المتبقي (${remainingAmount.toLocaleString("en-US")})`);
      return;
    }
    if (!reason.trim()) {
      setError("السبب مطلوب");
      return;
    }
    if (!confirmed) {
      setError("يجب تأكيد الإجراء");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${installmentId}/waiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, reason: reason.trim() }),
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(220,38,38,0.12)" }}>
              <FileX size={18} style={{ color: "#DC2626" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>تنازل عن دفعة</h3>
              <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>{installmentTitle}</p>
            </div>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={submitting} />
        </div>
        <div className="p-5 space-y-3">
          <div className="p-3 rounded-xl flex items-start gap-2" style={{ backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.2)" }}>
            <AlertTriangle size={16} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
            <div className="text-[11px]" style={{ color: "#374151" }}>
              التنازل يُسقط جزءاً من المبلغ المستحق دون اعتباره مدفوعاً. الإجراء يُسجَّل في AuditLog ويتطلب صلاحية ADMIN.
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>المبلغ المتبقي</label>
            <p className="text-sm font-mono font-bold" style={{ color: "#1C1B2E" }}>{remainingAmount.toLocaleString("en-US")} ريال</p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>مبلغ التنازل <span style={{ color: "#DC2626" }}>*</span></label>
            <input type="number" min="0" max={remainingAmount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 font-mono"
              style={{ direction: "ltr", textAlign: "right" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>السبب <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} disabled={submitting} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="اشرح سبب التنازل بالتفصيل…" />
          </div>
          <label className="flex items-start gap-2 cursor-pointer p-2 rounded-lg" style={{ backgroundColor: "rgba(220,38,38,0.04)" }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={submitting} className="mt-0.5" />
            <span className="text-[11px]" style={{ color: "#374151" }}>أؤكد أنني أتحمل مسؤولية هذا التنازل وأنه تم باتفاق مع الإدارة العليا.</span>
          </label>
          {error && <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{error}</div>}
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button type="button" onClick={submit} disabled={submitting || !confirmed}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#DC2626", color: "white" }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <FileX size={13} />}
            تأكيد التنازل
          </button>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}
