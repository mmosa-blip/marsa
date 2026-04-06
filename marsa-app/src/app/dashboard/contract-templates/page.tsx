"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Loader2,
  Plus,
  X,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Copy,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Template {
  id: string;
  title: string;
  content: string;
  description: string | null;
  isActive: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontSize: number;
  textAlign: string;
  letterheadImage: string | null;
  createdBy: { id: string; name: string };
  _count: { contracts: number };
  createdAt: string;
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim()))];
}

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloneOriginalTitle, setCloneOriginalTitle] = useState<string | null>(null);
  const [titleError, setTitleError] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [marginTop, setMarginTop] = useState(20);
  const [marginBottom, setMarginBottom] = useState(20);
  const [marginLeft, setMarginLeft] = useState(20);
  const [marginRight, setMarginRight] = useState(20);
  const [fontSize, setFontSize] = useState(14);
  const [textAlign, setTextAlign] = useState("right");
  const [letterheadImage, setLetterheadImage] = useState("");

  useEffect(() => {
    document.title = "قوالب العقود | مرسى";
  }, []);

  const fetchTemplates = () => {
    setLoading(true);
    fetch("/api/contract-templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const previewVars = useMemo(() => extractVariables(content), [content]);

  const openNew = () => {
    setEditingId(null);
    setCloneOriginalTitle(null);
    setTitleError("");
    setTitle("");
    setDescription("");
    setContent("");
    setMarginTop(20);
    setMarginBottom(20);
    setMarginLeft(20);
    setMarginRight(20);
    setFontSize(14);
    setTextAlign("right");
    setLetterheadImage("");
    setShowModal(true);
  };

  const handleClone = async (id: string) => {
    try {
      const res = await fetch(`/api/contract-templates/${id}/clone`, { method: "POST" });
      if (!res.ok) return;
      const { template: t } = await res.json();
      setEditingId(null);
      setCloneOriginalTitle(t.title);
      setTitleError("يجب إدخال اسم جديد للقالب");
      setTitle("");
      setDescription(t.description || "");
      setContent(t.content || "");
      setMarginTop(t.marginTop ?? 20);
      setMarginBottom(t.marginBottom ?? 20);
      setMarginLeft(t.marginLeft ?? 20);
      setMarginRight(t.marginRight ?? 20);
      setFontSize(t.fontSize ?? 14);
      setTextAlign(t.textAlign || "right");
      setLetterheadImage(t.letterheadImage || "");
      setShowModal(true);
    } catch { /* ignore */ }
  };

  const openEdit = (t: Template) => {
    setEditingId(t.id);
    setCloneOriginalTitle(null);
    setTitleError("");
    setTitle(t.title);
    setDescription(t.description || "");
    setContent(t.content);
    setMarginTop(t.marginTop);
    setMarginBottom(t.marginBottom);
    setMarginLeft(t.marginLeft);
    setMarginRight(t.marginRight);
    setFontSize(t.fontSize);
    setTextAlign(t.textAlign);
    setLetterheadImage(t.letterheadImage || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    if (cloneOriginalTitle !== null && title.trim() === cloneOriginalTitle) {
      setTitleError("يجب اختيار اسم مختلف عن القالب الأصلي");
      return;
    }
    setSaving(true);
    setTitleError("");
    try {
      const url = editingId
        ? `/api/contract-templates/${editingId}`
        : "/api/contract-templates";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, description, marginTop, marginBottom, marginLeft, marginRight, fontSize, textAlign, letterheadImage: letterheadImage || null }),
      });
      if (res.ok) {
        setShowModal(false);
        setCloneOriginalTitle(null);
        fetchTemplates();
      } else if (res.status === 400) {
        const data = await res.json();
        setTitleError(data.error || "خطأ في الحفظ");
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    await fetch(`/api/contract-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !currentActive }),
    });
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا القالب؟")) return;
    await fetch(`/api/contract-templates/${id}`, { method: "DELETE" });
    fetchTemplates();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            قوالب العقود
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            إدارة قوالب العقود والوثائق
          </p>
        </div>
        <MarsaButton onClick={openNew} variant="primary" icon={<Plus size={18} />}>
          إضافة قالب
        </MarsaButton>
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}
        >
          <FileText size={40} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.5 }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا توجد قوالب
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            أنشئ أول قالب عقد لتبدأ
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((t) => {
            const vars = extractVariables(t.content);
            return (
              <div
                key={t.id}
                className="rounded-2xl p-5 bg-white"
                style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
              >
                {/* Title + status */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                    {t.title}
                  </h3>
                  <button
                    onClick={() => handleToggle(t.id, t.isActive)}
                    title={t.isActive ? "تعطيل" : "تفعيل"}
                  >
                    {t.isActive ? (
                      <ToggleRight size={24} style={{ color: "#059669" }} />
                    ) : (
                      <ToggleLeft size={24} style={{ color: "#94A3B8" }} />
                    )}
                  </button>
                </div>

                {/* Description */}
                {t.description && (
                  <p className="text-xs mb-3 line-clamp-2" style={{ color: "#6B7280" }}>
                    {t.description}
                  </p>
                )}

                {/* Variables */}
                {vars.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {vars.map((v) => (
                      <span
                        key={v}
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}
                      >
                        <Tag size={10} />
                        {v}
                      </span>
                    ))}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs mb-4" style={{ color: "#94A3B8" }}>
                  <span>{t.createdBy.name}</span>
                  <span>&middot;</span>
                  <span>{t._count.contracts} عقد</span>
                  <span>&middot;</span>
                  <span>
                    {new Date(t.createdAt).toLocaleDateString("ar-SA-u-nu-latn", {
                      year: "numeric",
                      month: "short",
                      day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-3"
                  style={{ borderTop: "1px solid #F0EDE6" }}
                >
                  <MarsaButton onClick={() => openEdit(t)} variant="ghost" size="sm" icon={<Pencil size={13} />} style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                    تعديل
                  </MarsaButton>
                  <MarsaButton onClick={() => handleClone(t.id)} variant="ghost" size="sm" icon={<Copy size={13} />} style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                    نسخ
                  </MarsaButton>
                  <MarsaButton onClick={() => handleDelete(t.id)} variant="dangerSoft" size="sm" icon={<Trash2 size={13} />}>
                    حذف
                  </MarsaButton>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid #E2E0D8" }}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #F0EDE6" }}
            >
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {editingId ? "تعديل القالب" : cloneOriginalTitle !== null ? "نسخ القالب" : "إضافة قالب جديد"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5" dir="rtl">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>
                  عنوان القالب
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setTitleError(""); }}
                  placeholder="مثال: عقد خدمات استشارية"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: `1px solid ${titleError ? "#DC2626" : "#E2E0D8"}`, color: "#1C1B2E" }}
                />
                {titleError && (
                  <p className="text-xs mt-1 font-medium" style={{ color: "#DC2626" }}>{titleError}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>
                  الوصف
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف مختصر للقالب"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>
                  محتوى العقد
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  placeholder="اكتب نص العقد هنا... استخدم {{اسم_المتغير}} للمتغيرات الديناميكية"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y font-mono leading-relaxed"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
                <p className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>
                  استخدم {"{{variable_name}}"} للمتغيرات الديناميكية - مثال: {"{{اسم_العميل}}"}, {"{{رقم_السجل}}"}
                </p>
              </div>

              {/* Variable preview */}
              {previewVars.length > 0 && (
                <div
                  className="rounded-xl p-4"
                  style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}
                >
                  <p className="text-xs font-semibold mb-2" style={{ color: "#1C1B2E" }}>
                    المتغيرات المكتشفة ({previewVars.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {previewVars.map((v) => (
                      <span
                        key={v}
                        className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
                      >
                        <Tag size={12} />
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Settings */}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                <p className="text-sm font-semibold mb-3" style={{ color: "#1C1B2E" }}>
                  إعدادات الصفحة
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>هامش علوي (مم)</label>
                    <input type="number" value={marginTop} onChange={(e) => setMarginTop(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>هامش سفلي (مم)</label>
                    <input type="number" value={marginBottom} onChange={(e) => setMarginBottom(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>هامش أيمن (مم)</label>
                    <input type="number" value={marginRight} onChange={(e) => setMarginRight(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>هامش أيسر (مم)</label>
                    <input type="number" value={marginLeft} onChange={(e) => setMarginLeft(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>حجم الخط</label>
                    <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>محاذاة النص</label>
                    <select value={textAlign} onChange={(e) => setTextAlign(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }}>
                      <option value="right">يمين</option>
                      <option value="center">وسط</option>
                      <option value="left">يسار</option>
                      <option value="justify">ضبط</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>صورة الترويسة (URL)</label>
                    <input type="text" value={letterheadImage} onChange={(e) => setLetterheadImage(e.target.value)}
                      placeholder="رابط صورة الترويسة"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                </div>
                {letterheadImage && (
                  <div className="mt-2">
                    <img src={letterheadImage} alt="ترويسة" className="max-h-16 rounded" />
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4"
              style={{ borderTop: "1px solid #F0EDE6" }}
            >
              <MarsaButton onClick={() => setShowModal(false)} variant="secondary">
                إلغاء
              </MarsaButton>
              <MarsaButton
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim() || (cloneOriginalTitle !== null && title.trim() === cloneOriginalTitle)}
                variant="primary"
                loading={saving}
              >
                {editingId ? "حفظ التعديلات" : cloneOriginalTitle !== null ? "حفظ النسخة" : "إنشاء القالب"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
