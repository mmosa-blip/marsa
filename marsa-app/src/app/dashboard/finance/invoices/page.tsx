"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FileText, Filter, Wallet, Receipt, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import SarSymbol from "@/components/SarSymbol";

interface Invoice {
  id: string; invoiceNumber: string; title: string; totalAmount: number;
  status: string; issueDate: string; dueDate: string;
  company: { name: string };
  project: { name: string; client: { name: string } } | null;
  payments: { amount: number }[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  SENT: { label: "مرسلة", bg: "#EFF6FF", text: "#2563EB" },
  PAID: { label: "مدفوعة", bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخرة", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "ملغاة", bg: "#F3F4F6", text: "#9CA3AF" },
};

function fmt(d: string) { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" }); }

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { refreshCounts } = useSidebarCounts();

  const loadInvoices = () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    fetch(`/api/finance/invoices?${params}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInvoices(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadInvoices(); }, [filterStatus]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/finance/invoices/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== deleteId));
        refreshCounts();
      } else {
        const d = await res.json();
        alert(d.error || "حدث خطأ");
      }
    } catch { alert("حدث خطأ"); }
    setDeleting(false);
    setDeleteId(null);
  };

  const totalAll = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter((i) => ["DRAFT", "SENT"].includes(i.status)).reduce((s, i) => s + i.totalAmount, 0);
  const totalOverdue = invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.totalAmount, 0);

  const stats = [
    { label: "إجمالي الفواتير", value: totalAll, icon: FileText, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "المدفوعة", value: totalPaid, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "المعلقة", value: totalPending, icon: Wallet, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
    { label: "المتأخرة", value: totalOverdue, icon: AlertTriangle, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>الفواتير</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>إدارة الفواتير والمستحقات المالية</p>
        </div>
        <Link href="/dashboard/finance/invoices/new" className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all" style={{ backgroundColor: "#5E5495", boxShadow: "0 4px 12px rgba(27,42,74,0.25)" }}>
          <Plus size={18} /> فاتورة جديدة
        </Link>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ border: "1px solid #E2E0D8" }}>
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

      {/* الفلتر */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3" style={{ border: "1px solid #E2E0D8" }}>
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الحالات</option>
          {Object.entries(statusConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Receipt size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد فواتير</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          <table className="w-full">
            <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
              {["رقم الفاتورة", "العنوان", "العميل/الشركة", "المبلغ", "تاريخ الإصدار", "الاستحقاق", "الحالة", ""].map((h, i) => (
                <th key={i} className="text-right px-4 py-3.5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {invoices.map((inv) => {
                const st = statusConfig[inv.status] || statusConfig.DRAFT;
                const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors" style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-4 py-4"><span className="text-sm font-mono font-bold" style={{ color: "#C9A84C" }}>{inv.invoiceNumber}</span></td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#1C1B2E" }}>{inv.title}</td>
                    <td className="px-4 py-4 text-sm" style={{ color: "#2D3748" }}>{inv.project?.client?.name || inv.company.name}</td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{inv.totalAmount.toLocaleString("en-US")} <SarSymbol size={14} /></p>
                      {paid > 0 && paid < inv.totalAmount && <p className="text-[10px]" style={{ color: "#059669" }}>مدفوع: {paid.toLocaleString("en-US")}</p>}
                    </td>
                    <td className="px-4 py-4 text-xs" style={{ color: "#2D3748", opacity: 0.6 }}>{fmt(inv.issueDate)}</td>
                    <td className="px-4 py-4 text-xs" style={{ color: "#2D3748", opacity: 0.6 }}>{fmt(inv.dueDate)}</td>
                    <td className="px-4 py-4"><span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                    <td className="px-4 py-4 flex items-center gap-3">
                      <Link href={`/dashboard/finance/invoices/${inv.id}`} className="text-xs font-medium hover:underline" style={{ color: "#C9A84C" }}>التفاصيل</Link>
                      {inv.status !== "PAID" && (
                        <button onClick={() => setDeleteId(inv.id)} className="text-red-400 hover:text-red-600 transition-colors" title="حذف"><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
              <Trash2 size={24} style={{ color: "#DC2626" }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#1C1B2E" }}>حذف الفاتورة</h3>
            <p className="text-sm mb-6" style={{ color: "#6B7280" }}>هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>إلغاء</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: "#DC2626" }}>
                {deleting ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
