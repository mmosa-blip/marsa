"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Search,
  Settings,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ═══════════════════════════════════════════════════════════════════════
// ServiceTemplateRequirementsEditor
// ═══════════════════════════════════════════════════════════════════════
// Two modes:
//   mode='TASK'    — compact, per-task. Filters to requirements whose
//                   taskTemplateId matches the prop.
//   mode='SERVICE' — full panel, service-level requirements (null task).
//
// Both use a unified type picker that merges DocType records (DOCUMENT)
// with fixed non-document kinds into a single searchable combobox.

type Kind =
  | "DOCUMENT"
  | "PLATFORM_ACCOUNT"
  | "SENSITIVE_DATA"
  | "NOTE"
  | "PLATFORM_LINK"
  | "ISSUE";

// ─── Picker option ────────────────────────────────────────────────────
// Each option represents one selectable item in the unified combobox.
// id is unique within the dropdown; on select, the form derives
// kind + documentTypeId from it.

type PickerOption =
  | {
      id: string;            // docType.id
      group: "doctype";
      label: string;
      docTypeId: string;
      defaultIsPerPartner: boolean; // inherited from DocType.isPerPartner
    }
  | {
      id: string;            // "__platform_account" etc.
      group: "fixed";
      label: string;
      kind: Exclude<Kind, "DOCUMENT">;
    };

const FIXED_OPTIONS: PickerOption[] = [
  { id: "__platform_account", group: "fixed", label: "حساب منصة جديد",      kind: "PLATFORM_ACCOUNT" },
  { id: "__platform_link",    group: "fixed", label: "رابط منصة جديد",       kind: "PLATFORM_LINK"    },
  { id: "__sensitive_data",   group: "fixed", label: "بيانات حساسة",          kind: "SENSITIVE_DATA"   },
  { id: "__note",             group: "fixed", label: "ملاحظة",                 kind: "NOTE"             },
  { id: "__issue",            group: "fixed", label: "مشكلة / إشكالية",       kind: "ISSUE"            },
];

const FIXED_ICON: Record<string, string> = {
  __platform_account: "🔐",
  __platform_link:    "🔗",
  __sensitive_data:   "🗝️",
  __note:             "✏️",
  __issue:            "⚠️",
};

const KIND_COLOR: Record<Kind, string> = {
  DOCUMENT:         "#5E5495",
  PLATFORM_ACCOUNT: "#0EA5E9",
  SENSITIVE_DATA:   "#7C3AED",
  NOTE:             "#C9A84C",
  PLATFORM_LINK:    "#1B2A4A",
  ISSUE:            "#DC2626",
};

// ─── Requirement interface ─────────────────────────────────────────────

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
  taskTemplateId: string | null;
  isRequired: boolean;
  isPerPartner: boolean;
  order: number;
  documentType: { id: string; name: string; kind: string; isPerPartner: boolean } | null;
  taskTemplate: { id: string; name: string; sortOrder: number } | null;
}

// ─── Form state ────────────────────────────────────────────────────────
// `pickerOptionId` drives both kind and documentTypeId on submit.

interface FormState {
  pickerOptionId: string;
  label: string;
  description: string;
  isRequired: boolean;
  isPerPartner: boolean;
}

const DEFAULT_FORM: FormState = {
  pickerOptionId: "",
  label: "",
  description: "",
  isRequired: true,
  isPerPartner: false,
};

// ─── Props ─────────────────────────────────────────────────────────────

interface Props {
  serviceTemplateId: string;
  mode?: "TASK" | "SERVICE";
  taskTemplateId?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════════

export default function ServiceTemplateRequirementsEditor({
  serviceTemplateId,
  mode = "TASK",
  taskTemplateId,
}: Props) {
  const [expanded, setExpanded] = useState(mode === "SERVICE");
  const [allRequirements, setAllRequirements] = useState<Requirement[]>([]);
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
      const [reqsRes, docRes] = await Promise.all([
        fetch(`/api/service-catalog/templates/${serviceTemplateId}/requirements`),
        fetch(`/api/doc-types`),
      ]);
      if (reqsRes.ok) setAllRequirements(await reqsRes.json());
      if (docRes.ok) setDocTypes(await docRes.json());
    } finally {
      setLoading(false);
    }
  }, [serviceTemplateId]);

  useEffect(() => {
    if (expanded) load();
  }, [expanded, load]);

  // Build the unified picker options list from current docTypes.
  const pickerOptions: PickerOption[] = [
    ...docTypes.map<PickerOption>((dt) => ({
      id: dt.id,
      group: "doctype",
      label: dt.name,
      docTypeId: dt.id,
      defaultIsPerPartner: dt.isPerPartner,
    })),
    ...FIXED_OPTIONS,
  ];

  function optionById(id: string): PickerOption | undefined {
    return pickerOptions.find((o) => o.id === id);
  }

  // Filter requirements by mode.
  const requirements = allRequirements.filter((r) =>
    mode === "TASK"
      ? r.taskTemplateId === (taskTemplateId ?? null)
      : r.taskTemplateId === null
  );
  const sorted = [...requirements].sort((a, b) => a.order - b.order);

  // Derive kind + documentTypeId from the picked option.
  function deriveKindAndDocType(optId: string): {
    kind: Kind;
    documentTypeId: string | null;
  } {
    const opt = optionById(optId);
    if (!opt) return { kind: "DOCUMENT", documentTypeId: null };
    if (opt.group === "doctype") {
      return { kind: "DOCUMENT", documentTypeId: opt.docTypeId };
    }
    return { kind: opt.kind, documentTypeId: null };
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  // Pre-fill the picker when editing an existing requirement.
  function startEdit(r: Requirement) {
    let pickerOptionId = "";
    if (r.kind === "DOCUMENT" && r.documentTypeId) {
      pickerOptionId = r.documentTypeId;
    } else {
      const fixed = FIXED_OPTIONS.find((f) => f.group === "fixed" && f.kind === r.kind);
      pickerOptionId = fixed?.id ?? "";
    }
    setForm({
      pickerOptionId,
      label: r.label,
      description: r.description ?? "",
      isRequired: r.isRequired,
      isPerPartner: r.isPerPartner,
    });
    setEditingId(r.id);
    setShowForm(true);
    setError("");
  }

  async function submit() {
    setError("");
    if (!form.pickerOptionId) {
      setError("اختر نوع المتطلب");
      return;
    }
    if (!form.label.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    const { kind, documentTypeId } = deriveKindAndDocType(form.pickerOptionId);
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim(),
        description: form.description.trim() || null,
        kind,
        documentTypeId,
        taskTemplateId: mode === "TASK" ? (taskTemplateId ?? null) : null,
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
    const idx = sorted.findIndex((x) => x.id === r.id);
    const target = sorted[idx + direction];
    if (!target) return;
    setBusyId(r.id);
    try {
      setAllRequirements((prev) =>
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

  // ─── Requirement card ───────────────────────────────────────────────
  function RequirementCard({ r, idx }: { r: Requirement; idx: number }) {
    const color = KIND_COLOR[r.kind];
    const icon = r.kind === "DOCUMENT" ? "📄" : (FIXED_ICON[`__${r.kind.toLowerCase().replace("_", "_")}`] ?? "📎");
    const fixedIcon =
      r.kind === "PLATFORM_ACCOUNT" ? "🔐"
      : r.kind === "PLATFORM_LINK"   ? "🔗"
      : r.kind === "SENSITIVE_DATA"  ? "🗝️"
      : r.kind === "NOTE"            ? "✏️"
      : r.kind === "ISSUE"           ? "⚠️"
      : "📄";

    const compact = mode === "TASK";

    return (
      <div
        className={`flex items-center gap-2 rounded-xl bg-white border border-gray-100 ${compact ? "p-2" : "p-3"}`}
        style={{ borderRightWidth: compact ? 2 : 3, borderRightColor: color }}
      >
        <div className="flex flex-col gap-0.5 shrink-0">
          <button type="button" disabled={idx === 0 || busyId === r.id} onClick={() => move(r, -1)} className="text-[10px] disabled:opacity-30 leading-none">▲</button>
          <button type="button" disabled={idx === sorted.length - 1 || busyId === r.id} onClick={() => move(r, 1)} className="text-[10px] disabled:opacity-30 leading-none">▼</button>
        </div>
        <span className="text-base shrink-0 leading-none">{fixedIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-semibold truncate ${compact ? "text-xs" : "text-sm"}`} style={{ color: "#1C1B2E" }}>
              {r.label}
            </span>
            {r.documentType && r.label !== r.documentType.name && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}>
                {r.documentType.name}
              </span>
            )}
            {r.isRequired && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626" }}>إلزامي</span>
            )}
            {r.isPerPartner && (
              <span className="text-[9px] px-1 py-0.5 rounded inline-flex items-center gap-0.5" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#B45309" }}>
                👥 لكل شريك
              </span>
            )}
          </div>
          {r.description && !compact && (
            <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>{r.description}</p>
          )}
        </div>
        <MarsaButton size="xs" variant="ghost" onClick={() => startEdit(r)} disabled={busyId === r.id}>تعديل</MarsaButton>
        <MarsaButton size="xs" variant="ghost" iconOnly icon={<Trash2 size={compact ? 12 : 14} />} onClick={() => remove(r)} disabled={busyId === r.id} title="حذف" />
      </div>
    );
  }

  // ─── TASK mode ──────────────────────────────────────────────────────
  if (mode === "TASK") {
    return (
      <div className="mt-3" dir="rtl">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-2 text-xs font-semibold px-2 py-1.5 rounded-lg transition-colors w-full"
          style={{ color: sorted.length > 0 ? "#5E5495" : "#9CA3AF", backgroundColor: expanded ? "rgba(94,84,149,0.07)" : "transparent" }}
        >
          <FileText size={13} />
          <span>متطلبات السجل لهذه المهمة</span>
          {sorted.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full font-bold text-[10px]" style={{ backgroundColor: "rgba(94,84,149,0.15)", color: "#5E5495" }}>
              {sorted.length}
            </span>
          )}
          {expanded ? <ChevronUp size={12} className="ms-auto" /> : <ChevronDown size={12} className="ms-auto" />}
        </button>

        {expanded && (
          <div className="mt-2 rounded-xl p-3 space-y-2" style={{ backgroundColor: "rgba(94,84,149,0.04)", border: "1px solid rgba(94,84,149,0.15)" }}>
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-xs" style={{ color: "#9CA3AF" }}>
                <Loader2 size={13} className="animate-spin" />
                جاري التحميل…
              </div>
            ) : (
              <>
                {sorted.length > 0 && (
                  <div className="space-y-1.5">
                    {sorted.map((r, idx) => <RequirementCard key={r.id} r={r} idx={idx} />)}
                  </div>
                )}
                {!showForm && sorted.length === 0 && (
                  <p className="text-[11px]" style={{ color: "#9CA3AF" }}>لا توجد متطلبات لهذه المهمة بعد.</p>
                )}
              </>
            )}

            {showForm ? (
              <RequirementForm
                form={form}
                setForm={setForm}
                pickerOptions={pickerOptions}
                docTypes={docTypes}
                editingId={editingId}
                saving={saving}
                error={error}
                onSubmit={submit}
                onCancel={resetForm}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setForm(DEFAULT_FORM); setShowForm(true); }}
                disabled={loading}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                style={{ color: "#5E5495" }}
              >
                <Plus size={13} />
                إضافة متطلب
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── SERVICE mode ────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: "1px solid rgba(94,84,149,0.25)" }} dir="rtl">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between p-4 cursor-pointer transition-all hover:brightness-105 active:brightness-95"
        style={{ background: expanded ? "linear-gradient(135deg, rgba(94,84,149,0.10), rgba(201,168,76,0.06))" : "linear-gradient(135deg, rgba(94,84,149,0.16), rgba(201,168,76,0.10))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(94,84,149,0.15)" }}>
            <FileText size={18} style={{ color: "#5E5495" }} />
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base" style={{ color: "#1C1B2E" }}>متطلبات السجل (مستوى الخدمة)</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.18)", color: "#5E5495" }}>{sorted.length}</span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>متطلبات لا تنتمي لمهمة محددة — تُولَّد لكل مشروع جديد</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: "white", border: "1px solid rgba(94,84,149,0.2)", color: "#5E5495" }}>
          <span className="text-[11px] font-semibold">{expanded ? "إخفاء" : "اضغط للعرض"}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {loading ? (
            <div className="text-center py-6"><Loader2 size={20} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} /></div>
          ) : (
            <>
              {sorted.length > 0 ? (
                <div className="space-y-2">
                  {sorted.map((r, idx) => <RequirementCard key={r.id} r={r} idx={idx} />)}
                </div>
              ) : !showForm ? (
                <p className="text-xs text-center py-4" style={{ color: "#9CA3AF" }}>لا توجد متطلبات على مستوى الخدمة.</p>
              ) : null}
            </>
          )}

          {showForm ? (
            <RequirementForm
              form={form}
              setForm={setForm}
              pickerOptions={pickerOptions}
              docTypes={docTypes}
              editingId={editingId}
              saving={saving}
              error={error}
              onSubmit={submit}
              onCancel={resetForm}
            />
          ) : (
            <MarsaButton variant="gold" size="sm" icon={<Plus size={14} />} onClick={() => { setForm(DEFAULT_FORM); setShowForm(true); }} disabled={loading}>
              إضافة متطلب
            </MarsaButton>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RequirementForm — unified picker + other fields
// ═══════════════════════════════════════════════════════════════════════

function RequirementForm({
  form,
  setForm,
  pickerOptions,
  docTypes,
  editingId,
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  pickerOptions: PickerOption[];
  docTypes: DocTypeLite[];
  editingId: string | null;
  saving: boolean;
  error: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doctypeOptions = pickerOptions.filter((o) => o.group === "doctype");
  const fixedOptions   = pickerOptions.filter((o) => o.group === "fixed");
  const q = query.trim().toLowerCase();

  function filterGroup(opts: PickerOption[]) {
    if (!q) return opts;
    return opts.filter((o) => o.label.toLowerCase().includes(q));
  }

  const filteredDoctype = filterGroup(doctypeOptions);
  const filteredFixed   = filterGroup(fixedOptions);
  const hasResults      = filteredDoctype.length > 0 || filteredFixed.length > 0;

  function selectOption(opt: PickerOption) {
    const autoLabel = form.label.trim() === "" || form.label === form.pickerOptionId;
    setForm((f) => ({
      ...f,
      pickerOptionId: opt.id,
      label: autoLabel ? opt.label : f.label,
      isPerPartner:
        opt.group === "doctype" && opt.defaultIsPerPartner ? true : f.isPerPartner,
    }));
    setQuery("");
    setOpen(false);
  }

  const selected = pickerOptions.find((o) => o.id === form.pickerOptionId);
  const selectedIcon =
    !selected ? null
    : selected.group === "doctype" ? "📄"
    : FIXED_ICON[selected.id] ?? "📎";

  return (
    <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: "rgba(94,84,149,0.04)", border: "1px solid rgba(94,84,149,0.2)" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: "#5E5495" }}>{editingId ? "تعديل متطلب" : "إضافة متطلب جديد"}</p>
        <MarsaButton size="xs" variant="ghost" iconOnly icon={<X size={13} />} onClick={onCancel} disabled={saving} />
      </div>

      {/* ── Unified type picker ── */}
      <div ref={comboRef} className="relative">
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
          نوع المتطلب <span style={{ color: "#DC2626" }}>*</span>
        </label>

        {/* Trigger / search input */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-text"
          style={{
            borderColor: open ? "rgba(94,84,149,0.5)" : "#E5E7EB",
            backgroundColor: "white",
            boxShadow: open ? "0 0 0 2px rgba(94,84,149,0.1)" : "none",
          }}
          onClick={() => setOpen(true)}
        >
          {selected && !open && (
            <span className="text-sm shrink-0">{selectedIcon}</span>
          )}
          {!open && selected ? (
            <span className="flex-1 text-sm truncate" style={{ color: "#1C1B2E" }}>{selected.label}</span>
          ) : (
            <input
              autoFocus={open}
              type="text"
              value={open ? query : ""}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              placeholder={selected ? selected.label : "ابحث أو اختر نوع المتطلب…"}
              className="flex-1 text-sm bg-transparent outline-none"
              style={{ color: "#1C1B2E" }}
            />
          )}
          <Search size={13} style={{ color: "#9CA3AF", flexShrink: 0 }} />
        </div>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-y-auto"
            style={{ maxHeight: 280, minWidth: 240 }}
          >
            {!hasResults && (
              <p className="text-xs px-4 py-3" style={{ color: "#9CA3AF" }}>لا توجد نتائج للبحث</p>
            )}

            {filteredDoctype.length > 0 && (
              <div>
                <p className="text-[10px] font-bold px-3 py-1.5 sticky top-0 bg-gray-50" style={{ color: "#6B7280" }}>
                  📄 مستندات
                </p>
                {filteredDoctype.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseDown={() => selectOption(opt)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right transition-colors hover:bg-purple-50"
                    style={{ color: "#1C1B2E" }}
                  >
                    <span>📄</span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.group === "doctype" && opt.defaultIsPerPartner && (
                      <span className="text-[9px] px-1 rounded shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.2)", color: "#B45309" }}>👥</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {filteredFixed.length > 0 && (
              <div>
                {filteredDoctype.length > 0 && <div className="mx-3 border-t border-gray-100" />}
                <p className="text-[10px] font-bold px-3 py-1.5 sticky top-0 bg-gray-50" style={{ color: "#6B7280" }}>
                  أنواع أخرى
                </p>
                {filteredFixed.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onMouseDown={() => selectOption(opt)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-right transition-colors hover:bg-purple-50"
                    style={{ color: "#1C1B2E" }}
                  >
                    <span>{FIXED_ICON[opt.id] ?? "📎"}</span>
                    <span className="flex-1">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {docTypes.length === 0 && !q && (
              <div className="px-3 py-2 flex items-center gap-2 border-t border-gray-50">
                <Settings size={12} style={{ color: "#9CA3AF" }} />
                <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                  لا توجد أنواع مستندات.{" "}
                  <a href="/dashboard/settings/document-types" target="_blank" className="underline" style={{ color: "#5E5495" }}>
                    أضف من الإعدادات
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Label (auto-filled, editable) ── */}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
          العنوان <span style={{ color: "#DC2626" }}>*</span>
          <span className="text-[10px] font-normal ms-1" style={{ color: "#9CA3AF" }}>(تُملأ تلقائياً)</span>
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
          placeholder="مثال: السجل التجاري"
        />
      </div>

      {/* ── Description ── */}
      <div>
        <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>وصف (اختياري)</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </div>

      {/* ── Checkboxes ── */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isRequired}
            onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))}
          />
          <span className="text-xs" style={{ color: "#374151" }}>إلزامي — يمنع إغلاق المهمة/المشروع لو ناقص</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.isPerPartner}
            onChange={(e) => setForm((f) => ({ ...f, isPerPartner: e.target.checked }))}
          />
          <div>
            <span className="text-xs flex items-center gap-1" style={{ color: "#374151" }}>
              <Users size={12} /> يتكرر لكل شريك في المشروع
            </span>
            <p className="text-[10px] mt-0.5" style={{ color: "#9CA3AF" }}>مثال: هوية الشريك، شهادة عدم محكومية</p>
          </div>
        </label>
      </div>

      {error && (
        <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <MarsaButton variant="primary" size="sm" onClick={onSubmit} loading={saving} disabled={saving} icon={<Save size={13} />}>
          {editingId ? "حفظ" : "إضافة"}
        </MarsaButton>
        <MarsaButton variant="secondary" size="sm" onClick={onCancel} disabled={saving}>إلغاء</MarsaButton>
      </div>
    </div>
  );
}
