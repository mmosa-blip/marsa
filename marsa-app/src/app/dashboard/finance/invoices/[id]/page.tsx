"use client";

import { useState, useEffect, use } from "react";
import { ArrowRight, FileText, CreditCard, CheckCircle2, Clock, Printer, Download } from "lucide-react";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import SarSymbol from "@/components/SarSymbol";
import { exportInvoicePDF } from "@/lib/export-utils";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Invoice {
  id: string; invoiceNumber: string; title: string; description: string | null;
  subtotal: number; taxRate: number; taxAmount: number; totalAmount: number;
  status: string; issueDate: string; dueDate: string;
  company: { name: string; commercialRegister: string | null };
  project: { name: string; client: { name: string; email: string } } | null;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; amount: number; method: string; referenceNumber: string | null; notes: string | null; paymentDate: string }[];
  createdBy: { name: string };
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  SENT: { label: "مرسلة", bg: "#EFF6FF", text: "#2563EB" },
  PAID: { label: "مدفوعة", bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخرة", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "ملغاة", bg: "#F3F4F6", text: "#9CA3AF" },
};

const methodLabels: Record<string, string> = {
  BANK_TRANSFER: "تحويل بنكي",
  CASH: "نقداً",
  CHECK: "شيك",
  CREDIT_CARD: "بطاقة ائتمان",
  OTHER: "أخرى",
};

function fmt(d: string) { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" }); }

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { refreshCounts } = useSidebarCounts();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "BANK_TRANSFER", referenceNumber: "", notes: "", paymentDate: "" });
  const [savingPayment, setSavingPayment] = useState(false);

  const loadInvoice = () => {
    fetch(`/api/finance/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setInvoice(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadInvoice(); }, [id]);

  const totalPaid = invoice?.payments.reduce((s, p) => s + p.amount, 0) || 0;
  const remaining = (invoice?.totalAmount || 0) - totalPaid;

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount) return;
    setSavingPayment(true);
    try {
      const res = await fetch(`/api/finance/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      if (res.ok) {
        setShowPayment(false);
        setPaymentForm({ amount: "", method: "BANK_TRANSFER", referenceNumber: "", notes: "", paymentDate: "" });
        loadInvoice();
        refreshCounts();
      }
    } catch { /* ignore */ }
    setSavingPayment(false);
  };

  const updateStatus = async (status: string) => {
    await fetch(`/api/finance/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadInvoice();
    refreshCounts();
  };

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  if (!invoice) return <div className="p-8 text-center text-lg" style={{ color: "#DC2626" }}>الفاتورة غير موجودة</div>;

  const st = statusConfig[invoice.status] || statusConfig.DRAFT;

  return (
    <div className="p-8" dir="rtl">
      {/* الرأس */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <MarsaButton href="/dashboard/finance/invoices" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} style={{ color: "#1C1B2E" }} />} style={{ border: "1px solid #E2E0D8" }} />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{invoice.invoiceNumber}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
            </div>
            <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>{invoice.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "DRAFT" && (
            <MarsaButton variant="ghost" size="md" icon={<FileText size={16} />} onClick={() => updateStatus("SENT")} style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
              إرسال الفاتورة
            </MarsaButton>
          )}
          {["DRAFT", "SENT", "OVERDUE"].includes(invoice.status) && (
            <MarsaButton variant="gold" size="md" icon={<CreditCard size={16} />} onClick={() => setShowPayment(true)} style={{ backgroundColor: "#059669" }}>
              تسجيل دفعة
            </MarsaButton>
          )}
          <MarsaButton
            variant="primary"
            size="md"
            icon={<Download size={16} />}
            onClick={() => {
              if (!invoice) return;
              exportInvoicePDF({
                invoiceNumber: invoice.invoiceNumber,
                title: invoice.title,
                issueDate: invoice.issueDate,
                dueDate: invoice.dueDate,
                clientName: invoice.project?.client?.name || "—",
                companyName: invoice.company.name,
                items: invoice.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: item.total,
                })),
                subtotal: invoice.subtotal,
                taxRate: invoice.taxRate,
                taxAmount: invoice.taxAmount,
                totalAmount: invoice.totalAmount,
                status: invoice.status,
              });
            }}
          >
            تصدير PDF
          </MarsaButton>
          <MarsaButton variant="ghost" size="md" iconOnly icon={<Printer size={18} style={{ color: "#2D3748" }} />} onClick={() => window.print()} style={{ border: "1px solid #E2E0D8" }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* العمود الرئيسي */}
        <div className="lg:col-span-2 space-y-6">
          {/* معلومات الفاتورة */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div><p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>الشركة</p><p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{invoice.company.name}</p></div>
              <div><p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>العميل</p><p className="text-sm font-medium" style={{ color: "#2D3748" }}>{invoice.project?.client?.name || "—"}</p></div>
              <div><p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>تاريخ الإصدار</p><p className="text-sm font-medium" style={{ color: "#2D3748" }}>{fmt(invoice.issueDate)}</p></div>
              <div><p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>تاريخ الاستحقاق</p><p className="text-sm font-medium" style={{ color: "#2D3748" }}>{fmt(invoice.dueDate)}</p></div>
            </div>
            {invoice.description && <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: "rgba(27,42,74,0.03)", color: "#2D3748" }}>{invoice.description}</p>}
          </div>

          {/* بنود الفاتورة */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
            <div className="p-5 flex items-center gap-2" style={{ borderBottom: "1px solid #E2E0D8" }}>
              <FileText size={18} style={{ color: "#C9A84C" }} />
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>البنود</h3>
            </div>
            <table className="w-full">
              <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)" }}>
                {["الوصف", "الكمية", "سعر الوحدة", "الإجمالي"].map((h, i) => (
                  <th key={i} className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-5 py-3.5 text-sm" style={{ color: "#1C1B2E" }}>{item.description}</td>
                    <td className="px-5 py-3.5 text-sm text-center" style={{ color: "#2D3748" }}>{item.quantity}</td>
                    <td className="px-5 py-3.5 text-sm text-center" style={{ color: "#2D3748" }}>{item.unitPrice.toLocaleString("en-US")} <SarSymbol size={14} /></td>
                    <td className="px-5 py-3.5 text-sm font-bold text-center" style={{ color: "#1C1B2E" }}>{item.total.toLocaleString("en-US")} <SarSymbol size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-5" style={{ backgroundColor: "rgba(27,42,74,0.02)" }}>
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm" style={{ color: "#2D3748" }}><span>المجموع الفرعي</span><span>{invoice.subtotal.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                  <div className="flex justify-between text-sm" style={{ color: "#2D3748" }}><span>الضريبة ({invoice.taxRate}%)</span><span>{invoice.taxAmount.toLocaleString("en-US")} <SarSymbol size={14} /></span></div>
                  <div className="flex justify-between text-base font-bold pt-2" style={{ borderTop: "2px solid #C9A84C", color: "#1C1B2E" }}><span>الإجمالي</span><span style={{ color: "#C9A84C" }}>{invoice.totalAmount.toLocaleString("en-US")} <SarSymbol size={16} /></span></div>
                </div>
              </div>
            </div>
          </div>

          {/* سجل المدفوعات */}
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
            <div className="p-5 flex items-center gap-2" style={{ borderBottom: "1px solid #E2E0D8" }}>
              <CreditCard size={18} style={{ color: "#C9A84C" }} />
              <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>سجل المدفوعات</h3>
            </div>
            {invoice.payments.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: "#94A3B8" }}>لا توجد مدفوعات مسجلة</div>
            ) : (
              <table className="w-full">
                <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)" }}>
                  {["التاريخ", "المبلغ", "طريقة الدفع", "المرجع", "ملاحظات"].map((h, i) => (
                    <th key={i} className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{fmt(p.paymentDate)}</td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: "#059669" }}>{p.amount.toLocaleString("en-US")} <SarSymbol size={14} /></td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{methodLabels[p.method] || p.method}</td>
                      <td className="px-5 py-3 text-sm font-mono" style={{ color: "#94A3B8" }}>{p.referenceNumber || "—"}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#94A3B8" }}>{p.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-6">
          {/* ملخص الدفع */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h3 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>ملخص الدفع</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>إجمالي الفاتورة</p>
                <p className="text-xl font-bold" style={{ color: "#1C1B2E" }}>{invoice.totalAmount.toLocaleString("en-US")} <SarSymbol size={18} /></p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>المدفوع</p>
                <p className="text-xl font-bold" style={{ color: "#059669" }}>{totalPaid.toLocaleString("en-US")} <SarSymbol size={18} /></p>
              </div>
              <div className="pt-3" style={{ borderTop: "1px solid #E2E0D8" }}>
                <p className="text-xs mb-1" style={{ color: "#2D3748", opacity: 0.5 }}>المتبقي</p>
                <p className="text-xl font-bold" style={{ color: remaining > 0 ? "#DC2626" : "#059669" }}>{remaining.toLocaleString("en-US")} <SarSymbol size={18} /></p>
              </div>
              {/* شريط التقدم */}
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "#94A3B8" }}>
                  <span>نسبة السداد</span>
                  <span>{invoice.totalAmount > 0 ? Math.round((totalPaid / invoice.totalAmount) * 100) : 0}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((totalPaid / invoice.totalAmount) * 100, 100)}%`, backgroundColor: "#059669" }} />
                </div>
              </div>
            </div>
          </div>

          {/* تفاصيل إضافية */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h3 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>معلومات إضافية</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><Clock size={14} style={{ color: "#94A3B8" }} /><span className="text-xs" style={{ color: "#2D3748" }}>أنشأها: {invoice.createdBy.name}</span></div>
              {invoice.project && <div className="flex items-center gap-2"><FileText size={14} style={{ color: "#94A3B8" }} /><span className="text-xs" style={{ color: "#2D3748" }}>المشروع: {invoice.project.name}</span></div>}
              {invoice.company.commercialRegister && <div className="text-xs" style={{ color: "#94A3B8" }}>السجل التجاري: {invoice.company.commercialRegister}</div>}
            </div>
          </div>

          {/* إجراءات سريعة */}
          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <h3 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>إجراءات</h3>
              <div className="space-y-2">
                {invoice.status !== "OVERDUE" && (
                  <MarsaButton variant="dangerSoft" size="md" onClick={() => updateStatus("OVERDUE")} className="w-full" style={{ justifyContent: "flex-start" }}>
                    تحديد كمتأخرة
                  </MarsaButton>
                )}
                <MarsaButton variant="ghost" size="md" onClick={() => updateStatus("CANCELLED")} className="w-full" style={{ justifyContent: "flex-start", color: "#9CA3AF", backgroundColor: "rgba(156,163,175,0.1)" }}>
                  إلغاء الفاتورة
                </MarsaButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* نافذة تسجيل الدفع */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <CheckCircle2 size={20} style={{ color: "#059669" }} />
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تسجيل دفعة جديدة</h3>
            </div>
            <p className="text-xs mb-4 p-3 rounded-xl" style={{ backgroundColor: "rgba(5,150,105,0.06)", color: "#059669" }}>المتبقي: {remaining.toLocaleString("en-US")} <SarSymbol size={12} /></p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>المبلغ *</label>
                <input type="number" step="0.01" max={remaining} value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} placeholder="0.00" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>طريقة الدفع</label>
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0" }}>
                  {Object.entries(methodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>رقم المرجع</label>
                <input type="text" value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الدفع</label>
                <input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>ملاحظات</label>
                <textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <div className="flex gap-3 pt-2">
                <MarsaButton type="button" variant="secondary" size="md" onClick={() => setShowPayment(false)} className="flex-1">إلغاء</MarsaButton>
                <MarsaButton type="submit" variant="gold" size="md" disabled={savingPayment} loading={savingPayment} className="flex-1" style={{ backgroundColor: "#059669" }}>{savingPayment ? "جارٍ الحفظ..." : "تسجيل الدفعة"}</MarsaButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
