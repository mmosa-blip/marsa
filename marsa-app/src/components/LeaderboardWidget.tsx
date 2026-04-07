"use client";

import { useEffect, useState } from "react";
import { Trophy, Loader2, CheckCircle2, Clock, Target } from "lucide-react";

interface Row {
  id: string;
  name: string;
  role: string;
  completedTasks: number;
  avgExecutionHours: number;
  onTimePercentage: number;
  rank: number;
}

interface Data {
  rows: Row[];
  currentUserId: string;
}

const PODIUM = [
  { medal: "🥇", color: "#C9A84C", bg: "linear-gradient(180deg, rgba(201,168,76,0.18), rgba(201,168,76,0.04))", border: "rgba(201,168,76,0.4)" },
  { medal: "🥈", color: "#9CA3AF", bg: "linear-gradient(180deg, rgba(156,163,175,0.18), rgba(156,163,175,0.04))", border: "rgba(156,163,175,0.4)" },
  { medal: "🥉", color: "#B45309", bg: "linear-gradient(180deg, rgba(180,83,9,0.18), rgba(180,83,9,0.04))", border: "rgba(180,83,9,0.4)" },
];

export default function LeaderboardWidget() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rows) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 flex items-center justify-center" style={{ border: "1px solid #E2E0D8" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} style={{ color: "#C9A84C" }} />
          <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>لوحة المتصدرين</h3>
        </div>
        <p className="text-center text-xs py-6" style={{ color: "#9CA3AF" }}>لا توجد بيانات بعد</p>
      </div>
    );
  }

  const top3 = data.rows.slice(0, 3);
  const rest = data.rows.slice(3);

  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy size={20} style={{ color: "#C9A84C" }} />
          <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>لوحة المتصدرين</h3>
        </div>
        <span className="text-[10px]" style={{ color: "#9CA3AF" }}>كل الأوقات</span>
      </div>

      {/* Podium for top 3 */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Render order: 2nd, 1st, 3rd visually, but desktop RTL flips it;
              we just put rank 1 in the middle by re-ordering */}
          {[top3[1], top3[0], top3[2]].filter(Boolean).map((row) => {
            const cfg = PODIUM[row.rank - 1];
            const isCurrent = row.id === data.currentUserId;
            const isFirst = row.rank === 1;
            return (
              <div
                key={row.id}
                className="rounded-2xl p-4 flex flex-col items-center text-center transition-all"
                style={{
                  background: cfg.bg,
                  border: isCurrent ? `2px solid #5E5495` : `1px solid ${cfg.border}`,
                  transform: isFirst ? "translateY(-8px)" : "none",
                }}
              >
                <span className={isFirst ? "text-4xl mb-2" : "text-3xl mb-2"}>{cfg.medal}</span>
                <p className="text-sm font-bold mb-2 truncate w-full" style={{ color: "#1C1B2E" }} title={row.name}>
                  {row.name}
                  {isCurrent && <span className="text-[9px] mr-1" style={{ color: "#5E5495" }}>(أنت)</span>}
                </p>
                <div className="flex flex-col items-center gap-0.5 w-full">
                  <span className="text-[11px] flex items-center gap-1 font-bold" style={{ color: cfg.color }}>
                    <CheckCircle2 size={11} />
                    {row.completedTasks} مهمة
                  </span>
                  <span className="text-[9px] flex items-center gap-1" style={{ color: "#6B7280" }}>
                    <Target size={9} />
                    {row.onTimePercentage}% في الوقت
                  </span>
                  {row.avgExecutionHours > 0 && (
                    <span className="text-[9px] flex items-center gap-1" style={{ color: "#6B7280" }}>
                      <Clock size={9} />
                      {row.avgExecutionHours} س متوسط
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest table */}
      {rest.length > 0 && (
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid #F0EDE6" }}>
          <table className="w-full text-xs">
            <thead style={{ backgroundColor: "#FAFAF8" }}>
              <tr>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "#6B7280", width: 40 }}>#</th>
                <th className="text-right px-3 py-2 font-semibold" style={{ color: "#6B7280" }}>المنفذ</th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: "#6B7280" }} title="عدد المهام المنجزة">
                  <CheckCircle2 size={12} className="inline" />
                </th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: "#6B7280" }} title="متوسط وقت إنجاز المهمة (ساعة)">
                  <Clock size={12} className="inline" />
                </th>
                <th className="text-center px-3 py-2 font-semibold" style={{ color: "#6B7280" }} title="نسبة الإنجاز في الوقت">
                  <Target size={12} className="inline" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rest.map((row) => {
                const isCurrent = row.id === data.currentUserId;
                return (
                  <tr
                    key={row.id}
                    style={{
                      backgroundColor: isCurrent ? "rgba(94,84,149,0.06)" : "white",
                      borderTop: "1px solid #F0EDE6",
                    }}
                  >
                    <td className="px-3 py-2 font-bold" style={{ color: "#9CA3AF" }}>{row.rank}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium" style={{ color: "#1C1B2E" }}>
                        {row.name}
                        {isCurrent && (
                          <span className="text-[9px] mr-1" style={{ color: "#5E5495" }}>(أنت)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center" style={{ color: "#1C1B2E" }}>{row.completedTasks}</td>
                    <td className="px-3 py-2 text-center" style={{ color: "#6B7280" }}>
                      {row.avgExecutionHours > 0 ? `${row.avgExecutionHours} س` : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          backgroundColor:
                            row.onTimePercentage >= 80
                              ? "rgba(34,197,94,0.1)"
                              : row.onTimePercentage >= 50
                                ? "rgba(201,168,76,0.1)"
                                : "rgba(220,38,38,0.1)",
                          color:
                            row.onTimePercentage >= 80
                              ? "#22C55E"
                              : row.onTimePercentage >= 50
                                ? "#C9A84C"
                                : "#DC2626",
                        }}
                      >
                        {row.onTimePercentage}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 text-[10px]" style={{ color: "#9CA3AF", borderTop: "1px solid #F0EDE6" }}>
        <span className="flex items-center gap-1"><CheckCircle2 size={10} /> منجزة</span>
        <span className="flex items-center gap-1"><Clock size={10} /> متوسط الوقت</span>
        <span className="flex items-center gap-1"><Target size={10} /> في الوقت</span>
      </div>
    </div>
  );
}
