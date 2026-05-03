"use client";

import { useState } from "react";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// ReactivateProjectModal
// ═══════════════════════════════════════════════════════════════════════
// Triggered by the 🔄 button on a COLLAPSED building. Lets the admin
// type a new deadline and a short reason, then POSTs to
// /api/projects/[id]/reactivate which extends endDate (and
// contractEndDate when present), flips status back to ACTIVE, and
// stamps an audit log entry.

interface Props {
  projectId: string;
  projectName: string;
  // Current effective deadline (may already be in the past — that's
  // why we're reactivating). Drives the "+30 days from today" default.
  onClose: () => void;
  onSuccess?: () => void;
}

function defaultNewDeadline(): string {
  // 30 days out from today, formatted YYYY-MM-DD for <input type=date>.
  const d = new Date();
  d.setDate(d.getDate() + 30);
  // Shift to local-tz midnight so the date input stays consistent
  // regardless of the user's timezone offset.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ReactivateProjectModal({
  projectId,
  projectName,
  onClose,
  onSuccess,
}: Props) {
  const [newDeadline, setNewDeadline] = useState<string>(defaultNewDeadline());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!newDeadline) {
      setError("اختر موعد التسليم الجديد");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDeadline,
          reason: reason.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر إعادة التنشيط");
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(5,150,105,0.12)" }}
            >
              <RefreshCw size={18} style={{ color: "#059669" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                إعادة تنشيط المشروع
              </h3>
              <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>
                {projectName}
              </p>
            </div>
          </div>
          <MarsaButton
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={16} />}
            onClick={onClose}
            disabled={submitting}
          />
        </div>

        <div className="p-5 space-y-4">
          <div
            className="p-3 rounded-xl text-xs"
            style={{
              backgroundColor: "rgba(220,38,38,0.05)",
              border: "1px solid rgba(220,38,38,0.20)",
              color: "#374151",
            }}
          >
            المشروع تجاوز موعد التسليم وصُنِّف كـ <strong>منهار</strong>. أدخل
            موعد تسليم جديد لإعادة تنشيطه — سيرجع إلى حالة <strong>نشط</strong>{" "}
            وسيُشعَر المنفذون بالموعد الجديد.
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              موعد التسليم الجديد <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="date"
              value={newDeadline}
              min={todayIso()}
              onChange={(e) => setNewDeadline(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              style={{ direction: "ltr", textAlign: "right" }}
            />
            <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>
              الافتراضي: 30 يوماً من اليوم. عدّله حسب الاتفاق مع العميل.
            </p>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              سبب إعادة التنشيط (اختياري)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="مثال: العميل وافق على تمديد التسليم 30 يوماً"
            />
          </div>

          {error && (
            <div
              className="p-2 rounded-lg text-xs"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#059669", color: "white" }}
          >
            {submitting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            تأكيد إعادة التنشيط
          </button>
          <MarsaButton
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </MarsaButton>
        </div>
      </div>
    </div>
  );
}
