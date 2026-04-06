"use client";

import Link from "next/link";
import {
  Users,
  FolderKanban,
  DollarSign,
  ListTodo,
  ChevronLeft,
  TrendingUp,
  User,
  AlertTriangle,
  Clock,
  Zap,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ExpiringContractsWidget from "@/components/ExpiringContractsWidget";
import LeaderboardWidget from "@/components/LeaderboardWidget";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_HOLD: { label: "معلق", bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { label: "مكتمل", bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};


interface Props {
  data: Record<string, unknown>;
  userName: string;
}

export default function AdminDashboard({ data, userName }: Props) {
  const stats = data.stats as {
    totalClients: number;
    totalProjects: number;
    activeProjects: number;
    totalRevenue: number;
    pendingTasks: number;
    completedTasks: number;
    totalTasks: number;
  };

  const monthlyRevenue = data.monthlyRevenue as { month: string; revenue: number }[];
  const projectsByStatus = data.projectsByStatus as { active: number; completed: number; delayed: number; onHold: number } | undefined;
  const delayedProjects = (data.delayedProjects || []) as { id: string; name: string; client: string; delayedTasks: number; maxDelayDays: number }[];
  const recentOrders = data.recentOrders as { id: string; name: string; client: string; status: string; progress: number }[];
  const executorPerformance = data.executorPerformance as {
    id: string; name: string; totalTasks: number; completedTasks: number; inProgressTasks: number; rate: number;
  }[];
  const quickService = data.quickService as { total: number; active: number; completed: number } | undefined;

  const statCards = [
    { label: "إجمالي العملاء", value: stats.totalClients, icon: Users, color: "#1C1B2E", bg: "linear-gradient(135deg, rgba(27,42,74,0.08), rgba(94,84,149,0.06))", suffix: "" },
    { label: "المشاريع", value: stats.totalProjects, icon: FolderKanban, color: "#C9A84C", bg: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))", suffix: "", sub: `${stats.activeProjects} نشط` },
    { label: "الإيرادات", value: stats.totalRevenue.toLocaleString("en-US"), icon: DollarSign, color: "#22C55E", bg: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.03))", suffix: "SAR" },
    { label: "المهام المعلقة", value: stats.pendingTasks, icon: ListTodo, color: "#EA580C", bg: "linear-gradient(135deg, rgba(234,88,12,0.1), rgba(234,88,12,0.03))", suffix: "", sub: `من ${stats.totalTasks}` },
  ];

  return (
    <div className="p-8">
      {/* الترحيب */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
              الشاشة الرئيسية
            </h1>
            <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
              مرحباً {userName}، إليك نظرة شاملة على النظام
            </p>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{ backgroundColor: "rgba(34,197,94,0.08)", color: "#22C55E" }}
          >
            <TrendingUp size={16} />
            <span className="font-medium">{stats.completedTasks}/{stats.totalTasks} مهمة مكتملة</span>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 card-hover transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{stat.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-3xl font-bold" style={{ color: "#1C1B2E" }}>{stat.value}</p>
              {stat.suffix === "SAR" ? <SarSymbol size={14} /> : stat.suffix ? <span className="text-sm" style={{ color: "#2D3748", opacity: 0.4 }}>{stat.suffix}</span> : null}
            </div>
            {stat.sub && <p className="text-xs mt-1" style={{ color: "#2D3748", opacity: 0.4 }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)", margin: "8px 0" }} />

      {/* Quick Service Stats */}
      {quickService && quickService.total > 0 && (
        <div className="mb-8">
          <Link
            href="/dashboard/projects?type=quick"
            className="bg-white rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
              <Zap size={22} style={{ color: "#C9A84C" }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>طلبات الخدمات السريعة</p>
              <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{quickService.total}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: "#059669" }}>{quickService.active}</p>
                <p className="text-[10px]" style={{ color: "#6B7280" }}>نشط</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: "#2563EB" }}>{quickService.completed}</p>
                <p className="text-[10px]" style={{ color: "#6B7280" }}>مكتمل</p>
              </div>
            </div>
            <ChevronLeft size={18} style={{ color: "#CBD5E1" }} />
          </Link>
        </div>
      )}

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)", margin: "8px 0" }} />

      {/* الرسوم البيانية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* رسم الإيرادات الشهرية */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "#1C1B2E" }}>الإيرادات الشهرية</h2>
          <p className="text-xs mb-6" style={{ color: "#2D3748", opacity: 0.5 }}>تطور الإيرادات خلال الأشهر الماضية</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1C1B2E" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#1C1B2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEF5" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94A3B8" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#94A3B8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#5E5495", border: "none", borderRadius: "12px", color: "white", fontSize: "13px", direction: "rtl" }}
                formatter={(value) => [`${Number(value).toLocaleString("en-US")} ر.س`, "الإيرادات"]}
                cursor={{ stroke: "#C9A84C", strokeWidth: 1.5 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#1C1B2E" strokeWidth={2.5} fill="url(#revenueGrad)" dot={{ fill: "#C9A84C", stroke: "#1C1B2E", strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* نظرة عامة على المشاريع */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-lg font-bold mb-1" style={{ color: "#1C1B2E" }}>نظرة عامة على المشاريع</h2>
          <p className="text-xs mb-4" style={{ color: "#2D3748", opacity: 0.5 }}>حالات المشاريع الحالية</p>
          {projectsByStatus && (projectsByStatus.active + projectsByStatus.completed + projectsByStatus.delayed + projectsByStatus.onHold) > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      projectsByStatus.active > 0 && { name: "نشط", value: projectsByStatus.active },
                      projectsByStatus.completed > 0 && { name: "مكتمل", value: projectsByStatus.completed },
                      projectsByStatus.delayed > 0 && { name: "متأخر", value: projectsByStatus.delayed },
                      projectsByStatus.onHold > 0 && { name: "معلق", value: projectsByStatus.onHold },
                    ].filter(Boolean) as { name: string; value: number }[]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {[
                      projectsByStatus.active > 0 && "#22C55E",
                      projectsByStatus.completed > 0 && "#2563EB",
                      projectsByStatus.delayed > 0 && "#DC2626",
                      projectsByStatus.onHold > 0 && "#9CA3AF",
                    ].filter(Boolean).map((color, i) => (
                      <Cell key={i} fill={color as string} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#5E5495", border: "none", borderRadius: "12px", color: "white", fontSize: "12px", direction: "rtl" }}
                    formatter={(value) => [`${value} مشروع`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {[
                  { label: "نشط", value: projectsByStatus.active, color: "#22C55E" },
                  { label: "مكتمل", value: projectsByStatus.completed, color: "#2563EB" },
                  { label: "متأخر", value: projectsByStatus.delayed, color: "#DC2626" },
                  { label: "معلق", value: projectsByStatus.onHold, color: "#9CA3AF" },
                ].filter((s) => s.value > 0).map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-[11px] font-medium" style={{ color: "#2D3748" }}>{s.label}</span>
                    <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
              {/* Delayed projects list */}
              {delayedProjects.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid #F0EEF5" }}>
                  <div className="flex items-center gap-1.5 mb-3">
                    <AlertTriangle size={14} style={{ color: "#DC2626" }} />
                    <span className="text-xs font-semibold" style={{ color: "#DC2626" }}>مشاريع متأخرة</span>
                  </div>
                  <div className="space-y-2">
                    {delayedProjects.map((p) => (
                      <Link
                        key={p.id}
                        href={`/dashboard/projects/${p.id}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:shadow-sm"
                        style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate" style={{ color: "#1C1B2E" }}>{p.name}</p>
                          <p className="text-[10px]" style={{ color: "#6B7280" }}>{p.client}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                            {p.delayedTasks} مهام
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Clock size={11} style={{ color: "#DC2626" }} />
                            <span className="text-[10px] font-bold" style={{ color: "#DC2626" }}>{p.maxDelayDays} يوم</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px]">
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.4 }}>لا توجد مشاريع</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)", margin: "8px 0" }} />

      {/* Expiring contracts widget */}
      <div className="mb-8">
        <ExpiringContractsWidget days={30} />
      </div>

      {/* Performance leaderboard */}
      <div className="mb-8">
        <LeaderboardWidget />
      </div>

      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)", margin: "8px 0" }} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* آخر الطلبات */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>آخر الطلبات</h2>
            <MarsaButton href="/dashboard/projects" variant="link" size="xs" icon={<ChevronLeft size={14} />}>
              عرض الكل
            </MarsaButton>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => {
                const st = statusConfig[order.status] || statusConfig.DRAFT;
                return (
                  <Link
                    key={order.id}
                    href={`/dashboard/projects/${order.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl transition-all hover:bg-gray-50/80"
                    style={{ border: "1px solid #F0EDE6" }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(27,42,74,0.06)" }}>
                      <FolderKanban size={16} style={{ color: "#1C1B2E" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#1C1B2E" }}>{order.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#2D3748", opacity: 0.5 }}>{order.client}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.text }}>
                      {st.label}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                        <div className="h-full rounded-full" style={{ width: `${order.progress}%`, background: "linear-gradient(90deg, #1B2A4A, #C9A84C)" }} />
                      </div>
                      <span className="text-xs font-bold w-7 text-left" style={{ color: "#1C1B2E" }}>{order.progress}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.4 }}>لا توجد طلبات</p>
            </div>
          )}
        </div>

        {/* أداء المنفذين */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>أداء المنفذين</h2>
          {executorPerformance.length > 0 ? (
            <div className="space-y-4">
              {executorPerformance.map((ex) => (
                <div key={ex.id} className="p-4 rounded-xl" style={{ border: "1px solid #F0EDE6" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: "rgba(27,42,74,0.08)", color: "#1C1B2E" }}>
                      <User size={18} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{ex.name}</p>
                      <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: "#2D3748", opacity: 0.5 }}>
                        <span>{ex.totalTasks} مهمة</span>
                        <span>•</span>
                        <span style={{ color: "#22C55E" }}>{ex.completedTasks} مكتملة</span>
                        <span>•</span>
                        <span style={{ color: "#C9A84C" }}>{ex.inProgressTasks} قيد التنفيذ</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold" style={{ color: ex.rate >= 70 ? "#22C55E" : ex.rate >= 40 ? "#C9A84C" : "#EA580C" }}>
                        {ex.rate}%
                      </p>
                      <p className="text-[10px]" style={{ color: "#2D3748", opacity: 0.4 }}>نسبة الإنجاز</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${ex.rate}%`,
                        background: ex.rate >= 70
                          ? "linear-gradient(90deg, #22C55E, #16A34A)"
                          : ex.rate >= 40
                            ? "linear-gradient(90deg, #C9A84C, #D4AF37)"
                            : "linear-gradient(90deg, #EA580C, #DC2626)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <User size={40} className="mx-auto mb-3" style={{ color: "#C9A84C", opacity: 0.3 }} />
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.4 }}>لا يوجد منفذين</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
