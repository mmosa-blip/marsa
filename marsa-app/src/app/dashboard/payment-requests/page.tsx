"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import {
  CreditCard,
  Clock,
  Check,
  X,
  DollarSign,
  Filter,
  Search,
  ChevronLeft,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface PaymentRequest {
  id: string;
  requestNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  provider: { id: string; name: string };
  task: { id: string; title: string } | null;
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

const statCards = [
  {
    key: "PENDING_SUPERVISOR",
    label: "بانتظار المسؤول",
    gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: Clock,
  },
  {
    key: "PENDING_FINANCE",
    label: "بانتظار المالي",
    gradient: "linear-gradient(135deg, #3B82F6, #2563EB)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: DollarSign,
  },
  {
    key: "PENDING_TREASURY",
    label: "بانتظار الصندوق",
    gradient: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: CreditCard,
  },
  {
    key: "APPROVED",
    label: "تمت الموافقة",
    gradient: "linear-gradient(135deg, #22C55E, #16A34A)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: Check,
  },
  {
    key: "PAID",
    label: "تم الصرف",
    gradient: "linear-gradient(135deg, #10B981, #059669)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: Check,
  },
  {
    key: "REJECTED",
    label: "مرفوض",
    gradient: "linear-gradient(135deg, #EF4444, #DC2626)",
    iconBg: "rgba(255,255,255,0.25)",
    icon: X,
  },
];

export default function PaymentRequestsPage() {
  const { data: session, status: authStatus } = useSession();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [providerSearch, setProviderSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { document.title = "طلبات الصرف | مرسى"; }, []);

  function fetchRequests() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const url = `/api/payment-requests${params.toString() ? `?${params}` : ""}`;
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
    return <>{amount.toLocaleString("ar-SA-u-nu-latn")} <SarSymbol size={14} /></>;
  }

  const statusCounts = requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const filteredRequests = requests.filter((r) => {
    if (
      providerSearch &&
      !r.provider?.name?.toLowerCase().includes(providerSearch.toLowerCase())
    )
      return false;
    if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(r.createdAt) > to) return false;
    }
    return true;
  });

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: "#1C1B2E" }}
          >
            طلبات الصرف
          </h1>
          <p className="text-sm mt-1 text-gray-500">
            إدارة ومتابعة جميع طلبات الصرف المالية
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

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              onClick={() =>
                setStatusFilter(statusFilter === card.key ? "" : card.key)
              }
              className="relative rounded-2xl p-4 text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg text-right"
              style={{
                background: card.gradient,
                boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                border:
                  statusFilter === card.key
                    ? "3px solid #C9A84C"
                    : "3px solid transparent",
              }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: card.iconBg }}
              >
                <Icon size={18} />
              </div>
              <p className="text-2xl font-bold mb-1">
                {statusCounts[card.key] || 0}
              </p>
              <p className="text-xs opacity-90">{card.label}</p>
              {statusFilter === card.key && (
                <div
                  className="absolute top-2 left-2 w-3 h-3 rounded-full"
                  style={{ backgroundColor: "#C9A84C" }}
                />
              )}
            </button>
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

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            placeholder="بحث بمقدم الخدمة..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#C9A84C] text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">من</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">إلى</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2"
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
          <CreditCard
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
            لم يتم العثور على أي طلبات مطابقة للبحث
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
              <tr
                style={{
                  backgroundColor: "#5E5495",
                }}
              >
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  رقم الطلب
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  مقدم الخدمة
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
                  تاريخ الإنشاء
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-white">
                  إجراءات
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
                      <span className="text-sm" style={{ color: "#374151" }}>
                        {req.provider?.name || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {req.task?.title || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#C9A84C" }}
                      >
                        {formatAmount(req.amount)}
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
                    <td className="px-6 py-4">
                      <MarsaButton
                        href={`/dashboard/payment-requests/${req.id}`}
                        variant="link"
                        size="xs"
                        icon={<ChevronLeft size={16} />}
                        style={{ color: "#1C1B2E" }}
                      >
                        التفاصيل
                      </MarsaButton>
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
