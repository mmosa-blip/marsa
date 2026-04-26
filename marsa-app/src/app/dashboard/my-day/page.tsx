"use client";

/**
 * "مهامي اليوم" — per-user todo space, completely separate from the
 * project Task system. Backed by /api/personal-tasks.
 *
 * Layout:
 *   • header with "+ مهمة جديدة" + 3 filter tabs (today / week / all)
 *   • list of rows; each row is checkbox + title/desc + tag pile + actions
 *   • create/edit modal
 *
 * Reachable by every signed-in role (sidebar entry added in layout.tsx).
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  ListChecks,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Repeat,
  Calendar,
  Clock,
  X,
  AlertCircle,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Requester {
  id: string;
  name: string;
}

interface PTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  completedAt: string | null;
  requestedById: string | null;
  requestedBy: Requester | null;
  isRecurring: boolean;
  recurrencePattern: string | null;
  recurrenceDays: string | null;
  priority: string;
  notes: string | null;
  createdAt: string;
}

type Filter = "today" | "week" | "all";

const PRIORITY: Record<string, { label: string; bg: string; text: string }> = {
  HIGH:   { label: "عالية", bg: "rgba(220,38,38,0.1)",  text: "#DC2626" },
  NORMAL: { label: "عادية", bg: "rgba(94,84,149,0.08)", text: "#5E5495" },
  LOW:    { label: "منخفضة", bg: "rgba(107,114,128,0.1)", text: "#6B7280" },
};

const PATTERN_AR: Record<string, string> = {
  DAILY: "يومياً",
  WEEKLY: "أسبوعياً",
  MONTHLY: "شهرياً",
};

function dueLabel(d: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (day.getTime() === today.getTime()) return "اليوم";
  if (day.getTime() === tomorrow.getTime()) return "غداً";
  return date.toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" });
}

function dueColor(d: string | null): string {
  if (!d) return "#6B7280";
  const t = new Date(d).getTime();
  const now = Date.now();
  if (t < now - 24 * 60 * 60 * 1000) return "#DC2626"; // past due
  if (t < now + 24 * 60 * 60 * 1000) return "#D97706"; // today
  return "#5E5495";
}

interface FormState {
  id?: string;
  title: string;
  description: string;
  dueDate: string;          // yyyy-mm-dd
  dueTime: string;          // HH:mm
  requestedById: string;
  requestedByName: string;  // shown in the autocomplete input
  priority: "LOW" | "NORMAL" | "HIGH";
  isRecurring: boolean;
  recurrencePattern: "DAILY" | "WEEKLY" | "MONTHLY";
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  dueDate: "",
  dueTime: "",
  requestedById: "",
  requestedByName: "",
  priority: "NORMAL",
  isRecurring: false,
  recurrencePattern: "DAILY",
  notes: "",
};

export default function MyDayPage() {
  const { data: session, status: authStatus } = useSession();
  const [filter, setFilter] = useState<Filter>("today");
  const [tasks, setTasks] = useState<PTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Requester autocomplete
  const [reqResults, setReqResults] = useState<Requester[]>([]);
  const [reqSearching, setReqSearching] = useState(false);
  const [reqDropdownOpen, setReqDropdownOpen] = useState(false);

  useEffect(() => {
    document.title = "مهامي اليوم | مرسى";
  }, []);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    fetch(`/api/personal-tasks?filter=${filter}`)
      .then((r) => r.json())
      .then((d) => {
        setTasks(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (authStatus === "authenticated") fetchTasks();
  }, [authStatus, fetchTasks]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  const counts = useMemo(() => {
    const list = tasks ?? [];
    const done = list.filter((t) => t.status === "DONE").length;
    return { total: list.length, done, open: list.length - done };
  }, [tasks]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setReqResults([]);
    setModalOpen(true);
  };

  const openEdit = (t: PTask) => {
    setForm({
      id: t.id,
      title: t.title,
      description: t.description ?? "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
      dueTime: t.dueTime ?? "",
      requestedById: t.requestedById ?? "",
      requestedByName: t.requestedBy?.name ?? "",
      priority: (t.priority as FormState["priority"]) ?? "NORMAL",
      isRecurring: t.isRecurring,
      recurrencePattern: (t.recurrencePattern as FormState["recurrencePattern"]) ?? "DAILY",
      notes: t.notes ?? "",
    });
    setFormError(null);
    setReqResults([]);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setReqDropdownOpen(false);
  };

  const searchRequesters = (q: string) => {
    setForm((f) => ({ ...f, requestedByName: q, requestedById: q ? f.requestedById : "" }));
    if (q.trim().length < 2) {
      setReqResults([]);
      setReqDropdownOpen(false);
      return;
    }
    setReqSearching(true);
    fetch(`/api/users/search?q=${encodeURIComponent(q)}&transferTargets=true`)
      .then((r) => r.json())
      .then((data) => {
        setReqResults(Array.isArray(data) ? data : []);
        setReqDropdownOpen(true);
      })
      .catch(() => setReqResults([]))
      .finally(() => setReqSearching(false));
  };

  const submitForm = async () => {
    const title = form.title.trim();
    if (!title) {
      setFormError("العنوان مطلوب");
      return;
    }
    setFormError(null);
    setSaving(true);

    const body = {
      title,
      description: form.description.trim() || null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      dueTime: form.dueTime || null,
      requestedById: form.requestedById || null,
      priority: form.priority,
      isRecurring: form.isRecurring,
      recurrencePattern: form.isRecurring ? form.recurrencePattern : null,
      notes: form.notes.trim() || null,
    };

    try {
      const url = form.id ? `/api/personal-tasks/${form.id}` : "/api/personal-tasks";
      const method = form.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setFormError(e.error || "فشل الحفظ");
      } else {
        setModalOpen(false);
        fetchTasks();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleDone = async (id: string) => {
    setActing(id);
    try {
      await fetch(`/api/personal-tasks/${id}/toggle`, { method: "POST" });
      fetchTasks();
    } finally {
      setActing(null);
    }
  };

  const deleteTask = async (id: string) => {
    if (!window.confirm("حذف هذه المهمة نهائياً؟")) return;
    setActing(id);
    try {
      await fetch(`/api/personal-tasks/${id}`, { method: "DELETE" });
      fetchTasks();
    } finally {
      setActing(null);
    }
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "today", label: "اليوم" },
    { key: "week", label: "هذا الأسبوع" },
    { key: "all", label: "الكل" },
  ];

  return (
    <div className="p-6 lg:p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <ListChecks size={22} style={{ color: "#C9A84C" }} />
            مهامي اليوم
          </h1>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
            مساحتك الشخصية — مهام تنظيم يومك، منفصلة عن مهام المشاريع
          </p>
        </div>
        <MarsaButton variant="gold" icon={<Plus size={16} />} onClick={openCreate}>
          مهمة جديدة
        </MarsaButton>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="مفتوحة" value={counts.open} color="#C9A84C" />
        <Stat label="منجزة" value={counts.done} color="#059669" />
        <Stat label="الإجمالي" value={counts.total} color="#5E5495" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={
              filter === t.key
                ? { backgroundColor: "#5E5495", color: "white" }
                : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <ListChecks size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm mb-3" style={{ color: "#9CA3AF" }}>
            {filter === "today" ? "لا مهام لليوم" : filter === "week" ? "لا مهام هذا الأسبوع" : "لا توجد مهام بعد"}
          </p>
          <MarsaButton variant="link" size="sm" onClick={openCreate} icon={<Plus size={13} />}>
            أضف أول مهمة
          </MarsaButton>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const done = t.status === "DONE";
            const pri = PRIORITY[t.priority] ?? PRIORITY.NORMAL;
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl p-4 transition-all hover:shadow-md"
                style={{
                  border: "1px solid #E2E0D8",
                  opacity: done ? 0.65 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleDone(t.id)}
                    disabled={acting === t.id}
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors"
                    style={{
                      border: `2px solid ${done ? "#059669" : "#D1D5DB"}`,
                      backgroundColor: done ? "#059669" : "transparent",
                    }}
                    aria-label={done ? "إلغاء الإنجاز" : "تمييز كمنجزة"}
                  >
                    {done && <span className="text-white text-xs leading-none">✓</span>}
                  </button>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-sm font-semibold truncate"
                        style={{
                          color: "#1C1B2E",
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        {t.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          style={{ color: "#6B7280" }}
                          aria-label="تعديل"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          disabled={acting === t.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          style={{ color: "#DC2626" }}
                          aria-label="حذف"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-xs mt-1 whitespace-pre-line" style={{ color: "#6B7280" }}>
                        {t.description}
                      </p>
                    )}

                    {/* Tag pile */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: pri.bg, color: pri.text }}
                      >
                        {pri.label}
                      </span>
                      {t.dueDate && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ backgroundColor: "rgba(0,0,0,0.04)", color: dueColor(t.dueDate) }}
                        >
                          <Calendar size={10} />
                          {dueLabel(t.dueDate)}{t.dueTime ? ` · ${t.dueTime}` : ""}
                        </span>
                      )}
                      {t.isRecurring && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "#2563EB" }}
                          title={t.recurrencePattern ? PATTERN_AR[t.recurrencePattern] : "متكرر"}
                        >
                          <Repeat size={10} />
                          {t.recurrencePattern ? PATTERN_AR[t.recurrencePattern] : "متكرر"}
                        </span>
                      )}
                      {t.requestedBy && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}
                        >
                          طلب من: {t.requestedBy.name}
                        </span>
                      )}
                      {t.notes && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          style={{ backgroundColor: "rgba(0,0,0,0.04)", color: "#6B7280" }}
                          title={t.notes}
                        >
                          📝 ملاحظات
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                {form.id ? "تعديل المهمة" : "مهمة جديدة"}
              </h3>
              <MarsaButton
                variant="ghost"
                size="sm"
                iconOnly
                icon={<X size={18} />}
                onClick={closeModal}
              />
            </div>

            <div className="p-5 space-y-4">
              {formError && (
                <div className="text-xs p-2 rounded-lg flex items-center gap-2" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
                  <AlertCircle size={14} />
                  {formError}
                </div>
              )}

              <Field label="العنوان" required>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  style={{ borderColor: "#E5E7EB" }}
                  autoFocus
                  placeholder="مثلاً: مراجعة العقود المعلّقة"
                />
              </Field>

              <Field label="وصف">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="تاريخ الاستحقاق">
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </Field>
                <Field label="وقت محدد">
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                </Field>
              </div>

              <Field label="من طلب المهمة؟ (اختياري)">
                <div className="relative">
                  <input
                    type="text"
                    value={form.requestedByName}
                    onChange={(e) => searchRequesters(e.target.value)}
                    placeholder="اكتب اسماً للبحث..."
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                    style={{ borderColor: "#E5E7EB" }}
                  />
                  {reqSearching && (
                    <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                  {reqDropdownOpen && reqResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg max-h-48 overflow-y-auto" style={{ border: "1px solid #E2E0D8" }}>
                      {reqResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({ ...f, requestedById: u.id, requestedByName: u.name }));
                            setReqDropdownOpen(false);
                          }}
                          className="block w-full text-right px-3 py-2 text-sm hover:bg-gray-50"
                          style={{ color: "#1C1B2E" }}
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {form.requestedById && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, requestedById: "", requestedByName: "" })}
                      className="text-[11px] mt-1 font-semibold"
                      style={{ color: "#DC2626" }}
                    >
                      مسح
                    </button>
                  )}
                </div>
              </Field>

              <Field label="الأولوية">
                <div className="grid grid-cols-3 gap-2">
                  {(["LOW", "NORMAL", "HIGH"] as const).map((p) => {
                    const pri = PRIORITY[p];
                    const active = form.priority === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm({ ...form, priority: p })}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={
                          active
                            ? { backgroundColor: pri.text, color: "white" }
                            : { backgroundColor: pri.bg, color: pri.text }
                        }
                      >
                        {pri.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: "#1C1B2E" }}>
                    <Repeat size={12} /> مهمة متكررة
                  </span>
                </label>
                {form.isRecurring && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm({ ...form, recurrencePattern: p })}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={
                          form.recurrencePattern === p
                            ? { backgroundColor: "#2563EB", color: "white" }
                            : { backgroundColor: "rgba(37,99,235,0.08)", color: "#2563EB" }
                        }
                      >
                        {PATTERN_AR[p]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Field label="ملاحظات">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  style={{ borderColor: "#E5E7EB" }}
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-200">
              <MarsaButton variant="link" size="sm" disabled={saving} onClick={closeModal}>
                إلغاء
              </MarsaButton>
              <MarsaButton variant="gold" disabled={saving} onClick={submitForm}>
                {saving ? "جارٍ الحفظ..." : form.id ? "حفظ التعديلات" : "إنشاء المهمة"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 text-center" style={{ border: "1px solid #E2E0D8" }}>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{label}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
        {label}{required && <span style={{ color: "#DC2626" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

// Suppress unused-import warning when Clock isn't reached in some flows.
void Clock;
