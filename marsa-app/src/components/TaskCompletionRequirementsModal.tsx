"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2, Loader2, FileText, Link as LinkIcon, List, Upload } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { UploadButton } from "@/lib/uploadthing";

interface TaskRequirement {
  id: string;
  label: string;
  type: "TEXT" | "FILE" | "URL" | "SELECT";
  options: string | null;
  isRequired: boolean;
  order: number;
  value: {
    textValue: string | null;
    fileUrl: string | null;
    selectedOption: string | null;
  } | null;
}

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onCompleted: () => void;
}

interface FormValue {
  textValue?: string;
  fileUrl?: string;
  selectedOption?: string;
}

export default function TaskCompletionRequirementsModal({
  taskId,
  taskTitle,
  onClose,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<TaskRequirement[]>([]);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tasks/${taskId}/requirements`);
        if (!res.ok) throw new Error("فشل تحميل المتطلبات");
        const data = await res.json();
        if (!alive) return;
        const reqs: TaskRequirement[] = data.requirements || [];
        setRequirements(reqs);
        // Seed form with existing values
        const seed: Record<string, FormValue> = {};
        for (const r of reqs) {
          seed[r.id] = {
            textValue: r.value?.textValue ?? "",
            fileUrl: r.value?.fileUrl ?? "",
            selectedOption: r.value?.selectedOption ?? "",
          };
        }
        setValues(seed);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [taskId]);

  const updateValue = (id: string, patch: FormValue) => {
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setMissingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = requirements.map((r) => {
        const v = values[r.id] || {};
        return {
          requirementId: r.id,
          textValue: r.type === "TEXT" || r.type === "URL" ? v.textValue || null : null,
          fileUrl: r.type === "FILE" ? v.fileUrl || null : null,
          selectedOption: r.type === "SELECT" ? v.selectedOption || null : null,
        };
      });
      const res = await fetch(`/api/tasks/${taskId}/requirements/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payload }),
      });
      if (res.ok) {
        onCompleted();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 && Array.isArray(data.missing)) {
        setMissingIds(new Set<string>(data.missing.map((m: { id: string }) => m.id)));
        setError(data.error || "يوجد متطلبات ناقصة");
      } else {
        setError(data.error || `فشل الإكمال (HTTP ${res.status})`);
      }
    } catch (e) {
      setError("تعذّر الاتصال بالخادم");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const parseOptions = (opts: string | null): string[] => {
    if (!opts) return [];
    try {
      const parsed = JSON.parse(opts);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s));
    } catch {
      // fallback: comma-separated
      return opts.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const typeIcon = (t: TaskRequirement["type"]) => {
    if (t === "TEXT") return <FileText size={14} />;
    if (t === "URL") return <LinkIcon size={14} />;
    if (t === "FILE") return <Upload size={14} />;
    return <List size={14} />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        dir="rtl"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "rgba(5,150,105,0.12)" }}
            >
              <CheckCircle2 size={20} style={{ color: "#059669" }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                متطلبات إكمال المهمة
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : requirements.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد متطلبات.</p>
          ) : (
            <div className="space-y-4">
              {requirements.map((r) => {
                const v = values[r.id] || {};
                const missing = missingIds.has(r.id);
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl p-3 border ${
                      missing ? "border-red-300 bg-red-50/40" : "border-gray-100 bg-gray-50/50"
                    }`}
                  >
                    <label className="flex items-center gap-1.5 text-xs font-bold mb-1.5" style={{ color: "#1C1B2E" }}>
                      <span className="text-gray-400">{typeIcon(r.type)}</span>
                      {r.label}
                      {r.isRequired && <span className="text-red-500">*</span>}
                    </label>

                    {r.type === "TEXT" && (
                      <textarea
                        rows={2}
                        value={v.textValue || ""}
                        onChange={(e) => updateValue(r.id, { textValue: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white outline-none"
                        style={{ border: "1px solid #E2E0D8" }}
                        placeholder="اكتب هنا..."
                      />
                    )}

                    {r.type === "URL" && (
                      <input
                        type="url"
                        value={v.textValue || ""}
                        onChange={(e) => updateValue(r.id, { textValue: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white outline-none"
                        style={{ border: "1px solid #E2E0D8" }}
                        placeholder="https://..."
                      />
                    )}

                    {r.type === "SELECT" && (
                      <select
                        value={v.selectedOption || ""}
                        onChange={(e) => updateValue(r.id, { selectedOption: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm bg-white outline-none"
                        style={{ border: "1px solid #E2E0D8" }}
                      >
                        <option value="">— اختر —</option>
                        {parseOptions(r.options).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {r.type === "FILE" && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {v.fileUrl ? (
                          <div className="flex items-center gap-2 flex-1">
                            <a
                              href={v.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-blue-600 underline truncate"
                            >
                              عرض الملف المرفوع
                            </a>
                            <button
                              type="button"
                              onClick={() => updateValue(r.id, { fileUrl: "" })}
                              className="text-[10px] text-red-500 hover:underline"
                            >
                              إزالة
                            </button>
                          </div>
                        ) : (
                          <UploadButton
                            endpoint="taskRequirementFile"
                            onClientUploadComplete={(res) => {
                              if (res?.[0]?.ufsUrl) {
                                updateValue(r.id, { fileUrl: res[0].ufsUrl });
                              }
                            }}
                            onUploadError={(err) => setError("خطأ في الرفع: " + err.message)}
                            appearance={{
                              button: {
                                backgroundColor: "#C9A84C",
                                color: "white",
                                borderRadius: "0.5rem",
                                fontSize: "0.75rem",
                                padding: "0.5rem 0.75rem",
                              },
                              allowedContent: { color: "#6B7280", fontSize: "0.65rem" },
                            }}
                            content={{
                              button: ({ ready, isUploading }) =>
                                isUploading ? "جاري الرفع..." : ready ? "اختر ملف" : "تجهيز...",
                              allowedContent: () => "PDF أو JPG أو PNG (16MB)",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <p className="text-xs mt-4 font-medium" style={{ color: "#DC2626" }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-100">
          <MarsaButton
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={handleSubmit}
            loading={submitting}
            disabled={loading || submitting || requirements.length === 0}
            style={{ backgroundColor: "#059669" }}
            icon={!submitting ? <CheckCircle2 size={16} /> : undefined}
          >
            تأكيد الإكمال
          </MarsaButton>
          <MarsaButton variant="secondary" size="lg" onClick={onClose}>
            إلغاء
          </MarsaButton>
        </div>
      </div>
    </div>
  );
}
