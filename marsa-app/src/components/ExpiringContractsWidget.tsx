"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileWarning,
  Loader2,
  User,
} from "lucide-react";

interface ContractItem {
  id: string;
  contractNumber: number | null;
  endDate: string | null;
  daysRemaining: number | null;
  urgency: "critical" | "warning" | "normal";
  urgencyColor: string;
  client: { id: string; name: string } | null;
  linkedProjects: {
    id: string;
    name: string;
    department: { id: string; name: string; color: string | null } | null;
  }[];
}

interface Data {
  expiring: ContractItem[];
  expired: ContractItem[];
  counts: { critical: number; warning: number; expired: number };
}

interface Props {
  departmentId?: string;
  days?: number;
}

export default function ExpiringContractsWidget({ departmentId, days = 30 }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ days: String(days) });
    if (departmentId) params.set("departmentId", departmentId);
    fetch(`/api/contracts/expiring?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.expiring !== undefined) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [departmentId, days]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 flex items-center justify-center" style={{ border: "1px solid #E2E0D8" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (!data) return null;

  const hasItems = data.expiring.length > 0 || data.expired.length > 0;

  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileWarning size={18} style={{ color: "#EA580C" }} />
          <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>العقود المنتهية قريباً</h3>
        </div>
        <div className="flex items-center gap-2">
          {data.counts.critical > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
              {data.counts.critical} حرج
            </span>
          )}
          {data.counts.warning > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(234,88,12,0.1)", color: "#EA580C" }}>
              {data.counts.warning} تحذير
            </span>
          )}
          {data.counts.expired > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: "rgba(0,0,0,0.08)", color: "#1C1B2E" }}>
              {data.counts.expired} منتهي
            </span>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!hasItems && (
        <div className="text-center py-8">
          <Clock size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>لا توجد عقود منتهية قريباً</p>
        </div>
      )}

      {/* Expiring list */}
      {data.expiring.length > 0 && (
        <div className="space-y-2 mb-4">
          {data.expiring.map((c) => (
            <Link key={c.id} href={`/dashboard/contracts`}>
              <div
                className="flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-sm cursor-pointer"
                style={{ backgroundColor: `${c.urgencyColor}08`, border: `1px solid ${c.urgencyColor}20` }}
              >
                {/* Countdown circle */}
                <div
                  className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
                  style={{ backgroundColor: `${c.urgencyColor}15` }}
                >
                  <span className="text-base font-bold leading-none" style={{ color: c.urgencyColor }}>
                    {c.daysRemaining}
                  </span>
                  <span className="text-[9px]" style={{ color: c.urgencyColor }}>يوم</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                    {c.contractNumber ? `عقد #${c.contractNumber}` : "عقد"}
                    {c.linkedProjects[0] && ` — ${c.linkedProjects[0].name}`}
                  </p>
                  <div className="flex items-center gap-3 text-xs mt-0.5">
                    {c.client && (
                      <span className="flex items-center gap-1" style={{ color: "#6B7280" }}>
                        <User size={11} />
                        {c.client.name}
                      </span>
                    )}
                    {c.endDate && (
                      <span style={{ color: "#6B7280" }}>
                        ينتهي: {new Date(c.endDate).toLocaleDateString("ar-SA")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Urgency icon */}
                {c.urgency === "critical" && (
                  <AlertTriangle size={18} className="shrink-0" style={{ color: c.urgencyColor }} />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Expired list */}
      {data.expired.length > 0 && (
        <>
          <div className="my-3 flex items-center gap-2">
            <div className="flex-1 h-px" style={{ backgroundColor: "#E2E0D8" }} />
            <span className="text-xs font-medium" style={{ color: "#DC2626" }}>عقود منتهية</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#E2E0D8" }} />
          </div>
          <div className="space-y-2">
            {data.expired.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/dashboard/contracts`}>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "rgba(220,38,38,0.04)", border: "1px solid rgba(220,38,38,0.15)" }}>
                  <AlertTriangle size={16} style={{ color: "#DC2626" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: "#DC2626" }}>
                      {c.contractNumber ? `عقد #${c.contractNumber}` : "عقد"} — منتهي
                    </p>
                    <p className="text-xs truncate" style={{ color: "#6B7280" }}>
                      {c.client?.name} • {c.endDate && new Date(c.endDate).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
