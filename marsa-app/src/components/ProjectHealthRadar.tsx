"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  ChevronLeft,
  Trophy,
  Zap,
  Star,
  Layers,
} from "lucide-react";

interface ProjectHealth {
  id: string;
  name: string;
  clientName: string;
  status: string;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  overdueTasks: number;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractDurationDays: number | null;
  daysElapsed: number;
  daysRemaining: number;
  taskProgress: number;
  timeProgress: number;
  healthScore: number;
  healthStatus: "GREEN" | "AMBER" | "RED";
  healthLabel: string;
  currentServiceName: string | null;
  currentServiceProgress: number | null;
  allServicesDone: boolean;
}

const RAG_CONFIG = {
  GREEN: {
    color: "#059669",
    bg: "#ECFDF5",
    border: "#A7F3D0",
    icon: CheckCircle2,
    emoji: "🚀",
    motivational: "أداء ممتاز! استمر بنفس الوتيرة",
  },
  AMBER: {
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    icon: AlertTriangle,
    emoji: "⚡",
    motivational: "قريب من الهدف، ركّز على المهام المتأخرة",
  },
  RED: {
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FCA5A5",
    icon: XCircle,
    emoji: "🔥",
    motivational: "تحتاج تسريع! تواصل مع المدير إذا لزم الأمر",
  },
};

function CircularProgress({
  value,
  size = 120,
  strokeWidth = 10,
  color,
  bgColor = "#F0EEF5",
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  bgColor?: string;
  label: string;
  sublabel?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold" style={{ color }}>{value}%</span>
        {sublabel && <span className="text-[10px]" style={{ color: "#6B7280" }}>{sublabel}</span>}
      </div>
      <p className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</p>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectHealth }) {
  const config = RAG_CONFIG[project.healthStatus];
  const StatusIcon = config.icon;

  return (
    <Link href={`/dashboard/my-projects/${project.id}`}>
      <div
        className="rounded-2xl p-5 transition-all duration-300 cursor-pointer"
        style={{
          backgroundColor: "white",
          border: `1px solid ${config.border}`,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.1)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{config.emoji}</span>
              <h3 className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                {project.name}
              </h3>
            </div>
            {project.clientName && (
              <p className="text-xs" style={{ color: "#6B7280" }}>{project.clientName}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: config.bg, color: config.color }}
            >
              <StatusIcon size={12} />
              {project.healthLabel}
            </span>
            <ChevronLeft size={16} style={{ color: "#CBD5E1" }} />
          </div>
        </div>

        {/* Health Score Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium" style={{ color: "#6B7280" }}>صحة المشروع</span>
            <span className="text-sm font-bold" style={{ color: config.color }}>{project.healthScore}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${project.healthScore}%`,
                background: `linear-gradient(90deg, ${config.color}, ${config.color}88)`,
              }}
            />
          </div>
        </div>

        {/* Metrics Grid — RTL order: متأخرة | لم تبدأ | قيد التنفيذ | مكتملة */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: project.overdueTasks > 0 ? "#FEF2F2" : "#F0EEF5" }}>
            <p className="text-lg font-bold" style={{ color: project.overdueTasks > 0 ? "#DC2626" : "#6B7280" }}>{project.overdueTasks}</p>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>متأخرة</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: project.notStartedTasks > 0 ? "#FEF3C7" : "#F0EEF5" }}>
            <p className="text-lg font-bold" style={{ color: project.notStartedTasks > 0 ? "#B45309" : "#6B7280" }}>{project.notStartedTasks}</p>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>لم تبدأ</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: "#DBEAFE" }}>
            <p className="text-lg font-bold" style={{ color: "#2563EB" }}>{project.inProgressTasks}</p>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>قيد التنفيذ</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: "#DCFCE7" }}>
            <p className="text-lg font-bold" style={{ color: "#059669" }}>{project.doneTasks}</p>
            <p className="text-[10px]" style={{ color: "#6B7280" }}>مكتملة</p>
          </div>
        </div>

        {/* Progress Comparison */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px]" style={{ color: "#6B7280" }}>تقدم المهام</span>
              <span className="text-[11px] font-bold" style={{ color: "#5E5495" }}>{project.taskProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
              <div className="h-full rounded-full" style={{ width: `${project.taskProgress}%`, backgroundColor: "#5E5495" }} />
            </div>
          </div>

          {/* Current Service */}
          {project.allServicesDone ? (
            <div className="flex items-center gap-1.5 py-1">
              <CheckCircle2 size={13} style={{ color: "#059669" }} />
              <span className="text-[11px] font-semibold" style={{ color: "#059669" }}>جميع الخدمات مكتملة</span>
            </div>
          ) : project.currentServiceName ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} style={{ color: config.color }} />
                  <span className="text-[11px]" style={{ color: "#6B7280" }}>
                    الخدمة الحالية: <span className="font-semibold" style={{ color: config.color }}>{project.currentServiceName}</span>
                  </span>
                </div>
                <span className="text-[11px] font-bold" style={{ color: config.color }}>{project.currentServiceProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${project.currentServiceProgress}%`, backgroundColor: config.color }} />
              </div>
            </div>
          ) : null}

          {project.contractDurationDays && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px]" style={{ color: "#6B7280" }}>الوقت المنقضي</span>
                <span className="text-[11px] font-bold" style={{ color: "#C9A84C" }}>{project.timeProgress}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                <div className="h-full rounded-full" style={{ width: `${project.timeProgress}%`, backgroundColor: "#C9A84C" }} />
              </div>
            </div>
          )}
        </div>

        {/* SLA Info — days remaining from contractEndDate */}
        {project.daysRemaining != null && (
          <div
            className="mt-3 flex items-center gap-2 text-xs"
            style={{ color: project.daysRemaining <= 0 ? "#DC2626" : "#6B7280" }}
          >
            <Clock size={12} />
            <span>
              {project.daysRemaining <= 0
                ? `تجاوز الموعد`
                : `متبقي ${project.daysRemaining} يوم`}
            </span>
          </div>
        )}
        {/* Late tasks count from dueDate */}
        {project.overdueTasks > 0 && (
          <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "#DC2626" }}>
            <AlertTriangle size={12} />
            <span>{project.overdueTasks} مهام متأخرة</span>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ProjectHealthRadar({ compact = false }: { compact?: boolean }) {
  const [projects, setProjects] = useState<ProjectHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/my-projects/health")
      .then((r) => {
        console.log("[health] response status:", r.status);
        return r.json();
      })
      .then((data) => {
        console.log("[health] data:", data);
        if (Array.isArray(data)) setProjects(data);
      })
      .catch((err) => {
        console.error("[health] fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={28} style={{ color: "#5E5495" }} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
        <Target size={40} className="mx-auto mb-3" style={{ color: "#C9A84C", opacity: 0.5 }} />
        <h3 className="text-base font-semibold mb-1" style={{ color: "#2D3748" }}>لا توجد مشاريع نشطة</h3>
        <p className="text-sm" style={{ color: "#6B7280" }}>ستظهر صحة مشاريعك هنا بمجرد إسناد مهام إليك</p>
      </div>
    );
  }

  // Summary stats
  const totalProjects = projects.length;
  const greenCount = projects.filter((p) => p.healthStatus === "GREEN").length;
  const amberCount = projects.filter((p) => p.healthStatus === "AMBER").length;
  const redCount = projects.filter((p) => p.healthStatus === "RED").length;
  const avgScore = Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / totalProjects);

  // Overall status
  const overallStatus = redCount > 0 ? "RED" : amberCount > 0 ? "AMBER" : "GREEN";
  const overallConfig = RAG_CONFIG[overallStatus];

  // Motivational message based on score
  let motivationalMsg = "";
  let motivationalIcon = Star;
  if (avgScore >= 80) {
    motivationalMsg = "أداء استثنائي! أنت نجم الفريق";
    motivationalIcon = Trophy;
  } else if (avgScore >= 60) {
    motivationalMsg = "أداء جيد، خطوة واحدة للوصول للقمة";
    motivationalIcon = TrendingUp;
  } else if (avgScore >= 40) {
    motivationalMsg = "لا تستسلم! ركّز على المهام الأهم أولاً";
    motivationalIcon = Zap;
  } else {
    motivationalMsg = "وقت المضاعفة! تواصل مع مديرك للمساعدة";
    motivationalIcon = Flame;
  }

  const MotivIcon = motivationalIcon;

  const displayProjects = compact ? projects.slice(0, 3) : projects;

  return (
    <div dir="rtl">
      {/* Summary Header */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{
          background: `linear-gradient(135deg, ${overallConfig.bg}, white)`,
          border: `1px solid ${overallConfig.border}`,
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: overallConfig.color + "15" }}
            >
              <Target size={24} style={{ color: overallConfig.color }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>رادار صحة المشاريع</h2>
              <p className="text-xs" style={{ color: "#6B7280" }}>{totalProjects} مشاريع نشطة</p>
            </div>
          </div>
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center">
              <svg width={80} height={80} className="transform -rotate-90">
                <circle cx={40} cy={40} r={32} fill="none" stroke="#F0EEF5" strokeWidth={8} />
                <circle
                  cx={40} cy={40} r={32} fill="none"
                  stroke={overallConfig.color}
                  strokeWidth={8}
                  strokeDasharray={2 * Math.PI * 32}
                  strokeDashoffset={2 * Math.PI * 32 * (1 - avgScore / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="absolute text-lg font-bold" style={{ color: overallConfig.color }}>{avgScore}</span>
            </div>
            <p className="text-[10px] mt-1" style={{ color: "#6B7280" }}>المعدل العام</p>
          </div>
        </div>

        {/* Motivational Banner */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ backgroundColor: overallConfig.color + "10", border: `1px solid ${overallConfig.color}20` }}
        >
          <MotivIcon size={20} style={{ color: overallConfig.color }} />
          <p className="text-sm font-medium" style={{ color: overallConfig.color }}>{motivationalMsg}</p>
        </div>

        {/* RAG Summary Pills */}
        <div className="flex items-center gap-3 mt-4">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
            <CheckCircle2 size={12} /> {greenCount} على المسار
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>
            <AlertTriangle size={12} /> {amberCount} تحتاج انتباه
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            <XCircle size={12} /> {redCount} متأخرة
          </span>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {/* View All Link (compact mode) */}
      {compact && projects.length > 3 && (
        <div className="mt-4 text-center">
          <Link
            href="/dashboard/my-health"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: "#5E5495", color: "white" }}
          >
            عرض جميع المشاريع ({projects.length})
            <ChevronLeft size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
