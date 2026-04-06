"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Layers, Briefcase, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  project: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
  status: string;
  progress: number;
  client: { name: string } | null;
}

interface Service {
  id: string;
  service: { id: string; name: string; category: string | null };
}

const taskStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO:        { label: "للتنفيذ",     bg: "#F3F4F6", text: "#6B7280" },
  WAITING:     { label: "في الانتظار", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#EFF6FF", text: "#2563EB" },
  IN_REVIEW:   { label: "للمراجعة",    bg: "#F5F3FF", text: "#7C3AED" },
  DONE:        { label: "مكتمل",       bg: "#ECFDF5", text: "#059669" },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW:      { label: "منخفضة", color: "#6B7280" },
  MEDIUM:   { label: "متوسطة", color: "#D97706" },
  HIGH:     { label: "عالية",  color: "#DC2626" },
  CRITICAL: { label: "حرجة",   color: "#7C3AED" },
};

export default function MyWorkspacePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tasks" | "projects" | "services">("tasks");
  const [taskFilter, setTaskFilter] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/my-tasks").then(r => r.json()),
      fetch("/api/my-projects").then(r => r.json()),
    ]).then(([tasksData, projectsData]) => {
      const allTasks = [
        ...(tasksData.overdue || []),
        ...(tasksData.today || []),
        ...(tasksData.thisWeek || []),
        ...(tasksData.later || []),
      ];
      setTasks(allTasks);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    }).finally(() => setLoading(false));

    // Get user's linked services
    fetch("/api/my-services").then(r => r.json()).then(d => {
      if (Array.isArray(d)) setServices(d);
    });
  }, []);

  const filteredTasks = tasks.filter(t => {
    if (taskFilter === "all") return true;
    return t.status === taskFilter;
  });

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
    todo: tasks.filter(t => t.status === "TODO" || t.status === "WAITING").length,
    done: tasks.filter(t => t.status === "DONE").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: "#1C1B2E" }}>مساحة عملي</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "إجمالي المهام", value: stats.total, color: "#1C1B2E" },
          { label: "قيد التنفيذ",   value: stats.inProgress, color: "#2563EB" },
          { label: "في الانتظار",   value: stats.todo, color: "#D97706" },
          { label: "مكتملة",        value: stats.done, color: "#059669" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 text-center"
            style={{ border: "1px solid #E2E0D8" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "tasks",    label: "المهام",    icon: CheckCircle },
          { key: "projects", label: "المشاريع",  icon: Layers },
          { key: "services", label: "خدماتي",    icon: Briefcase },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key as "tasks" | "projects" | "services")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: activeTab === tab.key ? "#1C1B2E" : "white",
                color: activeTab === tab.key ? "white" : "#6B7280",
                border: "1px solid #E2E0D8",
              }}>
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div>
          {/* Filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: "all", label: "الكل" },
              { key: "IN_PROGRESS", label: "قيد التنفيذ" },
              { key: "TODO", label: "للتنفيذ" },
              { key: "WAITING", label: "في الانتظار" },
              { key: "IN_REVIEW", label: "للمراجعة" },
            ].map(f => (
              <button key={f.key}
                onClick={() => setTaskFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: taskFilter === f.key ? "#1C1B2E" : "#F8F7F4",
                  color: taskFilter === f.key ? "white" : "#6B7280",
                }}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12" style={{ color: "#94A3B8" }}>
                <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
                <p>لا توجد مهام</p>
              </div>
            ) : filteredTasks.map(task => {
              const st = taskStatusConfig[task.status] || taskStatusConfig.TODO;
              const pr = priorityConfig[task.priority] || priorityConfig.MEDIUM;
              return (
                <div key={task.id} className="bg-white rounded-2xl p-4 flex items-center justify-between"
                  style={{ border: "1px solid #E2E0D8" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.color }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.project && (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>{task.project.name}</span>
                        )}
                        {task.service && (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>• {task.service.name}</span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs flex items-center gap-1" style={{ color: "#94A3B8" }}>
                            <Clock size={10} />
                            {new Date(task.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: st.bg, color: st.text }}>
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === "projects" && (
        <div className="space-y-3">
          {projects.length === 0 ? (
            <div className="text-center py-12" style={{ color: "#94A3B8" }}>
              <Layers size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد مشاريع</p>
            </div>
          ) : projects.map(project => (
            <Link key={project.id} href={`/dashboard/my-projects/${project.id}`}>
              <div className="bg-white rounded-2xl p-4 hover:shadow-md transition-all"
                style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>{project.name}</p>
                  <span className="text-sm font-bold" style={{ color: project.progress >= 75 ? "#059669" : "#C9A84C" }}>
                    {project.progress}%
                  </span>
                </div>
                {project.client && (
                  <p className="text-xs mb-2" style={{ color: "#94A3B8" }}>{project.client.name}</p>
                )}
                <div className="h-1.5 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
                  <div className="h-1.5 rounded-full transition-all"
                    style={{ width: `${project.progress}%`, backgroundColor: "#C9A84C" }} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Services Tab */}
      {activeTab === "services" && (
        <div className="space-y-2">
          {services.length === 0 ? (
            <div className="text-center py-12" style={{ color: "#94A3B8" }}>
              <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد خدمات مرتبطة</p>
            </div>
          ) : services.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-4"
              style={{ border: "1px solid #E2E0D8" }}>
              <p className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>{s.service.name}</p>
              {s.service.category && (
                <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{s.service.category}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
