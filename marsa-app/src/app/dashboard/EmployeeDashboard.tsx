"use client";

import { useEffect, useState } from "react";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from "lucide-react";

/* ───────── types ───────── */

interface ActivityItem {
  id: string;
  taskTitle: string;
  projectName?: string;
  status: string;
  createdAt: string;
}

interface EmployeeDashboardProps {
  data: Record<string, unknown>;
  userName: string;
}

/* ───────── config maps ───────── */

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  TODO:        { label: "جديدة",        color: "#CA8A04", bg: "#FEF9C3" },
  WAITING:     { label: "في الانتظار",  color: "#EA580C", bg: "#FFF7ED" },
  IN_PROGRESS: { label: "قيد التنفيذ",  color: "#2563EB", bg: "#DBEAFE" },
  IN_REVIEW:   { label: "قيد المراجعة", color: "#D97706", bg: "#FEF3C7" },
  DONE:        { label: "مكتملة",       color: "#16A34A", bg: "#DCFCE7" },
  CANCELLED:   { label: "ملغاة",        color: "#DC2626", bg: "#FEE2E2" },
};

/* ───────── helpers ───────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

/* ───────── component ───────── */

export default function EmployeeDashboard({ data, userName }: EmployeeDashboardProps) {
  /* ── extract data ── */
  const stats = (data.stats ?? {}) as {
    totalAssigned: number;
    inProgress: number;
    inReview: number;
    completedThisMonth: number;
  };

  const recentActivity = (data.recentActivity ?? []) as ActivityItem[];

  /* ── fetch overdue count ── */
  const [overdueCount, setOverdueCount] = useState(0);
  useEffect(() => {
    fetch("/api/my-tasks/all?time=overdue&limit=1")
      .then((r) => r.json())
      .then((d) => setOverdueCount(d.total ?? 0))
      .catch(() => {});
  }, []);

  /* ── stat cards config ── */
  const statCards = [
    {
      label: "المهام المسندة",
      value: stats.totalAssigned,
      icon: ClipboardList,
      gradient: "linear-gradient(135deg, #1B2A4A 0%, #2D4A7A 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
    {
      label: "قيد التنفيذ",
      value: stats.inProgress,
      icon: Loader2,
      gradient: "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
    {
      label: "مهام متأخرة",
      value: overdueCount,
      icon: AlertTriangle,
      gradient: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
    {
      label: "مكتملة هذا الشهر",
      value: stats.completedThisMonth,
      icon: CheckCircle2,
      gradient: "linear-gradient(135deg, #15803D 0%, #22C55E 100%)",
      iconBg: "rgba(255,255,255,0.15)",
    },
  ];

  /* ── render ── */
  return (
    <div className="min-h-screen p-6 md:p-8" style={{ backgroundColor: "#F8F9FA" }} dir="rtl">
      {/* ─── Welcome Header ─── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
          مرحباً {userName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          {new Date().toLocaleDateString("ar-SA-u-nu-latn", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* ─── Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-5 text-white shadow-md"
            style={{ background: card.gradient }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.iconBg }}
              >
                <card.icon size={20} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold">
              {(card.value ?? 0).toLocaleString("en-US")}
            </p>
            <p className="text-sm mt-1 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ─── Recent Activity ─── */}
      {recentActivity.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Activity size={20} style={{ color: "#C9A84C" }} />
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              آخر النشاطات
            </h2>
          </div>

          <div className="divide-y divide-gray-50">
            {recentActivity.map((item, idx) => {
              const activityStatus = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.TODO;
              return (
                <div
                  key={item.id ?? idx}
                  className="px-6 py-4 flex items-center gap-3 hover:bg-gray-50/50 transition-colors"
                >
                  {/* Status dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: activityStatus.color }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>
                      {item.taskTitle}
                    </p>
                    {item.projectName && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.projectName}</p>
                    )}
                  </div>

                  {/* Time ago */}
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {timeAgo(item.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
