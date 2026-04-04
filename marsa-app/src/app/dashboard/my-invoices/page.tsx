"use client";

import { useState, useEffect } from "react";
import {
  Receipt,
  Loader2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

const invoiceStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: "#F3F4F6", text: "#6B7280", label: "مسودة" },
  SENT: { bg: "#EFF6FF", text: "#2563EB", label: "مرسلة" },
  PAID: { bg: "#ECFDF5", text: "#059669", label: "مدفوعة" },
  OVERDUE: { bg: "#FEF2F2", text: "#DC2626", label: "متأخرة" },
  CANCELLED: { bg: "#FEF2F2", text: "#DC2626", label: "ملغية" },
};

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  paymentDate: string;
  referenceNumber: string | null;
  notes: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  title: string;
  description: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  company: { name: string } | null;
  project: { name: string } | null;
  items: InvoiceItem[];
  payments: Payment[];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقدي",
  CREDIT_CARD: "بطاقة ائتمان",
  CHECK: "شيك",
};

export default function MyInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { document.title = "فواتيري | مرسى"; }, []);

  useEffect(() => {
    fetch("/api/my-invoices")
      .then((res) => {
        if (!res.ok) throw new Error("فشل في تحميل البيانات");
        return res.json();
      })
      .then((data) => setInvoices(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}
        >
          {error}
        </div>
      </div>
    );
  }

  const totalInvoices = invoices.length;
  const paidAmount = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const pendingAmount = invoices
    .filter((i) => i.status === "SENT" || i.status === "DRAFT")
    .reduce((sum, i) => sum + i.totalAmount, 0);
  const overdueAmount = invoices
    .filter((i) => i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const summaryCards = [
    { label: "إجمالي الفواتير", value: totalInvoices.toLocaleString("en-US"), icon: Receipt, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)", isCurrency: false },
    { label: "المبلغ المدفوع", value: paidAmount.toLocaleString("en-US"), icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.08)", isCurrency: true },
    { label: "المبلغ المعلق", value: pendingAmount.toLocaleString("en-US"), icon: Clock, color: "#C9A84C", bg: "rgba(201,168,76,0.1)", isCurrency: true },
    { label: "المبلغ المتأخر", value: overdueAmount.toLocaleString("en-US"), icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.08)", isCurrency: true },
  ];

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>
          فواتيري
        </h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          عرض جميع الفواتير والمدفوعات
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "white",
              border: "1px solid #E2E0D8",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <card.icon size={20} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: "#2D3748" }}>
              {card.value}
              {card.isCurrency && (
                <span className="text-xs font-normal mr-1" style={{ color: "#6B7280" }}>
                  <SarSymbol size={18} />
                </span>
              )}
            </p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
          >
            <Receipt size={32} style={{ color: "#C9A84C" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا توجد فواتير حالياً
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            ستظهر فواتيرك هنا بمجرد إنشائها
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          {/* Table Header */}
          <div
            className="hidden md:grid grid-cols-7 gap-4 px-6 py-4 text-xs font-semibold"
            style={{ backgroundColor: "#F8F9FA", color: "#6B7280", borderBottom: "1px solid #E2E0D8" }}
          >
            <span>رقم الفاتورة</span>
            <span className="col-span-2">العنوان</span>
            <span>المبلغ</span>
            <span>الحالة</span>
            <span>تاريخ الاستحقاق</span>
            <span></span>
          </div>

          {invoices.map((invoice) => {
            const status = invoiceStatusConfig[invoice.status] || invoiceStatusConfig.DRAFT;
            const isExpanded = expandedId === invoice.id;

            return (
              <div key={invoice.id} style={{ borderBottom: "1px solid #F0EDE6" }}>
                {/* Main Row */}
                <div
                  className="grid grid-cols-1 md:grid-cols-7 gap-4 px-6 py-4 items-center cursor-pointer transition-colors hover:bg-gray-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                >
                  <div>
                    <span className="text-xs font-mono font-semibold" style={{ color: "#1C1B2E" }}>
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-semibold" style={{ color: "#2D3748" }}>
                      {invoice.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {invoice.company && (
                        <span className="text-xs" style={{ color: "#6B7280" }}>
                          {invoice.company.name}
                        </span>
                      )}
                      {invoice.project && (
                        <>
                          <span className="text-xs" style={{ color: "#E8E6F0" }}>|</span>
                          <span className="text-xs" style={{ color: "#C9A84C" }}>
                            {invoice.project.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-bold" style={{ color: "#2D3748" }}>
                      {invoice.totalAmount.toLocaleString("en-US")}
                    </span>
                    <span className="text-xs mr-1" style={{ color: "#6B7280" }}>
                      <SarSymbol size={14} />
                    </span>
                  </div>
                  <div>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{ backgroundColor: status.bg, color: status.text }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "#6B7280" }}>
                      {formatDate(invoice.dueDate)}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {isExpanded ? (
                      <ChevronUp size={18} style={{ color: "#6B7280" }} />
                    ) : (
                      <ChevronDown size={18} style={{ color: "#6B7280" }} />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-6 pb-6" style={{ backgroundColor: "#FAFAFE" }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Items */}
                      <div>
                        <h4 className="text-sm font-bold mb-3" style={{ color: "#1C1B2E" }}>
                          بنود الفاتورة
                        </h4>
                        {invoice.items.length === 0 ? (
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            لا توجد بنود
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {invoice.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-3 rounded-xl"
                                style={{ backgroundColor: "white", border: "1px solid #F0EDE6" }}
                              >
                                <div>
                                  <p className="text-sm" style={{ color: "#2D3748" }}>
                                    {item.description}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                                    {item.quantity} x {item.unitPrice.toLocaleString("en-US")} <SarSymbol size={12} />
                                  </p>
                                </div>
                                <span className="text-sm font-bold" style={{ color: "#2D3748" }}>
                                  {item.total.toLocaleString("en-US")} <SarSymbol size={14} />
                                </span>
                              </div>
                            ))}
                            <div className="flex items-center justify-between pt-2 mt-2" style={{ borderTop: "1px solid #E2E0D8" }}>
                              <span className="text-xs" style={{ color: "#6B7280" }}>
                                المجموع الفرعي: {invoice.subtotal.toLocaleString("en-US")} <SarSymbol size={12} />
                              </span>
                              <span className="text-xs" style={{ color: "#6B7280" }}>
                                الضريبة ({invoice.taxRate}%): {invoice.taxAmount.toLocaleString("en-US")} <SarSymbol size={12} />
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Payments */}
                      <div>
                        <h4 className="text-sm font-bold mb-3" style={{ color: "#1C1B2E" }}>
                          المدفوعات
                        </h4>
                        {invoice.payments.length === 0 ? (
                          <p className="text-xs" style={{ color: "#6B7280" }}>
                            لا توجد مدفوعات
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {invoice.payments.map((payment) => (
                              <div
                                key={payment.id}
                                className="flex items-center justify-between p-3 rounded-xl"
                                style={{ backgroundColor: "white", border: "1px solid #F0EDE6" }}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <DollarSign size={14} style={{ color: "#059669" }} />
                                    <span className="text-sm font-semibold" style={{ color: "#059669" }}>
                                      {payment.amount.toLocaleString("en-US")} <SarSymbol size={14} />
                                    </span>
                                  </div>
                                  <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                                    {paymentMethodLabels[payment.method] || payment.method} - {formatDate(payment.paymentDate)}
                                  </p>
                                </div>
                                {payment.referenceNumber && (
                                  <span className="text-xs font-mono" style={{ color: "#6B7280" }}>
                                    #{payment.referenceNumber}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
