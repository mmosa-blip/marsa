"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/contexts/LanguageContext";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  Filter,
  Printer,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TaskRow {
  id: string;
  title: string;
  status: string;
  assigneeName: string;
  projectName: string;
  serviceName: string;
  dueDate: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  waitingDuration: number | null;
  executionDuration: number | null;
  totalDuration: number | null;
  isLate: boolean;
}

interface ExecutorStat {
  userId: string;
  name: string;
  taskCount: number;
  completedCount: number;
  avgExecutionTime: number;
  lateCount: number;
}

interface ServiceStat {
  serviceId: string;
  name: string;
  taskCount: number;
  avgDuration: number;
}

interface ProjectStat {
  projectId: string;
  name: string;
  taskCount: number;
  completedTasks: number;
  totalDuration: number;
}

interface Summary {
  totalTasks: number;
  completedTasks: number;
  lateTasks: number;
  avgWaitingTime: number;
  avgExecutionTime: number;
  avgTotalTime: number;
  byExecutor: ExecutorStat[];
  byService: ServiceStat[];
  byProject: ProjectStat[];
}

interface ReportData {
  tasks: TaskRow[];
  summary: Summary;
}

const formatDuration = (minutes: number | null): string => {
  if (minutes == null || minutes < 0) return "—";
  if (minutes < 1) return "أقل من دقيقة";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} ${days === 1 ? "يوم" : "أيام"}`);
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "ساعة" : "ساعات"}`);
  if (mins > 0 && days === 0) parts.push(`${mins} دقيقة`);
  return parts.join(" ") || "—";
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const COLORS = ["#2563EB", "#059669", "#EA580C", "#7C3AED", "#D97706", "#DC2626", "#0D9488", "#6366F1"];

export default function TimeReportsPage() {
  const { t } = useLang();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [projectId, setProjectId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dropdown options
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [executors, setExecutors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    document.title = `${t.reports.timeReports} | مرسى`;
    // Fetch projects for filter
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProjects(d.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {});
    // Fetch executors
    fetch("/api/users?role=EXECUTOR")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setExecutors(d.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (serviceId) params.set("serviceId", serviceId);
    if (userId) params.set("userId", userId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/reports/time-tracking?${params}`)
      .then((r) => r.json())
      .then((d: ReportData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, serviceId, userId, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const summary = data?.summary;

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w) return;

    const rows = (data?.tasks || []).map((t) => `
      <tr>
        <td>${t.title}</td>
        <td>${t.assigneeName}</td>
        <td>${t.projectName}</td>
        <td>${t.serviceName}</td>
        <td>${formatDate(t.assignedAt)}</td>
        <td>${formatDate(t.startedAt)}</td>
        <td>${formatDate(t.completedAt)}</td>
        <td>${formatDuration(t.waitingDuration)}</td>
        <td>${formatDuration(t.executionDuration)}</td>
        <td>${formatDuration(t.totalDuration)}</td>
        <td style="color:${t.isLate ? "red" : "green"}">${t.isLate ? "متأخرة" : "في الوقت"}</td>
      </tr>
    `).join("");

    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>تقرير تتبع الوقت</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 40px; }
        h1 { color: #1B2A4A; border-bottom: 3px solid #C9A84C; padding-bottom: 10px; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #f8f9fa; padding: 15px 20px; border-radius: 10px; text-align: center; }
        .stat .value { font-size: 24px; font-weight: bold; color: #1B2A4A; }
        .stat .label { font-size: 12px; color: #666; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
        th { background: #1B2A4A; color: white; }
        tr:nth-child(even) { background: #f9f9f9; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <h1>تقرير تتبع الوقت</h1>
      <div class="stats">
        <div class="stat"><div class="value">${summary?.totalTasks || 0}</div><div class="label">إجمالي المهام</div></div>
        <div class="stat"><div class="value">${summary?.completedTasks || 0}</div><div class="label">مكتملة</div></div>
        <div class="stat"><div class="value">${summary?.lateTasks || 0}</div><div class="label">متأخرة</div></div>
        <div class="stat"><div class="value">${formatDuration(summary?.avgExecutionTime || 0)}</div><div class="label">متوسط وقت التنفيذ</div></div>
      </div>
      <table>
        <thead><tr>
          <th>المهمة</th><th>المنفذ</th><th>المشروع</th><th>الخدمة</th>
          <th>تاريخ الإسناد</th><th>تاريخ البدء</th><th>تاريخ الإكمال</th>
          <th>وقت الانتظار</th><th>وقت التنفيذ</th><th>الوقت الكلي</th><th>الحالة</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:center;color:#999;margin-top:30px;font-size:11px;">تم إنشاء التقرير بواسطة نظام مرسى - ${new Date().toLocaleDateString("ar-SA-u-nu-latn")}</p>
    </body></html>`);
    w.document.close();
    w.print();
  };

  const statCards = summary
    ? [
        { label: t.reports.totalTime, value: summary.totalTasks, icon: ListChecks, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
        { label: t.reports.completedCount, value: summary.completedTasks, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.06)" },
        { label: t.reports.lateCount, value: summary.lateTasks, icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.06)" },
        { label: t.reports.executionTime, value: formatDuration(summary.avgExecutionTime), icon: Clock, color: "#EA580C", bg: "rgba(234,88,12,0.06)", isText: true },
      ]
    : [];

  const chartData = (summary?.byExecutor || []).map((e) => ({
    name: e.name.length > 12 ? e.name.slice(0, 12) + "..." : e.name,
    avgTime: e.avgExecutionTime,
    tasks: e.taskCount,
    late: e.lateCount,
  }));

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{t.reports.timeReports}</h1>
          <BarChart3 size={24} style={{ color: "#C9A84C" }} />
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#5E5495" }}
        >
          <Printer size={16} />
          طباعة التقرير
        </button>
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">{t.reports.filterByProject}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">{t.reports.filterByExecutor}</option>
          {executors.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white cursor-pointer"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            title="من تاريخ"
          />
          <span className="text-xs" style={{ color: "#94A3B8" }}>إلى</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white cursor-pointer"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
            title="إلى تاريخ"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
        </div>
      ) : !data ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <p className="text-lg" style={{ color: "#2D3748" }}>لا توجد بيانات</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((s, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>
                    {s.label}
                  </span>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: s.bg }}
                  >
                    <s.icon size={20} style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>
                  {"isText" in s ? String(s.value) : Number(s.value).toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>

          {/* Executor Performance Chart */}
          {chartData.length > 0 && (
            <div
              className="bg-white rounded-2xl p-6 mb-8"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <h2 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
                {t.reports.executorPerformance}
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ right: 20, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E6F0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip
                    formatter={(value) => [formatDuration(Number(value)), "متوسط التنفيذ"]}
                    contentStyle={{ direction: "rtl", borderRadius: 12, border: "1px solid #E2E0D8" }}
                  />
                  <Bar dataKey="avgTime" radius={[0, 6, 6, 0]} maxBarSize={32}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Executors Table */}
          {summary && summary.byExecutor.length > 0 && (
            <div
              className="bg-white rounded-2xl overflow-hidden mb-8"
              style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              <div className="p-5 border-b" style={{ borderColor: "#E8E6F0" }}>
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>إحصائيات المنفذين</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                      <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المنفذ</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المهام</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>مكتملة</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>متأخرة</th>
                      <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>متوسط التنفيذ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byExecutor.map((e) => (
                      <tr key={e.userId} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                        <td className="px-5 py-4 text-sm font-semibold" style={{ color: "#1C1B2E" }}>{e.name}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: "#2D3748" }}>{e.taskCount}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: "#059669" }}>{e.completedCount}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: e.lateCount > 0 ? "#DC2626" : "#2D3748" }}>{e.lateCount}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: "#EA580C" }}>{formatDuration(e.avgExecutionTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tasks Table */}
          <div
            className="bg-white rounded-2xl overflow-hidden"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="p-5 border-b" style={{ borderColor: "#E8E6F0" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تفاصيل المهام</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المهمة</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المنفذ</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المشروع</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الخدمة</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الاستحقاق</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.reports.waitingTime}</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.reports.executionTime}</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الكلي</th>
                    <th className="text-right px-4 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map((t) => (
                    <tr key={t.id} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>{t.title}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#2D3748" }}>{t.assigneeName}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#2D3748" }}>{t.projectName}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#2D3748" }}>{t.serviceName}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#2D3748" }}>{formatDate(t.dueDate)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#94A3B8" }}>{formatDuration(t.waitingDuration)}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#EA580C" }}>{formatDuration(t.executionDuration)}</td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#1C1B2E" }}>{formatDuration(t.totalDuration)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: t.isLate ? "#FEF2F2" : t.completedAt ? "#ECFDF5" : "#F1F5F9",
                            color: t.isLate ? "#DC2626" : t.completedAt ? "#059669" : "#94A3B8",
                          }}
                        >
                          {t.isLate ? "متأخرة" : t.completedAt ? "في الوقت" : "جارية"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
