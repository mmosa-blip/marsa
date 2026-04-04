"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import { MarsaButton } from "@/components/ui/MarsaButton";
import {
  Bell, Plus, Filter, Clock, CheckCircle2, AlertTriangle, XCircle,
  IdCard, Shield, FileCheck, FileSignature, Settings,
  RefreshCw, User, Building2, Calendar,
} from "lucide-react";

interface Reminder {
  id: string; title: string; description: string | null; type: string;
  dueDate: string; status: string; reminderDays: number; isRecurring: boolean;
  recurringMonths: number | null; priority: string;
  company: { name: string }; employee: { id: string; name: string } | null;
  createdBy: { name: string };
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  RESIDENCY_EXPIRY: { label: "انتهاء إقامة", icon: IdCard, color: "#EA580C" },
  INSURANCE_EXPIRY: { label: "انتهاء تأمين", icon: Shield, color: "#8B5CF6" },
  LICENSE_EXPIRY: { label: "انتهاء رخصة", icon: FileCheck, color: "#2563EB" },
  CONTRACT_RENEWAL: { label: "تجديد عقد", icon: FileSignature, color: "#059669" },
  CUSTOM: { label: "مخصص", icon: Settings, color: "#64748B" },
};

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  PENDING: { label: "قادم", bg: "#FFF7ED", text: "#C9A84C", icon: Clock },
  NOTIFIED: { label: "تم التنبيه", bg: "#EFF6FF", text: "#2563EB", icon: Bell },
  COMPLETED: { label: "مكتمل", bg: "#ECFDF5", text: "#059669", icon: CheckCircle2 },
  OVERDUE: { label: "متأخر", bg: "#FEF2F2", text: "#DC2626", icon: XCircle },
};

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: "منخفضة", color: "#94A3B8", bg: "#F1F5F9" },
  MEDIUM: { label: "متوسطة", color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  HIGH: { label: "عالية", color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
  CRITICAL: { label: "حرجة", color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
};

function daysUntil(date: string) {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
}

export default function RemindersPage() {
  const { refreshCounts } = useSidebarCounts();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  function fetchReminders() {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("status", filterStatus);
    if (filterPriority) params.set("priority", filterPriority);

    fetch(`/api/reminders?${params}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setReminders(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { fetchReminders(); }, [filterType, filterStatus, filterPriority]);

  async function markComplete(id: string) {
    const res = await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    if (res.ok) { setReminders(reminders.map((r) => r.id === id ? { ...r, status: "COMPLETED" } : r)); refreshCounts(); }
  }

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  const totalReminders = reminders.length;
  const upcoming = reminders.filter((r) => r.status !== "COMPLETED" && new Date(r.dueDate) <= in30 && new Date(r.dueDate) >= now).length;
  const overdue = reminders.filter((r) => r.status === "OVERDUE" || (r.status === "PENDING" && new Date(r.dueDate) < now)).length;
  const completed = reminders.filter((r) => r.status === "COMPLETED").length;

  const statCards = [
    { label: "إجمالي التذكيرات", value: totalReminders, icon: Bell, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "قادمة خلال 30 يوم", value: upcoming, icon: Clock, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
    { label: "متأخرة", value: overdue, icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
    { label: "مكتملة", value: completed, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  ];

  return (
    <div className="p-8">
      {/* الهيدر */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>التذكيرات الذكية</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            تتبع المواعيد والاستحقاقات المهمة
          </p>
        </div>
        <MarsaButton href="/dashboard/reminders/new" variant="primary" size="lg" icon={<Plus size={18} />}>
          تذكير جديد
        </MarsaButton>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* الفلاتر */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center" style={{ border: "1px solid #E2E0D8" }}>
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الأنواع</option>
          {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الحالات</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الأولويات</option>
          {Object.entries(priorityConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : reminders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Bell size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد تذكيرات</p>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>أضف تذكيراً جديداً للبدء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const tc = typeConfig[r.type] || typeConfig.CUSTOM;
            const sc = statusConfig[r.status] || statusConfig.PENDING;
            const pc = priorityConfig[r.priority] || priorityConfig.MEDIUM;
            const days = daysUntil(r.dueDate);
            const isOverdue = days < 0 && r.status !== "COMPLETED";
            const isUrgent = days >= 0 && days <= 7 && r.status !== "COMPLETED";

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                style={{
                  border: `1px solid ${isOverdue ? "#FECACA" : isUrgent ? "#FED7AA" : "#E8E6F0"}`,
                  boxShadow: isOverdue ? "0 2px 12px rgba(220,38,38,0.08)" : "0 2px 8px rgba(0,0,0,0.03)",
                }}
              >
                <div className="flex items-center gap-4">
                  {/* أيقونة النوع */}
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tc.color + "15" }}>
                    <tc.icon size={22} style={{ color: tc.color }} />
                  </div>

                  {/* المحتوى */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>{r.title}</h3>
                      {r.isRecurring && (
                        <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "#2563EB" }}>
                          <RefreshCw size={9} /> متكرر
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "#2D3748", opacity: 0.5 }}>
                      <span className="flex items-center gap-1"><Building2 size={12} />{r.company.name}</span>
                      {r.employee && <span className="flex items-center gap-1"><User size={12} />{r.employee.name}</span>}
                      {r.description && <span className="truncate max-w-[200px]">{r.description}</span>}
                    </div>
                  </div>

                  {/* الشارات */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* النوع */}
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ backgroundColor: tc.color + "12", color: tc.color }}>
                      {tc.label}
                    </span>
                    {/* الأولوية */}
                    <span className="px-2 py-1 rounded-lg text-[11px] font-medium" style={{ backgroundColor: pc.bg, color: pc.color }}>
                      {pc.label}
                    </span>
                  </div>

                  {/* التاريخ */}
                  <div className="text-center flex-shrink-0 min-w-[100px]">
                    <div className="flex items-center gap-1 justify-center mb-0.5">
                      <Calendar size={13} style={{ color: "#94A3B8" }} />
                      <span className="text-xs" style={{ color: "#2D3748" }}>{fmt(r.dueDate)}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: isOverdue ? "#DC2626" : isUrgent ? "#EA580C" : days <= 30 ? "#C9A84C" : "#059669" }}>
                      {isOverdue ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? "اليوم!" : `${days} يوم متبقي`}
                    </span>
                  </div>

                  {/* الحالة */}
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.text }}>
                    <sc.icon size={12} /> {sc.label}
                  </span>

                  {/* زر إكمال */}
                  {r.status !== "COMPLETED" && (
                    <MarsaButton onClick={() => markComplete(r.id)} variant="gold" size="sm" style={{ backgroundColor: "#059669" }} className="flex-shrink-0">
                      إكمال
                    </MarsaButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
