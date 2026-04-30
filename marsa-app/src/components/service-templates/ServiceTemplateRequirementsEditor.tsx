"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  FileText,
  Link as LinkIcon,
  Lock,
  KeyRound,
  StickyNote,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  X,
  Users,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// ServiceTemplateRequirementsEditor
// ═══════════════════════════════════════════════════════════════════════
// Embedded inside the service-template detail page. Lets ADMIN /
// MANAGER define the record-item requirements that get spawned into
// every project instantiated from this template.

type Kind =
  | "DOCUMENT"
  | "PLATFORM_ACCOUNT"
  | "SENSITIVE_DATA"
  | "NOTE"
  | "PLATFORM_LINK"
  | "ISSUE";

interface DocTypeLite {
  id: string;
  name: string;
  kind: string;
  isPerPartner: boolean;
}

interface Requirement {
  id: string;
  label: string;
  description: string | null;
  kind: Kind;
  documentTypeId: string | null;
  isRequired: boolean;
  isPerPartner: boolean;
  order: number;
  documentType: { id: string; name: string; kind: string; isPerPartner: boolean } | null;
}

interface Props {
  serviceTemplateId: string;
}

type IconCmp = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const KIND_META: Record<Kind, { label: string; icon: IconCmp; color: string }> = {
  DOCUMENT: { label: "مستند", icon: FileText, color: "#5E5495" },
  PLATFORM_ACCOUNT: { label: "حساب منصة", icon: KeyRound, color: "#0EA5E9" },
  SENSITIVE_DATA: { label: "بيانات حساسة", icon: Lock, color: "#7C3AED" },
  NOTE: { label: "ملاحظة", icon: StickyNote, color: "#C9A84C" },
  PLATFORM_LINK: { label: "رابط منصة", icon: LinkIcon, color: "#1B2A4A" },
  ISSUE: { label: "مشكلة", icon: AlertTriangle, color: "#DC2626" },
};

interface FormState {
  label: string;
  description: string;
  kind: Kind;
  documentTypeId: string;
  isRequired: boolean;
  isPerPartner: boolean;
}

const DEFAULT_FORM: FormState = {
  label: "",
  description: "",
  kind: "DOCUMENT",
  documentTypeId: "",
  isRequired: true,
  isPerPartner: false,
};

export default function ServiceTemplateRequirementsEditor({
  serviceTemplateId,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [docTypes, setDocTypes] = useState<DocTypeLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqsRes, docTypesRes] = await Promise.all([
        fetch(`/api/service-catalog/templates/${serviceTemplateId}/requirements`),
        fetch(`/api/doc-types`),
      ]);
      if (reqsRes.ok) setRequirements(await reqsRes.json());
      if (docTypesRes.ok) setDocTypes(await docTypesRes.json());
    } finally {
      setLoading(false);
    }
  }, [serviceTemplateId]);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  function startEdit(r: Requirement) {
    setForm({
      label: r.label,
      description: r.description ?? "",
      kind: r.kind,
      documentTypeId: r.documentTypeId ?? "",
      isRequired: r.isRequired,
      isPerPartner: r.isPerPartner,
    });
    setEditingId(r.id);
    setShowForm(true);
    setError("");
  }

  async function submit() {
    setError("");
    if (!form.label.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        documentTypeId:
          form.kind === "DOCUMENT" && form.documentTypeId
            ? form.documentTypeId
            : null,
        isRequired: form.isRequired,
        isPerPartner: form.isPerPartner,
      };

      const res = editingId
        ? await fetch(`/api/service-template-requirements/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(
            `/api/service-catalog/templates/${serviceTemplateId}/requirements`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر الحفظ");
        return;
      }
      resetForm();
      await load();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Requirement) {
    if (!confirm(`حذف المتطلب "${r.label}"؟`)) return;
    setBusyId(r.id);
    try {
      const res = await fetch(`/api/service-template-requirements/${r.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert((data as { error?: string }).error || "تعذّر الحذف");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function move(r: Requirement, direction: -1 | 1) {
    const sorted = [...requirements].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((x) => x.id === r.id);
    const target = sorted[idx + direction];
    if (!target) return;
    setBusyId(r.id);
    try {
      // Swap orders, two PATCHes. Optimistically reflect locally.
      setRequirements((prev) =>
        prev.map((x) => {
          if (x.id === r.id) return { ...x, order: target.order };
          if (x.id === target.id) return { ...x, order: r.order };
          return x;
        })
      );
      await Promise.all([
        fetch(`/api/service-template-requirements/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: target.order }),
        }),
        fetch(`/api/service-template-requirements/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: r.order }),
        }),
      ]);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const sorted = [...requirements].sort((a, b) => a.order - b.order);

  return (
    <div
      className="rounded-2xl border border-gray-100 bg-white overflow-hidden"
      dir="rtl"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={18} style={{ color: "#5E5495" }} />
          <span className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
            متطلبات السجل (مستندات / حسابات / منصات)
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
          >
            {requirements.length}
          </span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          <p className="text-xs" style={{ color: "#6B7280" }}>
            هذه المتطلبات تُولَّد تلقائياً كعناصر سجل في كل مشروع جديد يستخدم هذه الخدمة. متطلب
            <strong> "لكل شريك" </strong>
            يُولّد نسخة لكل شريك في المشروع.
          </p>

          {loading ? (
            <div className="text-center py-6">
              <Loader2
                size={20}
                className="animate-spin mx-auto"
                style={{ color: "#C9A84C" }}
              />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#9CA3AF" }}>
              لا توجد متطلبات بعد. أضف أول متطلب من زر "+ إضافة متطلب".
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((r, idx) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <div
                    key={r.id}
                    className="rounded-xl p-3 border border-gray-100 bg-gray-50/30"
                    style={{ borderRightWidth: 3, borderRightColor: meta.color }}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-1 mt-1">
                        <button
                          type="button"
                          disabled={idx === 0 || busyId === r.id}
                          onClick={() => move(r, -1)}
                          className="text-xs disabled:opacity-30"
                          title="أعلى"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === sorted.length - 1 || busyId === r.id}
                          onClick={() => move(r, 1)}
                          className="text-xs disabled:opacity-30"
                          title="أسفل"
                        >
                          ▼
                        </button>
                      </div>
                      <Icon size={14} style={{ color: meta.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm font-bold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {r.label}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                            }}
                          >
                            {meta.label}
                          </span>
                          {r.documentType && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: "rgba(94,84,149,0.08)",
                                color: "#5E5495",
                              }}
                            >
                              {r.documentType.name}
                            </span>
                          )}
                          {r.isRequired && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: "rgba(220,38,38,0.1)",
                                color: "#DC2626",
                              }}
                            >
                              إلزامي
                            </span>
                          )}
                          {r.isPerPartner && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                              style={{
                                backgroundColor: "rgba(201,168,76,0.15)",
                                color: "#C9A84C",
                              }}
                            >
                              <Users size={10} />
                              لكل شريك
                            </span>
                          )}
                        </div>
                        {r.description && (
                          <p
                            className="text-[11px] mt-1"
                            style={{ color: "#6B7280" }}
                          >
                            {r.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <MarsaButton
                          size="xs"
                          variant="ghost"
                          onClick={() => startEdit(r)}
                          disabled={busyId === r.id}
                        >
                          تعديل
                        </MarsaButton>
                        <MarsaButton
                          size="xs"
                          variant="ghost"
                          iconOnly
                          icon={<Trash2 size={14} />}
                          onClick={() => remove(r)}
                          disabled={busyId === r.id}
                          title="حذف"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showForm ? (
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ backgroundColor: "rgba(94,84,149,0.04)", border: "1px solid rgba(94,84,149,0.2)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: "#5E5495" }}>
                  {editingId ? "تعديل متطلب" : "إضافة متطلب جديد"}
                </p>
                <MarsaButton
                  size="xs"
                  variant="ghost"
                  iconOnly
                  icon={<X size={14} />}
                  onClick={resetForm}
                  disabled={saving}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: "#374151" }}
                >
                  العنوان <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="مثال: ترخيص بلدية"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1"
                  style={{ color: "#374151" }}
                >
                  وصف (اختياري)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-2"
                  style={{ color: "#374151" }}
                >
                  النوع
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(KIND_META) as Kind[]).map((k) => {
                    const meta = KIND_META[k];
                    const Icon = meta.icon;
                    const active = form.kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            kind: k,
                            documentTypeId: k === "DOCUMENT" ? f.documentTypeId : "",
                          }))
                        }
                        className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          backgroundColor: active ? `${meta.color}15` : "white",
                          color: active ? meta.color : "#6B7280",
                          border: `1.5px solid ${active ? meta.color : "#E5E7EB"}`,
                        }}
                      >
                        <Icon size={16} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.kind === "DOCUMENT" && (
                <div>
                  <label
                    className="block text-xs font-semibold mb-1"
                    style={{ color: "#374151" }}
                  >
                    نوع المستند (DocType)
                  </label>
                  <select
                    value={form.documentTypeId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, documentTypeId: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  >
                    <option value="">— بدون نوع محدد —</option>
                    {docTypes.map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name}
                        {dt.isPerPartner ? " (لكل شريك)" : ""}
                      </option>
                    ))}
                  </select>
                  {docTypes.length === 0 && (
                    <p className="text-[11px] mt-1" style={{ color: "#9CA3AF" }}>
                      لا توجد أنواع مستندات. أنشئها أولاً من إعدادات → أنواع المستندات.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRequired}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isRequired: e.target.checked }))
                    }
                  />
                  <span className="text-xs" style={{ color: "#374151" }}>
                    إلزامي (يمنع إغلاق المشروع لو ناقص)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPerPartner}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isPerPartner: e.target.checked }))
                    }
                  />
                  <span className="text-xs" style={{ color: "#374151" }}>
                    لكل شريك (نسخة لكل partner)
                  </span>
                </label>
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

              <div className="flex gap-2">
                <MarsaButton
                  variant="primary"
                  size="sm"
                  onClick={submit}
                  loading={saving}
                  disabled={saving}
                  icon={<Save size={14} />}
                >
                  {editingId ? "حفظ التعديلات" : "إضافة"}
                </MarsaButton>
                <MarsaButton
                  variant="secondary"
                  size="sm"
                  onClick={resetForm}
                  disabled={saving}
                >
                  إلغاء
                </MarsaButton>
              </div>
            </div>
          ) : (
            <MarsaButton
              variant="gold"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setForm(DEFAULT_FORM);
                setShowForm(true);
              }}
              disabled={loading}
            >
              إضافة متطلب
            </MarsaButton>
          )}
        </div>
      )}
    </div>
  );
}
