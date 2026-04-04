"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SarSymbol from "@/components/SarSymbol";
import {
  FolderKanban,
  Briefcase,
  FileWarning,
  Receipt,
  ChevronLeft,
  AlertTriangle,
  Clock,
  Bell,
  FileText,
  Activity,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_HOLD: { label: "معلق", bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { label: "مكتمل", bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
  PENDING: { label: "قيد الانتظار", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#ECFDF5", text: "#059669" },
};

const serviceStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "قيد الانتظار", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#ECFDF5", text: "#059669" },
  COMPLETED: { label: "مكتمل", bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};

const taskStatusLabels: Record<string, string> = {
  TODO: "قيد الانتظار",
  WAITING: "في الانتظار",
  IN_PROGRESS: "قيد التنفيذ",
  IN_REVIEW: "قيد المراجعة",
  DONE: "مكتمل",
  CANCELLED: "ملغي",
};

interface DashboardData {
  stats: {
    activeProjects: number;
    activeServices: number;
    expiringDocuments: number;
    pendingInvoicesTotal: number;
  };
  alerts: {
    expiringDocuments: { id: string; title: string; type: string; expiryDate: string }[];
    overdueInvoices: { id: string; invoiceNumber: string; totalAmount: number; dueDate: string }[];
    upcomingReminders: { id: string; title: string; type: string; dueDate: string; priority: string }[];
  };
  recentProjects: {
    id: string; name: string; status: string; priority: string;
    progress: number; totalTasks: number; completedTasks: number;
    manager: string | null;
  }[];
  recentServices: {
    id: string; name: string; category: string; status: string; price: number; createdAt: string;
  }[];
  recentActivities: {
    id: string; title: string; status: string; updatedAt: string; projectName: string;
  }[];
}

interface Props {
  userName: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
}

export default function ClientDashboard({ userName }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/client-dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!data) return null;

  const { stats, alerts, recentProjects, recentServices, recentActivities } = data;
  const hasAlerts = alerts.expiringDocuments.length > 0 || alerts.overdueInvoices.length > 0 || alerts.upcomingReminders.length > 0;

  const statCards = [
    { label: "المشاريع النشطة", value: stats.activeProjects, icon: FolderKanban, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "الخدمات الجارية", value: stats.activeServices, icon: Briefcase, color: "#22C55E", bg: "rgba(34,197,94,0.08)" },
    { label: "وثائق تنتهي قريباً", value: stats.expiringDocuments, icon: FileWarning, color: stats.expiringDocuments > 0 ? "#DC2626" : "#C9A84C", bg: stats.expiringDocuments > 0 ? "rgba(220,38,38,0.08)" : "rgba(201,168,76,0.1)" },
    { label: "فواتير معلقة", value: stats.pendingInvoicesTotal.toLocaleString("en-US"), icon: Receipt, color: "#C9A84C", bg: "rgba(201,168,76,0.1)", isText: true, isCurrency: true },
  ];

  return (
    <div className="p-8">
      {/* الترحيب */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
          مرحباً، {userName}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
          إليك نظرة عامة على أعمالك ومشاريعك
        </p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{stat.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.bg }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
            </div>
            <p className={`font-bold ${stat.isText ? "text-xl" : "text-3xl"}`} style={{ color: stat.color === "#DC2626" ? "#DC2626" : "#1C1B2E" }}>
              {stat.value} {stat.isCurrency && <SarSymbol size={18} />}
            </p>
          </div>
        ))}
      </div>

      {/* التنبيهات العاجلة */}
      {hasAlerts && (
        <div className="bg-white rounded-2xl p-6 mb-8" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} style={{ color: "#EA580C" }} />
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تنبيهات عاجلة</h2>
          </div>
          <div className="space-y-3">
            {alerts.expiringDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(234,88,12,0.05)", border: "1px solid rgba(234,88,12,0.15)" }}>
                <div className="flex items-center gap-3">
                  <FileText size={18} style={{ color: "#EA580C" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{doc.title}</p>
                    <p className="text-xs" style={{ color: "#EA580C" }}>تنتهي في {formatDate(doc.expiryDate)}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/request-service"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: "#EA580C" }}
                >
                  طلب تجديد
                </Link>
              </div>
            ))}
            {alerts.overdueInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.15)" }}>
                <div className="flex items-center gap-3">
                  <Receipt size={18} style={{ color: "#DC2626" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>فاتورة {inv.invoiceNumber} متأخرة</p>
                    <p className="text-xs" style={{ color: "#DC2626" }}>{inv.totalAmount.toLocaleString("en-US")} <SarSymbol size={12} /> — استحقاق {formatDate(inv.dueDate)}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/my-invoices"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}
                >
                  عرض
                </Link>
              </div>
            ))}
            {alerts.upcomingReminders.map((rem) => (
              <div key={rem.id} className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)" }}>
                <div className="flex items-center gap-3">
                  <Bell size={18} style={{ color: "#C9A84C" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{rem.title}</p>
                    <p className="text-xs" style={{ color: "#C9A84C" }}>{formatDate(rem.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* المشاريع الأخيرة */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>مشاريعي الأخيرة</h2>
            <Link href="/dashboard/my-projects" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: "#C9A84C" }}>
              عرض الكل <ChevronLeft size={14} />
            </Link>
          </div>
          {recentProjects.length > 0 ? (
            <div className="space-y-3">
              {recentProjects.map((p) => {
                const st = statusConfig[p.status] || statusConfig.DRAFT;
                return (
                  <Link key={p.id} href={`/dashboard/my-projects`} className="block p-4 rounded-xl transition-all duration-200 hover:bg-gray-50/80" style={{ border: "1px solid #F0EDE6" }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{p.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                        <div className="h-full rounded-full" style={{ width: `${p.progress}%`, background: p.progress === 100 ? "#22C55E" : "linear-gradient(90deg, #1B2A4A, #C9A84C)" }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-left" style={{ color: "#1C1B2E" }}>{p.progress}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "#2D3748", opacity: 0.5 }}>
                      <span>{p.completedTasks}/{p.totalTasks} مهام</span>
                      {p.manager && <span>المسؤول: {p.manager}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <FolderKanban size={40} className="mx-auto mb-3" style={{ color: "#C9A84C", opacity: 0.3 }} />
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.5 }}>لا توجد مشاريع بعد</p>
            </div>
          )}
        </div>

        {/* الخدمات الجارية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>خدماتي الجارية</h2>
            <Link href="/dashboard/my-services" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: "#C9A84C" }}>
              عرض الكل <ChevronLeft size={14} />
            </Link>
          </div>
          {recentServices.length > 0 ? (
            <div className="space-y-3">
              {recentServices.map((s) => {
                const st = serviceStatusConfig[s.status] || serviceStatusConfig.PENDING;
                return (
                  <div key={s.id} className="p-4 rounded-xl" style={{ border: "1px solid #F0EDE6" }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{s.name}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "#2D3748", opacity: 0.5 }}>
                      {s.category && <span>{s.category}</span>}
                      {s.price > 0 && <span>{s.price.toLocaleString("en-US")} <SarSymbol size={11} /></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <Briefcase size={40} className="mx-auto mb-3" style={{ color: "#C9A84C", opacity: 0.3 }} />
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.5 }}>لا توجد خدمات مفردة</p>
              <Link href="/dashboard/request-service" className="inline-block mt-3 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: "#C9A84C" }}>
                طلب خدمة جديدة
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* آخر النشاطات */}
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center gap-2 mb-5">
          <Activity size={20} style={{ color: "#C9A84C" }} />
          <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>آخر النشاطات</h2>
        </div>
        {recentActivities.length > 0 ? (
          <div className="space-y-3">
            {recentActivities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ border: "1px solid #F0EDE6" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
                  <Clock size={14} style={{ color: "#C9A84C" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "#2D3748" }}>
                    <span className="font-medium">{a.title}</span>
                    {" — "}
                    <span style={{ opacity: 0.6 }}>{taskStatusLabels[a.status] || a.status}</span>
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#2D3748", opacity: 0.4 }}>
                    {a.projectName} • {formatDate(a.updatedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "#2D3748", opacity: 0.4 }}>لا توجد نشاطات حديثة</p>
          </div>
        )}
      </div>
    </div>
  );
}
