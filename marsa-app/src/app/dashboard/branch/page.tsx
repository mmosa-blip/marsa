"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Users,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
} from "lucide-react";
import ProjectCodeBadge from "@/components/ProjectCodeBadge";

interface SubordinateProject {
  id: string;
  name: string;
  projectCode: string | null;
  status: string;
}

interface Subordinate {
  id: string;
  name: string;
  phone: string;
  role: string;
  totalTasks: number;
  doneTasks: number;
  activeTasks: number;
  lateTasks: number;
  projects: SubordinateProject[];
}

export default function BranchPage() {
  const { data: session, status: authStatus } = useSession();
  const [subs, setSubs] = useState<Subordinate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role) {
      if (!["BRANCH_MANAGER", "ADMIN", "MANAGER"].includes(session.user.role)) {
        redirect("/dashboard");
      }
    }
  }, [authStatus, session]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/branch/overview")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setSubs(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <Users size={24} style={{ color: "#5E5495" }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>فريقي</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {subs.length} منفذ تحت إشرافك
          </p>
        </div>
      </div>

      {subs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <Users size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p className="text-sm" style={{ color: "#9CA3AF" }}>لا يوجد منفذين تابعين لك بعد</p>
        </div>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const progress = sub.totalTasks > 0
              ? Math.round((sub.doneTasks / sub.totalTasks) * 100)
              : 0;
            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl p-5"
                style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: "#5E5495" }}
                    >
                      {sub.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{sub.name}</p>
                      <p className="text-xs" style={{ color: "#9CA3AF" }}>{sub.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}>
                      <CheckCircle2 size={11} /> {sub.doneTasks}/{sub.totalTasks}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>
                      <Clock size={11} /> {sub.activeTasks} نشطة
                    </span>
                    {sub.lateTasks > 0 && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: "#DC2626" }}>
                        <AlertTriangle size={11} /> {sub.lateTasks} متأخرة
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[10px] mb-1" style={{ color: "#6B7280" }}>
                    <span>التقدم الإجمالي</span>
                    <span className="font-bold">{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: progress === 100 ? "#22C55E" : "#C9A84C",
                      }}
                    />
                  </div>
                </div>

                {/* Projects list */}
                {sub.projects.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <FolderKanban size={12} style={{ color: "#9CA3AF" }} />
                    {sub.projects.map((p) => (
                      <span
                        key={p.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}
                      >
                        {p.name}
                        {p.projectCode && <ProjectCodeBadge code={p.projectCode} size="xs" inline className="mr-1" />}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
