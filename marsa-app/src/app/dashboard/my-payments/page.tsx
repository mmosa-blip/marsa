"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  AlertCircle,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

interface PaymentRequest {
  id: string;
  requestNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  taskCost: {
    task: { title: string } | null;
  } | null;
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING_SUPERVISOR: {
    label: "بانتظار المسؤول",
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
  PENDING_FINANCE: {
    label: "بانتظار المالي",
    bg: "#EFF6FF",
    text: "#1D4ED8",
    border: "#BFDBFE",
  },
  PENDING_TREASURY: {
    label: "بانتظار الصندوق",
    bg: "#F5F3FF",
    text: "#7C3AED",
    border: "#DDD6FE",
  },
  APPROVED: {
    label: "تمت الموافقة",
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },
  PAID: {
    label: "تم الصرف",
    bg: "#ECFDF5",
    text: "#047857",
    border: "#A7F3D0",
  },
  REJECTED: {
    label: "مرفوض",
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
  },
};

export default function MyPaymentsPage() {
  const { data: session, status: authStatus } = useSession();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { document.title = "مدفوعاتي | مرسى"; }, []);

  function fetchRequests() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const url = `/api/my-payments${params.toString() ? `?${params}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setRequests(Array.isArray(data) ? data : data.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    if (authStatus === "authenticated") fetchRequests();
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      setLoading(true);
      fetchRequests();
    }
  }, [statusFilter]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString("en-US");
  }

  // Stats calculations
  const totalCount = requests.length;
  const pendingAmount = requests
    .filter((r) => r.status !== "PAID" && r.status !== "REJECTED")
    .reduce((sum, r) => sum + r.amount, 0);
  const paidAmount = requests
    .filter((r) => r.status === "PAID")
    .reduce((sum, r) => sum + r.amount, 0);
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  const statsCards = [
    {
      label: "إجمالي الطلبات",
      value: totalCount.toString(),
      gradient: "linear-gradient(135deg, #1B2A4A, #2D4A7A)",
      icon: CreditCard,
      isCurrency: false,
    },
    {
      label: "مبالغ معلقة",
      value: formatAmount(pendingAmount),
      gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
      icon: Clock,
      isCurrency: true,
    },
    {
      label: "تم الصرف",
      value: formatAmount(paidAmount),
      gradient: "linear-gradient(135deg, #22C55E, #16A34A)",
      icon: CheckCircle,
      isCurrency: true,
    },
    {
      label: "مرفوضة",
      value: rejectedCount.toString(),
      gradient: "linear-gradient(135deg, #EF4444, #DC2626)",
      icon: XCircle,
      isCurrency: false,
    },
  ];

  // Client-side date filtering
  const filteredRequests = requests.filter((r) => {
    if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(r.createdAt) > to) return false;
    }
    return true;
  });

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "#1C1B2E" }}
          >
            مدفوعاتي
          </h1>
          <p className="text-sm mt-1 text-gray-500">
            متابعة جميع طلبات الصرف الخاصة بك
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #1B2A4A, #2D4A7A)",
            boxShadow: "0 4px 12px rgba(27,42,74,0.3)",
          }}
        >
          <CreditCard size={22} className="text-white" />
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="relative rounded-2xl p-5 text-white text-right"
              style={{
                background: card.gradient,
                boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
              >
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold mb-1">{card.value} {card.isCurrency && <SarSymbol size={20} />}</p>
              <p className="text-xs opacity-90">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl"
        style={{
          backgroundColor: "#FAFAFE",
          border: "1px solid #E2E0D8",
        }}
      >
        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#1C1B2E" }}>
          <Filter size={16} style={{ color: "#C9A84C" }} />
          <span>تصفية</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
        >
          <option value="">كل الحالات</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">من</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">إلى</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div
            className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{
              borderColor: "#C9A84C",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-20">
          <AlertCircle
            size={56}
            className="mx-auto mb-4"
            style={{ color: "#C9A84C", opacity: 0.4 }}
          />
          <p
            className="text-lg font-medium"
            style={{ color: "#2D3748" }}
          >
            لا توجد طلبات صرف
          </p>
          <p className="text-sm mt-1 text-gray-400">
            لم يتم العثور على أي طلبات صرف خاصة بك
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid #E2E0D8",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#5E5495" }}>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  رقم الطلب
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  المهمة
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  المبلغ
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  الحالة
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  تاريخ الطلب
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((req, idx) => {
                const st = statusConfig[req.status] || statusConfig.PENDING_SUPERVISOR;
                return (
                  <tr
                    key={req.id}
                    className="transition-colors duration-150"
                    style={{
                      backgroundColor: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFE",
                      borderBottom: "1px solid #F0EDE6",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#F8F9FA";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        idx % 2 === 0 ? "#FFFFFF" : "#FAFAFE";
                    }}
                  >
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-bold"
                        style={{ color: "#1C1B2E" }}
                      >
                        {req.requestNumber || req.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {req.taskCost?.task?.title || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#C9A84C" }}
                      >
                        {formatAmount(req.amount)} <SarSymbol size={14} />
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: st.bg,
                          color: st.text,
                          border: `1px solid ${st.border}`,
                        }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDate(req.createdAt)}
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
  );
}
