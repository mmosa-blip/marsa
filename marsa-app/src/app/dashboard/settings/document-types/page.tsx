"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, FileText, FileType2, Plus, Pencil, Trash2, X,
  Save, Loader2, Lock, Users,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

type Kind = "FILE" | "TEXT";
type Uploader = "CLIENT" | "EXECUTOR" | "BOTH";
type Visibility = "ALL" | "EXECUTORS_AND_ADMIN" | "ADMIN_ONLY" | "CLIENT_AND_ADMIN";

interface DocField { name: string; label: string }

interface DocType {
  id: string;
  name: string;
  description: string | null;
  kind: Kind;
  sampleImageUrl: string | null;
  instructions: string | null;
  fields: string | null;
  isConfidential: boolean;
  whoCanUpload: Uploader;
  whoCanView: Visibility;
  isRequired: boolean;
  displayOrder: number;
  groupId: string | null;
  group: { id: string; name: string; displayOrder: number } | null;
}

interface Group { id: string; name: string }

const KIND_LABELS: Record<Kind, string> = { FILE: "ملف", TEXT: "نصي" };
const UPLOADER_LABELS: Record<Uploader, string> = { CLIENT: "العميل", EXECUTOR: "المنفذ", BOTH: "كلاهما" };
const VISIBILITY_LABELS: Record<Visibility, string> = {
  ALL: "الجميع",
  EXECUTORS_AND_ADMIN: "المنفذون والإدارة",
  ADMIN_ONLY: "الإدارة فقط",
  CLIENT_AND_ADMIN: "العميل والإدارة",
};

export default function DocumentTypesPage() {
  const [deptId, setDeptId] = useState<string>("");
  const [types, setTypes] = useState<DocType[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocType | null>(null);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const emptyForm = {
    name: "", description: "", kind: "FILE" as Kind,
    sampleImageUrl: "", instructions: "", fields: [] as DocField[],
    isConfidential: false, whoCanUpload: "BOTH" as Uploader,
    whoCanView: "EXECUTORS_AND_ADMIN" as Visibility,
    isRequired: false, displayOrder: 0, groupId: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Initial fetch: find Investment department
  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((depts) => {
      if (Array.isArray(depts)) {
        const inv = depts.find((d: { name: string }) => d.name.includes("الاستثمار"));
        if (inv) setDeptId(inv.id);
        else setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  const loadData = useCallback(() => {
    if (!deptId) return;
    Promise.all([
      fetch(`/api/doc-types?departmentId=${deptId}`).then((r) => r.json()),
      fetch(`/api/doc-groups?departmentId=${deptId}`).then((r) => r.json()),
    ]).then(([tps, grs]) => {
      if (Array.isArray(tps)) setTypes(tps);
      if (Array.isArray(grs)) setGroups(grs);
      setLoading(false);
    });
  }, [deptId]);

  useEffect(() => { loadData(); }, [loadData]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  };

  const openEdit = (t: DocType) => {
    setEditing(t);
    let parsedFields: DocField[] = [];
    if (t.fields) {
      try { parsedFields = JSON.parse(t.fields); } catch {}
    }
    setForm({
      name: t.name,
      description: t.description || "",
      kind: t.kind,
      sampleImageUrl: t.sampleImageUrl || "",
      instructions: t.instructions || "",
      fields: parsedFields,
      isConfidential: t.isConfidential,
      whoCanUpload: t.whoCanUpload,
      whoCanView: t.whoCanView,
      isRequired: t.isRequired,
      displayOrder: t.displayOrder,
      groupId: t.groupId || "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError("الاسم مطلوب"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editing ? `/api/doc-types/${editing.id}` : "/api/doc-types";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          departmentId: deptId,
          groupId: form.groupId || null,
          fields: form.kind === "TEXT" ? JSON.stringify(form.fields) : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        loadData();
      } else {
        setError(data.error || "حدث خطأ");
      }
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/doc-types/${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      loadData();
    } catch {}
  };

  const addField = () => setForm({ ...form, fields: [...form.fields, { name: "", label: "" }] });
  const removeField = (i: number) => setForm({ ...form, fields: form.fields.filter((_, idx) => idx !== i) });
  const updateField = (i: number, key: "name" | "label", val: string) => {
    const newFields = [...form.fields];
    newFields[i] = { ...newFields[i], [key]: val };
    setForm({ ...form, fields: newFields });
  };

  // Group types by group name
  const typesByGroup = new Map<string, DocType[]>();
  for (const t of types) {
    const key = t.group?.name || "غير مصنف";
    if (!typesByGroup.has(key)) typesByGroup.set(key, []);
    typesByGroup.get(key)!.push(t);
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 size={40} className="animate-spin" style={{ color: "#C9A84C" }} /></div>;
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <MarsaButton href="/dashboard/settings" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>أنواع المستندات</h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>قسم الاستثمار — تعريف الأنواع والحقول والصلاحيات</p>
          </div>
        </div>
        <MarsaButton variant="primary" size="lg" icon={<Plus size={18} />} onClick={openNew}>
          نوع جديد
        </MarsaButton>
      </div>

      {/* Groups */}
      {types.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <FileText size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p style={{ color: "#6B7280" }}>لا توجد أنواع مستندات بعد — أضف واحداً للبدء</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(typesByGroup.entries()).map(([groupName, groupTypes]) => (
            <div key={groupName}>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#5E5495" }}>
                <FileType2 size={16} />
                {groupName}
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)" }}>{groupTypes.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupTypes.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl p-4" style={{ border: "1px solid #E2E0D8" }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>{t.name}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: t.kind === "FILE" ? "rgba(94,84,149,0.1)" : "rgba(201,168,76,0.1)", color: t.kind === "FILE" ? "#5E5495" : "#C9A84C" }}>
                            {KIND_LABELS[t.kind]}
                          </span>
                          {t.isRequired && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626" }}>إلزامي</span>}
                          {t.isConfidential && <Lock size={11} style={{ color: "#DC2626" }} />}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg" style={{ color: "#6B7280" }}>
                          <Pencil size={13} />
                        </button>
                        {confirmDelete === t.id ? (
                          <div className="flex gap-1">
                            <button onClick={() => handleDelete(t.id)} className="px-2 py-0.5 text-[10px] rounded font-bold" style={{ backgroundColor: "#DC2626", color: "#fff" }}>حذف</button>
                            <button onClick={() => setConfirmDelete(null)} className="px-2 py-0.5 text-[10px] rounded" style={{ color: "#6B7280" }}>إلغاء</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmDelete(t.id)} className="p-1.5 rounded-lg" style={{ color: "#DC2626" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    {t.description && <p className="text-[10px] mb-2" style={{ color: "#9CA3AF" }}>{t.description}</p>}
                    <div className="flex items-center gap-2 text-[9px]" style={{ color: "#6B7280" }}>
                      <Users size={10} />
                      <span>{VISIBILITY_LABELS[t.whoCanView]}</span>
                      <span>•</span>
                      <span>رفع: {UPLOADER_LABELS[t.whoCanUpload]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {editing ? "تعديل نوع المستند" : "نوع مستند جديد"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}><X size={18} /></button>
            </div>

            {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-600" style={{ backgroundColor: "rgba(220,38,38,0.06)" }}>{error}</div>}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>الاسم *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>الوصف</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: "1px solid #E2E0D8" }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>نوع المستند</label>
                  <div className="flex gap-2">
                    {(["FILE", "TEXT"] as Kind[]).map((k) => (
                      <button key={k} onClick={() => setForm({ ...form, kind: k })}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: form.kind === k ? "#5E5495" : "#F3F4F6", color: form.kind === k ? "#fff" : "#6B7280" }}>
                        {KIND_LABELS[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>المجموعة</label>
                  <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }}>
                    <option value="">بدون</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>

              {form.kind === "FILE" && (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>رابط الصورة النموذجية</label>
                    <input value={form.sampleImageUrl} onChange={(e) => setForm({ ...form, sampleImageUrl: e.target.value })}
                      placeholder="https://..." dir="ltr"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none text-left" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>التعليمات / الإرشادات</label>
                    <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={3}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: "1px solid #E2E0D8" }} />
                  </div>
                </>
              )}

              {form.kind === "TEXT" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: "#2D3748" }}>الحقول النصية</label>
                    <button onClick={addField} className="text-xs font-semibold flex items-center gap-1" style={{ color: "#5E5495" }}>
                      <Plus size={12} /> إضافة حقل
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.fields.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input placeholder="name (بالإنجليزية)" value={f.name} onChange={(e) => updateField(i, "name", e.target.value)}
                          dir="ltr" className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ border: "1px solid #E2E0D8" }} />
                        <input placeholder="التسمية بالعربية" value={f.label} onChange={(e) => updateField(i, "label", e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ border: "1px solid #E2E0D8" }} />
                        <button onClick={() => removeField(i)} className="p-1 rounded" style={{ color: "#DC2626" }}><X size={14} /></button>
                      </div>
                    ))}
                    {form.fields.length === 0 && <p className="text-[10px] text-center py-2" style={{ color: "#9CA3AF" }}>لا توجد حقول — أضف على الأقل حقلاً واحداً</p>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>من يرفع؟</label>
                  <select value={form.whoCanUpload} onChange={(e) => setForm({ ...form, whoCanUpload: e.target.value as Uploader })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }}>
                    {(Object.keys(UPLOADER_LABELS) as Uploader[]).map((k) => <option key={k} value={k}>{UPLOADER_LABELS[k]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>من يشاهد؟</label>
                  <select value={form.whoCanView} onChange={(e) => setForm({ ...form, whoCanView: e.target.value as Visibility })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }}>
                    {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((k) => <option key={k} value={k}>{VISIBILITY_LABELS[k]}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-xs" style={{ color: "#2D3748" }}>
                  <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} />
                  إلزامي
                </label>
                <label className="flex items-center gap-2 text-xs" style={{ color: "#2D3748" }}>
                  <input type="checkbox" checked={form.isConfidential} onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })} />
                  سري
                </label>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: "#2D3748" }}>ترتيب</label>
                  <input type="number" value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-1 rounded-lg text-xs outline-none" style={{ border: "1px solid #E2E0D8" }} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
              <MarsaButton variant="gold" size="md" loading={saving} icon={<Save size={16} />} onClick={handleSave}>
                حفظ
              </MarsaButton>
              <MarsaButton variant="secondary" size="md" onClick={() => setShowModal(false)}>إلغاء</MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
