"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FolderKanban, Loader2, Users2, ChevronLeft, CheckCircle2, Clock, ListChecks } from "lucide-react";
import ProjectCodeBadge from "@/components/ProjectCodeBadge";

interface TaskFromAPI {
  id: string;
  status: string;
  service: { id: string; name: string } | null;
  project: {
    id: string;
    name: string;
    projectCode?: string | null;
    client: { id: string; name: string } | null;
    services?: {
      id: string;
      name: string;
      tasks: { id: string; status: string }[];
    }[];
  } | null;
}

interface ProjectSummary {
  id: string;
  name: string;
  projectCode: string | null;
  clientName: string;
  myTasksCount: number;
  myDoneCount: number;
  myInProgressCount: number;
  totalTasks: number;
  totalDone: number;
  services: string[];
}

export default function MyProjectsPage() {
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clientProjects, setClientProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { document.title = "مشاريعي | مرسى"; }, []);

  useEffect(() => {
    if (!session) return;

    if (isClient) {
      fetch("/api/my-projects")
        .then((r) => { if (!r.ok) throw new Error("فشل"); return r.json(); })
        .then((data) => setClientProjects(data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      fetch("/api/my-tasks/all?limit=500")
        .then((r) => { if (!r.ok) throw new Error("فشل"); return r.json(); })
        .then((data) => {
          const tasks: TaskFromAPI[] = data.tasks || [];
          const map = new Map<string, ProjectSummary>();
          for (const t of tasks) {
            if (!t.project) continue;
            let p = map.get(t.project.id);
            if (!p) {
              const allTasks = (t.project.services || []).flatMap((s) => s.tasks);
              p = {
                id: t.project.id,
                name: t.project.name,
                projectCode: t.project.projectCode || null,
                clientName: t.project.client?.name || "",
                myTasksCount: 0,
                myDoneCount: 0,
                myInProgressCount: 0,
                totalTasks: allTasks.length,
                totalDone: allTasks.filter((tk) => tk.status === "DONE").length,
                services: [],
              };
              map.set(t.project.id, p);
            }
            p.myTasksCount++;
            if (t.status === "DONE") p.myDoneCount++;
            if (t.status === "IN_PROGRESS") p.myInProgressCount++;
            if (t.service && !p.services.includes(t.service.name)) {
              p.services.push(t.service.name);
            }
          }
          setProjects(Array.from(map.values()));
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [session, isClient]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" dir="rtl">
        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
          {error}
        </div>
      </div>
    );
  }

  // Client view - use original API data
  if (isClient) {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: "#F3F4F6", text: "#6B7280", label: "مسودة" },
      ACTIVE: { bg: "#ECFDF5", text: "#059669", label: "نشط" },
      ON_HOLD: { bg: "#FFF7ED", text: "#EA580C", label: "معلق" },
      COMPLETED: { bg: "#EFF6FF", text: "#2563EB", label: "مكتمل" },
      CANCELLED: { bg: "#FEF2F2", text: "#DC2626", label: "ملغي" },
    };
    return (
      <div className="p-8" dir="rtl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>مشاريعي</h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>تابع جميع مشاريعك وحالة تقدمها</p>
        </div>
        {clientProjects.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
            <FolderKanban size={32} className="mx-auto mb-4" style={{ color: "#C9A84C" }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>لا توجد مشاريع حالياً</h3>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clientProjects.map((proj: Record<string, unknown>) => {
              const st = statusConfig[(proj.status as string) || "DRAFT"] || statusConfig.DRAFT;
              const progress = (proj.progress as number) || 0;
              return (
                <Link key={proj.id as string} href={`/dashboard/my-projects/${proj.id}`}>
                  <div className="rounded-2xl p-6 transition-all duration-300 cursor-pointer bg-white" style={{ border: "1px solid #E2E0D8" }}>
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="text-base font-bold flex-1 ml-2" style={{ color: "#2D3748" }}>{proj.name as string}</h3>
                      <ChevronLeft size={18} style={{ color: "#C9A84C" }} />
                    </div>
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <ProjectCodeBadge code={proj.projectCode as string | null} size="xs" />
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    </div>
                    <div className="mt-4 mb-2">
                      <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                        <div className="h-2 rounded-full" style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#059669" : "#C9A84C" }} />
                      </div>
                      <p className="text-xs mt-1 text-left" style={{ color: "#C9A84C" }}>{progress}%</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Executor/Provider view
  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>مشاريعي</h1>
        <p className="text-sm" style={{ color: "#6B7280" }}>المشاريع التي لديك مهام فيها</p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
          <FolderKanban size={32} className="mx-auto mb-4" style={{ color: "#C9A84C" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>لا توجد مشاريع حالياً</h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>ستظهر مشاريعك هنا بمجرد إسناد مهام إليك</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const myProgress = proj.myTasksCount > 0 ? Math.round((proj.myDoneCount / proj.myTasksCount) * 100) : 0;
            const totalProgress = proj.totalTasks > 0 ? Math.round((proj.totalDone / proj.totalTasks) * 100) : 0;
            return (
              <Link key={proj.id} href={`/dashboard/my-projects/${proj.id}`}>
                <div
                  className="rounded-2xl p-6 transition-all duration-300 cursor-pointer"
                  style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 25px rgba(27,42,74,0.1)"; e.currentTarget.style.borderColor = "#C9A84C"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)"; e.currentTarget.style.borderColor = "#E8E6F0"; }}
                >
                  {/* Title */}
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="text-base font-bold flex-1 ml-2" style={{ color: "#2D3748" }}>{proj.name}</h3>
                    <ChevronLeft size={18} style={{ color: "#C9A84C" }} />
                  </div>
                  <div className="mb-3">
                    <ProjectCodeBadge code={proj.projectCode} size="xs" />
                  </div>

                  {/* Client */}
                  {proj.clientName && (
                    <div className="flex items-center gap-1.5 mb-4 text-xs" style={{ color: "#6B7280" }}>
                      <Users2 size={14} />
                      <span>{proj.clientName}</span>
                    </div>
                  )}

                  {/* My task stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "#F0EEF5" }}>
                      <ListChecks size={16} className="mx-auto mb-1" style={{ color: "#1C1B2E" }} />
                      <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{proj.myTasksCount}</p>
                      <p className="text-[10px]" style={{ color: "#6B7280" }}>مهامي</p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "#DBEAFE" }}>
                      <Clock size={16} className="mx-auto mb-1" style={{ color: "#2563EB" }} />
                      <p className="text-lg font-bold" style={{ color: "#2563EB" }}>{proj.myInProgressCount}</p>
                      <p className="text-[10px]" style={{ color: "#6B7280" }}>قيد التنفيذ</p>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ backgroundColor: "#DCFCE7" }}>
                      <CheckCircle2 size={16} className="mx-auto mb-1" style={{ color: "#059669" }} />
                      <p className="text-lg font-bold" style={{ color: "#059669" }}>{proj.myDoneCount}</p>
                      <p className="text-[10px]" style={{ color: "#6B7280" }}>مكتملة</p>
                    </div>
                  </div>

                  {/* My progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "#6B7280" }}>تقدمي</span>
                      <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>{myProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${myProgress}%`, backgroundColor: myProgress === 100 ? "#059669" : "#C9A84C" }} />
                    </div>
                  </div>

                  {/* Total progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: "#6B7280" }}>تقدم المشروع</span>
                      <span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>{totalProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
                      <div className="h-2 rounded-full transition-all" style={{ width: `${totalProgress}%`, backgroundColor: totalProgress === 100 ? "#059669" : "#2563EB" }} />
                    </div>
                  </div>

                  {/* Services */}
                  {proj.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3" style={{ borderTop: "1px solid #F0EDE6" }}>
                      {proj.services.map((s) => (
                        <span key={s} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
