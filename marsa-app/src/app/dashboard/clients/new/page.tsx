"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  Shield,
  ShieldAlert,
  ShieldOff,
  Save,
  Loader2,
} from "lucide-react";

type AuthType = "FULL" | "PER_SERVICE" | "NONE";

const authOptions: { value: AuthType; label: string; desc: string; icon: typeof Shield; color: string; bg: string }[] = [
  { value: "FULL", label: "تفويض شامل", desc: "تفويض كامل لجميع الخدمات", icon: Shield, color: "#059669", bg: "rgba(5,150,105,0.08)" },
  { value: "PER_SERVICE", label: "لكل خدمة", desc: "تفويض منفصل لكل خدمة", icon: ShieldAlert, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  { value: "NONE", label: "بدون تفويض", desc: "لا يوجد تفويض حالياً", icon: ShieldOff, color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
];

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    authorizationType: "NONE" as AuthType,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return "الاسم مطلوب";
    if (!form.email.trim()) return "البريد الإلكتروني مطلوب";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "البريد الإلكتروني غير صالح";
    if (!form.password) return "كلمة المرور مطلوبة";
    if (form.password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          role: "CLIENT",
          authorizationType: form.authorizationType,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push("/dashboard/clients");
      } else {
        setError(data.error || "حدث خطأ في إنشاء الحساب");
        setSaving(false);
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all";

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dashboard/clients"
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:shadow-md"
          style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}
        >
          <ArrowRight size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إضافة عميل جديد
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
            أدخل بيانات العميل لإنشاء حساب جديد
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto"
          style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
        >
          <UserPlus size={24} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {/* Error Message */}
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
        {/* البيانات الأساسية */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            البيانات الأساسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* الاسم */}
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
                className={inputClass}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* البريد الإلكتروني */}
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
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* الجوال */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Phone size={14} style={{ color: "#C9A84C" }} />
                الجوال
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>

            {/* كلمة المرور */}
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
                className={`${inputClass} text-left`}
                style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
              />
            </div>
          </div>
        </div>

        {/* نوع التفويض */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            نوع التفويض
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {authOptions.map((opt) => {
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
                    <span
                      className="text-sm font-bold"
                      style={{ color: isSelected ? opt.color : "#2D3748" }}
                    >
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

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50 transition-all hover:shadow-lg"
            style={{
              backgroundColor: "#5E5495",
              boxShadow: "0 4px 12px rgba(27,42,74,0.25)",
            }}
          >
            {saving ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                جارٍ الحفظ...
              </>
            ) : (
              <>
                <Save size={18} />
                حفظ العميل
              </>
            )}
          </button>
          <Link
            href="/dashboard/clients"
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
