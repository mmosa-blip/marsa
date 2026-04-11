"use client";

import React, { useState, useEffect } from "react";
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
  Info,
  X,
  Loader2,
  Check,
  Download,
  Printer,
} from "lucide-react";
import { exportDurationReportPDF } from "@/lib/duration-report-pdf";

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

  // Duration detail modal — "لماذا X يوم؟"
  interface DetailTask {
    name: string;
    defaultDuration: number;
    executionMode: string;
    sameDay: boolean;
  }
  interface DetailService {
    name: string;
    executionMode: string;
    duration: number;
    addsToTotal: boolean;
    tasks: DetailTask[];
  }
  const [detailModal, setDetailModal] = useState<{
    templateName: string;
    totalDays: number;
    workflowType: string;
    services: DetailService[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  async function openDetailModal(templateId: string) {
    setDetailLoading(true);
    setDetailModal(null);
    try {
      const res = await fetch(`/api/project-templates/${templateId}`);
      if (!res.ok) return;
      const data = await res.json();

      interface TaskTmpl {
        name: string;
        defaultDuration: number;
        executionMode?: string;
        sameDay?: boolean;
      }
      interface SvcLink {
        sortOrder: number;
        executionMode?: string;
        serviceTemplate: {
          name: string;
          defaultDuration: number | null;
          taskTemplates: TaskTmpl[];
        };
      }

      const services: DetailService[] = (data.services || []).map((link: SvcLink) => {
        const st = link.serviceTemplate;
        const tasks: DetailTask[] = (st.taskTemplates || []).map((tt: TaskTmpl) => ({
          name: tt.name,
          defaultDuration: tt.defaultDuration,
          executionMode: tt.executionMode || "SEQUENTIAL",
          sameDay: !!tt.sameDay,
        }));
        const duration =
          st.defaultDuration ||
          tasks.reduce((s, t) => s + t.defaultDuration, 0);
        const mode = link.executionMode || "SEQUENTIAL";
        const addsToTotal =
          data.workflowType === "SEQUENTIAL"
            ? mode === "SEQUENTIAL"
            : false;
        return { name: st.name, executionMode: mode, duration, addsToTotal, tasks };
      });

      setDetailModal({
        templateName: data.name,
        totalDays: data.totalDurationDays,
        workflowType: data.workflowType,
        services,
      });
    } catch { /* ignore */ }
    setDetailLoading(false);
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
        <MarsaButton href="/dashboard/projects/templates/new" variant="gold" size="lg" icon={<Plus size={18} />}>
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
          <MarsaButton href="/dashboard/projects/templates/new" variant="primary" size="lg" icon={<Plus size={18} />}>
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
                <button
                  type="button"
                  onClick={() => openDetailModal(template.id)}
                  disabled={detailLoading}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors"
                  style={{ color: "#5E5495" }}
                  title="لماذا هذا العدد من الأيام؟"
                >
                  <Info size={12} />
                  📋 تفاصيل
                </button>
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

      {/* Duration detail modal — "لماذا X يوم؟" */}
      {(detailModal || detailLoading) && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => !detailLoading && setDetailModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xl max-h-[80vh] overflow-y-auto"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            {detailLoading && !detailModal ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
              </div>
            ) : detailModal ? (
              <>
                <div className="flex items-center justify-between p-5" style={{ borderBottom: "1px solid #F0EDE6" }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
                    >
                      <Clock size={20} style={{ color: "#C9A84C" }} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                        لماذا {detailModal.totalDays} يوم؟
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                        {detailModal.templateName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MarsaButton
                      variant="secondary"
                      size="sm"
                      icon={<Download size={13} />}
                      onClick={() => exportDurationReportPDF(detailModal)}
                      style={{ color: "#5E5495" }}
                    >
                      ⬇ تصدير PDF
                    </MarsaButton>
                    <MarsaButton
                      variant="secondary"
                      size="sm"
                      icon={<Printer size={13} />}
                      onClick={() => exportDurationReportPDF(detailModal)}
                      style={{ color: "#6B7280" }}
                    >
                      🖨 طباعة
                    </MarsaButton>
                    <button onClick={() => setDetailModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: "#9CA3AF" }}>
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <table className="w-full text-sm mb-4" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th className="text-right py-2 px-3 text-xs font-bold" style={{ color: "#6B7280", borderBottom: "2px solid #E2E0D8" }}>الخدمة</th>
                        <th className="text-center py-2 px-3 text-xs font-bold" style={{ color: "#6B7280", borderBottom: "2px solid #E2E0D8" }}>النوع</th>
                        <th className="text-center py-2 px-3 text-xs font-bold" style={{ color: "#6B7280", borderBottom: "2px solid #E2E0D8" }}>الأيام</th>
                        <th className="text-center py-2 px-3 text-xs font-bold" style={{ color: "#6B7280", borderBottom: "2px solid #E2E0D8" }}>تُضاف؟</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.services.map((svc, idx) => {
                        const modeLabel =
                          svc.executionMode === "PARALLEL" ? "توازي" :
                          svc.executionMode === "INDEPENDENT" ? "مستقل" :
                          "تسلسلي";
                        const modeColor =
                          svc.executionMode === "PARALLEL" ? "#2563EB" :
                          svc.executionMode === "INDEPENDENT" ? "#6B7280" :
                          "#C9A84C";
                        return (
                          <React.Fragment key={idx}>
                            {/* Service row */}
                            <tr
                              style={{
                                backgroundColor: idx % 2 === 0 ? "#FAFAF7" : "white",
                                borderBottom: svc.tasks.length > 0 ? "none" : "1px solid #F0EDE6",
                              }}
                            >
                              <td className="py-2.5 px-3 text-xs font-semibold" style={{ color: "#1C1B2E" }}>{svc.name}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${modeColor}18`, color: modeColor }}
                                >
                                  {modeLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-xs font-bold" style={{ color: "#1C1B2E" }}>
                                {svc.duration}
                              </td>
                              <td className="py-2.5 px-3 text-center text-sm">
                                {svc.addsToTotal ? (
                                  <span style={{ color: "#16A34A" }}><Check size={16} className="mx-auto" /></span>
                                ) : (
                                  <span className="text-xs" style={{ color: "#9CA3AF" }}>—</span>
                                )}
                              </td>
                            </tr>
                            {/* Task detail rows */}
                            {svc.tasks.map((task, tIdx) => {
                              const tModeLabel =
                                task.sameDay ? "نفس اليوم" :
                                task.executionMode === "PARALLEL" ? "متوازي" :
                                task.executionMode === "INDEPENDENT" ? "مستقل" :
                                "تسلسلي";
                              const tModeColor =
                                task.sameDay ? "#92400E" :
                                task.executionMode === "PARALLEL" ? "#2563EB" :
                                task.executionMode === "INDEPENDENT" ? "#6B7280" :
                                "#9CA3AF";
                              return (
                                <tr
                                  key={`${idx}-t${tIdx}`}
                                  style={{
                                    backgroundColor: "rgba(94,84,149,0.03)",
                                    borderBottom: tIdx === svc.tasks.length - 1 ? "1px solid #F0EDE6" : "1px solid rgba(94,84,149,0.06)",
                                  }}
                                >
                                  <td className="py-1.5 px-3 pr-8 text-[11px]" style={{ color: "#6B7280" }}>
                                    <span className="text-gray-300 font-mono mr-1">{tIdx + 1}.</span>
                                    {task.name}
                                  </td>
                                  <td className="py-1.5 px-3 text-center">
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ backgroundColor: `${tModeColor}15`, color: tModeColor }}
                                    >
                                      {tModeLabel}
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-3 text-center text-[11px] font-medium" style={{ color: "#6B7280" }}>
                                    {task.sameDay ? "0" : task.defaultDuration}
                                  </td>
                                  <td />
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  <div
                    className="p-3 rounded-xl text-center"
                    style={{ backgroundColor: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)" }}
                  >
                    <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                      المجموع = {detailModal.services
                        .filter((s) => s.addsToTotal)
                        .map((s) => s.duration)
                        .join(" + ")} = {detailModal.totalDays} يوم عمل
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>
                      الخدمات التوازية والمستقلة تعمل بالتوازي مع غيرها ولا تُضاف للمجموع
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
