"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight, UserPlus, User, Mail, Phone, Lock, Save, Loader2,
  Briefcase, Building2, CreditCard, DollarSign, Wrench, UserCog,
  Shield, ShieldAlert, ShieldOff,
} from "lucide-react";

type Role = "ADMIN" | "MANAGER" | "FINANCE_MANAGER" | "TREASURY_MANAGER" | "EXECUTOR" | "CLIENT" | "EXTERNAL_PROVIDER";
type AuthType = "FULL" | "PER_SERVICE" | "NONE";

const roleOptions: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "مدير النظام" },
  { value: "MANAGER", label: "مشرف" },
  { value: "FINANCE_MANAGER", label: "مدير مالي" },
  { value: "TREASURY_MANAGER", label: "أمين صندوق" },
  { value: "EXECUTOR", label: "منفذ" },
  { value: "CLIENT", label: "عميل" },
  { value: "EXTERNAL_PROVIDER", label: "مقدم خدمة خارجي" },
];

const authTypeOptions: { value: AuthType; label: string; desc: string; icon: typeof Shield; color: string; bg: string }[] = [
  { value: "FULL", label: "تفويض كامل", desc: "تفويض كامل لجميع الخدمات", icon: Shield, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { value: "PER_SERVICE", label: "تفويض لكل خدمة", desc: "تفويض منفصل لكل خدمة", icon: ShieldAlert, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  { value: "NONE", label: "بدون تفويض", desc: "لا يوجد تفويض حالياً", icon: ShieldOff, color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
];

interface Supervisor {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "" as Role | "",
    // CLIENT fields
    companyName: "",
    authorizationType: "NONE" as AuthType,
    // EXTERNAL_PROVIDER fields
    specialty: "",
    supervisorId: "",
    defaultTaskCost: "",
    bankName: "",
    iban: "",
  });

  useEffect(() => {
    if (form.role === "EXTERNAL_PROVIDER") {
      fetch("/api/users/search?roles=ADMIN,MANAGER,EXECUTOR")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setSupervisors(d);
        })
        .catch(() => {});
    }
  }, [form.role]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return "الاسم مطلوب";
    if (!form.email.trim()) return "البريد الإلكتروني مطلوب";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "البريد الإلكتروني غير صالح";
    if (!form.password) return "كلمة المرور مطلوبة";
    if (form.password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    if (!form.role) return "الدور مطلوب";
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
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: form.role,
      };

      if (form.role === "CLIENT") {
        body.companyName = form.companyName.trim() || undefined;
        body.authorizationType = form.authorizationType;
      }

      if (form.role === "EXTERNAL_PROVIDER") {
        body.specialty = form.specialty.trim() || undefined;
        body.supervisorId = form.supervisorId || undefined;
        body.defaultTaskCost = form.defaultTaskCost ? parseFloat(form.defaultTaskCost) : undefined;
        body.bankName = form.bankName.trim() || undefined;
        body.iban = form.iban.trim() || undefined;
      }

      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard/users");
      } else {
        setError(data.error || "حدث خطأ في إنشاء المستخدم");
        setSaving(false);
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setSaving(false);
    }
  };

  const inputStyle = {
    border: "1px solid #E2E0D8",
    backgroundColor: "#FAFAFE",
    color: "#2D3748",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "#C9A84C";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = "#E8E6F0";
  };

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/users"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-md"
          style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}
        >
          <ArrowRight size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إضافة مستخدم جديد
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
            أدخل بيانات المستخدم لإنشاء حساب جديد
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto"
          style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
        >
          <UserPlus size={24} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            البيانات الأساسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Name */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <User size={14} style={{ color: "#C9A84C" }} />
                الاسم <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="الاسم الكامل"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Email */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Mail size={14} style={{ color: "#C9A84C" }} />
                البريد الإلكتروني <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="example@email.com"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none text-left"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Password */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Lock size={14} style={{ color: "#C9A84C" }} />
                كلمة المرور <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="8 أحرف على الأقل"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none text-left"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Phone size={14} style={{ color: "#C9A84C" }} />
                رقم الجوال
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none text-left"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
            </div>

            {/* Role */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Briefcase size={14} style={{ color: "#C9A84C" }} />
                الدور <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none cursor-pointer"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              >
                <option value="">اختر الدور</option>
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* CLIENT fields */}
        {form.role === "CLIENT" && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
              بيانات العميل
            </h2>
            <div className="space-y-5">
              {/* Company Name */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <Building2 size={14} style={{ color: "#C9A84C" }} />
                  اسم الشركة
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={form.companyName}
                  onChange={handleChange}
                  placeholder="اسم الشركة أو المؤسسة"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* Authorization Type */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-3" style={{ color: "#2D3748" }}>
                  <Shield size={14} style={{ color: "#C9A84C" }} />
                  نوع التفويض
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {authTypeOptions.map((opt) => {
                    const isSelected = form.authorizationType === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm({ ...form, authorizationType: opt.value })}
                        className="p-4 rounded-xl text-right transition-all"
                        style={{
                          border: isSelected ? `2px solid ${opt.color}` : "2px solid #E2E0D8",
                          backgroundColor: isSelected ? opt.bg : "transparent",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: isSelected ? `${opt.color}20` : "rgba(148,163,184,0.1)" }}
                          >
                            <Icon size={16} style={{ color: isSelected ? opt.color : "#94A3B8" }} />
                          </div>
                          <span className="text-sm font-bold" style={{ color: isSelected ? opt.color : "#2D3748" }}>
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXTERNAL_PROVIDER fields */}
        {form.role === "EXTERNAL_PROVIDER" && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
              بيانات مقدم الخدمة
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Specialty */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <Wrench size={14} style={{ color: "#C9A84C" }} />
                  التخصص
                </label>
                <input
                  type="text"
                  name="specialty"
                  value={form.specialty}
                  onChange={handleChange}
                  placeholder="مثال: تصميم جرافيك"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* Supervisor */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <UserCog size={14} style={{ color: "#C9A84C" }} />
                  المشرف المسؤول
                </label>
                <select
                  name="supervisorId"
                  value={form.supervisorId}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none cursor-pointer"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                >
                  <option value="">اختر المشرف</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Default Task Cost */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <DollarSign size={14} style={{ color: "#C9A84C" }} />
                  التكلفة الافتراضية للمهمة
                </label>
                <input
                  type="number"
                  name="defaultTaskCost"
                  value={form.defaultTaskCost}
                  onChange={handleChange}
                  placeholder="0.00"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none text-left"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* Bank Name */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <Building2 size={14} style={{ color: "#C9A84C" }} />
                  اسم البنك
                </label>
                <input
                  type="text"
                  name="bankName"
                  value={form.bankName}
                  onChange={handleChange}
                  placeholder="مثال: البنك الأهلي"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>

              {/* IBAN */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <CreditCard size={14} style={{ color: "#C9A84C" }} />
                  رقم الآيبان
                </label>
                <input
                  type="text"
                  name="iban"
                  value={form.iban}
                  onChange={handleChange}
                  placeholder="SA00 0000 0000 0000 0000 0000"
                  dir="ltr"
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none text-left"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all hover:shadow-lg"
            style={{ backgroundColor: "#C9A84C", boxShadow: "0 4px 12px rgba(201,168,76,0.25)" }}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Save size={18} />
                إنشاء المستخدم
              </>
            )}
          </button>
          <Link
            href="/dashboard/users"
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all hover:bg-gray-50"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
          >
            إلغاء
          </Link>
        </div>
      </form>
    </div>
  );
}
