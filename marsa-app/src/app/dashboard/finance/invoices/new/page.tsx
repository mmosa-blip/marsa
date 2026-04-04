"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trash2, Calculator, FileText } from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Company {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    companyId: "",
    projectId: "",
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);

  useEffect(() => {
    fetch("/api/hr/companies").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCompanies(d); });
    fetch("/api/projects").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setProjects(d); });
  }, []);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items];
    if (field === "description") {
      updated[index].description = value as string;
    } else {
      updated[index][field] = Number(value) || 0;
    }
    updated[index].total = updated[index].quantity * updated[index].unitPrice;
    setItems(updated);
  };

  const addItem = () => setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxRate = 15;
  const taxAmount = subtotal * (taxRate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.dueDate || !form.companyId || items.some((i) => !i.description || i.unitPrice <= 0)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, items }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/dashboard/finance/invoices/${data.id}`);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-8">
        <MarsaButton href="/dashboard/finance/invoices" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} style={{ color: "#1C1B2E" }} />} style={{ border: "1px solid #E2E0D8" }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>فاتورة جديدة</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>إنشاء فاتورة مالية جديدة</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* بيانات الفاتورة */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center gap-2 mb-5">
            <FileText size={20} style={{ color: "#C9A84C" }} />
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>بيانات الفاتورة</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>عنوان الفاتورة *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} placeholder="مثال: فاتورة تصميم موقع" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الاستحقاق *</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الشركة *</label>
              <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 bg-white" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} required>
                <option value="">اختر الشركة</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>المشروع (اختياري)</label>
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 bg-white" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}>
                <option value="">بدون مشروع</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>وصف إضافي</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-4 py-3 rounded-xl border text-sm outline-none focus:ring-2 resize-none" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} placeholder="تفاصيل إضافية عن الفاتورة..." />
            </div>
          </div>
        </div>

        {/* بنود الفاتورة */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Calculator size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>بنود الفاتورة</h2>
            </div>
            <MarsaButton type="button" variant="outline" size="sm" icon={<Plus size={16} />} onClick={addItem} style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid transparent" }}>
              إضافة بند
            </MarsaButton>
          </div>

          {/* رأس الجدول */}
          <div className="grid grid-cols-12 gap-3 mb-3 px-2">
            <span className="col-span-5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>الوصف</span>
            <span className="col-span-2 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>الكمية</span>
            <span className="col-span-2 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>سعر الوحدة</span>
            <span className="col-span-2 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>الإجمالي</span>
            <span className="col-span-1"></span>
          </div>

          {/* البنود */}
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-center p-3 rounded-xl" style={{ backgroundColor: "rgba(27,42,74,0.02)" }}>
                <input type="text" value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="col-span-5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} placeholder="وصف البند" required />
                <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="col-span-2 px-3 py-2.5 rounded-lg border text-sm outline-none text-center" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} />
                <input type="number" min="0" step="0.01" value={item.unitPrice || ""} onChange={(e) => updateItem(idx, "unitPrice", e.target.value)} className="col-span-2 px-3 py-2.5 rounded-lg border text-sm outline-none text-center" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} placeholder="0.00" />
                <div className="col-span-2 text-sm font-bold text-center" style={{ color: "#1C1B2E" }}>{item.total.toLocaleString("en-US")} <SarSymbol size={14} /></div>
                <button type="button" onClick={() => removeItem(idx)} className="col-span-1 flex justify-center" disabled={items.length === 1}>
                  <Trash2 size={16} style={{ color: items.length === 1 ? "#D1D5DB" : "#DC2626" }} />
                </button>
              </div>
            ))}
          </div>

          {/* ملخص الحساب */}
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid #E2E0D8" }}>
            <div className="flex justify-end">
              <div className="w-72 space-y-3">
                <div className="flex items-center justify-between text-sm" style={{ color: "#2D3748" }}>
                  <span>المجموع الفرعي</span>
                  <span className="font-medium">{subtotal.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                </div>
                <div className="flex items-center justify-between text-sm" style={{ color: "#2D3748" }}>
                  <span>ضريبة القيمة المضافة ({taxRate}%)</span>
                  <span className="font-medium">{taxAmount.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                </div>
                <div className="flex items-center justify-between pt-3 text-lg font-bold" style={{ borderTop: "2px solid #C9A84C", color: "#1C1B2E" }}>
                  <span>الإجمالي</span>
                  <span style={{ color: "#C9A84C" }}>{totalAmount.toLocaleString("en-US")} <SarSymbol size={18} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* أزرار */}
        <div className="flex items-center gap-3 justify-end">
          <MarsaButton href="/dashboard/finance/invoices" variant="secondary" size="lg">
            إلغاء
          </MarsaButton>
          <MarsaButton type="submit" variant="primary" size="lg" disabled={saving} loading={saving}>
            {saving ? "جارٍ الحفظ..." : "إنشاء الفاتورة"}
          </MarsaButton>
        </div>
      </form>
    </div>
  );
}
