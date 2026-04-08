"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Calendar,
  User,
  ChevronLeft,
  ArrowDown,
  ArrowLeftRight,
  Package,
  DollarSign,
  Search,
  Filter,
  Download,
  Trash2,
  Timer,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import { useLang } from "@/contexts/LanguageContext";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ProjectCodeBadge from "@/components/ProjectCodeBadge";

interface Project {
  id: string;
  name: string;
  projectCode: string | null;
  status: string;
  priority: string;
  workflowType: string;
  totalPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractDurationDays: number | null;
  client: { id: string; name: string };
  manager: { id: string; name: string } | null;
  departmentId?: string | null;
  department?: { id: string; name: string; nameEn?: string; color: string | null } | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  _count?: { services: number };
  isQuickService?: boolean;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  DRAFT: { bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { bg: "#ECFDF5", text: "#059669" },
  ON_HOLD: { bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { bg: "#FEF2F2", text: "#DC2626" },
};

const priorityColors: Record<string, string> = {
  LOW: "#94A3B8",
  MEDIUM: "#C9A84C",
  HIGH: "#EA580C",
  URGENT: "#DC2626",
};

export default function ProjectsPage() {
  const { data: session, status: authStatus } = useSession();
  const { t } = useLang();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [departments, setDepartments] = useState<{id:string;name:string}[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { document.title = "المشاريع | مرسى"; }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchProjects();
      fetch("/api/departments").then(r => r.json()).then(d => { if (Array.isArray(d)) setDepartments(d); }).catch(() => {});
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDept]);

  if (authStatus === "loading") return null;
  if (!session) redirect("/auth/login");

  function fetchProjects() {
    const params = new URLSearchParams();
    if (filterDept) params.set("departmentId", filterDept);
    const qs = params.toString();
    fetch(`/api/projects${qs ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((data) => { setProjects(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const filteredProjects = projects.filter((p) => {
    if (searchQuery && !p.name.includes(searchQuery) && !p.client?.name.includes(searchQuery)) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    if (clientFilter && p.client?.id !== clientFilter) return false;
    if (typeFilter === "quick" && !p.isQuickService) return false;
    if (typeFilter === "project" && p.isQuickService) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const uniqueClients = Array.from(new Map(projects.map(p => [p.client?.id, p.client])).values()).filter(Boolean);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{t.projects.title}</h1>
          <p className="text-sm mt-1 text-gray-500">{t.projects.subtitle}</p>
        </div>
        <MarsaButton href="/dashboard/projects/new" variant="primary" size="lg" icon={<Plus size={18} />}>
          {t.projects.new}
        </MarsaButton>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <MarsaButton
          variant="primary"
          icon={<Download size={16} />}
          onClick={() => {
            const headers = [
              { key: "name", label: t.projects.projectName },
              { key: "client", label: t.projects.client },
              { key: "status", label: t.common.status },
              { key: "progress", label: `${t.projects.progress} %` },
              { key: "startDate", label: t.projects.startDate },
              { key: "endDate", label: t.projects.endDate },
            ];
            const rows = filteredProjects.map((p) => ({
              name: p.name,
              client: p.client?.name || "—",
              status: (t.projects.status as Record<string, string>)[p.status] || p.status,
              progress: p.progress,
              startDate: formatDate(p.startDate),
              endDate: formatDate(p.endDate),
            }));
            exportToExcel(rows, headers, "projects");
          }}
        >
          {`${t.common.download} Excel`}
        </MarsaButton>
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`${t.common.search}...`}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="">{t.projects.allStatuses}</option>
          {Object.entries(statusColors).map(([k]) => <option key={k} value={k}>{(t.projects.status as Record<string, string>)[k] || k}</option>)}
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
        >
          <option value="">{t.common.all}</option>
          {uniqueClients.map((c) => c && <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white"
          style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
        >
          <option value="">كل الأنواع</option>
          <option value="project">مشاريع</option>
          <option value="quick">طلبات خدمات</option>
        </select>
        <select
          value={filterDept}
          onChange={(e) => { setFilterDept(e.target.value); }}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
          style={{ border: "1px solid #E2E0D8" }}
        >
          <option value="">جميع الأقسام</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban size={56} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>{t.projects.noProjects}</p>
          <p className="text-sm mt-1 mb-6 text-gray-400">{t.projects.noProjectsDesc}</p>
          <MarsaButton href="/dashboard/projects/new" variant="primary" size="lg" icon={<Plus size={18} />}>
            {t.projects.new}
          </MarsaButton>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => {
            const stColors = statusColors[project.status] || statusColors.DRAFT;
            const prColor = priorityColors[project.priority] || priorityColors.MEDIUM;
            const stLabel = (t.projects.status as Record<string, string>)[project.status] || project.status;
            const prLabel = (t.projects.priority as Record<string, string>)[project.priority] || project.priority;
            return (
              <div key={project.id} className="relative group">
              <Link
                href={`/dashboard/projects/${project.id}`}
                className="block bg-white rounded-2xl p-6 transition-all duration-200 hover:-translate-y-0.5"
                style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 25px rgba(27,42,74,0.1)"; e.currentTarget.style.borderColor = "#C9A84C"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)"; e.currentTarget.style.borderColor = "#E8E6F0"; }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(27,42,74,0.06)" }}>
                      <FolderKanban size={20} style={{ color: "#1C1B2E" }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold" style={{ color: "#1C1B2E" }}>{project.name}</h3>
                        <ProjectCodeBadge code={project.projectCode} size="xs" />
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: stColors.bg, color: stColors.text }}>
                          {stLabel}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: prColor }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: prColor }} />
                          {prLabel}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          {project.workflowType === "SEQUENTIAL" ? <ArrowDown size={12} /> : <ArrowLeftRight size={12} />}
                          {project.workflowType === "SEQUENTIAL" ? t.projects.sequential : t.projects.independent}
                        </span>
                        {project.isQuickService && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>خدمة سريعة</span>
                        )}
                        {project.department && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: `${project.department.color}15`, color: project.department.color || "#5E5495" }}>
                            {project.department.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronLeft size={20} style={{ color: "#CBD5E1" }} />
                </div>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{t.projects.achievement}</span>
                    <span className="font-semibold" style={{ color: "#1C1B2E" }}>{project.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${project.progress}%`,
                        background: project.progress === 100 ? "#22C55E" : "linear-gradient(90deg, #1B2A4A, #C9A84C)",
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Info */}
                <div className="flex items-center gap-6 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <User size={13} />
                    {project.client?.name || "—"}
                  </span>
                  {project._count?.services !== undefined && (
                    <span className="flex items-center gap-1">
                      <Package size={13} />
                      {project._count.services} {t.projects.services}
                    </span>
                  )}
                  {project.totalPrice && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={13} />
                      {project.totalPrice.toLocaleString("en-US")} {t.common.currency}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={13} />
                    {formatDate(project.startDate)}
                  </span>
                  <span>{project.completedTasks}/{project.totalTasks} {t.projects.tasks}</span>
                  {project.contractDurationDays && (
                    <span className="flex items-center gap-1">
                      <Timer size={13} />
                      {project.contractDurationDays} يوم SLA
                    </span>
                  )}
                </div>
              </Link>
              {confirmId === project.id ? (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg z-10" style={{ border: "1px solid #FCA5A5" }}>
                  <span className="text-xs font-medium" style={{ color: "#DC2626" }}>{t.common.confirmDelete}</span>
                  <MarsaButton variant="danger" size="xs" onClick={() => handleDelete(project.id)} disabled={deletingId === project.id}>
                    {deletingId === project.id ? "..." : t.common.yes}
                  </MarsaButton>
                  <MarsaButton variant="secondary" size="xs" onClick={() => setConfirmId(null)}>
                    {t.common.no}
                  </MarsaButton>
                </div>
              ) : (
                <MarsaButton variant="dangerSoft" size="sm" iconOnly icon={<Trash2 size={15} />}
                  className="absolute top-4 left-4 hidden group-hover:flex"
                  onClick={(e) => { e.preventDefault(); setConfirmId(project.id); }}
                />
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
