"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, FileText, Link as LinkIcon, Upload, List, ChevronDown, ChevronUp } from "lucide-react";

interface TaskRequirement {
  id: string;
  label: string;
  type: "TEXT" | "FILE" | "URL" | "SELECT";
  options: string | null;
  isRequired: boolean;
  order: number;
}

interface Props {
  taskTemplateId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  TEXT: <FileText size={12} />,
  URL: <LinkIcon size={12} />,
  FILE: <Upload size={12} />,
  SELECT: <List size={12} />,
};

const TYPE_LABELS: Record<string, string> = {
  TEXT: "نص",
  URL: "رابط",
  FILE: "ملف",
  SELECT: "اختيار من قائمة",
};

export default function TaskRequirementsEditor({ taskTemplateId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [requirements, setRequirements] = useState<TaskRequirement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    type: "TEXT" as "TEXT" | "FILE" | "URL" | "SELECT",
    options: "", // comma-separated when type === SELECT
    isRequired: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/task-templates/${taskTemplateId}/requirements`);
      if (res.ok) setRequirements(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [taskTemplateId]);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  const resetForm = () =>
    setForm({ label: "", type: "TEXT", options: "", isRequired: true });

  async function addRequirement(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      const options =
        form.type === "SELECT"
          ? form.options.split(",").map((s) => s.trim()).filter(Boolean)
          : null;
      const res = await fetch(`/api/task-templates/${taskTemplateId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label.trim(),
          type: form.type,
          options,
          isRequired: form.isRequired,
          order: requirements.length,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setRequirements((prev) => [...prev, created]);
        resetForm();
        setShowForm(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequirement(id: string) {
    if (!confirm("حذف هذا المتطلب؟")) return;
    const res = await fetch(`/api/task-requirements/${id}`, { method: "DELETE" });
    if (res.ok) setRequirements((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleRequired(r: TaskRequirement) {
    const res = await fetch(`/api/task-requirements/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRequired: !r.isRequired }),
    });
    if (res.ok) {
      setRequirements((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, isRequired: !r.isRequired } : x))
      );
    }
  }

  return (
    <div className="mt-3 w-full">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-amber-600 transition-colors"
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        متطلبات الإكمال
        {requirements.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
            {requirements.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-dashed border-gray-200 p-3 bg-white">
          {loading ? (
            <p className="text-xs text-gray-400">جاري التحميل…</p>
          ) : requirements.length === 0 ? (
            <p className="text-xs text-gray-400 mb-2">لا توجد متطلبات لهذه المهمة.</p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {requirements.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-gray-50 border border-gray-100"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-gray-400">{TYPE_ICONS[r.type]}</span>
                    <span className="text-xs font-medium text-gray-700 truncate">{r.label}</span>
                    <span className="text-[10px] text-gray-400">({TYPE_LABELS[r.type]})</span>
                    {r.type === "SELECT" && r.options && (
                      <span className="text-[10px] text-gray-400 truncate">
                        [{(() => { try { return (JSON.parse(r.options) as string[]).join(" • "); } catch { return r.options; } })()}]
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRequired(r)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      r.isRequired
                        ? "bg-red-50 text-red-500"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {r.isRequired ? "إجباري" : "اختياري"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRequirement(r.id)}
                    className="p-1 rounded hover:bg-white text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              <Plus size={13} />
              إضافة متطلب
            </button>
          ) : (
            <form onSubmit={addRequirement} className="space-y-2 mt-1">
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="مثال: اسم الصفحة التي تم الحجز منها"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-amber-300 outline-none"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))
                  }
                  className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-amber-300 outline-none"
                >
                  <option value="TEXT">نص</option>
                  <option value="URL">رابط</option>
                  <option value="FILE">ملف</option>
                  <option value="SELECT">اختيار من قائمة</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isRequired: e.target.checked }))
                    }
                    className="accent-amber-500"
                  />
                  إجباري
                </label>
              </div>
              {form.type === "SELECT" && (
                <input
                  type="text"
                  value={form.options}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, options: e.target.value }))
                  }
                  placeholder="الخيارات مفصولة بفواصل: خيار1, خيار2, خيار3"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-amber-300 outline-none"
                />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving || !form.label.trim()}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {saving ? "جاري الحفظ…" : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
