"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight, Calendar, DollarSign, User, CheckCircle,
  Clock, Layers, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  order: number;
}

interface Service {
  id: string;
  name: string;
  status: string;
  price: number | null;
  duration: number | null;
  category: string | null;
  tasks: Task[];
}

interface Milestone {
  id: string;
  title: string;
  type: string;
  status: string;
  order: number;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  workflowType: string;
  totalPrice: number | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  manager: { id: string; name: string } | null;
  services: Service[];
  milestones: Milestone[];
}

const taskStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO:             { label: "للتنفيذ",      bg: "#F3F4F6", text: "#6B7280" },
  WAITING:          { label: "في الانتظار",  bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS:      { label: "قيد التنفيذ",  bg: "#EFF6FF", text: "#2563EB" },
  IN_REVIEW:        { label: "للمراجعة",     bg: "#F5F3FF", text: "#7C3AED" },
  DONE:             { label: "مكتمل",        bg: "#ECFDF5", text: "#059669" },
  CANCELLED:        { label: "ملغي",         bg: "#FEF2F2", text: "#DC2626" },
  WAITING_EXTERNAL: { label: "انتظار خارجي", bg: "#FFF7ED", text: "#D97706" },
};

const serviceStatusConfig: Record<string, { label: string; color: string }> = {
  PENDING:     { label: "في الانتظار", color: "#6B7280" },
  IN_PROGRESS: { label: "جاري",        color: "#2563EB" },
  COMPLETED:   { label: "مكتمل",      color: "#059669" },
  ON_HOLD:     { label: "موقوف",       color: "#EA580C" },
};

const milestoneStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  LOCKED:      { label: "مقفل",       bg: "#F3F4F6", text: "#6B7280" },
  IN_PROGRESS: { label: "جاري",       bg: "#EFF6FF", text: "#2563EB" },
  COMPLETED:   { label: "مكتمل",     bg: "#ECFDF5", text: "#059669" },
  PENDING:     { label: "في الانتظار", bg: "#FFF7ED", text: "#EA580C" },
};

export default function MyProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isClient = session?.user?.role === "CLIENT";
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          const total = data.tasks?.length || 0;
          const done = data.tasks?.filter((t: Task) => t.status === "DONE").length || 0;
          setProject({
            ...data,
            progress: total > 0 ? Math.round((done / total) * 100) : 0,
            totalTasks: total,
            completedTasks: done,
          });
          // Expand first service by default
          if (data.services?.length > 0) {
            setExpandedServices(new Set([data.services[0].id]));
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleService = (serviceId: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="w-8 h-8 border-4 rounded-full animate-spin"
          style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center" dir="rtl">
        <AlertCircle size={48} className="mx-auto mb-4" style={{ color: "#DC2626", opacity: 0.4 }} />
        <p style={{ color: "#DC2626" }}>المشروع غير موجود</p>
      </div>
    );
  }

  const progressColor = project.progress >= 75 ? "#059669" : project.progress >= 40 ? "#C9A84C" : "#2563EB";

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Back */}
      <MarsaButton onClick={() => router.push("/dashboard/my-projects")}
        variant="ghost" size="sm" icon={<ArrowRight size={16} />}
        className="mb-6">
        العودة للمشاريع
      </MarsaButton>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: "#1C1B2E" }}>{project.name}</h1>
            {project.description && (
              <p className="text-sm" style={{ color: "#6B7280" }}>{project.description}</p>
            )}
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}>
            {project.status === "ACTIVE" ? "نشط" : project.status}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "#6B7280" }}>
              {project.completedTasks}/{project.totalTasks} مهمة
            </span>
            <span className="text-lg font-bold" style={{ color: progressColor }}>
              {project.progress}%
            </span>
          </div>
          <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F4F6" }}>
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${project.progress}%`, backgroundColor: progressColor }} />
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {!isClient && project.manager && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <User size={14} style={{ color: "#C9A84C" }} />
              <span>{project.manager.name}</span>
            </div>
          )}
          {project.totalPrice && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <DollarSign size={14} style={{ color: "#C9A84C" }} />
              <span>{project.totalPrice.toLocaleString("en-US")} <SarSymbol size={12} /></span>
            </div>
          )}
          {project.startDate && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <Calendar size={14} style={{ color: "#C9A84C" }} />
              <span>{new Date(project.startDate).toLocaleDateString("ar-SA-u-nu-latn")}</span>
            </div>
          )}
          {project.endDate && (
            <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
              <Clock size={14} style={{ color: "#C9A84C" }} />
              <span>{new Date(project.endDate).toLocaleDateString("ar-SA-u-nu-latn")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {project.milestones?.length > 0 && (
        <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>مراحل المشروع</h2>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {project.milestones.sort((a, b) => a.order - b.order).map((m, idx) => {
              const st = milestoneStatusConfig[m.status] || milestoneStatusConfig.PENDING;
              return (
                <div key={m.id} className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1"
                      style={{ backgroundColor: st.bg, color: st.text }}>
                      {idx + 1}
                    </div>
                    <p className="text-xs max-w-[80px] text-center" style={{ color: "#2D3748" }}>{m.title}</p>
                    <span className="text-xs" style={{ color: st.text }}>{st.label}</span>
                  </div>
                  {idx < project.milestones.length - 1 && (
                    <div className="w-8 h-0.5 flex-shrink-0" style={{ backgroundColor: "#E8E6F0" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Services */}
      <div className="space-y-4">
        <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>الخدمات والمهام</h2>
        {project.services?.map((service, idx) => {
          const isExpanded = expandedServices.has(service.id);
          const svcDone = service.tasks.filter((t) => t.status === "DONE").length;
          const svcTotal = service.tasks.length;
          const svcProgress = svcTotal > 0 ? Math.round((svcDone / svcTotal) * 100) : 0;
          const svcSt = serviceStatusConfig[service.status] || serviceStatusConfig.PENDING;

          return (
            <div key={service.id} className="bg-white rounded-2xl overflow-hidden"
              style={{ border: "1px solid #E2E0D8" }}>
              <button onClick={() => toggleService(service.id)}
                className="w-full p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>
                    {idx + 1}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>{service.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {service.category && (
                        <span className="text-xs" style={{ color: "#94A3B8" }}>{service.category}</span>
                      )}
                      <span className="text-xs font-medium" style={{ color: svcSt.color }}>{svcSt.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-left">
                    <p className="text-sm font-bold" style={{ color: svcProgress === 100 ? "#059669" : "#C9A84C" }}>
                      {svcProgress}%
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>{svcDone}/{svcTotal}</p>
                  </div>
                  {isExpanded ? <ChevronUp size={16} style={{ color: "#94A3B8" }} /> : <ChevronDown size={16} style={{ color: "#94A3B8" }} />}
                </div>
              </button>

              {isExpanded && service.tasks.length > 0 && (
                <div className="px-5 pb-5 space-y-2" style={{ borderTop: "1px solid #F0EDE6" }}>
                  <div className="pt-3 space-y-2">
                    {service.tasks.sort((a, b) => a.order - b.order).map((task, taskIdx) => {
                      const tSt = taskStatusConfig[task.status] || taskStatusConfig.TODO;
                      return (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-xl"
                          style={{ backgroundColor: "#F8F7F4" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: tSt.bg }}>
                              {task.status === "DONE"
                                ? <CheckCircle size={12} style={{ color: tSt.text }} />
                                : <Clock size={12} style={{ color: tSt.text }} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{
                                color: task.status === "DONE" ? "#94A3B8" : "#2D3748",
                                textDecoration: task.status === "DONE" ? "line-through" : "none"
                              }}>
                                {isClient
                                  ? `مهمة ${taskIdx + 1} من ${svcTotal}`
                                  : task.title}
                              </p>
                              {!isClient && (
                                <div className="flex items-center gap-2 mt-0.5">
                                  {task.assignee && (
                                    <span className="text-xs" style={{ color: "#94A3B8" }}>{task.assignee.name}</span>
                                  )}
                                  {task.dueDate && (
                                    <span className="text-xs" style={{ color: "#94A3B8" }}>
                                      {new Date(task.dueDate).toLocaleDateString("ar-SA-u-nu-latn", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: tSt.bg, color: tSt.text }}>
                            {tSt.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
