import Link from "next/link";
import { Home } from "lucide-react";
import MarsaLogo from "@/components/MarsaLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F8F9FA" }} dir="rtl">
      <div className="text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}>
          <MarsaLogo size={48} variant="dark" />
        </div>
        <h1 className="text-7xl font-bold mb-2" style={{ color: "#1C1B2E" }}>404</h1>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#1C1B2E" }}>الصفحة غير موجودة</h2>
        <p className="text-sm text-gray-500 mb-8">عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90" style={{ backgroundColor: "#5E5495" }}>
          <Home size={16} />
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
