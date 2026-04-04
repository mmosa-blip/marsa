"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";

interface Company { id: string; name: string; }

export default function NewEmployeePage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "", nationality: "", nationalId: "", dateOfBirth: "",
    jobTitle: "", department: "", hireDate: "", baseSalary: "",
    housingAllowance: "", transportAllowance: "", phone: "", email: "",
    passportNumber: "", residencyExpiry: "", insuranceExpiry: "", companyId: "",
  });

  useEffect(() => {
    fetch("/api/hr/companies")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCompanies(d); })
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.companyId) { setError("الاسم والشركة مطلوبان"); return; }
    setSaving(true);
    const res = await fetch("/api/hr/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { router.push("/dashboard/hr/employees"); }
    else { const d = await res.json(); setError(d.error || "حدث خطأ"); setSaving(false); }
  };

  const departments = ["الإدارة", "المالية", "الموارد البشرية", "التقنية", "التسويق", "العمليات"];

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all";

  function Input({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>{label}</label>
        <input
          type={type} name={name} value={form[name as keyof typeof form]} onChange={handleChange}
          required={required} className={inputClass}
          style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
          onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
          onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm mb-6" style={{ color: "#2D3748", opacity: 0.5 }}>
        <ArrowRight size={16} /> رجوع
      </button>

      <h1 className="text-2xl font-bold mb-6" style={{ color: "#1C1B2E" }}>إضافة موظف جديد</h1>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* البيانات الأساسية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات الشخصية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الكامل *" name="name" required />
            <Input label="الجنسية" name="nationality" />
            <Input label="رقم الهوية / الإقامة" name="nationalId" />
            <Input label="تاريخ الميلاد" name="dateOfBirth" type="date" />
            <Input label="رقم الجواز" name="passportNumber" />
            <Input label="رقم الجوال" name="phone" type="tel" />
            <Input label="البريد الإلكتروني" name="email" type="email" />
          </div>
        </div>

        {/* البيانات الوظيفية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات الوظيفية</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>الشركة *</label>
              <select name="companyId" value={form.companyId} onChange={handleChange} required className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                <option value="">اختر الشركة</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Input label="المسمى الوظيفي" name="jobTitle" />
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>القسم</label>
              <select name="department" value={form.department} onChange={handleChange} className={inputClass} style={{ borderColor: "#E8E6F0", color: "#2D3748", backgroundColor: "white" }}>
                <option value="">اختر القسم</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Input label="تاريخ التعيين" name="hireDate" type="date" />
          </div>
        </div>

        {/* البيانات المالية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات المالية</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="الراتب الأساسي" name="baseSalary" type="number" />
            <Input label="بدل السكن" name="housingAllowance" type="number" />
            <Input label="بدل المواصلات" name="transportAllowance" type="number" />
          </div>
        </div>

        {/* التواريخ المهمة */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>تواريخ مهمة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="تاريخ انتهاء الإقامة" name="residencyExpiry" type="date" />
            <Input label="تاريخ انتهاء التأمين" name="insuranceExpiry" type="date" />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: "#5E5495" }}>
            <Save size={18} />
            {saving ? "جارٍ الحفظ..." : "حفظ الموظف"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-3 rounded-xl text-sm font-medium" style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
