"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Trash2,
  RotateCcw,
  Clock,
  User,
  Mail,
  Shield,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";

interface DeletedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  deletedAt: string;
}

const roleLabels: Record<string, { ar: string; en: string }> = {
  ADMIN: { ar: "مدير النظام", en: "Admin" },
  MANAGER: { ar: "مشرف", en: "Manager" },
  CLIENT: { ar: "عميل", en: "Client" },
  EXECUTOR: { ar: "منفذ", en: "Executor" },
  EXTERNAL_PROVIDER: { ar: "مقدم خدمة خارجي", en: "External Provider" },
  FINANCE_MANAGER: { ar: "مدير مالي", en: "Finance Manager" },
  TREASURY_MANAGER: { ar: "أمين صندوق", en: "Treasury Manager" },
};

export default function RecycleBinPage() {
  const { data: session } = useSession();
  const { lang } = useLang();
  const isAr = lang === "ar";

  const [users, setUsers] = useState<DeletedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchDeleted = () => {
    fetch("/api/users/deleted")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchDeleted();
  }, []);

  const handleRestore = async (userId: string) => {
    setRestoring(userId);
    try {
      const res = await fetch("/api/users/deleted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || (isAr ? "حدث خطأ" : "Error"));
      }
    } catch {
      alert(isAr ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setRestoring(null);
    }
  };

  const daysRemaining = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted);
    expiry.setDate(expiry.getDate() + 30);
    const now = new Date();
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  if (session?.user?.role !== "ADMIN") {
    return (
      <div className="flex justify-center items-center min-h-[60vh]" dir={isAr ? "rtl" : "ltr"}>
        <p className="text-lg font-semibold" style={{ color: "#DC2626" }}>
          {isAr ? "غير مصرح بالدخول" : "Access denied"}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir={isAr ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(220,38,38,0.08)" }}
        >
          <Trash2 size={24} style={{ color: "#DC2626" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            {isAr ? "سلة المحذوفات" : "Recycle Bin"}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {isAr
              ? "المستخدمون المحذوفون — يمكن استعادتهم خلال 30 يومًا"
              : "Deleted users — recoverable within 30 days"}
          </p>
        </div>
      </div>

      {/* Warning */}
      <div
        className="mb-6 p-4 rounded-xl flex items-center gap-3"
        style={{ backgroundColor: "rgba(234,88,12,0.06)", border: "1px solid rgba(234,88,12,0.15)" }}
      >
        <AlertTriangle size={20} style={{ color: "#EA580C" }} />
        <p className="text-sm" style={{ color: "#EA580C" }}>
          {isAr
            ? "المستخدمون المحذوفون يُحذفون نهائيًا بعد 30 يومًا. استعدهم قبل انتهاء المهلة."
            : "Deleted users are permanently removed after 30 days. Restore them before the deadline."}
        </p>
      </div>

      {/* List */}
      {users.length === 0 ? (
        <div className="text-center py-20">
          <Trash2 size={48} className="mx-auto mb-4" style={{ color: "#D1D5DB" }} />
          <p className="text-lg font-semibold" style={{ color: "#6B7280" }}>
            {isAr ? "سلة المحذوفات فارغة" : "Recycle bin is empty"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#9CA3AF" }}>
            {isAr ? "لا يوجد مستخدمون محذوفون حاليًا" : "No deleted users at this time"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => {
            const days = daysRemaining(user.deletedAt);
            const isUrgent = days <= 7;

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-md"
                style={{ border: "1px solid #E2E0D8" }}
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                >
                  {user.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                      {user.name}
                    </p>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}
                    >
                      {isAr ? roleLabels[user.role]?.ar : roleLabels[user.role]?.en || user.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "#6B7280" }}>
                      <Mail size={12} />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "#6B7280" }}>
                      <Clock size={12} />
                      {isAr ? "حُذف:" : "Deleted:"}{" "}
                      {new Date(user.deletedAt).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* Days remaining */}
                <div className="text-center shrink-0 mx-2">
                  <p
                    className="text-lg font-bold"
                    style={{ color: isUrgent ? "#DC2626" : "#EA580C" }}
                  >
                    {days}
                  </p>
                  <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                    {isAr ? "يوم متبقي" : "days left"}
                  </p>
                </div>

                {/* Restore button */}
                <MarsaButton
                  variant="primary"
                  size="sm"
                  icon={<RotateCcw size={14} />}
                  loading={restoring === user.id}
                  onClick={() => handleRestore(user.id)}
                >
                  {isAr ? "استعادة" : "Restore"}
                </MarsaButton>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
