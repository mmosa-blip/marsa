"use client";

import { useState } from "react";
import { X, Pause, Loader2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// PauseProjectModal
// ═══════════════════════════════════════════════════════════════════════
// Compact admin modal triggered by the inline ⏸️ button on a building
// in /dashboard/all-cities. Posts to /api/projects/[id]/pause with the
// existing API contract: { reason, notes }. The wire vocabulary stays
// `PAYMENT_DELAY | CLIENT_REQUEST | OTHER` (matches what the API
// already accepts and what ProjectPause history was written with).

type PauseReason = "PAYMENT_DELAY" | "ADMIN_DECISION" | "CLIENT_REQUEST";

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REASONS: { value: PauseReason; label: string; hint: string }[] = [
  {
    value: "PAYMENT_DELAY",
    label: "دفعة متأخرة",
    hint: "العميل لم يسدد دفعة مستحقة",
  },
  {
    value: "ADMIN_DECISION",
    label: "قرار إداري",
    hint: "إيقاف داخلي من الإدارة",
  },
  {
    value: "CLIENT_REQUEST",
    label: "بطلب من العميل",
    hint: "العميل طلب الإيقاف مؤقتاً",
  },
];

export default function PauseProjectModal({
  projectId,
  projectName,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState<PauseReason>("PAYMENT_DELAY");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      // The API enum still uses "OTHER" for the catch-all; map our
      // internal "ADMIN_DECISION" label onto that. Visually we want the
      // clearer label, but on the wire we stay backward-compatible.
      const wireReason = reason === "ADMIN_DECISION" ? "OTHER" : reason;
      const res = await fetch(`/api/projects/${projectId}/pause`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: wireReason,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر إيقاف المشروع");
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
              style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
            >
              <Pause size={18} style={{ color: "#5E5495" }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                إيقاف المشروع
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
          <div>
            <label
              className="block text-xs font-semibold mb-2"
              style={{ color: "#374151" }}
            >
              سبب الإيقاف <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <div className="space-y-1.5">
              {REASONS.map((r) => {
                const active = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    disabled={submitting}
                    className="w-full flex items-start gap-2 p-3 rounded-xl text-right transition-all"
                    style={{
                      backgroundColor: active ? "rgba(94,84,149,0.06)" : "white",
                      border: `1.5px solid ${active ? "#5E5495" : "#E5E7EB"}`,
                    }}
                  >
                    <div
                      className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        border: `2px solid ${active ? "#5E5495" : "#94A3B8"}`,
                      }}
                    >
                      {active && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: "#5E5495" }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-sm font-bold"
                        style={{ color: active ? "#5E5495" : "#1C1B2E" }}
                      >
                        {r.label}
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "#9CA3AF" }}
                      >
                        {r.hint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              ملاحظة (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="مثال: ينتظر تحويل الدفعة الثانية"
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
            style={{ backgroundColor: "#5E5495", color: "white" }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />}
            تأكيد الإيقاف
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
