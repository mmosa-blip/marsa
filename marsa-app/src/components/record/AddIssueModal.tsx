"use client";

import { useState } from "react";
import { X, AlertTriangle, Send, Loader2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// AddIssueModal
// ═══════════════════════════════════════════════════════════════════════
// Lets an executor raise an issue against a task. The record API
// creates the ProjectRecordItem (kind=ISSUE, scope=TASK) AND the
// sibling ProjectIssue row (with severity + reportedById set
// server-side). A non-blocking TaskRequirementLink is also created
// so the issue surfaces under the task in the unified record.

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  LOW: { label: "منخفضة", color: "#6B7280" },
  MEDIUM: { label: "متوسطة", color: "#EA580C" },
  HIGH: { label: "عالية", color: "#DC2626" },
  CRITICAL: { label: "حرجة", color: "#7F1D1D" },
};

interface Props {
  taskId: string;
  taskTitle: string;
  projectId: string;
  serviceId: string | null;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddIssueModal({
  taskId,
  taskTitle,
  projectId,
  serviceId,
  onClose,
  onAdded,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ISSUE",
          scope: "TASK",
          title: title.trim(),
          description: description.trim() || null,
          serviceId: serviceId || undefined,
          taskId,
          // Issues are admin-visible by default — anyone working on
          // the task or above can see them.
          visibility: "ADMIN_ONLY",
          issue: { severity },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر إرسال البلاغ");
        return;
      }
      onAdded?.();
      onClose();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
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
              style={{ backgroundColor: "rgba(220,38,38,0.12)" }}
            >
              <AlertTriangle size={18} style={{ color: "#DC2626" }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                بلاغ مشكلة
              </h3>
              <p className="text-[11px]" style={{ color: "#6B7280" }}>
                {taskTitle}
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

        <div className="p-5 space-y-3">
          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              العنوان <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="مثال: تعذّر التحقق من رقم الهوية"
              disabled={submitting}
              autoFocus
            />
          </div>
          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              الوصف
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
              placeholder="ماذا حدث، ومتى، وما أثر ذلك على المهمة…"
              disabled={submitting}
            />
          </div>
          <div>
            <label
              className="block text-xs font-semibold mb-2"
              style={{ color: "#374151" }}
            >
              درجة الخطورة
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(SEVERITY_META) as Severity[]).map((s) => {
                const meta = SEVERITY_META[s];
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    disabled={submitting}
                    className="px-2 py-2 rounded-lg text-[11px] font-bold transition-all"
                    style={{
                      backgroundColor: active ? `${meta.color}15` : "white",
                      color: active ? meta.color : "#6B7280",
                      border: `1.5px solid ${active ? meta.color : "#E5E7EB"}`,
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
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
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 active:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: "#DC2626", color: "white" }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            إرسال البلاغ
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
