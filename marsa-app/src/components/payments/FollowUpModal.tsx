"use client";

import { useState } from "react";
import { X, MessageCircle, Loader2, Send, Phone } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Props {
  installmentId: string;
  installmentTitle: string;
  clientName?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const OUTCOMES = [
  { value: "PROMISED_PAYMENT", label: "وعد بالسداد", color: "#16A34A" },
  { value: "UNREACHABLE", label: "لم يرد", color: "#6B7280" },
  { value: "REFUSED", label: "رفض", color: "#DC2626" },
  { value: "RESCHEDULED", label: "إعادة جدولة", color: "#0EA5E9" },
];

function plus7DaysIso() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FollowUpModal({
  installmentId,
  installmentTitle,
  clientName,
  onClose,
  onSuccess,
}: Props) {
  const [outcome, setOutcome] = useState<string>("PROMISED_PAYMENT");
  const [promisedDate, setPromisedDate] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState(plus7DaysIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(openWhatsApp: boolean) {
    setError("");
    if (!notes.trim()) {
      setError("الملاحظات مطلوبة");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/${installmentId}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          notes: notes.trim(),
          promisedDate: outcome === "PROMISED_PAYMENT" && promisedDate ? promisedDate : undefined,
          promisedAmount: promisedAmount ? Number(promisedAmount) : undefined,
          nextFollowUpAt: nextFollowUpAt || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر الحفظ");
        return;
      }

      if (openWhatsApp) {
        try {
          const wres = await fetch(`/api/payments/${installmentId}/whatsapp-message`);
          if (wres.ok) {
            const w = await wres.json();
            if (w.url) window.open(w.url, "_blank", "noopener,noreferrer");
          }
        } catch {
          /* whatsapp open is best-effort */
        }
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(14,165,233,0.12)" }}>
              <MessageCircle size={18} style={{ color: "#0EA5E9" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>تسجيل متابعة</h3>
              <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>
                {clientName ? `${clientName} — ` : ""}{installmentTitle}
              </p>
            </div>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={submitting} />
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>نتيجة الاتصال <span style={{ color: "#DC2626" }}>*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const active = outcome === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setOutcome(o.value)} disabled={submitting}
                    className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ backgroundColor: active ? `${o.color}15` : "white", color: active ? o.color : "#6B7280", border: `1.5px solid ${active ? o.color : "#E5E7EB"}` }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {outcome === "PROMISED_PAYMENT" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>تاريخ الوعد</label>
                <input type="date" value={promisedDate} onChange={(e) => setPromisedDate(e.target.value)} disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" style={{ direction: "ltr", textAlign: "right" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>المبلغ الموعود</label>
                <input type="number" min="0" step="0.01" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} disabled={submitting}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none font-mono" style={{ direction: "ltr", textAlign: "right" }}
                  placeholder="اختياري" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>الملاحظات <span style={{ color: "#DC2626" }}>*</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="ماذا قال العميل؟" />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>المتابعة القادمة</label>
            <input type="date" value={nextFollowUpAt} onChange={(e) => setNextFollowUpAt(e.target.value)} disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none" style={{ direction: "ltr", textAlign: "right" }} />
            <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>سيُذكَّرك النظام في هذا التاريخ.</p>
          </div>

          {error && <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>{error}</div>}
        </div>
        <div className="flex gap-2 p-5 border-t border-gray-100">
          <MarsaButton variant="primary" size="sm" onClick={() => submit(false)} loading={submitting} disabled={submitting} icon={<Send size={13} />} className="flex-1">حفظ</MarsaButton>
          <MarsaButton variant="gold" size="sm" onClick={() => submit(true)} disabled={submitting} icon={<Phone size={13} />}>حفظ + واتساب</MarsaButton>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}
