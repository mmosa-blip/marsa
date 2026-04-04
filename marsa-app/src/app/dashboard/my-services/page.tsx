"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Loader2, CheckCircle2, Clock } from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

const serviceStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FFF7ED", text: "#EA580C", label: "قيد الانتظار" },
  IN_PROGRESS: { bg: "#ECFDF5", text: "#059669", label: "قيد التنفيذ" },
  COMPLETED: { bg: "#EFF6FF", text: "#2563EB", label: "مكتمل" },
  CANCELLED: { bg: "#FEF2F2", text: "#DC2626", label: "ملغي" },
};

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | null;
  status: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  projectId: string | null;
  project: { name: string; status: string } | null;
}

export default function MyServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/my-services")
      .then((res) => {
        if (!res.ok) throw new Error("فشل في تحميل البيانات");
        return res.json();
      })
      .then((data) => setServices(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}
        >
          {error}
        </div>
      </div>
    );
  }

  const projectServices = services.filter((s) => s.projectId);
  const standaloneServices = services.filter((s) => !s.projectId);

  const renderServiceCard = (service: ServiceItem) => {
    const status = serviceStatusConfig[service.status || "PENDING"] || serviceStatusConfig.PENDING;

    return (
      <div
        key={service.id}
        className="rounded-2xl p-6 transition-all duration-300"
        style={{
          backgroundColor: "white",
          border: "1px solid #E2E0D8",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 8px 25px rgba(27,42,74,0.1)";
          e.currentTarget.style.borderColor = "#C9A84C";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
          e.currentTarget.style.borderColor = "#E8E6F0";
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-base font-bold" style={{ color: "#2D3748" }}>
            {service.name}
          </h3>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: status.bg, color: status.text }}
          >
            {status.label}
          </span>
        </div>

        {/* Category */}
        {service.category && (
          <span
            className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold mb-3"
            style={{ backgroundColor: "#F0EEF5", color: "#6B7280" }}
          >
            {service.category}
          </span>
        )}

        {/* Price */}
        {service.price != null && (
          <div className="mb-3">
            <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>
              {service.price.toLocaleString("en-US")}
            </span>
            <SarSymbol size={12} />
          </div>
        )}

        {/* Task Progress */}
        {service.totalTasks > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: "#6B7280" }}>
                تقدم المهام
              </span>
              <div className="flex items-center gap-1 text-xs" style={{ color: "#1C1B2E" }}>
                <CheckCircle2 size={12} />
                <span className="font-bold">
                  {service.completedTasks}/{service.totalTasks}
                </span>
              </div>
            </div>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${service.progress}%`,
                  backgroundColor: service.progress === 100 ? "#059669" : "#C9A84C",
                }}
              />
            </div>
          </div>
        )}

        {/* Project Link */}
        {service.project && (
          <div className="pt-3" style={{ borderTop: "1px solid #F0EDE6" }}>
            <Link
              href={`/dashboard/my-projects/${service.projectId}`}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: "#C9A84C" }}
            >
              <Clock size={13} />
              <span>ضمن مشروع: {service.project.name}</span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>
          خدماتي
        </h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          تابع جميع الخدمات المطلوبة والمنفذة
        </p>
      </div>

      {/* Empty State */}
      {services.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
          >
            <Briefcase size={32} style={{ color: "#C9A84C" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا توجد خدمات حالياً
          </h3>
          <p className="text-sm mb-4" style={{ color: "#6B7280" }}>
            يمكنك طلب خدمات جديدة من سوق الخدمات
          </p>
          <Link
            href="/dashboard/request-service"
            className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#C9A84C" }}
          >
            طلب خدمة جديدة
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Project Services */}
          {projectServices.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
                خدمات ضمن مشاريع
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {projectServices.map(renderServiceCard)}
              </div>
            </div>
          )}

          {/* Standalone Services */}
          {standaloneServices.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
                خدمات مفردة
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {standaloneServices.map(renderServiceCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
