"use client";

/**
 * Cities Leaderboard at /dashboard/cities-leaderboard.
 *
 * Ranks every executor by the health of their "city" (set of assigned
 * projects). Top 3 wear medals. Each row links over to /dashboard/all-cities
 * with a focus query so the admin can drill into that executor's view.
 *
 * Auth: ADMIN / MANAGER. The page itself redirects on mismatch.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Loader2, Trophy, Building2, Eye } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { logger } from "@/lib/logger";

interface LeaderboardRow {
  id: string;
  name: string;
  completedCount: number;
  inProgressCount: number;
  taskLateCount: number;
  atRiskCount: number;
  collapsedCount: number;
  totalProjects: number;
  cityHealth: number;
  rank: number;
}

function medalFor(rank: number): { color: string; label: string } | null {
  if (rank === 1) return { color: "#C9A84C", label: "🥇" };
  if (rank === 2) return { color: "#94A3B8", label: "🥈" };
  if (rank === 3) return { color: "#CD7F32", label: "🥉" };
  return null;
}

// Health colour ramps red → amber → green so a single glance reads.
function healthColor(score: number): string {
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#C9A84C";
  if (score >= 25) return "#F59E0B";
  return "#DC2626";
}

export default function CitiesLeaderboardPage() {
  const { data: session, status } = useSession();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect(ROUTES.DASHBOARD);
      }
    }
  }, [status, session]);

  useEffect(() => {
    fetch("/api/admin/cities-leaderboard")
      .then((r) => r.json())
      .then((d) => {
        const list: LeaderboardRow[] = Array.isArray(d?.leaderboard) ? d.leaderboard : [];
        setRows(list);
      })
      .catch((err) => {
        logger.error("cities-leaderboard: failed to fetch", err);
        setRows([]);
      });
  }, []);

  if (status === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  return (
    <div className="flex flex-col h-full overflow-y-auto" dir="rtl">
      <div className="flex-shrink-0 px-6 pt-4 pb-3">
        <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Trophy size={22} style={{ color: "#C9A84C" }} />
          ترتيب المدن
        </h1>
        <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
          صحة مدينة كل منفذ مرتّبة من الأقوى للأضعف
        </p>
      </div>

      {!rows && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <Building2 size={32} style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#6B7280" }}>
            لا توجد بيانات لعرضها بعد
          </p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows.map((row) => {
              const medal = medalFor(row.rank);
              const isPodium = medal !== null;
              const hColor = healthColor(row.cityHealth);

              return (
                <div
                  key={row.id}
                  className="bg-white rounded-2xl p-4 transition-all hover:shadow-md"
                  style={{
                    border: isPodium ? `1.5px solid ${medal!.color}` : "1px solid #E2E0D8",
                    boxShadow: isPodium
                      ? `0 4px 16px ${medal!.color}25`
                      : "0 2px 6px rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex-shrink-0 flex items-center justify-center rounded-full font-bold"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: isPodium ? `${medal!.color}20` : "rgba(94,84,149,0.08)",
                          color: isPodium ? medal!.color : "#5E5495",
                          fontSize: isPodium ? 18 : 14,
                        }}
                      >
                        {isPodium ? medal!.label : `#${row.rank}`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                          {row.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                          {row.totalProjects} مبنى
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/all-cities?focus=${row.id}`}
                      title="عرض مدينته"
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all hover:shadow"
                      style={{
                        backgroundColor: "rgba(94,84,149,0.08)",
                        color: "#5E5495",
                        border: "1px solid rgba(94,84,149,0.2)",
                      }}
                    >
                      <Eye size={11} />
                      عرض
                    </Link>
                  </div>

                  {/* Health bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span style={{ color: "#6B7280" }}>صحة المدينة</span>
                      <span className="font-bold" style={{ color: hColor }}>
                        {row.cityHealth}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EEF5" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${row.cityHealth}%`,
                          background: `linear-gradient(90deg, ${hColor}99, ${hColor})`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stat tiles */}
                  <div className="grid grid-cols-5 gap-1.5">
                    <StatTile icon="✅" label="مكتمل" count={row.completedCount} color="#10B981" />
                    <StatTile icon="🏗️" label="جارٍ" count={row.inProgressCount} color="#2563EB" />
                    <StatTile icon="🚓" label="متأخر" count={row.taskLateCount} color="#D97706" />
                    <StatTile icon="⚠️" label="متهالك" count={row.atRiskCount} color="#EA580C" />
                    <StatTile icon="💥" label="منهار" count={row.collapsedCount} color="#DC2626" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  count,
  color,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
}) {
  const muted = count === 0;
  return (
    <div
      className="rounded-lg px-1.5 py-1 text-center"
      style={{
        backgroundColor: muted ? "rgba(0,0,0,0.03)" : `${color}12`,
        border: `1px solid ${muted ? "rgba(0,0,0,0.05)" : `${color}30`}`,
        opacity: muted ? 0.5 : 1,
      }}
    >
      <div className="text-[11px] leading-none mb-0.5">{icon}</div>
      <div className="text-sm font-bold leading-none" style={{ color: muted ? "#9CA3AF" : color }}>
        {count}
      </div>
      <div className="text-[8px] mt-0.5" style={{ color: "#9CA3AF" }}>
        {label}
      </div>
    </div>
  );
}
