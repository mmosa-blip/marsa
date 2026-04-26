"use client";

/**
 * CityStatsBar — sticky pill row sitting above the canvas city. Six
 * counters (one per BuildingState plus an overall progress %) update
 * automatically from whatever projects array the parent passes in.
 *
 * Pure presentation: derives its numbers from getBuildingState +
 * isProjectComplete so the values can never disagree with what the
 * canvas actually draws.
 */

import { useMemo } from "react";
import {
  CityApiProject,
  BuildingState,
  getBuildingState,
  isProjectComplete,
} from "./CityCanvas";

interface StatRow {
  key: BuildingState | "OVERALL";
  label: string;
  icon: string;
  count: string;
  color: string;
  bg: string;
  border: string;
}

export default function CityStatsBar({ projects }: { projects: CityApiProject[] }) {
  const stats = useMemo<StatRow[]>(() => {
    const counts: Record<BuildingState, number> = {
      COMPLETED: 0,
      IN_PROGRESS: 0,
      TASK_LATE: 0,
      AT_RISK: 0,
      COLLAPSED: 0,
    };
    let progressSum = 0;

    for (const p of projects) {
      const isComplete = isProjectComplete(p);
      const state = getBuildingState({ ...p, isComplete });
      counts[state]++;
      progressSum += p.progress ?? 0;
    }

    const overall =
      projects.length > 0 ? Math.round(progressSum / projects.length) : 0;

    return [
      {
        key: "COMPLETED",
        label: "مكتمل",
        icon: "✅",
        count: String(counts.COMPLETED),
        color: "#10B981",
        bg: "rgba(16,185,129,0.10)",
        border: "rgba(16,185,129,0.30)",
      },
      {
        key: "IN_PROGRESS",
        label: "جارٍ",
        icon: "🏗️",
        count: String(counts.IN_PROGRESS),
        color: "#2563EB",
        bg: "rgba(37,99,235,0.10)",
        border: "rgba(37,99,235,0.30)",
      },
      {
        key: "TASK_LATE",
        label: "متأخر بمهمة",
        icon: "🚓",
        count: String(counts.TASK_LATE),
        color: "#D97706",
        bg: "rgba(217,119,6,0.10)",
        border: "rgba(217,119,6,0.32)",
      },
      {
        key: "AT_RISK",
        label: "متهالك",
        icon: "⚠️",
        count: String(counts.AT_RISK),
        color: "#EA580C",
        bg: "rgba(234,88,12,0.10)",
        border: "rgba(234,88,12,0.32)",
      },
      {
        key: "COLLAPSED",
        label: "منهار",
        icon: "💥",
        count: String(counts.COLLAPSED),
        color: "#DC2626",
        bg: "rgba(220,38,38,0.10)",
        border: "rgba(220,38,38,0.32)",
      },
      {
        key: "OVERALL",
        label: "إنجاز عام",
        icon: "📊",
        count: `${overall}%`,
        color: "#5E5495",
        bg: "rgba(94,84,149,0.10)",
        border: "rgba(94,84,149,0.32)",
      },
    ];
  }, [projects]);

  return (
    <div
      className="sticky top-0 z-30 px-4 lg:px-6 pt-2 pb-2"
      style={{
        backgroundColor: "rgba(247,246,242,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(226,224,216,0.6)",
      }}
    >
      <div
        className="flex items-center gap-2 overflow-x-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stats.map((s) => (
          <div
            key={s.key}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: s.bg,
              border: `1px solid ${s.border}`,
            }}
          >
            <span className="text-sm leading-none">{s.icon}</span>
            <span className="text-[11px] font-semibold" style={{ color: s.color }}>
              {s.label}
            </span>
            <span
              className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(255,255,255,0.85)", color: s.color }}
            >
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
