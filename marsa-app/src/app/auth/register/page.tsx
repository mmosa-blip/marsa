"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, Phone, Smartphone } from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";
import { MarsaButton } from "@/components/ui/MarsaButton";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    if (formData.password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      router.push("/auth/login?registered=true");
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setLoading(false);
    }
  };

  const inputClass =
    "w-full pr-12 pl-4 py-3.5 rounded-xl border-2 bg-white text-sm transition-all duration-200 outline-none";

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#F8F9FA" }}>
      {/* القسم الأيمن - نموذج التسجيل */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* الشعار للشاشات الصغيرة */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "#5E5495" }}
              >
                <MarsaLogo size={24} variant="light" />
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "#1C1B2E" }}>
                مرسى
              </h1>
            </div>
          </div>

          {/* العنوان */}
          <div className="mb-8">
            <h2
              className="text-2xl font-bold mb-2"
              style={{ color: "#2D3748" }}
            >
              إنشاء حساب جديد
            </h2>
            <p className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>
              انضم إلى مرسى وابدأ بإدارة أعمالك باحترافية
            </p>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* النموذج */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                الاسم الكامل
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C9A84C" }}
                />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="أدخل اسمك الكامل"
                  required
                  className={inputClass}
                  style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  dir="rtl"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                رقم الجوال
              </label>
              <div className="relative">
                <Smartphone
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C9A84C" }}
                />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="05xxxxxxxx"
                  required
                  className={inputClass}
                  style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                البريد الإلكتروني{" "}
                <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C9A84C" }}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className={inputClass}
                  style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C9A84C" }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="8 أحرف على الأقل"
                  required
                  className="w-full pr-12 pl-12 py-3.5 rounded-xl border-2 bg-white text-sm transition-all duration-200 outline-none"
                  style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  dir="rtl"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#2D3748" }}
              >
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: "#C9A84C" }}
                />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="أعد كتابة كلمة المرور"
                  required
                  className="w-full pr-12 pl-12 py-3.5 rounded-xl border-2 bg-white text-sm transition-all duration-200 outline-none"
                  style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  dir="rtl"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                required
                className="w-4 h-4 mt-0.5 rounded border-gray-300 accent-[#C9A84C]"
              />
              <span
                className="text-xs leading-relaxed"
                style={{ color: "#2D3748", opacity: 0.7 }}
              >
                أوافق على{" "}
                <a
                  href="#"
                  className="underline"
                  style={{ color: "#C9A84C" }}
                >
                  شروط الاستخدام
                </a>{" "}
                و{" "}
                <a
                  href="#"
                  className="underline"
                  style={{ color: "#C9A84C" }}
                >
                  سياسة الخصوصية
                </a>
              </span>
            </div>

            <MarsaButton
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              {loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
            </MarsaButton>
          </form>

          {/* رابط تسجيل الدخول */}
          <div className="mt-6 text-center">
            <p className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>
              لديك حساب بالفعل؟{" "}
              <MarsaButton href="/auth/login" variant="link">
                سجّل دخولك
              </MarsaButton>
            </p>
          </div>

          {/* الفوتر */}
          <div className="mt-8 text-center">
            <p
              className="text-xs"
              style={{ color: "#2D3748", opacity: 0.4 }}
            >
              &copy; 2024 مرسى. جميع الحقوق محفوظة
            </p>
          </div>
        </div>
      </div>

      {/* القسم الأيسر - التصميم الديكوري */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center"
        style={{ backgroundColor: "#5E5495" }}
      >
        {/* أنماط زخرفية */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-16 left-16 w-64 h-64 rounded-full"
            style={{ border: "2px solid #C9A84C" }}
          />
          <div
            className="absolute bottom-24 right-24 w-56 h-56 rounded-full"
            style={{ border: "2px solid #C9A84C" }}
          />
          <div
            className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full"
            style={{ border: "1px solid #C9A84C" }}
          />
        </div>

        <div className="relative z-10 text-center px-12">
          <div className="mb-8 flex justify-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                backgroundColor: "rgba(201, 168, 76, 0.15)",
                border: "2px solid #C9A84C",
              }}
            >
              <MarsaLogo size={40} variant="light" />
            </div>
          </div>
          <h1
            className="text-5xl font-bold mb-4"
            style={{ color: "#C9A84C" }}
          >
            مرسى
          </h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-md">
            ابدأ رحلتك نحو إدارة أعمال أكثر ذكاءً وفعالية
          </p>

          {/* ميزات */}
          <div className="mt-10 space-y-4 text-right max-w-sm mx-auto">
            {[
              "إدارة المشاريع والمهام بسهولة",
              "تتبع الأداء والتقارير المفصلة",
              "تواصل فعّال مع فريق العمل",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 justify-end">
                <span className="text-sm text-white/70">{feature}</span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(201, 168, 76, 0.2)" }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="#C9A84C"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
