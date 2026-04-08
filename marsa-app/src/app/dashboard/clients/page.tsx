"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Users2, Search, Filter, Building2, FolderKanban,
  Briefcase, DollarSign, UserPlus, TrendingUp,
  Shield, ShieldAlert, ShieldOff, FileWarning, Download, Trash2, Upload,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Client {
  id: string; name: string; email: string; phone: string | null;
  companyName: string | null; projectCount: number; activeProjects: number;
  serviceCount: number; totalRevenue: number; isActive: boolean; createdAt: string;
  authorizationType: string;
  totalDocuments: number; expiredDocs: number; expiringDocs: number;
}

const authLabels: Record<string, { label: string; color: string; bg: string; icon: typeof Shield }> = {
  FULL: { label: "تفويض شامل", color: "#059669", bg: "rgba(5,150,105,0.08)", icon: Shield },
  PER_SERVICE: { label: "لكل خدمة", color: "#C9A84C", bg: "rgba(201,168,76,0.1)", icon: ShieldAlert },
  NONE: { label: "بدون تفويض", color: "#94A3B8", bg: "rgba(148,163,184,0.1)", icon: ShieldOff },
};

export default function ClientsPage() {
  const { data: session } = useSession();
  // Client deletion is restricted to ADMIN/MANAGER server-side. Mirror the
  // same gate in the UI so EXECUTORs (and other roles) don't see a button
  // that would only ever return a 403.
  const canDeleteClients =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => { document.title = "العملاء | مرسى"; }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    const timer = setTimeout(() => {
      fetch(`/api/clients?${params}`)
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setClients(d); setLoading(false); })
        .catch(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.isActive).length;
  const totalActiveProjects = clients.reduce((s, c) => s + c.activeProjects, 0);
  const totalRevenue = clients.reduce((s, c) => s + c.totalRevenue, 0);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/clients/${id}`, { method: "DELETE" });
      setClients((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const stats = [
    { label: "إجمالي العملاء", value: totalClients, icon: Users2, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)", isCurrency: false },
    { label: "العملاء النشطين", value: activeClients, icon: TrendingUp, color: "#059669", bg: "rgba(5,150,105,0.08)", isCurrency: false },
    { label: "المشاريع الجارية", value: totalActiveProjects, icon: FolderKanban, color: "#C9A84C", bg: "rgba(201,168,76,0.1)", isCurrency: false },
    { label: "إجمالي الإيرادات", value: totalRevenue, icon: DollarSign, color: "#2563EB", bg: "rgba(37,99,235,0.08)", isCurrency: true },
  ];

  return (
    <div className="p-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>العملاء</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>إدارة العملاء ومتابعة مشاريعهم وخدماتهم</p>
        </div>
        <div className="flex items-center gap-2">
          <MarsaButton href="/dashboard/clients/import" variant="outline" size="md" icon={<Upload size={16} />}>
            استيراد Excel
          </MarsaButton>
          <MarsaButton href="/dashboard/clients/new" variant="primary" size="lg" icon={<UserPlus size={18} />}>
            عميل جديد
          </MarsaButton>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value.toLocaleString("en-US")}
              {s.isCurrency && <SarSymbol size={12} />}
            </p>
          </div>
        ))}
      </div>

      {/* البحث والفلاتر */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap" style={{ border: "1px solid #E2E0D8" }}>
        <MarsaButton
          variant="primary"
          icon={<Download size={16} />}
          onClick={() => {
            const headers = [
              { key: "name", label: "الاسم" },
              { key: "companyName", label: "الشركة" },
              { key: "email", label: "البريد الإلكتروني" },
              { key: "projectCount", label: "عدد المشاريع" },
            ];
            const rows = clients.map((c) => ({
              name: c.name,
              companyName: c.companyName || "—",
              email: c.email,
              projectCount: c.projectCount,
            }));
            exportToExcel(rows, headers, "clients");
          }}
        >
          تصدير Excel
        </MarsaButton>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} style={{ color: "#94A3B8" }} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو البريد..." className="flex-1 py-2 text-sm outline-none" style={{ color: "#2D3748" }} />
        </div>
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل العملاء</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : clients.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Users2 size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا يوجد عملاء</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => {
            const auth = authLabels[client.authorizationType] || authLabels.NONE;
            const AuthIcon = auth.icon;
            return (
              <div key={client.id} className="relative group">
              <Link href={`/dashboard/clients/${client.id}`} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg block" style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>
                    {client.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold truncate group-hover:text-[#C9A84C] transition-colors" style={{ color: "#1C1B2E" }}>{client.name}</h3>
                    {client.companyName && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 size={12} style={{ color: "#94A3B8" }} />
                        <span className="text-xs truncate" style={{ color: "#94A3B8" }}>{client.companyName}</span>
                      </div>
                    )}
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>{client.email}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium shrink-0" style={client.isActive ? { backgroundColor: "#ECFDF5", color: "#059669" } : { backgroundColor: "#F3F4F6", color: "#9CA3AF" }}>
                    {client.isActive ? "نشط" : "غير نشط"}
                  </span>
                </div>

                {/* التفويض والوثائق */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium" style={{ backgroundColor: auth.bg, color: auth.color }}>
                    <AuthIcon size={10} /> {auth.label}
                  </span>
                  {(client.expiredDocs > 0 || client.expiringDocs > 0) && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium" style={{ backgroundColor: client.expiredDocs > 0 ? "rgba(220,38,38,0.08)" : "rgba(234,88,12,0.08)", color: client.expiredDocs > 0 ? "#DC2626" : "#EA580C" }}>
                      <FileWarning size={10} />
                      {client.expiredDocs > 0 ? `${client.expiredDocs} منتهية` : `${client.expiringDocs} تنتهي قريباً`}
                    </span>
                  )}
                </div>

                {/* إحصائيات */}
                <div className="grid grid-cols-3 gap-3 pt-3" style={{ borderTop: "1px solid #F0EDE6" }}>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <FolderKanban size={12} style={{ color: "#C9A84C" }} />
                      <span className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{client.projectCount}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "#94A3B8" }}>مشروع</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Briefcase size={12} style={{ color: "#C9A84C" }} />
                      <span className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{client.serviceCount}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "#94A3B8" }}>خدمة</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign size={12} style={{ color: "#059669" }} />
                      <span className="text-sm font-bold" style={{ color: "#059669" }}>{client.totalRevenue > 0 ? (client.totalRevenue / 1000).toFixed(0) + "K" : "0"}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "#94A3B8" }}>إيرادات</span>
                  </div>
                </div>
              </Link>
              {canDeleteClients && (
                confirmId === client.id ? (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg z-10" style={{ border: "1px solid #FCA5A5" }}>
                    <span className="text-xs font-medium" style={{ color: "#DC2626" }}>تأكيد الحذف؟</span>
                    <MarsaButton variant="danger" size="xs" onClick={() => handleDelete(client.id)} disabled={deletingId === client.id}>
                      {deletingId === client.id ? "..." : "نعم"}
                    </MarsaButton>
                    <MarsaButton variant="secondary" size="xs" onClick={() => setConfirmId(null)}>
                      لا
                    </MarsaButton>
                  </div>
                ) : (
                  <MarsaButton variant="dangerSoft" size="sm" iconOnly icon={<Trash2 size={15} />}
                    className="absolute top-3 left-3 hidden group-hover:flex"
                    onClick={(e) => { e.preventDefault(); setConfirmId(client.id); }} />
                )
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
