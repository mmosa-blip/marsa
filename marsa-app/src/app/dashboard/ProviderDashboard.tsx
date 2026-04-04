"use client";

import {
  ListChecks,
  CheckCircle2,
  DollarSign,
  Clock,
  FileText,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

interface PaymentRequest {
  id: string;
  requestNumber: string;
  amount: number;
  status: string;
  createdAt: string;
  taskCost: {
    task: { title: string };
  };
}

interface ProviderStats {
  totalAssigned: number;
  completedTasks: number;
  totalEarnings: number;
  pendingAmount: number;
}

interface ProviderDashboardProps {
  data: Record<string, unknown>;
  userName: string;
}

const paymentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_SUPERVISOR: { label: "بانتظار المسؤول", color: "#CA8A04", bg: "#FEF9C3" },
  PENDING_FINANCE: { label: "بانتظار المالي", color: "#2563EB", bg: "#DBEAFE" },
  PENDING_TREASURY: { label: "بانتظار الصندوق", color: "#9333EA", bg: "#F3E8FF" },
  APPROVED: { label: "تمت الموافقة", color: "#16A34A", bg: "#DCFCE7" },
  PAID: { label: "تم الصرف", color: "#059669", bg: "#D1FAE5" },
  REJECTED: { label: "مرفوض", color: "#DC2626", bg: "#FEE2E2" },
};

export default function ProviderDashboard({ data, userName }: ProviderDashboardProps) {
  const stats = (data.stats as ProviderStats) || {
    totalAssigned: 0,
    completedTasks: 0,
    totalEarnings: 0,
    pendingAmount: 0,
  };
  const paymentRequests = (data.paymentRequests as PaymentRequest[]) || [];

  function formatDate(d: string | null) {
    if (!d) return "\u2014";
    return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatAmount(amount: number) {
    return amount.toLocaleString("en-US");
  }

  const statCards = [
    {
      label: "المهام المسندة",
      value: stats.totalAssigned.toLocaleString("en-US"),
      icon: ListChecks,
      gradient: "from-[#1B2A4A] to-[#2D4A7A]",
    },
    {
      label: "المهام المكتملة",
      value: stats.completedTasks.toLocaleString("en-US"),
      icon: CheckCircle2,
      gradient: "from-[#16A34A] to-[#22C55E]",
    },
    {
      label: "إجمالي الأرباح",
      value: formatAmount(stats.totalEarnings),
      icon: DollarSign,
      gradient: "from-[#C9A84C] to-[#E0C068]",
      isCurrency: true,
    },
    {
      label: "مبالغ معلقة",
      value: formatAmount(stats.pendingAmount),
      icon: Clock,
      gradient: "from-[#EA580C] to-[#F59E0B]",
      isCurrency: true,
    },
  ];

  return (
    <div className="p-8" dir="rtl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
          مرحباً {userName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString("ar-SA-u-nu-latn", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.gradient} rounded-2xl p-5 shadow-sm text-white`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20">
                <card.icon size={20} className="text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value} {card.isCurrency && <SarSymbol size={18} />}</p>
            <p className="text-xs text-white/70 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Payment Requests Table */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={20} style={{ color: "#C9A84C" }} />
          <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
            طلبات الصرف الخاصة بي
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#C9A84C20", color: "#C9A84C" }}
          >
            {paymentRequests.length}
          </span>
        </div>

        {paymentRequests.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100" style={{ backgroundColor: "#1B2A4A08" }}>
                    <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: "#1C1B2E" }}>
                      رقم الطلب
                    </th>
                    <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: "#1C1B2E" }}>
                      المهمة
                    </th>
                    <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: "#1C1B2E" }}>
                      المبلغ
                    </th>
                    <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: "#1C1B2E" }}>
                      الحالة
                    </th>
                    <th className="text-right text-xs font-semibold px-4 py-3" style={{ color: "#1C1B2E" }}>
                      تاريخ الطلب
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRequests.map((pr) => {
                    const psCfg = paymentStatusConfig[pr.status] || {
                      label: pr.status,
                      color: "#6B7280",
                      bg: "#F3F4F6",
                    };
                    return (
                      <tr key={pr.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>
                          {pr.requestNumber}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {pr.taskCost?.task?.title || "\u2014"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium" style={{ color: "#C9A84C" }}>
                          {formatAmount(pr.amount)} <SarSymbol size={14} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-block text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: psCfg.bg, color: psCfg.color }}
                          >
                            {psCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(pr.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <FileText size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-400">لا توجد طلبات صرف</p>
          </div>
        )}
      </div>

    </div>
  );
}
