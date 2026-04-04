"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Users2,
  CheckCircle,
  Clock,
  XCircle,
  FolderKanban,
  Calendar,
  Download,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import SarSymbol from "@/components/SarSymbol";

// ===== Types =====

interface FinancialData {
  revenue: { month: string; total: number }[];
  expenses: { name: string; total: number }[];
  profitability: {
    id: string;
    name: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
  }[];
  receivables: {
    id: string;
    invoiceNumber: string;
    clientName: string;
    totalAmount: number;
    daysOverdue: number;
    agingBucket: string;
  }[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    overdueAmount: number;
  };
}

interface PerformanceData {
  executors: {
    id: string;
    name: string;
    role: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    rejectedTasks: number;
    avgCompletionDays: number;
    completionRate: number;
  }[];
  taskEfficiency: { onTime: number; late: number; total: number };
}

interface ProjectsData {
  projects: {
    id: string;
    name: string;
    status: string;
    client: string;
    startDate: string | null;
    endDate: string | null;
    totalTasks: number;
    completedTasks: number;
    progress: number;
    priority: string;
  }[];
  statusDistribution: Record<string, number>;
  timeline: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    progress: number;
    status: string;
  }[];
}

// ===== Helpers =====

const formatDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const formatAmount = (n: number) => n.toLocaleString("en-US");

const statusLabels: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#DBEAFE", text: "#2563EB" },
  ON_HOLD: { label: "معلق", bg: "#FEF3C7", text: "#D97706" },
  COMPLETED: { label: "مكتمل", bg: "#D1FAE5", text: "#059669" },
  CANCELLED: { label: "ملغي", bg: "#FEE2E2", text: "#DC2626" },
};

const priorityLabels: Record<string, { label: string; bg: string; text: string }> = {
  LOW: { label: "منخفض", bg: "#F3F4F6", text: "#6B7280" },
  MEDIUM: { label: "متوسط", bg: "#DBEAFE", text: "#2563EB" },
  HIGH: { label: "عالي", bg: "#FEF3C7", text: "#D97706" },
  URGENT: { label: "عاجل", bg: "#FEE2E2", text: "#DC2626" },
};

const roleLabels: Record<string, string> = {
  EXECUTOR: "منفذ",
  EXTERNAL_PROVIDER: "مقدم خدمة خارجي",
};

// ===== Component =====

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<"financial" | "performance" | "projects">("financial");
  const [loading, setLoading] = useState(false);

  // Date range - default last 6 months
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const [fromDate, setFromDate] = useState(sixMonthsAgo.toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(now.toISOString().slice(0, 10));

  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsData | null>(null);

  useEffect(() => { document.title = "التقارير | مرسى"; }, []);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams({ from: fromDate, to: toDate });

    if (activeTab === "financial") {
      fetch(`/api/reports/financial?${params}`)
        .then((r) => r.json())
        .then((d) => { if (d.summary) setFinancialData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (activeTab === "performance") {
      fetch(`/api/reports/performance?${params}`)
        .then((r) => r.json())
        .then((d) => { if (d.executors) setPerformanceData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/reports/projects?${params}`)
        .then((r) => r.json())
        .then((d) => { if (d.projects) setProjectsData(d); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const tabs = [
    { key: "financial" as const, label: "التقارير المالية" },
    { key: "performance" as const, label: "تقارير الأداء" },
    { key: "projects" as const, label: "تقارير المشاريع" },
  ];

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
        >
          <BarChart3 size={24} style={{ color: "#C9A84C" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            التقارير والإحصائيات
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            عرض وتحليل البيانات المالية والأداء والمشاريع
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div
        className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-4 flex-wrap"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <Calendar size={18} style={{ color: "#94A3B8" }} />
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: "#2D3748" }}>من:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: "#2D3748" }}>إلى:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
          />
        </div>
        <button
          onClick={fetchData}
          className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg"
          style={{ backgroundColor: "#C9A84C", boxShadow: "0 4px 12px rgba(201,168,76,0.25)" }}
        >
          تطبيق
        </button>
      </div>

      {/* Tabs */}
      <div
        className="bg-white rounded-2xl p-1.5 mb-6 flex gap-1"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={
              activeTab === tab.key
                ? { backgroundColor: "#5E5495", color: "#C9A84C" }
                : { color: "#2D3748", opacity: 0.6 }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
        </div>
      ) : (
        <>
          {activeTab === "financial" && financialData && (
            <FinancialTab data={financialData} />
          )}
          {activeTab === "performance" && performanceData && (
            <PerformanceTab data={performanceData} />
          )}
          {activeTab === "projects" && projectsData && (
            <ProjectsTab data={projectsData} />
          )}
        </>
      )}
    </div>
  );
}

// ===== Financial Tab =====

function FinancialTab({ data }: { data: FinancialData }) {
  const { summary, revenue, expenses, profitability, receivables } = data;

  const handleExportFinancial = () => {
    const headers = [
      { key: "name", label: "المشروع" },
      { key: "revenue", label: "الإيرادات" },
      { key: "expenses", label: "المصروفات" },
      { key: "profit", label: "الربح" },
      { key: "margin", label: "هامش الربح %" },
    ];
    const rows = profitability.map((p) => ({
      name: p.name,
      revenue: p.revenue,
      expenses: p.expenses,
      profit: p.profit,
      margin: p.margin,
    }));
    exportToExcel(rows, headers, "financial-report");
  };

  const summaryCards = [
    { label: "إجمالي الإيرادات", value: formatAmount(summary.totalRevenue), icon: TrendingUp, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "إجمالي المصروفات", value: formatAmount(summary.totalExpenses), icon: TrendingDown, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
    { label: "صافي الربح", value: formatAmount(summary.netProfit), icon: DollarSign, color: "#C9A84C", bg: "rgba(201,168,76,0.08)" },
    { label: "ذمم مدينة", value: formatAmount(summary.overdueAmount), icon: AlertTriangle, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
  ];

  const maxRevenue = Math.max(...revenue.map((r) => r.total), 1);
  const totalExpenses = expenses.reduce((s, e) => s + e.total, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button onClick={handleExportFinancial} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#5E5495" }}>
          <Download size={16} />
          تصدير Excel
        </button>
      </div>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((s, i) => (
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
            <p className="text-xl font-bold" style={{ color: s.color }}>
              {s.value} <SarSymbol size={18} />
            </p>
          </div>
        ))}
      </div>

      {/* Revenue Bar Chart */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          الإيرادات الشهرية
        </h3>
        {revenue.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {revenue.map((r) => (
              <div key={r.month} className="flex items-center gap-3">
                <span className="text-xs font-medium w-20 shrink-0" style={{ color: "#2D3748" }}>
                  {r.month}
                </span>
                <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                  <div
                    className="h-full rounded-lg flex items-center justify-end px-2 transition-all"
                    style={{
                      width: `${Math.max((r.total / maxRevenue) * 100, 2)}%`,
                      backgroundColor: "#059669",
                    }}
                  >
                    <span className="text-xs font-bold text-white whitespace-nowrap">
                      {formatAmount(r.total)} <SarSymbol size={12} />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          المصروفات حسب المزود
        </h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المزود</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المبلغ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>النسبة</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => {
                  const pct = Math.round((e.total / totalExpenses) * 100);
                  return (
                    <tr key={i} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>{e.name}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{formatAmount(e.total)} <SarSymbol size={14} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "#DC2626" }} />
                          </div>
                          <span className="text-xs font-medium w-10" style={{ color: "#2D3748" }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Profitability Table */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          ربحية المشاريع
        </h3>
        {profitability.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المشروع</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الإيرادات</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المصروفات</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الربح</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>هامش الربح %</th>
                </tr>
              </thead>
              <tbody>
                {profitability.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>{p.name}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#059669" }}>{formatAmount(p.revenue)} <SarSymbol size={14} /></td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#DC2626" }}>{formatAmount(p.expenses)} <SarSymbol size={14} /></td>
                    <td className="px-5 py-3 text-sm font-bold" style={{ color: p.profit >= 0 ? "#059669" : "#DC2626" }}>
                      {formatAmount(p.profit)} <SarSymbol size={14} />
                    </td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: "#2D3748" }}>{p.margin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receivables Aging Table */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          الذمم المدينة المتأخرة
        </h3>
        {receivables.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد ذمم مدينة متأخرة</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الفاتورة</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>العميل</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المبلغ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>أيام التأخر</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الفئة العمرية</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => {
                  const agingColor =
                    r.agingBucket === "0-30" ? "#D97706" :
                    r.agingBucket === "31-60" ? "#EA580C" :
                    r.agingBucket === "61-90" ? "#DC2626" : "#991B1B";
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>{r.invoiceNumber}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{r.clientName}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{formatAmount(r.totalAmount)} <SarSymbol size={14} /></td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: agingColor }}>{r.daysOverdue} يوم</td>
                      <td className="px-5 py-3">
                        <span
                          className="px-3 py-1 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: `${agingColor}15`, color: agingColor }}
                        >
                          {r.agingBucket} يوم
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Performance Tab =====

function PerformanceTab({ data }: { data: PerformanceData }) {
  const { executors, taskEfficiency } = data;

  const handleExportPerformance = () => {
    const headers = [
      { key: "name", label: "المنفذ" },
      { key: "role", label: "الدور" },
      { key: "totalTasks", label: "إجمالي المهام" },
      { key: "completedTasks", label: "مكتملة" },
      { key: "inProgressTasks", label: "قيد التنفيذ" },
      { key: "rejectedTasks", label: "مرفوضة" },
      { key: "avgCompletionDays", label: "متوسط أيام الإنجاز" },
      { key: "completionRate", label: "نسبة الإنجاز %" },
    ];
    const rows = executors.map((e) => ({
      name: e.name,
      role: e.role,
      totalTasks: e.totalTasks,
      completedTasks: e.completedTasks,
      inProgressTasks: e.inProgressTasks,
      rejectedTasks: e.rejectedTasks,
      avgCompletionDays: e.avgCompletionDays,
      completionRate: e.completionRate,
    }));
    exportToExcel(rows, headers, "performance-report");
  };
  const maxRate = Math.max(...executors.map((e) => e.completionRate), 1);
  const totalEff = taskEfficiency.total || 1;
  const onTimePct = Math.round((taskEfficiency.onTime / totalEff) * 100);
  const latePct = Math.round((taskEfficiency.late / totalEff) * 100);

  const effCards = [
    { label: "في الموعد", value: `${onTimePct}%`, sub: `${taskEfficiency.onTime} مهمة`, icon: CheckCircle, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "متأخرة", value: `${latePct}%`, sub: `${taskEfficiency.late} مهمة`, icon: XCircle, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
    { label: "إجمالي المهام", value: taskEfficiency.total.toString(), sub: "مهمة مكتملة بموعد", icon: Clock, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
  ];

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button onClick={handleExportPerformance} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#5E5495" }}>
          <Download size={16} />
          تصدير Excel
        </button>
      </div>
      {/* Task Efficiency Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {effCards.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Executor Performance Table */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          أداء المنفذين
        </h3>
        {executors.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المنفذ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>إجمالي المهام</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>مكتملة</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>قيد التنفيذ</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>مرفوضة</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>متوسط أيام الإنجاز</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>نسبة الإنجاز</th>
                </tr>
              </thead>
              <tbody>
                {executors.map((e) => (
                  <tr key={e.id} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{e.name}</p>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>{roleLabels[e.role] || e.role}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium" style={{ color: "#2D3748" }}>{e.totalTasks}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#059669" }}>{e.completedTasks}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#2563EB" }}>{e.inProgressTasks}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#DC2626" }}>{e.rejectedTasks}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{e.avgCompletionDays} يوم</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${e.completionRate}%`,
                              backgroundColor: e.completionRate >= 70 ? "#059669" : e.completionRate >= 40 ? "#D97706" : "#DC2626",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10" style={{ color: "#2D3748" }}>{e.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Completion Rate Bar Chart */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          مقارنة نسب الإنجاز
        </h3>
        {executors.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {executors
              .sort((a, b) => b.completionRate - a.completionRate)
              .map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-32 shrink-0 truncate" style={{ color: "#2D3748" }}>
                    {e.name}
                  </span>
                  <div className="flex-1 h-8 rounded-lg overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                    <div
                      className="h-full rounded-lg flex items-center justify-end px-2 transition-all"
                      style={{
                        width: `${Math.max((e.completionRate / maxRate) * 100, 2)}%`,
                        backgroundColor: e.completionRate >= 70 ? "#059669" : e.completionRate >= 40 ? "#D97706" : "#DC2626",
                      }}
                    >
                      <span className="text-xs font-bold text-white whitespace-nowrap">{e.completionRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Projects Tab =====

function ProjectsTab({ data }: { data: ProjectsData }) {
  const { projects, statusDistribution, timeline } = data;

  const handleExportProjects = () => {
    const headers = [
      { key: "name", label: "المشروع" },
      { key: "client", label: "العميل" },
      { key: "status", label: "الحالة" },
      { key: "startDate", label: "تاريخ البدء" },
      { key: "endDate", label: "تاريخ الانتهاء" },
      { key: "progress", label: "التقدم %" },
      { key: "priority", label: "الأولوية" },
    ];
    const rows = projects.map((p) => ({
      name: p.name,
      client: p.client,
      status: (statusLabels[p.status]?.label) || p.status,
      startDate: p.startDate ? formatDate(p.startDate) : "—",
      endDate: p.endDate ? formatDate(p.endDate) : "—",
      progress: p.progress,
      priority: (priorityLabels[p.priority]?.label) || p.priority,
    }));
    exportToExcel(rows, headers, "projects-report");
  };

  const statusCards = [
    { key: "DRAFT", label: "مسودة", icon: FolderKanban, color: "#6B7280", bg: "rgba(107,114,128,0.08)" },
    { key: "ACTIVE", label: "نشط", icon: FolderKanban, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
    { key: "ON_HOLD", label: "معلق", icon: FolderKanban, color: "#D97706", bg: "rgba(217,119,6,0.08)" },
    { key: "COMPLETED", label: "مكتمل", icon: FolderKanban, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { key: "CANCELLED", label: "ملغي", icon: FolderKanban, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  ];

  // Gantt chart calculations
  let ganttMinDate = Infinity;
  let ganttMaxDate = -Infinity;
  for (const t of timeline) {
    const s = new Date(t.startDate).getTime();
    const e = new Date(t.endDate).getTime();
    if (s < ganttMinDate) ganttMinDate = s;
    if (e > ganttMaxDate) ganttMaxDate = e;
  }
  const ganttRange = ganttMaxDate - ganttMinDate || 1;

  const ganttStatusColors: Record<string, string> = {
    DRAFT: "#9CA3AF",
    ACTIVE: "#3B82F6",
    ON_HOLD: "#F59E0B",
    COMPLETED: "#10B981",
    CANCELLED: "#EF4444",
  };

  return (
    <div className="space-y-6">
      {/* Export Button */}
      <div className="flex justify-end">
        <button onClick={handleExportProjects} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#5E5495" }}>
          <Download size={16} />
          تصدير Excel
        </button>
      </div>
      {/* Status Distribution Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statusCards.map((s) => (
          <div
            key={s.key}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {(statusDistribution[s.key] || 0).toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </div>

      {/* Projects Table */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          المشاريع
        </h3>
        {projects.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد مشاريع</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>المشروع</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>العميل</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الحالة</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>تاريخ البدء</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>تاريخ الانتهاء</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>التقدم</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الأولوية</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const st = statusLabels[p.status] || { label: p.status, bg: "#F3F4F6", text: "#6B7280" };
                  const pr = priorityLabels[p.priority] || { label: p.priority, bg: "#F3F4F6", text: "#6B7280" };
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFAF8]" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm font-semibold" style={{ color: "#1C1B2E" }}>{p.name}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{p.client}</td>
                      <td className="px-5 py-3">
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{formatDate(p.startDate)}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{formatDate(p.endDate)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${p.progress}%`,
                                backgroundColor: p.progress >= 70 ? "#059669" : p.progress >= 40 ? "#D97706" : "#3B82F6",
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium w-10" style={{ color: "#2D3748" }}>{p.progress}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: pr.bg, color: pr.text }}>
                          {pr.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simple Gantt Chart */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
          الجدول الزمني للمشاريع
        </h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "#94A3B8" }}>لا توجد مشاريع بتواريخ محددة</p>
        ) : (
          <div className="space-y-3">
            {/* Date header */}
            <div className="flex items-center justify-between text-xs mb-2" style={{ color: "#94A3B8" }}>
              <span>{formatDate(new Date(ganttMinDate).toISOString())}</span>
              <span>{formatDate(new Date(ganttMaxDate).toISOString())}</span>
            </div>
            {timeline.map((t) => {
              const startOffset = ((new Date(t.startDate).getTime() - ganttMinDate) / ganttRange) * 100;
              const width = Math.max(
                ((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / ganttRange) * 100,
                2
              );
              const barColor = ganttStatusColors[t.status] || "#9CA3AF";

              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-32 shrink-0 truncate" style={{ color: "#2D3748" }}>
                    {t.name}
                  </span>
                  <div className="flex-1 h-8 rounded-lg relative" style={{ backgroundColor: "#F3F4F6" }}>
                    <div
                      className="absolute top-0 h-full rounded-lg flex items-center justify-center transition-all"
                      style={{
                        right: `${startOffset}%`,
                        width: `${width}%`,
                        backgroundColor: barColor,
                        minWidth: "24px",
                      }}
                    >
                      <span className="text-[10px] font-bold text-white whitespace-nowrap px-1">
                        {t.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 flex-wrap" style={{ borderTop: "1px solid #F0EDE6" }}>
              {Object.entries(ganttStatusColors).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs" style={{ color: "#94A3B8" }}>
                    {statusLabels[key]?.label || key}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
