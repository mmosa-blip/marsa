"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Loader2,
  UserCheck,
  Shield,
  FileCheck,
  RefreshCw,
  Star,
  Calendar,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: "#FEF2F2", text: "#DC2626", label: "حرج" },
  HIGH: { bg: "#FFF7ED", text: "#EA580C", label: "مرتفع" },
  MEDIUM: { bg: "#FFF7ED", text: "#C9A84C", label: "متوسط" },
  LOW: { bg: "#F3F4F6", text: "#6B7280", label: "منخفض" },
};

const reminderTypeConfig: Record<string, { label: string; icon: typeof Bell }> = {
  RESIDENCY_EXPIRY: { label: "انتهاء إقامة", icon: UserCheck },
  INSURANCE_EXPIRY: { label: "انتهاء تأمين", icon: Shield },
  LICENSE_EXPIRY: { label: "انتهاء رخصة", icon: FileCheck },
  CONTRACT_RENEWAL: { label: "تجديد عقد", icon: RefreshCw },
  CUSTOM: { label: "مخصص", icon: Star },
};

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "#FFF7ED", text: "#EA580C", label: "قيد الانتظار" },
  NOTIFIED: { bg: "#EFF6FF", text: "#2563EB", label: "تم التنبيه" },
  COMPLETED: { bg: "#ECFDF5", text: "#059669", label: "مكتمل" },
  OVERDUE: { bg: "#FEF2F2", text: "#DC2626", label: "متأخر" },
};

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  type: string;
  dueDate: string;
  status: string;
  priority: string;
  company: { name: string } | null;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const filterTabs = [
  { key: "ALL", label: "الكل" },
  { key: "CRITICAL", label: "حرج" },
  { key: "HIGH", label: "مرتفع" },
  { key: "MEDIUM", label: "متوسط" },
  { key: "LOW", label: "منخفض" },
];

export default function MyRemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/my-reminders")
      .then((res) => {
        if (!res.ok) throw new Error("فشل في تحميل البيانات");
        return res.json();
      })
      .then((data) => setReminders(data))
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

  const filtered =
    activeFilter === "ALL"
      ? reminders
      : reminders.filter((r) => r.priority === activeFilter);

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>
          تذكيراتي
        </h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          متابعة المواعيد والتنبيهات المهمة
        </p>
      </div>

      {/* Priority Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: isActive ? "#1C1B2E" : "white",
                color: isActive ? "white" : "#6B7280",
                border: isActive ? "1px solid #1B2A4A" : "1px solid #E2E0D8",
              }}
            >
              {tab.label}
              {tab.key !== "ALL" && (
                <span className="mr-1.5 text-xs opacity-70">
                  ({reminders.filter((r) => r.priority === tab.key).length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reminders List */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
          >
            <Bell size={32} style={{ color: "#C9A84C" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا توجد تذكيرات
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {activeFilter === "ALL"
              ? "ستظهر تذكيراتك هنا"
              : "لا توجد تذكيرات بهذا المستوى"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reminder) => {
            const priority = priorityConfig[reminder.priority] || priorityConfig.MEDIUM;
            const typeInfo = reminderTypeConfig[reminder.type] || reminderTypeConfig.CUSTOM;
            const rStatus = statusConfig[reminder.status] || statusConfig.PENDING;
            const overdue = isOverdue(reminder.dueDate) && reminder.status !== "COMPLETED";
            const TypeIcon = typeInfo.icon;

            return (
              <div
                key={reminder.id}
                className="rounded-2xl p-5 transition-all duration-300"
                style={{
                  backgroundColor: "white",
                  border: overdue ? "2px solid #FCA5A5" : "1px solid #E2E0D8",
                  boxShadow: overdue
                    ? "0 4px 12px rgba(220,38,38,0.08)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
                }}
                onMouseEnter={(e) => {
                  if (!overdue) {
                    e.currentTarget.style.boxShadow = "0 8px 25px rgba(27,42,74,0.1)";
                    e.currentTarget.style.borderColor = "#C9A84C";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!overdue) {
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
                    e.currentTarget.style.borderColor = "#E8E6F0";
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Type Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: overdue ? "rgba(220,38,38,0.08)" : "rgba(201,168,76,0.1)",
                    }}
                  >
                    <TypeIcon
                      size={20}
                      style={{ color: overdue ? "#DC2626" : "#C9A84C" }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: "#2D3748" }}>
                          {reminder.title}
                        </h3>
                        {reminder.description && (
                          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                            {reminder.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: priority.bg, color: priority.text }}
                        >
                          {priority.label}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: rStatus.bg, color: rStatus.text }}
                        >
                          {rStatus.label}
                        </span>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <span
                        className="inline-flex items-center gap-1 text-xs"
                        style={{ color: "#6B7280" }}
                      >
                        <Calendar size={12} />
                        {formatDate(reminder.dueDate)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        style={{ backgroundColor: "#F0EEF5", color: "#6B7280" }}
                      >
                        {typeInfo.label}
                      </span>
                      {reminder.company && (
                        <span className="text-xs" style={{ color: "#6B7280" }}>
                          {reminder.company.name}
                        </span>
                      )}
                      {overdue && (
                        <span className="text-xs font-semibold" style={{ color: "#DC2626" }}>
                          متأخر
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
