"use client";

import { useState, useEffect } from "react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import {
  BookTemplate,
  Layers,
  ArrowDown,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Calendar,
  Copy,
  Clock,
} from "lucide-react";

interface ProjectTemplate {
  id: string;
  name: string;
  workflowType: "SEQUENTIAL" | "INDEPENDENT";
  isSystem: boolean;
  createdAt: string;
  createdBy: { name: string } | null;
  _count: { services: number; projects: number };
  totalDurationDays: number;
}

export default function ProjectTemplatesPage() {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Clone modal state
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneData, setCloneData] = useState<Record<string, unknown> | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneOriginalName, setCloneOriginalName] = useState("");
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState("");

  useEffect(() => {
    fetchTemplates();
  }, []);

  function fetchTemplates() {
    setLoading(true);
    fetch("/api/project-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا القالب؟")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/project-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // ignore
    }
    setDeletingId(null);
  }

  async function handleClone(id: string) {
    try {
      const res = await fetch(`/api/project-templates/${id}/clone`, { method: "POST" });
      if (!res.ok) return;
      const { template } = await res.json();
      setCloneData(template);
      setCloneOriginalName(template.name);
      setCloneName("");
      setCloneError("يجب إدخال اسم جديد للقالب");
      setCloneModal(true);
    } catch { /* ignore */ }
  }

  async function handleCloneSave() {
    if (!cloneData || !cloneName.trim() || cloneName.trim() === cloneOriginalName) return;
    setCloneLoading(true);
    setCloneError("");
    try {
      interface CloneService { serviceTemplateId: string; sortOrder: number }
      interface CloneMilestone { title: string; amount: number; afterServiceIndex: number; order: number }
      const data = cloneData as { workflowType?: string; description?: string; services?: { serviceTemplate?: { id?: string }; sortOrder?: number }[]; milestones?: CloneMilestone[] };
      const res = await fetch("/api/project-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cloneName.trim(),
          description: data.description || null,
          workflowType: data.workflowType || "SEQUENTIAL",
          services: (data.services || []).map((s: { serviceTemplate?: { id?: string }; sortOrder?: number }, i: number): CloneService => ({
            serviceTemplateId: s.serviceTemplate?.id || "",
            sortOrder: s.sortOrder ?? i,
          })),
          milestones: (data.milestones || []).map((m: CloneMilestone) => ({
            title: m.title,
            amount: m.amount,
            afterServiceIndex: m.afterServiceIndex,
          })),
        }),
      });
      if (res.ok) {
        setCloneModal(false);
        setCloneData(null);
        fetchTemplates();
      } else if (res.status === 400) {
        const d = await res.json();
        setCloneError(d.error || "خطأ في الحفظ");
      }
    } catch { /* ignore */ }
    setCloneLoading(false);
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="p-8" dir="rtl">
      {/* الهيدر */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            قوالب المشاريع
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "#2D3748", opacity: 0.6 }}
          >
            إنشاء وإدارة قوالب المشاريع الجاهزة
          </p>
        </div>
        <MarsaButton href="/dashboard/projects/new?mode=template" variant="gold" size="lg" icon={<Plus size={18} />}>
          إنشاء قالب جديد
        </MarsaButton>
      </div>

      {/* المحتوى */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="#1C1B2E"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="#1C1B2E"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <BookTemplate
            size={56}
            className="mx-auto mb-4"
            style={{ color: "#C9A84C", opacity: 0.4 }}
          />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>
            لا توجد قوالب بعد
          </p>
          <p
            className="text-sm mt-1 mb-6"
            style={{ color: "#2D3748", opacity: 0.5 }}
          >
            أنشئ قالبك الأول لتسريع إنشاء المشاريع
          </p>
          <MarsaButton href="/dashboard/projects/new?mode=template" variant="primary" size="lg" icon={<Plus size={18} />}>
            إنشاء قالب جديد
          </MarsaButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-white rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5 group"
              style={{
                border: "1px solid #E2E0D8",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 8px 25px rgba(27,42,74,0.1)";
                e.currentTarget.style.borderColor = "#C9A84C";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(0,0,0,0.03)";
                e.currentTarget.style.borderColor = "#E8E6F0";
              }}
            >
              {/* رأس البطاقة */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
                  >
                    <Layers size={20} style={{ color: "#C9A84C" }} />
                  </div>
                  <div>
                    <h3
                      className="font-bold text-base"
                      style={{ color: "#1C1B2E" }}
                    >
                      {template.name}
                    </h3>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "#2D3748", opacity: 0.5 }}
                    >
                      {template._count?.services || 0} خدمة
                    </p>
                  </div>
                </div>

                {/* شارة النوع */}
                <span
                  className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={
                    template.isSystem
                      ? { backgroundColor: "#ECFDF5", color: "#059669" }
                      : { backgroundColor: "#EFF6FF", color: "#2563EB" }
                  }
                >
                  {template.isSystem ? "نظام" : "محفوظ"}
                </span>
              </div>

              {/* شارة سير العمل + المدة الإجمالية */}
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(27,42,74,0.05)",
                    color: "#1C1B2E",
                  }}
                >
                  {template.workflowType === "SEQUENTIAL" ? (
                    <>
                      <ArrowDown size={14} />
                      تسلسلي
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight size={14} />
                      مستقل
                    </>
                  )}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(201,168,76,0.1)",
                    color: "#C9A84C",
                  }}
                  title="إجمالي مدة المشروع محسوبة من مدد المهام في الخدمات"
                >
                  <Clock size={14} />
                  {template.totalDurationDays.toLocaleString("en-US")} يوم
                </span>
              </div>

              {/* معلومات إضافية */}
              <div
                className="flex items-center gap-4 text-xs mb-5 pb-4"
                style={{
                  color: "#2D3748",
                  opacity: 0.5,
                  borderBottom: "1px solid #F0EDE6",
                }}
              >
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {formatDate(template.createdAt)}
                </span>
                {template.createdBy && (
                  <span className="flex items-center gap-1">
                    بواسطة {template.createdBy.name}
                  </span>
                )}
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex items-center gap-2">
                <MarsaButton href={`/dashboard/projects/new?templateId=${template.id}`} variant="primary" className="flex-1" icon={<ExternalLink size={15} />}>
                  استخدام
                </MarsaButton>
                <MarsaButton variant="secondary" size="lg" iconOnly icon={<Copy size={16} style={{ color: "#5E5495" }} />}
                  onClick={() => handleClone(template.id)} title="نسخ"
                />
                <MarsaButton href={`/dashboard/projects/templates/${template.id}/edit`} variant="secondary" size="lg" iconOnly icon={<Edit3 size={16} />}
                  title="تعديل"
                />
                <MarsaButton variant="secondary" size="lg" iconOnly
                  icon={<Trash2 size={16} style={{ color: deletingId === template.id ? "#9CA3AF" : "#DC2626" }} />}
                  onClick={() => handleDelete(template.id)} disabled={deletingId === template.id} title="حذف"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clone Modal */}
      {cloneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6" dir="rtl" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(94,84,149,0.12)" }}>
                <Copy size={20} style={{ color: "#5E5495" }} />
              </div>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>نسخ قالب المشروع</h3>
            </div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>اسم القالب الجديد</label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => { setCloneName(e.target.value); setCloneError(""); }}
              placeholder="أدخل اسم القالب الجديد"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none mb-1"
              style={{ border: `1px solid ${cloneError ? "#DC2626" : "#E2E0D8"}`, color: "#1C1B2E" }}
            />
            {cloneError && <p className="text-xs mb-4 font-medium" style={{ color: "#DC2626" }}>{cloneError}</p>}
            <div className="flex gap-3 mt-5">
              <MarsaButton variant="primary" size="lg" className="flex-1"
                icon={!cloneLoading ? <Copy size={16} /> : undefined}
                loading={cloneLoading}
                onClick={handleCloneSave}
                disabled={cloneLoading || !cloneName.trim() || cloneName.trim() === cloneOriginalName}
              >
                حفظ النسخة
              </MarsaButton>
              <MarsaButton variant="secondary" size="lg"
                onClick={() => { setCloneModal(false); setCloneData(null); }}
              >
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
