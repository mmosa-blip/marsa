"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Save,
  Plus,
  Trash2,
  Eye,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Loader2,
} from "lucide-react";

const ICONS = ["BookOpen", "Shield", "Landmark", "ClipboardList", "AlertCircle", "FileText", "Lock"];

interface Policy {
  id: string;
  title: string;
  slug: string;
  content: string;
  icon: string | null;
  order: number;
  isPublished: boolean;
  updatedAt: string;
}

function ManagePoliciesContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    icon: "BookOpen",
    content: "",
    order: 0,
    isPublished: true,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "إدارة اللوائح | مرسى";
    fetchPolicies();
  }, []);

  useEffect(() => {
    if (editId && policies.length > 0) {
      const p = policies.find((x) => x.id === editId);
      if (p) openEdit(p);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, policies]);

  // Redirect non-admins
  useEffect(() => {
    if (session && session.user.role !== "ADMIN") {
      router.push("/dashboard/policies");
    }
  }, [session, router]);

  const fetchPolicies = async () => {
    const res = await fetch("/api/policies");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setPolicies(data);
    }
  };

  const openEdit = (policy: Policy) => {
    setEditing(policy);
    setForm({
      title: policy.title,
      slug: policy.slug,
      icon: policy.icon || "BookOpen",
      content: policy.content,
      order: policy.order,
      isPublished: policy.isPublished,
    });
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = policy.content;
    }, 0);
  };

  const newPolicy = () => {
    setEditing({ id: "", title: "", slug: "", content: "", icon: null, order: policies.length, isPublished: true, updatedAt: "" });
    setForm({ title: "", slug: "", icon: "BookOpen", content: "", order: policies.length, isPublished: true });
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = "";
    }, 0);
  };

  const slugify = (str: string) =>
    str
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w-]/g, "");

  const handleTitleChange = (val: string) => {
    setForm((f) => ({ ...f, title: val, slug: f.slug || slugify(val) }));
  };

  const savePolicy = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const content = editorRef.current?.innerHTML || form.content;
    const body = { ...form, content };

    const res = editing?.id
      ? await fetch(`/api/policies/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchPolicies();
      if (!editing?.id) {
        const created = await res.json();
        setEditing(created);
      }
    }
    setSaving(false);
  };

  const deletePolicy = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه اللائحة؟")) return;
    await fetch(`/api/policies/${id}`, { method: "DELETE" });
    fetchPolicies();
    if (editing?.id === id) setEditing(null);
  };

  const togglePublish = async (policy: Policy) => {
    await fetch(`/api/policies/${policy.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !policy.isPublished }),
    });
    fetchPolicies();
  };

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  if (session && session.user.role !== "ADMIN") return null;

  return (
    <div dir="rtl" className="flex h-[calc(100vh-56px)]" style={{ backgroundColor: "#F8F9FA" }}>
      {/* Left: policy list */}
      <div
        className="w-72 flex-shrink-0 border-l overflow-y-auto bg-white"
        style={{ borderColor: "#E2E0D8" }}
      >
        <div
          className="p-4 border-b flex items-center justify-between"
          style={{ borderColor: "#F0EDE6" }}
        >
          <h2 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
            اللوائح ({policies.length})
          </h2>
          <button
            onClick={newPolicy}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: "#5E5495" }}
          >
            <Plus size={13} /> جديد
          </button>
        </div>

        <div className="p-2 space-y-1">
          {policies.map((p) => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                backgroundColor: editing?.id === p.id ? "rgba(94,84,149,0.08)" : "transparent",
                border: editing?.id === p.id ? "1px solid rgba(94,84,149,0.2)" : "1px solid transparent",
              }}
            >
              <GripVertical size={14} style={{ color: "#D1D5DB" }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#1C1B2E" }}>
                  {p.title}
                </p>
                <p className="text-xs" style={{ color: "#94A3B8" }}>
                  {p.isPublished ? "منشور" : "مخفي"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePublish(p);
                  }}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  {p.isPublished ? (
                    <ToggleRight size={16} style={{ color: "#059669" }} />
                  ) : (
                    <ToggleLeft size={16} style={{ color: "#94A3B8" }} />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePolicy(p.id);
                  }}
                  className="p-1 rounded hover:bg-red-50"
                  style={{ color: "#D1D5DB" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 overflow-y-auto">
        {editing ? (
          <div className="p-6 max-w-3xl mx-auto">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => router.push("/dashboard/policies")}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "#6B7280" }}
              >
                <ArrowRight size={16} />
                عودة للعرض
              </button>
              <div className="flex items-center gap-2">
                {saved && (
                  <span
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
                  >
                    تم الحفظ والإشعار لجميع الموظفين
                  </span>
                )}
                <button
                  onClick={() => router.push("/dashboard/policies")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
                  style={{ color: "#6B7280", border: "1px solid #E2E0D8" }}
                >
                  <Eye size={14} /> معاينة
                </button>
                <button
                  onClick={savePolicy}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: "#5E5495" }}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  {saving ? "جاري الحفظ..." : "حفظ ونشر"}
                </button>
              </div>
            </div>

            {/* Meta fields */}
            <div
              className="bg-white rounded-2xl p-5 mb-4 space-y-3"
              style={{ border: "1px solid #E2E0D8" }}
            >
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>
                  عنوان اللائحة *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="مثال: إرشادات تنفيذ المهام"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>
                    الرابط (slug)
                  </label>
                  <input
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="task-guidelines"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none font-mono"
                    style={{ border: "1px solid #E2E0D8", color: "#6B7280", direction: "ltr" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>
                    الأيقونة
                  </label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none bg-white"
                    style={{ border: "1px solid #E2E0D8" }}
                  >
                    {ICONS.map((ic) => (
                      <option key={ic} value={ic}>
                        {ic}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* WYSIWYG editor */}
            <div
              className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "1px solid #E2E0D8" }}
            >
              {/* Toolbar */}
              <div
                className="flex flex-wrap items-center gap-1 px-4 py-2.5 border-b"
                style={{ borderColor: "#F0EDE6", backgroundColor: "#FAFAFE" }}
              >
                {[
                  { cmd: "bold", label: "B", title: "عريض", style: { fontWeight: 700 } as React.CSSProperties },
                  { cmd: "italic", label: "I", title: "مائل", style: { fontStyle: "italic" } as React.CSSProperties },
                  { cmd: "underline", label: "U", title: "خط تحت", style: { textDecoration: "underline" } as React.CSSProperties },
                ].map((btn) => (
                  <button
                    key={btn.cmd}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      exec(btn.cmd);
                    }}
                    title={btn.title}
                    className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                    style={{ ...btn.style, color: "#1C1B2E" }}
                  >
                    {btn.label}
                  </button>
                ))}

                <div className="w-px h-5 mx-1" style={{ backgroundColor: "#E2E0D8" }} />

                <select
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => exec("formatBlock", e.target.value)}
                  className="px-2 py-1 text-xs rounded-lg outline-none bg-white"
                  style={{ border: "1px solid #E2E0D8" }}
                  defaultValue="p"
                >
                  <option value="p">فقرة</option>
                  <option value="h2">عنوان 2</option>
                  <option value="h3">عنوان 3</option>
                  <option value="blockquote">اقتباس</option>
                </select>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: "#E2E0D8" }} />

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec("insertUnorderedList");
                  }}
                  title="قائمة نقطية"
                  className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                  style={{ color: "#5E5495" }}
                >
                  ☰
                </button>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec("insertOrderedList");
                  }}
                  title="قائمة مرقمة"
                  className="w-8 h-8 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                  style={{ color: "#5E5495" }}
                >
                  #
                </button>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: "#E2E0D8" }} />

                <select
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    if (e.target.value) exec("foreColor", e.target.value);
                    e.target.value = "";
                  }}
                  className="px-2 py-1 text-xs rounded-lg outline-none bg-white"
                  style={{ border: "1px solid #E2E0D8" }}
                  defaultValue=""
                >
                  <option value="">لون النص</option>
                  <option value="#1C1B2E">أسود</option>
                  <option value="#5E5495">بنفسجي</option>
                  <option value="#C9A84C">ذهبي</option>
                  <option value="#DC2626">أحمر</option>
                  <option value="#059669">أخضر</option>
                </select>

                <div className="w-px h-5 mx-1" style={{ backgroundColor: "#E2E0D8" }} />

                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    exec("removeFormat");
                  }}
                  className="px-2 py-1 text-xs rounded-lg hover:bg-gray-100"
                  style={{ color: "#6B7280" }}
                >
                  مسح التنسيق
                </button>
              </div>

              {/* Editable area */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                dir="rtl"
                className="prose-rtl min-h-64 p-6 outline-none focus:ring-0"
                style={{
                  color: "#2D3748",
                  fontSize: "15px",
                  lineHeight: 2,
                  minHeight: "400px",
                }}
                onInput={() => {
                  setForm((f) => ({ ...f, content: editorRef.current?.innerHTML || "" }));
                }}
              />
            </div>

            {/* Publish note */}
            <div
              className="mt-3 p-3 rounded-xl flex items-start gap-2"
              style={{ backgroundColor: "#FEF9C3", border: "1px solid #FDE68A" }}
            >
              <p className="text-xs" style={{ color: "#92400E" }}>
                عند الحفظ، سيتم إرسال إشعار فوري لجميع الموظفين بأنه تم تحديث اللائحة.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="font-semibold mb-2" style={{ color: "#1C1B2E" }}>
              اختر لائحة للتعديل
            </p>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
              أو أنشئ لائحة جديدة
            </p>
            <button
              onClick={newPolicy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#5E5495" }}
            >
              <Plus size={16} />
              إنشاء لائحة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ManagePoliciesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin" style={{ color: "#5E5495" }} />
        </div>
      }
    >
      <ManagePoliciesContent />
    </Suspense>
  );
}
