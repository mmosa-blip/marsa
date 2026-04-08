"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Activity,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Pause,
  TrendingUp,
  Loader2,
  Calendar,
  CreditCard,
  User,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ExpiringContractsWidget from "@/components/ExpiringContractsWidget";

interface ProjectHealth {
  id: string;
  name: string;
  projectCode: string | null;
  client: string;
  status: string;
  statusLabel: string;
  progress: number;
  health: number;
  healthLabel: string;
  healthColor: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  paymentRate: number;
  overduePayments: number;
  daysRemaining: number | null;
}

interface DeptHealth {
  department: { id: string; name: string; color: string | null };
  stats: {
    totalProjects: number;
    completed: number;
    active: number;
    delayed: number;
    onHold: number;
    avgHealth: number;
    healthLabel: string;
    healthColor: string;
  };
  projects: ProjectHealth[];
}

export default function DepartmentHealthPage() {
  const params = useParams();
  const deptId = params.deptId as string;

  const [data, setData] = useState<DeptHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`/api/departments/${deptId}/health`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (d.department) {
          setData(d);
        } else {
          setErrorMsg(d.error || "بيانات غير صالحة");
        }
        setLoading(false);
      })
      .catch((err) => {
        setErrorMsg(`خطأ في تحميل البيانات: ${err.message}`);
        setLoading(false);
      });
  }, [deptId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <p className="text-lg font-bold mb-2" style={{ color: "#DC2626" }}>
          {errorMsg || "القسم غير موجود"}
        </p>
        <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
          معرف القسم: {deptId}
        </p>
        <MarsaButton href="/dashboard/departments" variant="primary" size="md">
          العودة للأقسام
        </MarsaButton>
      </div>
    );
  }

  const { department, stats, projects } = data;

  const filtered = filter
    ? projects.filter((p) => p.healthLabel === filter)
    : projects;

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <MarsaButton href="/dashboard/departments" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: department.color || "#5E5495" }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>صحة مشاريع {department.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>نظرة عامة على أداء المشاريع</p>
          </div>
        </div>
      </div>

      {/* Overall Health Score */}
      <div
        className="rounded-2xl p-6 mb-6 flex items-center gap-6"
        style={{ backgroundColor: `${stats.healthColor}08`, border: `1px solid ${stats.healthColor}25` }}
      >
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
          style={{ backgroundColor: `${stats.healthColor}15`, color: stats.healthColor }}
        >
          {stats.avgHealth}%
        </div>
        <div>
          <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>الصحة العامة: {stats.healthLabel}</p>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            بناءً على: نسبة إنجاز المهام • الالتزام بالمواعيد • تحصيل المدفوعات
          </p>
        </div>
        <Activity size={32} className="mr-auto" style={{ color: stats.healthColor, opacity: 0.5 }} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "إجمالي", value: stats.totalProjects, icon: FolderKanban, color: "#5E5495" },
          { label: "جاري", value: stats.active, icon: Clock, color: "#2563EB" },
          { label: "مكتمل", value: stats.completed, icon: CheckCircle2, color: "#059669" },
          { label: "متأخر", value: stats.delayed, icon: AlertTriangle, color: "#DC2626" },
          { label: "معلق", value: stats.onHold, icon: Pause, color: "#EA580C" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl p-4 text-center" style={{ border: "1px solid #E2E0D8" }}>
              <Icon size={18} className="mx-auto mb-2" style={{ color: s.color }} />
              <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] font-medium" style={{ color: "#9CA3AF" }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Expiring Contracts Widget */}
      <div className="mb-6">
        <ExpiringContractsWidget departmentId={deptId} days={30} />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        {["", "يحتاج متابعة", "جيد", "ممتاز"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={
              filter === f
                ? { backgroundColor: "#5E5495", color: "#C9A84C" }
                : { backgroundColor: "#FFF", color: "#6B7280", border: "1px solid #E2E0D8" }
            }
          >
            {f || "الكل"}
          </button>
        ))}
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>لا توجد مشاريع مطابقة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <div
                className="bg-white rounded-2xl p-5 transition-all hover:shadow-md cursor-pointer"
                style={{ border: "1px solid #E2E0D8" }}
              >
                <div className="flex items-start gap-4">
                  {/* Health score */}
                  <div
                    className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
                    style={{ backgroundColor: `${project.healthColor}12` }}
                  >
                    <span className="text-lg font-bold" style={{ color: project.healthColor }}>{project.health}%</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>{project.name}</p>
                      {project.projectCode && (
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495", border: "1px solid rgba(94,84,149,0.18)" }}>
                          {project.projectCode}
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                        style={{ backgroundColor: `${project.healthColor}12`, color: project.healthColor }}
                      >
                        {project.healthLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs" style={{ color: "#6B7280" }}>
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {project.client}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {project.doneTasks}/{project.totalTasks} مهمة
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard size={12} />
                        {project.paymentRate}% تحصيل
                      </span>
                      {project.daysRemaining !== null && (
                        <span className="flex items-center gap-1" style={{ color: project.daysRemaining < 0 ? "#DC2626" : "#6B7280" }}>
                          <Calendar size={12} />
                          {project.daysRemaining < 0 ? `متأخر ${Math.abs(project.daysRemaining)} يوم` : `${project.daysRemaining} يوم متبقي`}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{ width: `${project.progress}%`, backgroundColor: project.healthColor }}
                        />
                      </div>
                    </div>

                    {/* Warnings */}
                    {(project.overdueTasks > 0 || project.overduePayments > 0) && (
                      <div className="flex items-center gap-3 mt-2">
                        {project.overdueTasks > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
                            {project.overdueTasks} مهام متأخرة
                          </span>
                        )}
                        {project.overduePayments > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(234,88,12,0.08)", color: "#EA580C" }}>
                            {project.overduePayments} دفعات متأخرة
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
