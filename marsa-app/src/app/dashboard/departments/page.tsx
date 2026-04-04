"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  FolderKanban,
  Wrench,
  Users,
  X,
  Save,
  Loader2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";

interface Department {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  color: string | null;
  isActive: boolean;
  _count: { projects: number; services: number; employees: number };
}

const defaultColors = ["#5E5495", "#C9A84C", "#059669", "#EA580C", "#DC2626", "#2563EB", "#7C3AED", "#0891B2"];

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const { t, lang } = useLang();
  const isAr = lang === "ar";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    nameEn: "",
    description: "",
    color: "#5E5495",
  });

  const fetchDepartments = () => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", nameEn: "", description: "", color: "#5E5495" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setForm({
      name: dept.name,
      nameEn: dept.nameEn || "",
      description: dept.description || "",
      color: dept.color || "#5E5495",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(isAr ? "اسم القسم مطلوب" : "Department name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const url = editing ? `/api/departments/${editing.id}` : "/api/departments";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        fetchDepartments();
      } else {
        setError(data.error || (isAr ? "حدث خطأ" : "An error occurred"));
      }
    } catch {
      setError(isAr ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setDeleteConfirm(null);
        fetchDepartments();
      } else {
        alert(data.error || (isAr ? "حدث خطأ" : "Error"));
        setDeleteConfirm(null);
      }
    } catch {
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
          >
            <Building2 size={24} style={{ color: "#5E5495" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
              {isAr ? "إدارة الأقسام" : "Department Management"}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
              {isAr ? "إضافة وتعديل أقسام الشركة" : "Add and manage company departments"}
            </p>
          </div>
        </div>
        {session?.user?.role === "ADMIN" && (
          <MarsaButton variant="primary" size="lg" icon={<Plus size={18} />} onClick={openNew}>
            {isAr ? "قسم جديد" : "New Department"}
          </MarsaButton>
        )}
      </div>

      {/* Departments Grid */}
      {departments.length === 0 ? (
        <div className="text-center py-20">
          <Building2 size={48} className="mx-auto mb-4" style={{ color: "#D1D5DB" }} />
          <p className="text-lg font-semibold" style={{ color: "#6B7280" }}>
            {isAr ? "لا توجد أقسام" : "No departments"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
            {isAr ? "أضف قسمًا جديدًا للبدء" : "Add a new department to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="bg-white rounded-2xl p-6 transition-all hover:shadow-md"
              style={{ border: "1px solid #E2E0D8" }}
            >
              {/* Color bar */}
              <div
                className="w-full h-1.5 rounded-full mb-4"
                style={{ backgroundColor: dept.color || "#5E5495" }}
              />

              {/* Name */}
              <h3 className="text-lg font-bold mb-1" style={{ color: "#1C1B2E" }}>
                {dept.name}
              </h3>
              {dept.nameEn && (
                <p className="text-xs mb-3" style={{ color: "#9CA3AF" }}>
                  {dept.nameEn}
                </p>
              )}
              {dept.description && (
                <p className="text-sm mb-4 line-clamp-2" style={{ color: "#6B7280" }}>
                  {dept.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <FolderKanban size={14} style={{ color: "#5E5495" }} />
                  <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                    {dept._count.projects}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Wrench size={14} style={{ color: "#C9A84C" }} />
                  <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                    {dept._count.services}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={14} style={{ color: "#059669" }} />
                  <span className="text-xs font-medium" style={{ color: "#6B7280" }}>
                    {dept._count.employees}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {session?.user?.role === "ADMIN" && (
                <div className="flex items-center gap-2 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <MarsaButton variant="ghost" size="xs" icon={<Pencil size={14} />} onClick={() => openEdit(dept)}>
                    {isAr ? "تعديل" : "Edit"}
                  </MarsaButton>
                  {deleteConfirm === dept.id ? (
                    <div className="flex items-center gap-1.5">
                      <MarsaButton variant="danger" size="xs" onClick={() => handleDelete(dept.id)}>
                        {isAr ? "نعم" : "Yes"}
                      </MarsaButton>
                      <MarsaButton variant="secondary" size="xs" onClick={() => setDeleteConfirm(null)}>
                        {isAr ? "لا" : "No"}
                      </MarsaButton>
                    </div>
                  ) : (
                    <MarsaButton variant="dangerSoft" size="xs" icon={<Trash2 size={14} />} onClick={() => setDeleteConfirm(dept.id)}>
                      {isAr ? "حذف" : "Delete"}
                    </MarsaButton>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {editing
                  ? (isAr ? "تعديل القسم" : "Edit Department")
                  : (isAr ? "قسم جديد" : "New Department")}
              </h2>
              <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={18} />} onClick={() => setShowModal(false)} />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm font-medium text-red-600" style={{ backgroundColor: "rgba(220,38,38,0.06)" }}>
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Arabic Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "#2D3748" }}>
                  {isAr ? "اسم القسم (عربي)" : "Department Name (Arabic)"} <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={isAr ? "مثال: قسم الاستثمار" : "e.g. قسم الاستثمار"}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
                />
              </div>

              {/* English Name */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "#2D3748" }}>
                  {isAr ? "اسم القسم (إنجليزي)" : "Department Name (English)"}
                </label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="e.g. Investment"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all text-left"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: "#2D3748" }}>
                  {isAr ? "الوصف" : "Description"}
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all resize-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
                />
              </div>

              {/* Color */}
              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: "#2D3748" }}>
                  {isAr ? "اللون" : "Color"}
                </label>
                <div className="flex items-center gap-2">
                  {defaultColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className="w-8 h-8 rounded-lg transition-all"
                      style={{
                        backgroundColor: c,
                        border: form.color === c ? "3px solid #1C1B2E" : "3px solid transparent",
                        transform: form.color === c ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
              <MarsaButton variant="primary" size="lg" loading={saving} icon={<Save size={18} />} onClick={handleSave}>
                {saving
                  ? (isAr ? "جارٍ الحفظ..." : "Saving...")
                  : (isAr ? "حفظ" : "Save")}
              </MarsaButton>
              <MarsaButton variant="secondary" size="lg" onClick={() => setShowModal(false)}>
                {isAr ? "إلغاء" : "Cancel"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
