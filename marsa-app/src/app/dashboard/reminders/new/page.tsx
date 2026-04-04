"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save, Bell } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Company { id: string; name: string }
interface Employee { id: string; name: string }

export default function NewReminderPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "", description: "", type: "CUSTOM", dueDate: "",
    reminderDays: "30", isRecurring: false, recurringMonths: "",
    priority: "MEDIUM", companyId: "", employeeId: "",
  });

  useEffect(() => {
    fetch("/api/hr/companies").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCompanies(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.companyId) {
      fetch("/api/hr/employees").then((r) => r.json()).then((d) => {
        if (Array.isArray(d)) setEmployees(d.filter((e: { companyId?: string }) => !form.companyId || e.companyId === form.companyId));
      }).catch(() => {});
    }
  }, [form.companyId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title || !form.dueDate || !form.companyId) { setError("العنوان وتاريخ الاستحقاق والشركة مطلوبة"); return; }
    setSaving(true);
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) router.push("/dashboard/reminders");
    else { const d = await res.json(); setError(d.error || "حدث خطأ"); setSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all";
  const focusStyle = (e: React.FocusEvent<HTMLElement>) => { (e.target as HTMLElement).style.borderColor = "#C9A84C"; };
  const blurStyle = (e: React.FocusEvent<HTMLElement>) => { (e.target as HTMLElement).style.borderColor = "#E8E6F0"; };

  return (
    <div className="p-8 max-w-3xl">
      <MarsaButton onClick={() => router.back()} variant="ghost" size="sm" icon={<ArrowRight size={16} />} className="mb-6">
        رجوع
      </MarsaButton>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.1)" }}>
          <Bell size={24} style={{ color: "#C9A84C" }} />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>تذكير جديد</h1>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-red-600">{error}</p></div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* البيانات الأساسية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>بيانات التذكير</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>العنوان *</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required placeholder="مثال: تجديد إقامة أحمد الغامدي" className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الوصف</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="تفاصيل إضافية..." className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", resize: "none" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>النوع</label>
                <select name="type" value={form.type} onChange={handleChange} className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                  <option value="RESIDENCY_EXPIRY">انتهاء إقامة</option>
                  <option value="INSURANCE_EXPIRY">انتهاء تأمين</option>
                  <option value="LICENSE_EXPIRY">انتهاء رخصة</option>
                  <option value="CONTRACT_RENEWAL">تجديد عقد</option>
                  <option value="CUSTOM">مخصص</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الأولوية</label>
                <select name="priority" value={form.priority} onChange={handleChange} className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                  <option value="LOW">منخفضة</option>
                  <option value="MEDIUM">متوسطة</option>
                  <option value="HIGH">عالية</option>
                  <option value="CRITICAL">حرجة</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* التواريخ */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>التوقيت</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الاستحقاق *</label>
              <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} required className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>التنبيه قبل (أيام)</label>
              <input type="number" name="reminderDays" value={form.reminderDays} onChange={handleChange} className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="isRecurring" checked={form.isRecurring} onChange={handleChange} className="w-4 h-4 rounded accent-[#C9A84C]" />
              <span className="text-sm" style={{ color: "#2D3748" }}>تذكير متكرر</span>
            </label>
            {form.isRecurring && (
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>كل</span>
                <input type="number" name="recurringMonths" value={form.recurringMonths} onChange={handleChange} placeholder="12" className="w-20 px-3 py-2 rounded-xl border-2 text-sm outline-none" style={{ borderColor: "#E8E6F0", color: "#2D3748" }} />
                <span className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>شهر</span>
              </div>
            )}
          </div>
        </div>

        {/* الربط */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>الربط</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الشركة *</label>
              <select name="companyId" value={form.companyId} onChange={handleChange} required className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                <option value="">اختر الشركة</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الموظف <span className="text-xs opacity-50">(اختياري)</span></label>
              <select name="employeeId" value={form.employeeId} onChange={handleChange} className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                <option value="">بدون موظف</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <MarsaButton type="submit" disabled={saving} variant="primary" size="lg" loading={saving} icon={!saving ? <Save size={18} /> : undefined}>
            {saving ? "جارٍ الحفظ..." : "حفظ التذكير"}
          </MarsaButton>
          <MarsaButton type="button" onClick={() => router.back()} variant="secondary" size="lg">إلغاء</MarsaButton>
        </div>
      </form>
    </div>
  );
}
