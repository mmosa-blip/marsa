"use client";

import { useState, useEffect, use, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/routes";
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
  Pencil,
  Check,
  Layers,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ContractPromptDialog from "@/components/ContractPromptDialog";
import SetupInstallmentsModal from "@/components/payments/SetupInstallmentsModal";

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
  projectCode: string | null;
  projectSeq: number | null;
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
  client: { id: string; name: string; email: string; phone?: string | null };
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
    _count?: { installments: number };
  } | null;
  tasks: TaskType[];
  services: ServiceType[];
  milestones?: {
    id: string;
    title: string;
    type: string;
    status: string;
    order: number;
    invoice?: { id: string; totalAmount: number; status: string } | null;
  }[];
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
  const searchParams = useSearchParams();
  // ?welcome=needs-setup is appended by /dashboard/projects/new when the
  // project was generated from a template that produced no installment
  // schedule. We auto-open the setup modal once on mount and clear the
  // param so it doesn't fire again on subsequent visits.
  const welcomeNeedsSetup = searchParams.get("welcome") === "needs-setup";
  const [showWelcomePrompt, setShowWelcomePrompt] = useState(welcomeNeedsSetup);
  const [project, setProject] = useState<ProjectType | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "services" | "delay">("services");
  const [delayReport, setDelayReport] = useState<{
    startDate: string | null;
    originalEndDate: string | null;
    adjustedEndDate: string | null;
    isPaused: boolean;
    totalPausedDays: number;
    periods: {
      id: string;
      reason: string;
      notes: string | null;
      startDate: string;
      endDate: string | null;
      isOpen: boolean;
      days: number;
      pausedBy: { id: string; name: string } | null;
      resumedBy: { id: string; name: string } | null;
    }[];
  } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showContractPrompt, setShowContractPrompt] = useState(false);
  // Project code edit modal — admins/managers can change the project's
  // contract number from here, which regenerates projectCode server-side.
  const [showCodeModal, setShowCodeModal] = useState(false);
  // Celebration modal — only meaningful when project.status === "COMPLETED".
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showSetupInstallments, setShowSetupInstallments] = useState(false);
  const [waCopied, setWaCopied] = useState(false);
  // Inline rename: admins can edit the project name from the header.
  // The auto-name from the create page was "{template} - {client}" — this
  // is the only place to override that after the project exists.
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [codeContractInput, setCodeContractInput] = useState("");
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeError, setCodeError] = useState("");
  const dragItem = useRef<string | null>(null);
  const dragOverColumn = useRef<string | null>(null);

  useEffect(() => {
    if (authStatus === "authenticated") fetchProject();
  }, [authStatus, id]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  // Executors use the project detail page as a read-only dashboard —
  // all task status changes and edits happen from "مدينتي" instead.
  const isExecutor = session.user.role === "EXECUTOR";

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
            {/* Project code — prominent identifier above the name */}
            {project.projectCode && (
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-sm font-bold tracking-wider"
                  style={{
                    backgroundColor: "rgba(94,84,149,0.08)",
                    color: "#5E5495",
                    border: "1px solid rgba(94,84,149,0.2)",
                  }}
                  title="رمز المشروع: السنة + العميل + القسم + العقد + التسلسل"
                >
                  <Hash size={13} />
                  {project.projectCode}
                </span>
                {isAdmin && project.contract?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeContractInput(
                        project.contract?.contractNumber != null
                          ? String(project.contract.contractNumber)
                          : ""
                      );
                      setCodeError("");
                      setShowCodeModal(true);
                    }}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md transition-colors"
                    style={{ color: "#6B7280", backgroundColor: "transparent" }}
                    title="تعديل رقم العقد وإعادة توليد رمز المشروع"
                  >
                    تعديل الرقم
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    autoFocus
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") { setEditingName(false); setNameInput(""); }
                      if (e.key === "Enter") {
                        const trimmed = nameInput.trim();
                        if (!trimmed || nameSaving) return;
                        (async () => {
                          setNameSaving(true);
                          try {
                            const res = await fetch(`/api/projects/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: trimmed }),
                            });
                            if (res.ok) {
                              setProject((prev) => prev ? { ...prev, name: trimmed } : prev);
                              setEditingName(false);
                              setNameInput("");
                            } else {
                              const j = await res.json().catch(() => ({}));
                              alert((j as { error?: string }).error || "تعذّر التعديل");
                            }
                          } finally {
                            setNameSaving(false);
                          }
                        })();
                      }
                    }}
                    disabled={nameSaving}
                    className="text-2xl font-bold px-3 py-1 rounded-lg outline-none focus:ring-2 focus:ring-amber-200 min-w-[280px]"
                    style={{ color: "#1C1B2E", border: "1px solid #E2E0D8" }}
                  />
                  <button
                    type="button"
                    disabled={nameSaving || !nameInput.trim()}
                    onClick={async () => {
                      const trimmed = nameInput.trim();
                      if (!trimmed) return;
                      setNameSaving(true);
                      try {
                        const res = await fetch(`/api/projects/${id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: trimmed }),
                        });
                        if (res.ok) {
                          setProject((prev) => prev ? { ...prev, name: trimmed } : prev);
                          setEditingName(false);
                          setNameInput("");
                        } else {
                          const j = await res.json().catch(() => ({}));
                          alert((j as { error?: string }).error || "تعذّر التعديل");
                        }
                      } finally {
                        setNameSaving(false);
                      }
                    }}
                    className="p-2 rounded-lg disabled:opacity-50"
                    style={{ backgroundColor: "#22C55E", color: "white" }}
                    title="حفظ"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingName(false); setNameInput(""); }}
                    disabled={nameSaving}
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                    title="إلغاء"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                  {project.name}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => { setNameInput(project.name); setEditingName(true); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                      style={{ color: "#9CA3AF" }}
                      title="تعديل اسم المشروع"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </h1>
              )}
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
            {isAdmin && project.status === "COMPLETED" && (
              <MarsaButton
                variant="gold"
                onClick={() => { setShowCelebrationModal(true); setWaCopied(false); }}
              >
                🎉 احتفالية الإنجاز
              </MarsaButton>
            )}
            <MarsaButton
              variant="secondary"
              icon={<FolderOpen size={16} />}
              href={`/dashboard/projects/${id}/documents`}
            >
              📁 متطلبات المشروع
            </MarsaButton>
            <MarsaButton
              variant="primary"
              icon={<Layers size={16} />}
              href={`/dashboard/projects/${id}/record`}
            >
              السجل الموحد
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

      {/* Welcome prompt — shown once when arriving from /new with the
          ?welcome=needs-setup flag, so the user is reminded to define
          a payment schedule that the template didn't supply. */}
      {showWelcomePrompt && project.contract && (project.contract._count?.installments ?? 0) === 0 && (
        <div
          className="mb-4 rounded-2xl p-4 flex items-center gap-3 flex-wrap"
          style={{
            backgroundColor: "rgba(234,88,12,0.06)",
            border: "1px solid rgba(234,88,12,0.30)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(234,88,12,0.15)" }}
          >
            <DollarSign size={18} style={{ color: "#EA580C" }} />
          </div>
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              ⚠️ المشروع تم إنشاؤه. تحتاج إعداد جدول الدفعات.
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
              القالب لا يحتوي على جدول دفعات افتراضي. عرّف الجدول الآن لتظهر الدفعات في صفحة الدفعات.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowSetupInstallments(true);
              setShowWelcomePrompt(false);
              // Strip the query param so refresh doesn't re-prompt.
              router.replace(`/dashboard/projects/${id}`);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-105"
            style={{ backgroundColor: "#EA580C", color: "white" }}
          >
            إعداد الآن
          </button>
          <button
            type="button"
            onClick={() => {
              setShowWelcomePrompt(false);
              router.replace(`/dashboard/projects/${id}`);
            }}
            className="text-[11px] px-3 py-2 rounded-xl"
            style={{ color: "#6B7280" }}
          >
            لاحقاً
          </button>
        </div>
      )}

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
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {c._count && c._count.installments === 0 && (
                  <MarsaButton
                    variant="gold"
                    size="sm"
                    onClick={() => setShowSetupInstallments(true)}
                  >
                    💰 إعداد جدول الدفعات
                  </MarsaButton>
                )}
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
        <button
          onClick={() => {
            setViewMode("delay");
            fetch(`/api/projects/${id}/pause-report`)
              .then((r) => r.json())
              .then((d) => {
                if (d && !d.error) setDelayReport(d);
              })
              .catch(() => {});
          }}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={viewMode === "delay"
            ? { backgroundColor: "#DC2626", color: "white" }
            : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
          }
        >
          <span className="flex items-center gap-1.5"><Clock size={16} />تقرير التأخير</span>
        </button>
      </div>

      {/* Delay / pause report */}
      {viewMode === "delay" && (() => {
        const report = delayReport;
        if (!report) {
          return (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
              <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
              <p className="text-sm mt-3" style={{ color: "#6B7280" }}>
                جاري تحميل تقرير التأخير...
              </p>
            </div>
          );
        }
        const reasonLabel = (r: string) => {
          if (r === "PAYMENT_DELAY") return "تأخر الدفعة";
          if (r === "CLIENT_REQUEST") return "طلب العميل";
          if (r === "OTHER") return "أخرى";
          return r;
        };
        const dateFmt = (d: string | null) =>
          d
            ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : "—";
        return (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(220,38,38,0.06)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                    إجمالي أيام الإيقاف
                  </p>
                  <p className="text-xl font-bold" style={{ color: "#DC2626" }}>
                    {report.totalPausedDays.toLocaleString("en-US")} يوم
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(94,84,149,0.06)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                    تاريخ الانتهاء الأصلي
                  </p>
                  <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                    {dateFmt(report.originalEndDate)}
                  </p>
                </div>
                <div className="p-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.08)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                    تاريخ الانتهاء المعدّل
                  </p>
                  <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                    {dateFmt(report.adjustedEndDate)}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{
                    backgroundColor: report.isPaused ? "rgba(220,38,38,0.1)" : "rgba(34,197,94,0.06)",
                  }}
                >
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
                    الحالة
                  </p>
                  <p
                    className="text-sm font-bold"
                    style={{ color: report.isPaused ? "#DC2626" : "#16A34A" }}
                  >
                    {report.isPaused ? "موقوف حالياً" : "نشط"}
                  </p>
                </div>
              </div>
            </div>

            {/* Periods table */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="text-sm font-bold mb-4" style={{ color: "#1C1B2E" }}>
                فترات الإيقاف ({report.periods.length})
              </h3>
              {report.periods.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  لا توجد فترات إيقاف مسجلة لهذا المشروع.
                </p>
              ) : (
                <div className="space-y-2">
                  {report.periods.map((p, idx) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl"
                      style={{
                        border: "1px solid #F0EDE6",
                        backgroundColor: p.isOpen ? "rgba(220,38,38,0.04)" : "#FAFAF7",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>
                          #{idx + 1} — {reasonLabel(p.reason)}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: p.isOpen
                              ? "rgba(220,38,38,0.12)"
                              : "rgba(148,163,184,0.15)",
                            color: p.isOpen ? "#DC2626" : "#64748B",
                          }}
                        >
                          {p.days} يوم{p.isOpen ? " (جارٍ)" : ""}
                        </span>
                      </div>
                      <div className="text-[11px]" style={{ color: "#6B7280" }}>
                        {dateFmt(p.startDate)} → {p.endDate ? dateFmt(p.endDate) : "حتى الآن"}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] mt-1" style={{ color: "#9CA3AF" }}>
                        {p.pausedBy && <span>أوقف: {p.pausedBy.name}</span>}
                        {p.resumedBy && <span>استأنف: {p.resumedBy.name}</span>}
                      </div>
                      {p.notes && (
                        <p className="text-[11px] mt-2 p-2 rounded" style={{ backgroundColor: "#F8F6EE", color: "#4B5563" }}>
                          {p.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Simple horizontal timeline */}
            {report.startDate && report.originalEndDate && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold mb-4" style={{ color: "#1C1B2E" }}>
                  المخطط الزمني
                </h3>
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  <div className="min-w-[120px] p-3 rounded-xl border border-gray-100 bg-gray-50 text-center">
                    <p className="text-[10px] text-gray-400 mb-1">البداية</p>
                    <p className="text-xs font-bold" style={{ color: "#1C1B2E" }}>
                      {dateFmt(report.startDate)}
                    </p>
                  </div>
                  {report.periods.map((p, idx) => (
                    <Fragment key={p.id}>
                      <ArrowRight size={14} className="text-gray-300 shrink-0 rotate-180" />
                      <div
                        className="min-w-[120px] p-3 rounded-xl text-center"
                        style={{
                          border: "1px solid rgba(220,38,38,0.25)",
                          backgroundColor: "rgba(220,38,38,0.05)",
                        }}
                      >
                        <p className="text-[10px] mb-1" style={{ color: "#DC2626" }}>
                          إيقاف #{idx + 1}
                        </p>
                        <p className="text-xs font-bold" style={{ color: "#DC2626" }}>
                          {p.days} يوم
                        </p>
                      </div>
                    </Fragment>
                  ))}
                  <ArrowRight size={14} className="text-gray-300 shrink-0 rotate-180" />
                  <div
                    className="min-w-[120px] p-3 rounded-xl text-center"
                    style={{
                      border: "1px solid rgba(201,168,76,0.3)",
                      backgroundColor: "rgba(201,168,76,0.08)",
                    }}
                  >
                    <p className="text-[10px] mb-1" style={{ color: "#C9A84C" }}>
                      الانتهاء المعدّل
                    </p>
                    <p className="text-xs font-bold" style={{ color: "#C9A84C" }}>
                      {dateFmt(report.adjustedEndDate)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Services View */}
      {viewMode === "services" && project.services && project.services.length > 0 && (
        <div className="space-y-4">
          {/* "Before project start" payment milestones — rendered above
              the services timeline. These are PAYMENT-type milestones
              with order === -1 created from afterServiceIndex === -1
              in /api/projects POST. */}
          {(() => {
            const beforeStart = (project.milestones || []).filter(
              (m) => m.type === "PAYMENT" && m.order === -1
            );
            if (beforeStart.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
                <p className="text-xs text-gray-400 mb-3">دفعات قبل بدء المشروع</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {beforeStart.map((m) => {
                    const amount = m.invoice?.totalAmount;
                    const paid = m.invoice?.status === "PAID" || m.status === "UNLOCKED";
                    return (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: paid ? "rgba(34,197,94,0.1)" : "rgba(220,38,38,0.1)",
                          color: paid ? "#16A34A" : "#DC2626",
                          border: `1px solid ${paid ? "rgba(34,197,94,0.3)" : "rgba(220,38,38,0.3)"}`,
                        }}
                      >
                        <DollarSign size={12} />
                        {m.title}
                        {amount != null && (
                          <span className="opacity-70">
                            ({amount.toLocaleString("en-US")})
                          </span>
                        )}
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: paid ? "#16A34A" : "#DC2626",
                            color: "white",
                          }}
                        >
                          {paid ? "مدفوعة" : "غير مدفوعة"}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })()}

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
                            {task.status !== "DONE" && !isExecutor && (
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
                  onDragOver={!isExecutor ? (e) => handleDragOver(e, col.key) : undefined}
                  onDrop={!isExecutor ? () => handleDrop(col.key) : undefined}
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
                          draggable={!isExecutor}
                          onDragStart={!isExecutor ? () => handleDragStart(task.id) : undefined}
                          className={`bg-white rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 border border-gray-100 shadow-sm ${isExecutor ? "" : "cursor-grab active:cursor-grabbing"}`}
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

      {/* Inline payments-setup modal — opened from the contract bar
          when the project has a contract but no installment schedule
          yet. Reuses the shared SetupInstallmentsModal so behaviour
          stays in sync with /dashboard/payments and /dashboard/payments/setup. */}
      {showSetupInstallments && project?.contract && (
        <SetupInstallmentsModal
          target={{
            contractId: project.contract.id,
            displayName: project.name,
            effectiveValue:
              (project.contract.contractValue && project.contract.contractValue > 0
                ? project.contract.contractValue
                : null) ??
              (project.totalPrice && project.totalPrice > 0
                ? project.totalPrice
                : null),
            valueSource:
              project.contract.contractValue && project.contract.contractValue > 0
                ? "contract"
                : project.totalPrice && project.totalPrice > 0
                  ? "project"
                  : "missing",
          }}
          onClose={() => setShowSetupInstallments(false)}
          onSuccess={() => {
            setShowSetupInstallments(false);
            fetchProject();
          }}
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

      {/* Edit project code (contract number) modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !codeSaving && setShowCodeModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                <Hash size={18} style={{ color: "#5E5495" }} />
                تعديل رقم العقد
              </h3>
              <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={20} />} onClick={() => !codeSaving && setShowCodeModal(false)} />
            </div>
            <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
              تغيير رقم العقد سيُعيد توليد رمز المشروع تلقائياً (الجزء الثالث من الرمز).
            </p>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1" style={{ color: "#374151" }}>رقم العقد</label>
              <input
                type="number"
                min="0"
                value={codeContractInput}
                onChange={(e) => { setCodeContractInput(e.target.value); setCodeError(""); }}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm font-mono"
                placeholder="مثلاً: 17"
                disabled={codeSaving}
              />
            </div>
            <p className="text-[11px] mb-4" style={{ color: "#9CA3AF" }}>
              سيتحول إلى 3 أرقام في الرمز (مثلاً 17 → 017). اتركه فارغاً للقيمة الصفرية.
            </p>
            {codeError && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                {codeError}
              </div>
            )}
            <div className="flex gap-3 mt-2">
              <MarsaButton
                variant="gold"
                className="flex-1"
                disabled={codeSaving}
                loading={codeSaving}
                onClick={async () => {
                  setCodeSaving(true);
                  setCodeError("");
                  try {
                    const parsed = codeContractInput.trim() === "" ? null : Number(codeContractInput);
                    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
                      setCodeError("أدخل عدداً صحيحاً موجباً");
                      setCodeSaving(false);
                      return;
                    }
                    const res = await fetch(`/api/projects/${id}/code`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ contractNumber: parsed }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setCodeError(data.error || "تعذّر تحديث الرقم");
                      setCodeSaving(false);
                      return;
                    }
                    // Refresh the project so the new code shows up
                    setShowCodeModal(false);
                    setCodeSaving(false);
                    router.refresh();
                    window.location.reload();
                  } catch {
                    setCodeError("حدث خطأ");
                    setCodeSaving(false);
                  }
                }}
              >
                حفظ
              </MarsaButton>
              <MarsaButton variant="secondary" onClick={() => setShowCodeModal(false)} disabled={codeSaving}>
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Celebration modal — image preview + downloads + WhatsApp message */}
      {showCelebrationModal && project.status === "COMPLETED" && (() => {
        const imageUrl = `/api/projects/${id}/celebration/image`;
        const reportUrl = `/api/projects/${id}/celebration/report`;
        const clientName = project.client?.name ?? "العميل الكريم";
        const waMessage = `مرحباً ${clientName}،\nيسعدنا إعلامكم بإكمال مشروع ${project.name} بنجاح ✨\nنرفق لكم:\n- شهادة إنجاز\n- تقرير شامل\nشكراً لثقتكم بمرسى.`;
        const phone = project.client?.phone?.replace(/[^\d]/g, "");
        const waLink = phone
          ? `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`
          : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCelebrationModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                  🎉 احتفالية إنجاز المشروع
                </h3>
                <MarsaButton
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={<X size={20} />}
                  onClick={() => setShowCelebrationModal(false)}
                />
              </div>

              <div className="p-5 space-y-5">
                {/* Image preview */}
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl}
                    alt="بطاقة الاحتفالية"
                    className="w-full h-auto"
                    style={{ aspectRatio: "1200 / 630" }}
                  />
                </div>

                {/* Download buttons */}
                <div className="flex flex-wrap gap-2">
                  <MarsaButton
                    variant="gold"
                    href={imageUrl}
                    {...({ download: `celebration-${project.projectCode || project.id}.png` } as Record<string, unknown>)}
                  >
                    تحميل الصورة
                  </MarsaButton>
                  <MarsaButton variant="secondary" href={reportUrl} {...({ target: "_blank" } as Record<string, unknown>)}>
                    تحميل التقرير
                  </MarsaButton>
                  {waLink && (
                    <MarsaButton variant="secondary" href={waLink} {...({ target: "_blank", rel: "noopener noreferrer" } as Record<string, unknown>)}>
                      فتح في واتساب
                    </MarsaButton>
                  )}
                </div>

                {/* WhatsApp text */}
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>
                    نص جاهز للنسخ
                  </label>
                  <textarea
                    readOnly
                    value={waMessage}
                    rows={6}
                    className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{ borderColor: "#E5E7EB", backgroundColor: "#FAFAFE", lineHeight: 1.7 }}
                  />
                  <div className="flex justify-end mt-2">
                    <MarsaButton
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(waMessage);
                          setWaCopied(true);
                          setTimeout(() => setWaCopied(false), 2000);
                        } catch {
                          /* clipboard blocked — user can select+copy manually */
                        }
                      }}
                    >
                      {waCopied ? "✓ تم النسخ" : "نسخ النص"}
                    </MarsaButton>
                  </div>
                </div>

                {!phone && (
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>
                    لإضافة زر فتح واتساب مباشرة، أضف رقم جوال للعميل في صفحته.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
