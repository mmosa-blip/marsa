"use client";

import { useEffect } from "react";
import ProjectHealthRadar from "@/components/ProjectHealthRadar";

export default function MyHealthPage() {
  useEffect(() => {
    document.title = "صحة مشاريعي | مرسى";
  }, []);

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>صحة مشاريعي</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>تتبع أداءك وصحة المشاريع المسندة إليك</p>
      </div>
      <ProjectHealthRadar />
    </div>
  );
}
