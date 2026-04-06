"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, Eye, X, Search, Shield, User, Briefcase, Wrench, Building2 } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const roleConfig: Record<string, { label: string; color: string; bg: string; icon: typeof User }> = {
  ADMIN:             { label: "مدير النظام",    color: "#DC2626", bg: "#FEF2F2", icon: Shield },
  MANAGER:           { label: "مدير",           color: "#7C3AED", bg: "#F5F3FF", icon: Shield },
  CLIENT:            { label: "عميل",           color: "#2563EB", bg: "#EFF6FF", icon: Building2 },
  EXECUTOR:          { label: "منفذ",           color: "#059669", bg: "#ECFDF5", icon: Wrench },
  EXTERNAL_PROVIDER: { label: "مورد",            color: "#D97706", bg: "#FFF7ED", icon: Briefcase },
  FINANCE_MANAGER:   { label: "مدير مالي",      color: "#0891B2", bg: "#ECFEFF", icon: Shield },
  TREASURY_MANAGER:  { label: "أمين الصندوق",   color: "#0891B2", bg: "#ECFEFF", icon: Shield },
};

export default function UserPreviewPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string | null>(null);

  useEffect(() => {
    document.title = "استعراض المستخدمين | مرسى";
    // Check if already impersonating
    const cookie = document.cookie.split(";").find((c) => c.trim().startsWith("impersonate_user_id="));
    if (cookie) {
      setImpersonating(cookie.split("=")[1]);
    }

    fetch("/api/users")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setUsers(d); })
      .finally(() => setLoading(false));
  }, []);

  const handleImpersonate = async (user: UserItem) => {
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) throw new Error();
      setImpersonating(user.id);
      setActiveName(user.name);
      // Redirect to dashboard as that user
      window.location.href = "/dashboard";
    } catch {
      alert("حدث خطأ");
    }
  };

  const handleStopImpersonating = async () => {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    setImpersonating(null);
    setActiveName(null);
    window.location.href = "/dashboard";
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const grouped = Object.keys(roleConfig).reduce((acc, role) => {
    acc[role] = filtered.filter((u) => u.role === role);
    return acc;
  }, {} as Record<string, UserItem[]>);

  return (
    <div className="p-8" dir="rtl">
      {/* Impersonation Banner */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 py-3"
          style={{ backgroundColor: "#7C3AED", color: "white" }}>
          <div className="flex items-center gap-2">
            <Eye size={18} />
            <span className="text-sm font-semibold">تستعرض النظام كـ: {activeName}</span>
          </div>
          <MarsaButton onClick={handleStopImpersonating}
            variant="ghost"
            size="sm"
            icon={<X size={14} />}
            style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "white" }}>
            إيقاف الاستعراض
          </MarsaButton>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>استعراض واجهات المستخدمين</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          اضغط على أي مستخدم لتجربة النظام من منظوره كاملاً
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-white rounded-xl px-4 py-2.5"
          style={{ border: "1px solid #E2E0D8" }}>
          <Search size={16} style={{ color: "#94A3B8" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="flex-1 text-sm outline-none bg-transparent" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-white rounded-xl px-4 py-2.5 text-sm outline-none"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>
          <option value="">كل الأدوار</option>
          {Object.entries(roleConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(roleConfig).map(([role, config]) => {
            const roleUsers = grouped[role];
            if (!roleUsers || roleUsers.length === 0) return null;
            const RoleIcon = config.icon;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: config.bg }}>
                    <RoleIcon size={14} style={{ color: config.color }} />
                  </div>
                  <h2 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                    {config.label}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: config.bg, color: config.color }}>
                    {roleUsers.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {roleUsers.map((user) => (
                    <div key={user.id}
                      className="bg-white rounded-2xl p-4 flex items-center justify-between transition-all hover:shadow-md"
                      style={{
                        border: impersonating === user.id
                          ? `2px solid ${config.color}`
                          : "1px solid #E2E0D8"
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                          style={{ backgroundColor: config.bg, color: config.color }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>{user.name}</p>
                          <p className="text-xs" style={{ color: "#94A3B8" }}>{user.email}</p>
                        </div>
                      </div>
                      {impersonating === user.id ? (
                        <MarsaButton onClick={handleStopImpersonating}
                          variant="ghost" size="sm" icon={<X size={12} />}
                          style={{ backgroundColor: config.bg, color: config.color }}>
                          إيقاف
                        </MarsaButton>
                      ) : (
                        <MarsaButton onClick={() => handleImpersonate(user)} variant="primary" size="sm" icon={<Eye size={12} />}>
                          استعراض
                        </MarsaButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
