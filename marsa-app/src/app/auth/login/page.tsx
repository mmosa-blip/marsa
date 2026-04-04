"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function LoginPage() {
  const router = useRouter();
  const { t, isRTL } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
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
    <div
      className="min-h-screen flex items-center justify-center islamic-pattern relative"
      style={{ background: "linear-gradient(135deg, #2A2542 0%, #1C1B2E 100%)" }}
    >
      {/* Language Toggle */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageToggle variant="dark" />
      </div>

      {/* Center Card */}
      <div className="w-full max-w-md mx-4 glass rounded-2xl p-8 animate-fade-slide-up">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <MarsaLogo size={64} variant="light" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#C9A84C" }}>
            {t.brand.name}
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {t.brand.tagline}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="mb-4 p-3 rounded-xl text-sm text-center"
            style={{
              backgroundColor: "rgba(220,38,38,0.15)",
              color: "#FCA5A5",
              border: "1px solid rgba(220,38,38,0.2)",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label
              className="block text-sm mb-1.5"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t.auth.email}
            </label>
            <div className="relative">
              <Mail
                size={16}
                className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2`}
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200`}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                placeholder={t.auth.emailPlaceholder}
                dir="ltr"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label
              className="block text-sm mb-1.5"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              {t.auth.password}
            </label>
            <div className="relative">
              <Lock
                size={16}
                className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2`}
                style={{ color: "rgba(255,255,255,0.3)" }}
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full ${isRTL ? "pr-10 pl-10" : "pl-10 pr-10"} py-3 rounded-xl text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200`}
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                placeholder={t.auth.passwordPlaceholder}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute ${isRTL ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 transition-colors`}
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-white/20 accent-[#C9A84C]"
              />
              <span style={{ color: "rgba(255,255,255,0.5)" }}>
                {t.auth.rememberMe}
              </span>
            </label>
            <a
              href="#"
              className="font-medium hover:underline"
              style={{ color: "#C9A84C" }}
            >
              {t.auth.forgotPassword}
            </a>
          </div>

          {/* Submit Button */}
          <MarsaButton
            type="submit"
            variant="gold"
            size="lg"
            loading={loading}
            className="w-full mt-6"
          >
            {loading ? t.auth.loggingIn : t.auth.loginBtn}
          </MarsaButton>
        </form>

        {/* Register Link */}
        <p
          className="text-center text-sm mt-6"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          {t.auth.noAccount}{" "}
          <MarsaButton href="/auth/register" variant="link">
            {t.auth.registerNow}
          </MarsaButton>
        </p>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p
            className="text-xs"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            &copy; 2024 {t.brand.name}. {t.auth.copyright}
          </p>
        </div>
      </div>
    </div>
  );
}
