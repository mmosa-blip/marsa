import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #2A2542 0%, #1C1B2E 60%, #15132A 100%)" }}
      dir="rtl"
    >
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-5" style={{ backgroundColor: "#C9A84C" }} />
      <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full opacity-5" style={{ backgroundColor: "#5E5495" }} />

      <div className="text-center relative z-10 px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <MarsaLogo size={40} variant="light" />
          <span className="text-xl font-bold" style={{ color: "#C9A84C" }}>مرسى</span>
        </div>

        {/* 404 number */}
        <h1
          className="text-8xl md:text-9xl font-bold mb-2"
          style={{
            color: "transparent",
            WebkitTextStroke: "2px rgba(201,168,76,0.3)",
          }}
        >
          404
        </h1>

        <h2 className="text-2xl font-bold mb-3" style={{ color: "#FFFFFF" }}>
          الصفحة غير موجودة
        </h2>
        <p className="text-base mb-10 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>
          عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ backgroundColor: "#5E5495", boxShadow: "0 4px 12px rgba(94,84,149,0.3)" }}
          >
            <Home size={16} />
            لوحة التحكم
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg"
            style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            <ArrowLeft size={16} />
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
