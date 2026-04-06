"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  X,
  CheckCircle,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Department = {
  id: string;
  name: string;
};

type DocumentGroup = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  departmentId: string;
  _count?: { docTypes: number };
};

type GroupFormState = {
  name: string;
  description: string;
  displayOrder: number;
};

const emptyForm: GroupFormState = {
  name: "",
  description: "",
  displayOrder: 0,
};

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function DocumentGroupsSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [investmentDept, setInvestmentDept] = useState<Department | null>(null);
  const [groups, setGroups] = useState<DocumentGroup[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GroupFormState>(emptyForm);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ─────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────
  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    document.title = "إعدادات مجموعات المستندات | مرسى";
  }, []);

  // ─────────────────────────────────────────
  // Data fetching
  // ─────────────────────────────────────────
  const loadGroups = useCallback(async (deptId: string) => {
    try {
      const res = await fetch(`/api/doc-groups?departmentId=${deptId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const deptRes = await fetch("/api/departments");
        const deptData: Department[] = await deptRes.json();
        const investment =
          deptData.find((d) => d.name?.includes("الاستثمار")) || null;
        if (cancelled) return;
        setInvestmentDept(investment);
        if (investment) {
          await loadGroups(investment.id);
        }
      } catch {
        if (!cancelled) showMessage("error", "تعذر تحميل البيانات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGroups]);

  // ─────────────────────────────────────────
  // Modal helpers
  // ─────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      displayOrder: groups.length,
    });
    setModalOpen(true);
  };

  const openEdit = (g: DocumentGroup) => {
    setEditingId(g.id);
    setForm({
      name: g.name,
      description: g.description || "",
      displayOrder: g.displayOrder,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  // ─────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      showMessage("error", "الاسم مطلوب");
      return;
    }
    if (!investmentDept) {
      showMessage("error", "لم يتم تحديد قسم الاستثمار");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        displayOrder: form.displayOrder,
        departmentId: investmentDept.id,
      };
      const url = editingId
        ? `/api/doc-groups/${editingId}`
        : "/api/doc-groups";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل الحفظ");
      }
      showMessage("success", editingId ? "تم تحديث المجموعة" : "تم إنشاء المجموعة");
      closeModal();
      await loadGroups(investmentDept.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      showMessage("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: DocumentGroup) => {
    if (!investmentDept) return;
    const confirmText =
      g._count && g._count.docTypes > 0
        ? `هذه المجموعة تحتوي على ${g._count.docTypes} نوع مستند. سيتم فك الربط منها. هل تريد المتابعة؟`
        : "هل أنت متأكد من حذف هذه المجموعة؟";
    if (!confirm(confirmText)) return;
    try {
      const res = await fetch(`/api/doc-groups/${g.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showMessage("success", "تم الحذف");
      await loadGroups(investmentDept.id);
    } catch {
      showMessage("error", "تعذر الحذف");
    }
  };

  // ─────────────────────────────────────────
  // Styles
  // ─────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    border: "1px solid #E2E0D8",
    color: "#2D3748",
    backgroundColor: "#FAFAFE",
  };
  const labelStyle: React.CSSProperties = {
    color: "#1C1B2E",
    fontWeight: 600,
    fontSize: "0.875rem",
    marginBottom: "0.375rem",
    display: "block",
  };

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex justify-center items-center min-h-screen"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <Loader2
          size={40}
          className="animate-spin"
          style={{ color: "#1C1B2E" }}
        />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <MarsaButton
            variant="secondary"
            size="md"
            iconOnly
            icon={<ArrowRight size={18} />}
            onClick={() => router.push("/dashboard/settings")}
            aria-label="رجوع"
          />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
              إعدادات مجموعات المستندات
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "#2D3748", opacity: 0.6 }}
            >
              تنظيم مجموعات المستندات الخاصة بقسم الاستثمار
            </p>
          </div>
        </div>
        <MarsaButton
          variant="gold"
          size="md"
          icon={<Plus size={18} />}
          onClick={openCreate}
          disabled={!investmentDept}
        >
          إضافة مجموعة
        </MarsaButton>
      </div>

      {/* Message */}
      {message && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-medium"
          style={
            message.type === "success"
              ? {
                  backgroundColor: "#ECFDF5",
                  color: "#059669",
                  border: "1px solid #A7F3D0",
                }
              : {
                  backgroundColor: "#FEF2F2",
                  color: "#DC2626",
                  border: "1px solid #FECACA",
                }
          }
        >
          {message.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {message.text}
        </div>
      )}

      {!investmentDept && (
        <div
          className="bg-white rounded-2xl p-8 text-center text-sm"
          style={{ border: "1px solid #E2E0D8", color: "#6B7280" }}
        >
          لم يتم العثور على قسم الاستثمار. تأكد من وجود قسم باسم يحتوي على
          &quot;الاستثمار&quot;.
        </div>
      )}

      {/* List */}
      {investmentDept && (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            border: "1px solid #E2E0D8",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          {groups.length === 0 ? (
            <div className="p-12 text-center" style={{ color: "#6B7280" }}>
              <FolderOpen
                size={36}
                className="mx-auto mb-3"
                style={{ opacity: 0.4 }}
              />
              <p className="text-sm">لا توجد مجموعات بعد</p>
              <p className="text-xs mt-1" style={{ opacity: 0.7 }}>
                ابدأ بإنشاء مجموعة جديدة لتنظيم أنواع المستندات
              </p>
            </div>
          ) : (
            <ul>
              {groups.map((g, i) => (
                <li
                  key={g.id}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{
                    borderBottom:
                      i === groups.length - 1 ? "none" : "1px solid #F1EFE7",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: "rgba(201,168,76,0.1)",
                      color: "#C9A84C",
                    }}
                  >
                    <FolderOpen size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className="text-sm font-bold"
                        style={{ color: "#1C1B2E" }}
                      >
                        {g.name}
                      </h3>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "#F1EFE7",
                          color: "#6B7280",
                        }}
                      >
                        ترتيب: {g.displayOrder}
                      </span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: "rgba(94,84,149,0.08)",
                          color: "#5E5495",
                        }}
                      >
                        {g._count?.docTypes ?? 0} نوع
                      </span>
                    </div>
                    {g.description && (
                      <p
                        className="text-xs mt-1 truncate"
                        style={{ color: "#6B7280" }}
                      >
                        {g.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <MarsaButton
                      variant="secondary"
                      size="sm"
                      iconOnly
                      icon={<Pencil size={14} />}
                      onClick={() => openEdit(g)}
                      aria-label="تعديل"
                    />
                    <MarsaButton
                      variant="dangerSoft"
                      size="sm"
                      iconOnly
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDelete(g)}
                      aria-label="حذف"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(28,27,46,0.5)" }}
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
            style={{
              border: "1px solid #E2E0D8",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: "1px solid #E2E0D8" }}
            >
              <h2
                className="text-lg font-bold"
                style={{ color: "#1C1B2E" }}
              >
                {editingId ? "تعديل المجموعة" : "إضافة مجموعة جديدة"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{ color: "#6B7280" }}
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label style={labelStyle}>
                  اسم المجموعة <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="مثال: مستندات الهوية"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>الوصف</label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="وصف اختياري للمجموعة"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>ترتيب العرض</label>
                <input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      displayOrder: parseInt(e.target.value || "0"),
                    })
                  }
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>

            <div
              className="flex items-center justify-end gap-2 px-6 py-4"
              style={{ borderTop: "1px solid #E2E0D8" }}
            >
              <MarsaButton
                variant="secondary"
                size="md"
                onClick={closeModal}
                disabled={saving}
              >
                إلغاء
              </MarsaButton>
              <MarsaButton
                variant="gold"
                size="md"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
              >
                {editingId ? "حفظ التغييرات" : "إنشاء المجموعة"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
