"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Plus,
  Search,
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Receipt,
  Filter,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import SarSymbol from "@/components/SarSymbol";

/* ─── Types ─── */
interface Payment {
  id: string;
  amount: number;
  paidAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  paymentType: "FULL" | "INSTALLMENTS";
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  client: { id: string; name: string };
}

interface Stats {
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  overdue: number;
}

/* ─── Helpers ─── */
const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING:  { label: "معلق",  bg: "#F3F4F6", text: "#6B7280" },
  PARTIAL:  { label: "جزئي",  bg: "#FFF7ED", text: "#EA580C" },
  PAID:     { label: "مدفوع", bg: "#ECFDF5", text: "#059669" },
  OVERDUE:  { label: "متأخر", bg: "#FEF2F2", text: "#DC2626" },
};

const typeLabels: Record<string, string> = {
  FULL: "كامل",
  INSTALLMENTS: "أقساط",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pct(paid: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(Math.round((paid / total) * 100), 100);
}

/* ─── Page ─── */
export default function DepartmentPaymentsPage({ params }: { params: Promise<{ deptId: string }> }) {
  const { deptId } = use(params);
  const router = useRouter();

  const [deptName, setDeptName] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>({ totalDue: 0, totalPaid: 0, totalRemaining: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/departments/${deptId}`).then((r) => r.json()),
      fetch(`/api/department-payments?departmentId=${deptId}`).then((r) => r.json()),
      fetch(`/api/department-payments/stats?departmentId=${deptId}`).then((r) => r.json()),
    ])
      .then(([dept, pays, st]) => {
        if (dept?.name) setDeptName(dept.name);
        if (Array.isArray(pays)) setPayments(pays);
        if (st && typeof st.totalDue === "number") setStats(st);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [deptId]);

  /* Filtered list */
  const filtered = payments.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (clientSearch && !p.client.name.toLowerCase().includes(clientSearch.toLowerCase())) return false;
    return true;
  });

  /* Stats cards config */
  const statCards = [
    { label: "إجمالي المستحق", value: stats.totalDue, icon: Wallet,         color: "#C9A84C", bg: "rgba(201,168,76,0.10)" },
    { label: "المدفوع",         value: stats.totalPaid, icon: CheckCircle2,   color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "المتبقي",         value: stats.totalRemaining, icon: Clock,     color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
    { label: "المتأخر",         value: stats.overdue,   icon: AlertTriangle,  color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  ];

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <MarsaButton
            href="/dashboard/departments"
            variant="ghost"
            size="md"
            iconOnly
            icon={<ArrowRight size={20} style={{ color: "#1C1B2E" }} />}
            style={{ border: "1px solid #E2E0D8" }}
          />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
              مدفوعات {deptName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
              إدارة ومتابعة الدفعات المالية للقسم
            </p>
          </div>
        </div>

        <MarsaButton
          href={`/dashboard/department-payments/${deptId}/new`}
          variant="gold"
          size="lg"
          icon={<Plus size={18} />}
        >
          إضافة دفعة
        </MarsaButton>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value.toLocaleString("en-US")} <SarSymbol size={12} />
            </p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <div
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-white"
            style={{ border: "1px solid #E2E0D8" }}
          >
            <Search size={16} style={{ color: "#9CA3AF" }} />
            <input
              type="text"
              placeholder="بحث بالعميل..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="flex-1 outline-none text-sm bg-transparent"
              style={{ color: "#2D3748" }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} style={{ color: "#9CA3AF" }} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
          >
            <option value="">جميع الحالات</option>
            <option value="PENDING">معلق</option>
            <option value="PARTIAL">جزئي</option>
            <option value="PAID">مدفوع</option>
            <option value="OVERDUE">متأخر</option>
          </select>
        </div>
      </div>

      {/* ── Payment Cards ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Receipt size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد دفعات</p>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
            {payments.length > 0 ? "لا توجد نتائج مطابقة للفلتر" : "أضف دفعة جديدة للبدء"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const st = statusConfig[p.status] || statusConfig.PENDING;
            const progress = pct(p.paidAmount, p.amount);

            return (
              <div
                key={p.id}
                onClick={() => router.push(`/dashboard/department-payments/${deptId}/${p.id}`)}
                className="bg-white rounded-2xl p-6 transition-all hover:shadow-md cursor-pointer"
                style={{ border: "1px solid #E2E0D8" }}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                    {p.client.name}
                  </h3>
                  <span
                    className="px-3 py-1 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: st.bg, color: st.text }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Amount */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
                    {p.amount.toLocaleString("en-US")}
                  </span>
                  <SarSymbol size={12} />
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span style={{ color: "#6B7280" }}>المدفوع: {p.paidAmount.toLocaleString("en-US")}</span>
                    <span style={{ color: progress === 100 ? "#059669" : "#C9A84C" }} className="font-bold">
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: progress === 100 ? "#059669" : "#C9A84C",
                      }}
                    />
                  </div>
                </div>

                {/* Footer info */}
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
                  <span
                    className="px-2.5 py-0.5 rounded-lg text-[11px] font-medium"
                    style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}
                  >
                    {typeLabels[p.paymentType] || p.paymentType}
                  </span>
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>
                    {p.dueDate ? fmt(p.dueDate) : "بدون تاريخ استحقاق"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
