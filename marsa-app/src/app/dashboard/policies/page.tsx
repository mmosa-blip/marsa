"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { MarsaButton } from "@/components/ui/MarsaButton";
import {
  BookOpen,
  Shield,
  Landmark,
  ClipboardList,
  AlertCircle,
  Clock,
  CheckCircle2,
  Loader2,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Shield,
  Landmark,
  ClipboardList,
  AlertCircle,
};

interface Policy {
  id: string;
  title: string;
  slug: string;
  content: string;
  icon: string | null;
  order: number;
  isPublished: boolean;
  updatedAt: string;
  updatedBy: { name: string } | null;
  notifications: { id: string }[];
}

export default function PoliciesPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selected, setSelected] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "اللوائح والإرشادات | مرسى";
    fetch("/api/policies")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPolicies(data);
          if (data.length > 0) selectPolicy(data[0]);
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPolicy = async (policy: Policy) => {
    setSelected(policy);
    const res = await fetch(`/api/policies/${policy.id}`);
    if (res.ok) {
      const full = await res.json();
      setSelected(full);
      setPolicies((prev) =>
        prev.map((p) => (p.id === full.id ? { ...p, notifications: [] } : p))
      );
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]" dir="rtl" style={{ backgroundColor: "#F8F9FA" }}>
      {/* Sidebar */}
      <div
        className="w-72 flex-shrink-0 border-l overflow-y-auto"
        style={{ backgroundColor: "white", borderColor: "#E2E0D8" }}
      >
        {/* Header */}
        <div className="p-5 border-b" style={{ borderColor: "#F0EDE6" }}>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={20} style={{ color: "#5E5495" }} />
            <h1 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              اللوائح والإرشادات
            </h1>
          </div>
          <p className="text-xs" style={{ color: "#6B7280" }}>
            قواعد العمل والسياسات الرسمية لمرسى
          </p>
        </div>

        {/* Policy list */}
        <div className="p-3 space-y-1">
          {policies.map((policy) => {
            const IconComp = ICON_MAP[policy.icon || ""] || BookOpen;
            const hasUnread = policy.notifications?.length > 0;
            const isActive = selected?.id === policy.id;
            return (
              <button
                key={policy.id}
                onClick={() => selectPolicy(policy)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-right transition-all"
                style={{
                  backgroundColor: isActive ? "rgba(94,84,149,0.08)" : "transparent",
                  border: isActive ? "1px solid rgba(94,84,149,0.2)" : "1px solid transparent",
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isActive ? "#5E5495" : "#F0EDE6" }}
                >
                  <IconComp size={18} style={{ color: isActive ? "white" : "#5E5495" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isActive ? "#5E5495" : "#1C1B2E" }}
                  >
                    {policy.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                    {formatDate(policy.updatedAt).split("،")[0]}
                  </p>
                </div>
                {hasUnread && (
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse"
                    style={{ backgroundColor: "#C9A84C" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Admin: manage link */}
        {isAdmin && (
          <div className="p-3 border-t" style={{ borderColor: "#F0EDE6" }}>
            <MarsaButton href="/dashboard/policies/manage" variant="primary" className="w-full">
              إدارة اللوائح
            </MarsaButton>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {selected ? (
          <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2" style={{ color: "#1C1B2E" }}>
                  {selected.title}
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
                    style={{ backgroundColor: "#EAE8F5", color: "#5E5495" }}
                  >
                    <Clock size={12} />
                    آخر تحديث: {formatDate(selected.updatedAt)}
                  </span>
                  {selected.updatedBy && (
                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                      بواسطة: {selected.updatedBy.name}
                    </span>
                  )}
                </div>
              </div>
              {isAdmin && (
                <MarsaButton href={`/dashboard/policies/manage?id=${selected.id}`} variant="gold">
                  تعديل
                </MarsaButton>
              )}
            </div>

            {/* Content */}
            <div
              className="rounded-2xl p-8 prose-rtl"
              style={{
                backgroundColor: "white",
                border: "1px solid #E2E0D8",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                lineHeight: 2,
                color: "#2D3748",
                fontSize: "15px",
              }}
              dangerouslySetInnerHTML={{ __html: selected.content }}
            />

            {/* Acknowledgment */}
            <div
              className="mt-4 flex items-center gap-3 p-4 rounded-xl"
              style={{ backgroundColor: "#DCFCE7", border: "1px solid #BBF7D0" }}
            >
              <CheckCircle2 size={20} style={{ color: "#16A34A" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#15803D" }}>
                  تم الاطلاع على هذه اللائحة
                </p>
                <p className="text-xs" style={{ color: "#16A34A" }}>
                  تأكيد الاطلاع يتم تلقائياً عند فتح اللائحة
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <BookOpen size={48} style={{ color: "#E2E0D8" }} className="mb-4" />
            <p style={{ color: "#94A3B8" }}>اختر لائحة من القائمة لعرضها</p>
          </div>
        )}
      </div>
    </div>
  );
}
