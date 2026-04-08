"use client";

import { useState, useEffect, use, useRef } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  User,
  Tag,
  Clock,
  GripVertical,
  CheckCircle2,
  Circle,
  Loader2,
  Eye,
  AlertTriangle,
  ArrowDown,
  ArrowLeftRight,
  Package,
  DollarSign,
  Save,
  X,
  FileText,
  FileWarning,
  ExternalLink,
  Hash,
  FolderOpen,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ContractPromptDialog from "@/components/ContractPromptDialog";

interface TaskType {
  id: string;
  title: string;
  status: string;
  priority: string;
  order: number;
  dueDate: string | null;
  service: { id: string; name: string; category: string } | null;
  assignee: { id: string; name: string; avatar: string | null } | null;
}

interface ServiceType {
  id: string;
  name: string;
  category: string | null;
  price: number | null;
  duration: number | null;
  status: string | null;
  tasks: TaskType[];
}

interface ProjectType {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  workflowType: string;
  totalPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  client: { id: string; name: string; email: string };
  manager: { id: string; name: string; email: string } | null;
  department?: { id: string; name: string; nameEn?: string; color: string | null } | null;
  contract?: {
    id: string;
    contractNumber: number | null;
    startDate: string | null;
    endDate: string | null;
    durationDays: number | null;
    contractValue: number | null;
    uploadedFileUrl: string | null;
    templateId: string | null;
    status: string;
  } | null;
  tasks: TaskType[];
  services: ServiceType[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_HOLD: { label: "معلق", bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { label: "مكتمل", bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "منخفضة", color: "#94A3B8" },
  MEDIUM: { label: "متوسطة", color: "#C9A84C" },
  HIGH: { label: "عالية", color: "#EA580C" },
  URGENT: { label: "عاجلة", color: "#DC2626" },
};

const taskStatusConfig: Record<string, { label: string; color: string }> = {
  TODO: { label: "للتنفيذ", color: "#94A3B8" },
  WAITING: { label: "في الانتظار", color: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", color: "#C9A84C" },
  IN_REVIEW: { label: "للمراجعة", color: "#8B5CF6" },
  DONE: { label: "مكتمل", color: "#22C55E" },
  CANCELLED: { label: "ملغي", color: "#EF4444" },
};

const columns = [
  { key: "TODO", label: "للتنفيذ", icon: Circle, color: "#94A3B8" },
  { key: "WAITING", label: "في الانتظار", icon: Circle, color: "#EA580C" },
  { key: "IN_PROGRESS", label: "قيد التنفيذ", icon: Loader2, color: "#C9A84C" },
  { key: "IN_REVIEW", label: "للمراجعة", icon: Eye, color: "#8B5CF6" },
  { key: "DONE", label: "مكتمل", icon: CheckCircle2, color: "#22C55E" },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [project, setProject] = useState<ProjectType | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "services">("services");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showContractPrompt, setShowContractPrompt] = useState(false);
  const dragItem = useRef<string | null>(null);
  const dragOverColumn = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === "authenticated") fetchProject();
  }, [authStatus, id]);

  if (authStatus === "loading") return null;
  if (!session) redirect("/auth/login");

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER";

  function fetchProject() {
    fetch(`/api/projects/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => { setProject(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok && project) {
      const updatedTasks = project.tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t);
      const done = updatedTasks.filter((t) => t.status === "DONE").length;
      setProject({
        ...project,
        tasks: updatedTasks,
        services: project.services.map(s => ({
          ...s,
          tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t),
        })),
        completedTasks: done,
        progress: updatedTasks.length > 0 ? Math.round((done / updatedTasks.length) * 100) : 0,
      });
    }
  }

  function handleDragStart(taskId: string) { dragItem.current = taskId; }
  function handleDragOver(e: React.DragEvent, columnKey: string) { e.preventDefault(); dragOverColumn.current = columnKey; }
  function handleDrop(columnKey: string) {
    if (dragItem.current && dragOverColumn.current === columnKey) updateTaskStatus(dragItem.current, columnKey);
    dragItem.current = null;
    dragOverColumn.current = null;
  }

  async function handleSaveAsTemplate() {
    if (!templateName || !project) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${id}/save-as-template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName }),
    });
    if (res.ok) {
      setShowTemplateModal(false);
      setTemplateName("");
      alert("تم حفظ القالب بنجاح");
    }
    setSaving(false);
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>المشروع غير موجود</p>
          <MarsaButton variant="link" onClick={() => router.back()} className="mt-4">رجوع</MarsaButton>
        </div>
      </div>
    );
  }

  const st = statusConfig[project.status] || statusConfig.DRAFT;
  const pr = priorityConfig[project.priority] || priorityConfig.MEDIUM;

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <MarsaButton variant="ghost" size="sm" icon={<ArrowRight size={16} />} onClick={() => router.push("/dashboard/projects")} className="mb-6">
        العودة للمشاريع
      </MarsaButton>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{project.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
              <span className="flex items-center gap-1 text-xs" style={{ color: pr.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.color }} />
                {pr.label}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-400">
                {project.workflowType === "SEQUENTIAL" ? <ArrowDown size={12} /> : <ArrowLeftRight size={12} />}
                {project.workflowType === "SEQUENTIAL" ? "تسلسلي" : "مستقل"}
              </span>
              {project.department && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${project.department.color}15`, color: project.department.color || "#5E5495" }}>
                  {project.department.name}
                </span>
              )}
            </div>
            {project.description && <p className="text-sm text-gray-500 mb-2">{project.description}</p>}
            <div className="flex items-center gap-5 text-xs text-gray-400">
              <span className="flex items-center gap-1"><User size={13} />العميل: {project.client.name}</span>
              {project.manager && <span className="flex items-center gap-1"><User size={13} />المدير: {project.manager.name}</span>}
              <span className="flex items-center gap-1"><Calendar size={13} />{formatDate(project.startDate)} — {formatDate(project.endDate)}</span>
              {project.totalPrice && (
                <span className="flex items-center gap-1"><DollarSign size={13} />{project.totalPrice.toLocaleString("en-US")} <SarSymbol size={12} /></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <MarsaButton
              variant="secondary"
              icon={<FolderOpen size={16} />}
              href={`/dashboard/projects/${id}/documents`}
            >
              📁 متطلبات المشروع
            </MarsaButton>
            {isAdmin && (
              <MarsaButton variant="secondary" icon={<Save size={16} />}
                onClick={() => { setTemplateName(project.name); setShowTemplateModal(true); }}
              >
                حفظ كقالب
              </MarsaButton>
            )}
            <div className="flex items-center gap-4 min-w-[180px]">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">الإنجاز</span>
                  <span className="font-bold" style={{ color: "#1C1B2E" }}>{project.progress}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: `${project.progress}%`,
                    background: project.progress === 100 ? "#22C55E" : "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                  }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
                  {project.completedTasks}<span className="text-sm font-normal text-gray-400">/{project.totalTasks}</span>
                </p>
                <p className="text-xs text-gray-400">مهمة</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contract status card */}
      {(() => {
        const c = project.contract;
        if (!c) {
          return (
            <div
              className="bg-white rounded-2xl p-5 mb-6 flex items-center gap-4"
              style={{ border: "2px dashed #FECACA", backgroundColor: "rgba(220,38,38,0.03)" }}
              dir="rtl"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
                <FileWarning size={22} style={{ color: "#DC2626" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>لا يوجد عقد مرتبط بهذا المشروع</p>
                <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>أضف عقداً قائماً أو أنشئ عقداً جديداً لتفعيل تتبع الانتهاء</p>
              </div>
              {isAdmin && (
                <MarsaButton variant="gold" size="sm" icon={<FileText size={14} />} onClick={() => setShowContractPrompt(true)}>
                  إضافة عقد
                </MarsaButton>
              )}
            </div>
          );
        }

        const now = Date.now();
        const endMs = c.endDate ? new Date(c.endDate).getTime() : null;
        const daysRemaining = endMs ? Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)) : null;
        let urgency: "expired" | "critical" | "warning" | "normal" = "normal";
        let urgencyColor = "#22C55E";
        let urgencyLabel = "ساري";
        if (daysRemaining !== null) {
          if (daysRemaining < 0) { urgency = "expired"; urgencyColor = "#DC2626"; urgencyLabel = "منتهي"; }
          else if (daysRemaining <= 15) { urgency = "critical"; urgencyColor = "#DC2626"; urgencyLabel = `ينتهي خلال ${daysRemaining} يوم`; }
          else if (daysRemaining <= 30) { urgency = "warning"; urgencyColor = "#EA580C"; urgencyLabel = `ينتهي خلال ${daysRemaining} يوم`; }
          else { urgencyLabel = `${daysRemaining} يوم متبقي`; }
        }

        return (
          <div
            className="bg-white rounded-2xl p-5 mb-6"
            style={{ border: `1px solid ${urgency === "normal" ? "#E2E0D8" : `${urgencyColor}40`}`, backgroundColor: urgency === "normal" ? "white" : `${urgencyColor}05` }}
            dir="rtl"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${urgencyColor}15` }}>
                <FileText size={22} style={{ color: urgencyColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                    {c.contractNumber ? `عقد رقم #${c.contractNumber}` : "عقد المشروع"}
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${urgencyColor}15`, color: urgencyColor }}>
                    {urgencyLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                    {c.templateId ? "عقد جديد" : "عقد قائم"}
                  </span>
                  {(urgency === "critical" || urgency === "expired") && (
                    <AlertTriangle size={14} style={{ color: urgencyColor }} />
                  )}
                </div>
                <div className="flex items-center gap-5 text-xs mt-2 flex-wrap" style={{ color: "#6B7280" }}>
                  {c.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      من {formatDate(c.startDate)}
                    </span>
                  )}
                  {c.endDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      إلى {formatDate(c.endDate)}
                    </span>
                  )}
                  {c.durationDays != null && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {c.durationDays} يوم
                    </span>
                  )}
                  {c.contractValue != null && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {c.contractValue.toLocaleString("en-US")} <SarSymbol size={11} />
                    </span>
                  )}
                  {c.contractNumber != null && (
                    <span className="flex items-center gap-1">
                      <Hash size={12} />
                      {c.contractNumber}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.uploadedFileUrl && (
                  <a href={c.uploadedFileUrl} target="_blank" rel="noopener noreferrer">
                    <MarsaButton variant="secondary" size="sm" icon={<ExternalLink size={14} />}>
                      عرض الملف
                    </MarsaButton>
                  </a>
                )}
                <MarsaButton href={`/dashboard/contracts?id=${c.id}`} variant="link" size="sm">
                  تفاصيل العقد
                </MarsaButton>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View Toggle */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setViewMode("services")}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={viewMode === "services"
            ? { backgroundColor: "#5E5495", color: "white" }
            : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
          }
        >
          <span className="flex items-center gap-1.5"><Package size={16} />عرض الخدمات</span>
        </button>
        <button
          onClick={() => setViewMode("kanban")}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={viewMode === "kanban"
            ? { backgroundColor: "#5E5495", color: "white" }
            : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
          }
        >
          <span className="flex items-center gap-1.5"><GripVertical size={16} />لوحة Kanban</span>
        </button>
      </div>

      {/* Services View */}
      {viewMode === "services" && project.services && project.services.length > 0 && (
        <div className="space-y-4">
          {project.workflowType === "SEQUENTIAL" && project.services.length > 1 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
              <p className="text-xs text-gray-400 mb-3">مخطط التنفيذ التسلسلي للخدمات</p>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {project.services.map((svc, idx) => {
                  const svcTasks = svc.tasks || [];
                  const svcDone = svcTasks.filter(t => t.status === "DONE").length;
                  const svcProgress = svcTasks.length > 0 ? Math.round((svcDone / svcTasks.length) * 100) : 0;
                  return (
                    <div key={svc.id} className="flex items-center gap-2">
                      <div className="min-w-[140px] p-3 rounded-xl border border-gray-100 bg-gray-50 text-center">
                        <p className="text-xs font-medium" style={{ color: "#1C1B2E" }}>{svc.name}</p>
                        <div className="h-1.5 rounded-full mt-2 overflow-hidden bg-gray-200">
                          <div className="h-full rounded-full" style={{
                            width: `${svcProgress}%`,
                            backgroundColor: svcProgress === 100 ? "#22C55E" : "#C9A84C",
                          }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{svcProgress}%</p>
                      </div>
                      {idx < project.services.length - 1 && <ArrowRight size={16} className="text-gray-300 shrink-0 rotate-180" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {project.services.map((svc) => {
            const svcTasks = svc.tasks || [];
            const svcDone = svcTasks.filter(t => t.status === "DONE").length;
            const svcProgress = svcTasks.length > 0 ? Math.round((svcDone / svcTasks.length) * 100) : 0;
            return (
              <div key={svc.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                        <Package size={18} style={{ color: "#C9A84C" }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>{svc.name}</h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          {svc.category && <span>{svc.category}</span>}
                          {svc.price && <span>{svc.price.toLocaleString("en-US")} <SarSymbol size={12} /></span>}
                          {svc.duration && <span>{svc.duration} يوم</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: svc.status === "COMPLETED" ? "#ECFDF5" : svc.status === "IN_PROGRESS" ? "#FFFBEB" : "#F3F4F6",
                        color: svc.status === "COMPLETED" ? "#059669" : svc.status === "IN_PROGRESS" ? "#D97706" : "#6B7280",
                      }}>
                        {svc.status === "COMPLETED" ? "مكتمل" : svc.status === "IN_PROGRESS" ? "جاري" : "معلق"}
                      </span>
                      <div className="w-24">
                        <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                          <div className="h-full rounded-full" style={{
                            width: `${svcProgress}%`,
                            backgroundColor: svcProgress === 100 ? "#22C55E" : "#C9A84C",
                          }} />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5 text-left">{svcDone}/{svcTasks.length}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {svcTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">لا توجد مهام</p>
                  ) : (
                    <div className="space-y-2">
                      {svcTasks.sort((a, b) => a.order - b.order).map((task, idx) => {
                        const ts = taskStatusConfig[task.status] || taskStatusConfig.TODO;
                        return (
                          <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                            <span className="text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: ts.color + "20", color: ts.color }}>
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{task.title}</p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: ts.color + "15", color: ts.color }}>{ts.label}</span>
                                {task.assignee && <span className="text-[10px] text-gray-400">{task.assignee.name}</span>}
                                {task.dueDate && (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <Clock size={10} />
                                    {new Date(task.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {task.status !== "DONE" && (
                              <select
                                value={task.status}
                                onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                                className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white"
                              >
                                <option value="TODO">للتنفيذ</option>
                                <option value="WAITING">في الانتظار</option>
                                <option value="IN_PROGRESS">قيد التنفيذ</option>
                                <option value="IN_REVIEW">للمراجعة</option>
                                <option value="DONE">مكتمل</option>
                              </select>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {columns.map((col) => {
              const colTasks = project.tasks.filter((t) => t.status === col.key);
              return (
                <div
                  key={col.key}
                  className="rounded-2xl p-4 min-h-[400px]"
                  style={{ backgroundColor: "rgba(27,42,74,0.03)", border: "1px solid #E8E5DE" }}
                  onDragOver={(e) => handleDragOver(e, col.key)}
                  onDrop={() => handleDrop(col.key)}
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <col.icon size={16} style={{ color: col.color }} />
                      <span className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{col.label}</span>
                    </div>
                    <span className="text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: col.color + "20", color: col.color }}>
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {colTasks.map((task) => {
                      const tp = priorityConfig[task.priority] || priorityConfig.MEDIUM;
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task.id)}
                          className="bg-white rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 border border-gray-100 shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <GripVertical size={14} className="text-gray-300" />
                            <div className="flex items-center gap-1.5">
                              {task.priority === "URGENT" && <AlertTriangle size={12} style={{ color: tp.color }} />}
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tp.color }} />
                            </div>
                          </div>
                          <p className="text-sm font-medium mb-2" style={{ color: "#1C1B2E" }}>{task.title}</p>
                          {task.service && (
                            <div className="flex items-center gap-1 text-xs mb-3 px-2 py-1 rounded-lg w-fit" style={{ backgroundColor: "rgba(201,168,76,0.08)", color: "#C9A84C" }}>
                              <Tag size={10} />
                              {task.service.name}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            {task.assignee ? (
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "rgba(27,42,74,0.08)", color: "#1C1B2E" }}>
                                  {task.assignee.name.charAt(0)}
                                </div>
                                <span className="text-xs text-gray-400">{task.assignee.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">غير مُعيّن</span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Clock size={10} />
                                {new Date(task.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* No services fallback for services view */}
      {viewMode === "services" && (!project.services || project.services.length === 0) && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Package size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">لا توجد خدمات في هذا المشروع</p>
        </div>
      )}

      {/* Add contract dialog */}
      {showContractPrompt && project && (
        <ContractPromptDialog
          clientId={project.client.id}
          projectId={project.id}
          onSuccess={() => {
            setShowContractPrompt(false);
            fetchProject();
          }}
          onCancel={() => setShowContractPrompt(false)}
        />
      )}

      {/* Save as Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>حفظ كقالب مشروع</h3>
              <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={20} />} onClick={() => setShowTemplateModal(false)} />
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم القالب</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  placeholder="اسم القالب"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <MarsaButton variant="gold" className="flex-1" onClick={handleSaveAsTemplate} disabled={!templateName || saving} loading={saving}>
                {saving ? "جاري الحفظ..." : "حفظ القالب"}
              </MarsaButton>
              <MarsaButton variant="secondary" onClick={() => setShowTemplateModal(false)}>
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
