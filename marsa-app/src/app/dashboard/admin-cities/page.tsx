"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Search, Loader2, Users, ExternalLink } from "lucide-react";
import { ROUTES } from "@/lib/routes";

interface City {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
  specialization: string | null;
  projectCount: number;
  activeProjectCount: number;
  totalTasks: number;
  doneTasks: number;
  lastActivityAt: string | null;
}

const ROLE_AR: Record<string, string> = {
  EXECUTOR: "منفّذ",
  EXTERNAL_PROVIDER: "مزود خارجي",
};

function formatRel(d: string | null) {
  if (!d) return "—";
  const ts = new Date(d).getTime();
  const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (days < 1) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 7) return `قبل ${days} أيام`;
  if (days < 30) return `قبل ${Math.floor(days / 7)} أسبوع`;
  return `قبل ${Math.floor(days / 30)} شهر`;
}

export default function AdminCitiesPage() {
  const { data: session, status } = useSession();
  const [cities, setCities] = useState<City[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "idle">("all");

  useEffect(() => {
    document.title = "مدن المنفذين | مرسى";
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect("/dashboard");
      }
    }
  }, [status, session]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/cities-overview")
      .then((r) => r.json())
      .then((d) => {
        setCities(d.cities ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [status]);

  const filtered = useMemo(() => {
    if (!cities) return [];
    const q = search.trim().toLowerCase();
    return cities.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !(c.specialization ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (filter === "active" && c.activeProjectCount === 0) return false;
      if (filter === "idle" && c.activeProjectCount > 0) return false;
      return true;
    });
  }, [cities, search, filter]);

  const totals = useMemo(() => {
    const list = cities ?? [];
    return {
      executors: list.length,
      activeProjects: list.reduce((s, c) => s + c.activeProjectCount, 0),
      totalTasks: list.reduce((s, c) => s + c.totalTasks, 0),
      doneTasks: list.reduce((s, c) => s + c.doneTasks, 0),
    };
  }, [cities]);

  if (status === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  return (
    <div className="p-8" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            مدن المنفذين
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            نظرة شاملة على نشاط كل منفّذ ومشاريعه الحيّة
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#5E5495,#1B2A4A)", boxShadow: "0 4px 12px rgba(94,84,149,0.3)" }}>
          <Building2 size={22} className="text-white" />
        </div>
      </div>

      {/* Top totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="منفّذون" value={totals.executors} icon={Users} color="#5E5495" />
        <Stat label="مشاريع نشطة" value={totals.activeProjects} icon={Building2} color="#C9A84C" />
        <Stat label="مهام كلية" value={totals.totalTasks} icon={Building2} color="#2563EB" />
        <Stat label="مهام منجزة" value={totals.doneTasks} icon={Building2} color="#059669" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو التخصص..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            style={{ borderColor: "#E5E7EB" }}
          />
        </div>
        {(["all", "active", "idle"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={
              filter === k
                ? { backgroundColor: "#5E5495", color: "white" }
                : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
            }
          >
            {k === "all" ? "الكل" : k === "active" ? "نشطون" : "خاملون"}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <Building2 size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>لا منفّذون مطابقون للبحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const progress = c.totalTasks ? Math.round((c.doneTasks / c.totalTasks) * 100) : 0;
            return (
              <div key={c.id} className="bg-white rounded-2xl p-5 transition-shadow hover:shadow-lg"
                style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#1B2A4A,#5E5495)", color: "white", fontWeight: 700 }}>
                    {c.avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={c.avatar} alt={c.name} className="w-full h-full rounded-xl object-cover" />
                      : (c.name.charAt(0) || "؟")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate" style={{ color: "#1C1B2E" }}>{c.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      {ROLE_AR[c.role] ?? c.role}{c.specialization ? ` · ${c.specialization}` : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <Mini label="نشطة" value={c.activeProjectCount} color="#C9A84C" />
                  <Mini label="مهام" value={c.totalTasks} color="#2563EB" />
                  <Mini label="منجزة" value={c.doneTasks} color="#059669" />
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: "#6B7280" }}>التقدم</span>
                    <span style={{ color: "#1C1B2E" }} className="font-semibold">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
                    <div
                      className="h-full transition-all"
                      style={{ width: `${progress}%`, background: "linear-gradient(90deg,#C9A84C,#5E5495)" }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>
                    آخر نشاط: {formatRel(c.lastActivityAt)}
                  </span>
                  <Link
                    href={`/dashboard/users/${c.id}`}
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ color: "#5E5495" }}
                  >
                    عرض الملف
                    <ExternalLink size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: typeof Users; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4" style={{ border: "1px solid #E2E0D8" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{value}</p>
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{label}</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: "#6B7280" }}>{label}</p>
    </div>
  );
}
