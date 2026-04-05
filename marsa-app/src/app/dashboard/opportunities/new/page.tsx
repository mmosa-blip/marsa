"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, Save, Briefcase, User, Phone,
  Building2, Users, DollarSign, TrendingUp, StickyNote, Megaphone,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface DepartmentOption { id: string; name: string }
interface UserOption { id: string; name: string }

export default function NewOpportunityPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    departmentId: "",
    value: "",
    assigneeId: "",
    probability: "50",
    marketerName: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/departments").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDepartments(d); }).catch(() => {});
    fetch("/api/users/search?roles=ADMIN,MANAGER,EXECUTOR").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setUsers(d); }).catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (): string | null => {
    if (!form.contactName.trim()) return "اسم العميل المحتمل مطلوب";
    if (!form.contactPhone.trim()) return "رقم الجوال مطلوب";
    if (!/^05\d{8}$/.test(form.contactPhone.trim())) return "رقم الجوال غير صحيح (05xxxxxxxx)";
    if (!form.departmentId) return "القسم مطلوب";
    if (!form.value) return "القيمة المتوقعة مطلوبة";
    if (!form.assigneeId) return "المسؤول مطلوب";
    if (!form.probability) return "احتمالية الإغلاق مطلوبة";
    if (!form.marketerName.trim()) return "اسم المسوق مطلوب";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const err = validate();
    if (err) { setError(err); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          departmentId: form.departmentId,
          value: parseFloat(form.value),
          assigneeId: form.assigneeId,
          probability: parseInt(form.probability),
          marketerName: form.marketerName.trim(),
          notes: form.notes.trim() || undefined,
        }),
      });

      let data;
      try { data = await res.json(); } catch { data = { error: `خطأ (${res.status})` }; }

      if (res.ok) {
        router.push("/dashboard/opportunities");
      } else {
        setError(data.error || "حدث خطأ");
        setSaving(false);
      }
    } catch (err) {
      setError(`خطأ في الاتصال: ${err instanceof Error ? err.message : "غير معروف"}`);
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all";
  const selectClass = "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all appearance-none bg-white";
  const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = "#C9A84C"; };
  const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { e.target.style.borderColor = "#E8E6F0"; };

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <MarsaButton href="/dashboard/opportunities" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>إضافة فرصة جديدة</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>أدخل بيانات العميل المحتمل</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto" style={{ backgroundColor: "rgba(201,168,76,0.12)" }}>
          <Briefcase size={24} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl flex items-center gap-3" style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* البيانات الأساسية — كل الحقول مطلوبة */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "2px solid rgba(201,168,76,0.3)" }}>
          <h2 className="text-base font-bold mb-1" style={{ color: "#1C1B2E" }}>البيانات الأساسية</h2>
          <p className="text-xs mb-5" style={{ color: "#9CA3AF" }}>جميع الحقول مطلوبة</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* اسم العميل المحتمل */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <User size={14} style={{ color: "#C9A84C" }} />
                اسم العميل المحتمل <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input type="text" name="contactName" value={form.contactName} onChange={handleChange}
                placeholder="اسم العميل أو الشركة" className={inputClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            {/* رقم الجوال */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Phone size={14} style={{ color: "#C9A84C" }} />
                رقم الجوال <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input type="tel" name="contactPhone" value={form.contactPhone} onChange={handleChange}
                placeholder="05xxxxxxxx" dir="ltr" className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>

            {/* القسم */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Building2 size={14} style={{ color: "#C9A84C" }} />
                القسم <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select name="departmentId" value={form.departmentId} onChange={handleChange} className={selectClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="">-- اختر القسم --</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* القيمة المتوقعة */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <DollarSign size={14} style={{ color: "#C9A84C" }} />
                القيمة المتوقعة (ر.س) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input type="number" name="value" value={form.value} onChange={handleChange}
                placeholder="0.00" dir="ltr" className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} min="0" step="0.01" />
            </div>

            {/* المسؤول */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Users size={14} style={{ color: "#C9A84C" }} />
                المسؤول <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select name="assigneeId" value={form.assigneeId} onChange={handleChange} className={selectClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle}>
                <option value="">-- اختر المسؤول --</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>

            {/* احتمالية الإغلاق */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <TrendingUp size={14} style={{ color: "#C9A84C" }} />
                احتمالية الإغلاق: {form.probability}% <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input type="range" name="probability" value={form.probability} onChange={handleChange}
                min="0" max="100" step="5" className="w-full h-2 rounded-lg cursor-pointer" style={{ accentColor: "#C9A84C" }} />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: "#9CA3AF" }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* اسم المسوق */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Megaphone size={14} style={{ color: "#C9A84C" }} />
                اسم المسوق <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input type="text" name="marketerName" value={form.marketerName} onChange={handleChange}
                placeholder="اسم الشخص الذي جلب الفرصة" className={inputClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
            </div>
          </div>
        </div>

        {/* ملاحظات (اختياري) */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-1" style={{ color: "#1C1B2E" }}>ملاحظات</h2>
          <p className="text-xs mb-4" style={{ color: "#9CA3AF" }}>اختياري</p>
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
              <StickyNote size={14} style={{ color: "#C9A84C" }} />
              ملاحظات
            </label>
            <textarea name="notes" value={form.notes} onChange={handleChange}
              placeholder="أي ملاحظات إضافية..." rows={3}
              className="w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all resize-none"
              style={{ borderColor: "#E8E6F0", color: "#2D3748" }} onFocus={focusStyle} onBlur={blurStyle} />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <MarsaButton type="submit" variant="gold" size="lg" loading={saving} icon={<Save size={18} />}>
            {saving ? "جارٍ الحفظ..." : "حفظ الفرصة"}
          </MarsaButton>
          <MarsaButton href="/dashboard/opportunities" variant="secondary" size="lg">
            إلغاء
          </MarsaButton>
        </div>
      </form>
    </div>
  );
}
