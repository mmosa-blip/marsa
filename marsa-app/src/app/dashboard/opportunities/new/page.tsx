"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Save,
  Briefcase,
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  StickyNote,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface DepartmentOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

const TYPE_OPTIONS = [
  { value: "INVESTMENT", label: "استثمار" },
  { value: "REAL_ESTATE", label: "عقار" },
  { value: "PREMIUM_RESIDENCY", label: "إقامة مميزة" },
  { value: "SERVICES", label: "خدمات" },
];

export default function NewOpportunityPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [form, setForm] = useState({
    title: "",
    type: "INVESTMENT",
    description: "",
    value: "",
    probability: "50",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    departmentId: "",
    assigneeId: "",
    expectedCloseDate: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setDepartments(data);
        else if (Array.isArray(data.departments)) setDepartments(data.departments);
      })
      .catch(() => {});

    fetch("/api/users/search?roles=ADMIN,MANAGER,EXECUTOR")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        else if (Array.isArray(data.users)) setUsers(data.users);
      })
      .catch(() => {});
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return "عنوان الفرصة مطلوب";
    if (!form.type) return "نوع الفرصة مطلوب";
    if (form.contactPhone && !/^05\d{8}$/.test(form.contactPhone.trim()))
      return "رقم الجوال غير صحيح (05xxxxxxxx)";
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim()))
      return "البريد الإلكتروني غير صحيح";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          description: form.description.trim() || undefined,
          value: form.value ? parseFloat(form.value) : undefined,
          probability: parseInt(form.probability),
          contactName: form.contactName.trim() || undefined,
          contactPhone: form.contactPhone.trim() || undefined,
          contactEmail: form.contactEmail.trim() || undefined,
          departmentId: form.departmentId || undefined,
          assigneeId: form.assigneeId || undefined,
          expectedCloseDate: form.expectedCloseDate || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard/opportunities");
      } else {
        setError(data.error || "حدث خطأ في إنشاء الفرصة");
        setSaving(false);
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all";
  const selectClass =
    "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all appearance-none bg-white";
  const textareaClass =
    "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all resize-none";

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <MarsaButton
          href="/dashboard/opportunities"
          variant="ghost"
          size="md"
          iconOnly
          icon={<ArrowRight size={20} />}
        />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إضافة فرصة جديدة
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
            أدخل بيانات الفرصة لإضافتها إلى خط الأنابيب
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto"
          style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
        >
          <Briefcase size={24} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{
            backgroundColor: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.15)",
          }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(220,38,38,0.1)" }}
          >
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* البيانات الأساسية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            البيانات الأساسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* العنوان */}
            <div className="md:col-span-2">
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <FileText size={14} style={{ color: "#C9A84C" }} />
                عنوان الفرصة <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="مثال: صفقة استثمارية مع شركة ..."
                className={inputClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* النوع */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Briefcase size={14} style={{ color: "#C9A84C" }} />
                نوع الفرصة <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className={selectClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* القيمة المتوقعة */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <DollarSign size={14} style={{ color: "#C9A84C" }} />
                القيمة المتوقعة (ر.س)
              </label>
              <input
                type="number"
                name="value"
                value={form.value}
                onChange={handleChange}
                placeholder="0.00"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                min="0"
                step="0.01"
              />
            </div>

            {/* احتمالية الإغلاق */}
            <div className="md:col-span-2">
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <TrendingUp size={14} style={{ color: "#C9A84C" }} />
                احتمالية الإغلاق: {form.probability}%
              </label>
              <input
                type="range"
                name="probability"
                value={form.probability}
                onChange={handleChange}
                min="0"
                max="100"
                step="5"
                className="w-full h-2 rounded-lg cursor-pointer"
                style={{ accentColor: "#C9A84C" }}
              />
              <div
                className="flex justify-between text-xs mt-1"
                style={{ color: "#9CA3AF" }}
              >
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* الوصف */}
            <div className="md:col-span-2">
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <FileText size={14} style={{ color: "#C9A84C" }} />
                الوصف
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="وصف تفصيلي للفرصة..."
                rows={3}
                className={textareaClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>
          </div>
        </div>

        {/* بيانات التواصل */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            بيانات التواصل
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* اسم جهة الاتصال */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <User size={14} style={{ color: "#C9A84C" }} />
                اسم جهة الاتصال
              </label>
              <input
                type="text"
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                placeholder="اسم الشخص المسؤول"
                className={inputClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* رقم الجوال */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Phone size={14} style={{ color: "#C9A84C" }} />
                رقم الجوال
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={form.contactPhone}
                onChange={handleChange}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* البريد الإلكتروني */}
            <div className="md:col-span-2">
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Mail size={14} style={{ color: "#C9A84C" }} />
                البريد الإلكتروني{" "}
                <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <input
                type="email"
                name="contactEmail"
                value={form.contactEmail}
                onChange={handleChange}
                placeholder="example@email.com"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>
          </div>
        </div>

        {/* التعيين والجدول */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            التعيين والجدول الزمني
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* القسم */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Building2 size={14} style={{ color: "#C9A84C" }} />
                القسم
              </label>
              <select
                name="departmentId"
                value={form.departmentId}
                onChange={handleChange}
                className={selectClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              >
                <option value="">-- اختر القسم --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* المسؤول */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Users size={14} style={{ color: "#C9A84C" }} />
                المسؤول
              </label>
              <select
                name="assigneeId"
                value={form.assigneeId}
                onChange={handleChange}
                className={selectClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              >
                <option value="">-- اختر المسؤول --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* تاريخ الإغلاق المتوقع */}
            <div>
              <label
                className="flex items-center gap-1.5 text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                <Calendar size={14} style={{ color: "#C9A84C" }} />
                تاريخ الإغلاق المتوقع
              </label>
              <input
                type="date"
                name="expectedCloseDate"
                value={form.expectedCloseDate}
                onChange={handleChange}
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>
          </div>
        </div>

        {/* ملاحظات */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            ملاحظات إضافية
          </h2>
          <div>
            <label
              className="flex items-center gap-1.5 text-sm font-medium mb-2"
              style={{ color: "#2D3748" }}
            >
              <StickyNote size={14} style={{ color: "#C9A84C" }} />
              ملاحظات
            </label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="أي ملاحظات إضافية حول هذه الفرصة..."
              rows={4}
              className={textareaClass}
              style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
              onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
              onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <MarsaButton
            type="submit"
            variant="gold"
            size="lg"
            loading={saving}
            icon={<Save size={18} />}
          >
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
