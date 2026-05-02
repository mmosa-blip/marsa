"use client";

import { useState } from "react";
import { X, StickyNote, Save, Loader2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// AddNoteModal
// ═══════════════════════════════════════════════════════════════════════
// Lets an executor pin a free-text note to a task. The note lands as
// a ProjectRecordItem (kind=NOTE, scope=TASK) plus a non-blocking
// TaskRequirementLink — so it surfaces in the unified record under
// the task without standing in the way of completion.

interface Props {
  taskId: string;
  taskTitle: string;
  projectId: string;
  serviceId: string | null;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddNoteModal({
  taskId,
  taskTitle,
  projectId,
  serviceId,
  onClose,
  onAdded,
}: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!body.trim()) {
      setError("اكتب نص الملاحظة");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "NOTE",
          scope: "TASK",
          title: title.trim() || `ملاحظة على مهمة "${taskTitle}"`,
          textData: body.trim(),
          serviceId: serviceId || undefined,
          taskId,
          visibility: "EXECUTORS_AND_ADMIN",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر حفظ الملاحظة");
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
              style={{ backgroundColor: "rgba(201,168,76,0.15)" }}
            >
              <StickyNote size={18} style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                إضافة ملاحظة
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
              عنوان مختصر (اختياري)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="مثال: ملاحظة من العميل"
              disabled={submitting}
            />
          </div>
          <div>
            <label
              className="block text-xs font-semibold mb-1"
              style={{ color: "#374151" }}
            >
              نص الملاحظة <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="اكتب الملاحظة هنا…"
              disabled={submitting}
              autoFocus
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
          <MarsaButton
            variant="primary"
            size="sm"
            onClick={submit}
            loading={submitting}
            disabled={submitting}
            icon={submitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            className="flex-1"
          >
            حفظ الملاحظة
          </MarsaButton>
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
