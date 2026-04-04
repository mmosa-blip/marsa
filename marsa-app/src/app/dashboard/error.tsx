"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
          <AlertTriangle size={32} style={{ color: "#DC2626" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#1C1B2E" }}>حدث خطأ غير متوقع</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-md">{error.message || "عذراً، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى."}</p>
        <MarsaButton onClick={reset} variant="gold" icon={<RefreshCw size={16} />}>
          إعادة المحاولة
        </MarsaButton>
      </div>
    </div>
  );
}
