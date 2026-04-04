"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  Save,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const validate = (): string | null => {
    if (!form.name.trim()) return "الاسم مطلوب";
    if (!form.phone.trim()) return "رقم الجوال مطلوب";
    if (!/^05\d{8}$/.test(form.phone.trim())) return "رقم الجوال غير صحيح (05xxxxxxxx)";
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
          phone: form.phone.trim(),
          password: form.password,
          email: form.email.trim() || undefined,
          role: "CLIENT",
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
        <MarsaButton href="/dashboard/clients" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
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

            {/* الجوال */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Phone size={14} style={{ color: "#C9A84C" }} />
                رقم الجوال <span style={{ color: "#DC2626" }}>*</span>
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

            {/* البريد الإلكتروني (اختياري) */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Mail size={14} style={{ color: "#C9A84C" }} />
                البريد الإلكتروني <span className="text-xs opacity-50">(اختياري)</span>
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

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <MarsaButton type="submit" variant="primary" size="lg" loading={saving} icon={<Save size={18} />}>
            {saving ? "جارٍ الحفظ..." : "حفظ العميل"}
          </MarsaButton>
          <MarsaButton href="/dashboard/clients" variant="secondary" size="lg">
            إلغاء
          </MarsaButton>
        </div>
      </form>
    </div>
  );
}
