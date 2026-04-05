"use client";

import { useState } from "react";
import {
  FileText,
  CreditCard,
  CheckCircle2,
  Wrench,
  Users,
  UserCog,
  Play,
  Trophy,
  Lock,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Phase {
  key: string;
  label: string;
  icon: typeof FileText;
  color: string;
}

const PHASES: Phase[] = [
  { key: "CONTRACT", label: "العقد", icon: FileText, color: "#5E5495" },
  { key: "PAYMENTS", label: "الدفعات", icon: CreditCard, color: "#C9A84C" },
  { key: "CONTRACT_APPROVAL", label: "اعتماد العقد", icon: CheckCircle2, color: "#2563EB" },
  { key: "SERVICES", label: "الخدمات", icon: Wrench, color: "#059669" },
  { key: "PROVIDERS", label: "المزودين", icon: Users, color: "#7C3AED" },
  { key: "MANAGER", label: "مدير المشروع", icon: UserCog, color: "#EA580C" },
  { key: "EXECUTION", label: "التنفيذ", icon: Play, color: "#0891B2" },
  { key: "COMPLETED", label: "مكتمل", icon: Trophy, color: "#059669" },
];

interface Props {
  projectId: string;
  currentPhase: string;
  onPhaseChange?: (newPhase: string) => void;
  isAdmin?: boolean;
}

export default function ProjectWorkflow({ projectId, currentPhase, onPhaseChange, isAdmin = false }: Props) {
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState("");

  const currentIdx = PHASES.findIndex((p) => p.key === currentPhase);

  const advancePhase = async () => {
    setAdvancing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/phase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "next" }),
      });
      const data = await res.json();
      if (res.ok) {
        onPhaseChange?.(data.phase);
      } else {
        setError(data.error || "حدث خطأ");
      }
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>مراحل المشروع</h3>
        {isAdmin && currentIdx < PHASES.length - 1 && (
          <MarsaButton
            variant="gold"
            size="sm"
            icon={advancing ? <Loader2 size={14} className="animate-spin" /> : <ChevronLeft size={14} />}
            onClick={advancePhase}
            disabled={advancing}
          >
            المرحلة التالية
          </MarsaButton>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm text-red-600" style={{ backgroundColor: "rgba(220,38,38,0.06)" }}>
          {error}
        </div>
      )}

      {/* Phase stepper */}
      <div className="relative">
        {PHASES.map((phase, idx) => {
          const Icon = phase.icon;
          const isCurrent = idx === currentIdx;
          const isCompleted = idx < currentIdx;
          const isLocked = idx > currentIdx;

          return (
            <div key={phase.key} className="flex items-start gap-4 mb-1 last:mb-0">
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
                  style={{
                    backgroundColor: isCompleted
                      ? phase.color
                      : isCurrent
                      ? `${phase.color}20`
                      : "rgba(0,0,0,0.04)",
                    border: isCurrent ? `2px solid ${phase.color}` : "2px solid transparent",
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={16} style={{ color: "#FFFFFF" }} />
                  ) : isLocked ? (
                    <Lock size={14} style={{ color: "#D1D5DB" }} />
                  ) : (
                    <Icon size={16} style={{ color: isCurrent ? phase.color : "#9CA3AF" }} />
                  )}
                </div>
                {idx < PHASES.length - 1 && (
                  <div
                    className="w-0.5 h-8"
                    style={{
                      backgroundColor: isCompleted ? phase.color : "rgba(0,0,0,0.08)",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <div className="pt-1.5 pb-4">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: isCompleted ? phase.color : isCurrent ? "#1C1B2E" : "#9CA3AF",
                  }}
                >
                  {phase.label}
                </p>
                {isCurrent && (
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: `${phase.color}15`, color: phase.color }}
                  >
                    المرحلة الحالية
                  </span>
                )}
                {isCompleted && (
                  <span className="text-[10px]" style={{ color: "#059669" }}>✓ مكتمل</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
