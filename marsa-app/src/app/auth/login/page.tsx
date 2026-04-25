"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Phone, Lock, Eye, EyeOff, TrendingUp, Shield, Home, Wrench } from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ROUTES } from "@/lib/routes";

const departments = [
  { icon: TrendingUp, name: "الاستثمار", color: "#5E5495" },
  { icon: Shield, name: "الإقامة المميزة", color: "#C9A84C" },
  { icon: Home, name: "العقار", color: "#059669" },
  { icon: Wrench, name: "الخدمات", color: "#EA580C" },
];

export default function LoginPage() {
  const router = useRouter();
  const { t, isRTL } = useLang();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      phone,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex" dir={isRTL ? "rtl" : "ltr"}>
      {/* Left panel — branding (hidden on mobile) */}
      <div
        className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #2A2542 0%, #1C1B2E 60%, #15132A 100%)" }}
      >
        {/* Decorative */}
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-5" style={{ backgroundColor: "#C9A84C" }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: "#5E5495" }} />

        {/* Top — logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <MarsaLogo size={44} variant="light" />
            <div>
              <span className="text-2xl font-bold block" style={{ color: "#C9A84C" }}>{t.brand.name}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.brand.tagline}</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-tight mb-4" style={{ color: "#FFFFFF" }}>
            {isRTL ? "شريكك في نجاح\nأعمالك" : "Your Partner in\nBusiness Success"}
          </h2>
          <p className="text-base leading-relaxed max-w-md" style={{ color: "rgba(255,255,255,0.5)" }}>
            {isRTL
              ? "منصة متكاملة لإدارة المشاريع والخدمات والعقود بأعلى معايير الاحترافية"
              : "A comprehensive platform for managing projects, services, and contracts with the highest standards"}
          </p>
        </div>

        {/* Bottom — departments */}
        <div className="relative z-10">
          <p className="text-xs font-medium mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            {isRTL ? "أقسامنا" : "Our Departments"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {departments.map((dept) => {
              const Icon = dept.icon;
              return (
                <div
                  key={dept.name}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${dept.color}20` }}
                  >
                    <Icon size={16} style={{ color: dept.color }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {dept.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex-1 flex items-center justify-center p-6 relative"
        style={{ background: "linear-gradient(135deg, #2A2542 0%, #1C1B2E 100%)" }}
      >
        {/* Language Toggle */}
        <div className="absolute top-6 right-6 z-20">
          <LanguageToggle variant="dark" />
        </div>

        {/* Mobile logo (shown only on small screens) */}
        <div className="lg:hidden absolute top-6 left-6">
          <div className="flex items-center gap-2">
            <MarsaLogo size={28} variant="light" />
            <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>{t.brand.name}</span>
          </div>
        </div>

        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8 lg:text-start">
            <div className="lg:hidden flex justify-center mb-6">
              <MarsaLogo size={56} variant="light" />
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "#FFFFFF" }}>
              {isRTL ? "تسجيل الدخول" : "Sign In"}
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isRTL ? "أدخل بياناتك للوصول إلى حسابك" : "Enter your credentials to access your account"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-4 p-3 rounded-xl text-sm text-center"
              style={{ backgroundColor: "rgba(220,38,38,0.15)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t.auth.phone}
              </label>
              <div className="relative">
                <Phone size={16} className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2`} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all`}
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(201,168,76,0.4)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder={t.auth.phonePlaceholder}
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                {t.auth.password}
              </label>
              <div className="relative">
                <Lock size={16} className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2`} style={{ color: "rgba(255,255,255,0.3)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={`w-full ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"} py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all`}
                  style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(201,168,76,0.4)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  placeholder={t.auth.passwordPlaceholder}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2`}
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-white/20 accent-[#C9A84C]" />
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{t.auth.rememberMe}</span>
              </label>
              <a href="#" className="font-medium hover:underline" style={{ color: "#C9A84C" }}>
                {t.auth.forgotPassword}
              </a>
            </div>

            <MarsaButton type="submit" variant="gold" size="lg" loading={loading} className="w-full">
              {loading ? t.auth.loggingIn : t.auth.loginBtn}
            </MarsaButton>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "rgba(255,255,255,0.4)" }}>
            {t.auth.noAccount}{" "}
            <MarsaButton href={ROUTES.REGISTER} variant="link">{t.auth.registerNow}</MarsaButton>
          </p>

          <div className="mt-8 text-center">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              &copy; {new Date().getFullYear()} {t.brand.name}. {t.auth.copyright}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
