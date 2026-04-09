"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock,
  DollarSign,
  Edit3,
  GripVertical,
  ListChecks,
  Plus,
  Trash2,
  Users,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  X,
  UserPlus,
  Search,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import TaskRequirementsEditor from "@/components/TaskRequirementsEditor";

type TaskExecutionMode = "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  defaultDuration: number;
  sortOrder: number;
  executionMode: TaskExecutionMode;
  sameDay: boolean;
  isRequired: boolean;
}

interface QualifiedEmployee {
  id: string;
  assignedAt: string;
  user: { id: string; name: string; role: string; email: string };
}

interface TemplateDetail {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number | null;
  defaultDuration: number | null;
  workflowType: "SEQUENTIAL" | "INDEPENDENT";
  isActive: boolean;
  category: { id: string; name: string; color: string | null };
  taskTemplates: TaskTemplate[];
  qualifiedEmployees: QualifiedEmployee[];
}

interface EscalationEmployee {
  id: string;
  priority: number;
  userId: string;
  user: { id: string; name: string; role: string; email: string };
}

interface UserOption {
  id: string;
  name: string;
  role: string;
  email: string;
}

export default function ServiceTemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Task modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplate | null>(null);
  const [taskForm, setTaskForm] = useState({ name: "", description: "", defaultDuration: 1, sortOrder: 0, executionMode: "SEQUENTIAL" as TaskExecutionMode, sameDay: false, isRequired: true });

  // Employee modal
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [empSearch, setEmpSearch] = useState("");
  const [empResults, setEmpResults] = useState<UserOption[]>([]);
  const [empSearching, setEmpSearching] = useState(false);

  // Escalation employees
  const [escalations, setEscalations] = useState<EscalationEmployee[]>([]);
  const [showEscModal, setShowEscModal] = useState(false);
  const [escSearch, setEscSearch] = useState("");
  const [escResults, setEscResults] = useState<UserOption[]>([]);
  const [escSearching, setEscSearching] = useState(false);

  // Edit template modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", defaultPrice: "", defaultDuration: "", workflowType: "SEQUENTIAL" as "SEQUENTIAL" | "INDEPENDENT" });

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await fetch(`/api/service-catalog/templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplate(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [templateId]);

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await fetch(`/api/service-catalog/templates/${templateId}/escalation`);
      if (res.ok) setEscalations(await res.json());
    } catch {}
  }, [templateId]);

  useEffect(() => { fetchTemplate(); fetchEscalations(); }, [fetchTemplate, fetchEscalations]);

  // Search employees
  const searchEmployees = async (q: string) => {
    setEmpSearch(q);
    if (q.length < 2) { setEmpResults([]); return; }
    setEmpSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${q}&roles=ADMIN,MANAGER,EXECUTOR`);
      if (res.ok) {
        const data = await res.json();
        // Filter out already qualified employees
        const existingIds = template?.qualifiedEmployees.map(e => e.user.id) || [];
        setEmpResults(data.filter((u: UserOption) => !existingIds.includes(u.id) && ["ADMIN", "MANAGER", "EXECUTOR"].includes(u.role)));
      }
    } catch {} finally {
      setEmpSearching(false);
    }
  };

  // Add task
  const handleSaveTask = async () => {
    const method = editingTask ? "PATCH" : "POST";
    const url = editingTask
      ? `/api/service-catalog/task-templates/${editingTask.id}`
      : `/api/service-catalog/templates/${templateId}/tasks`;
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskForm),
    });
    if (res.ok) {
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({ name: "", description: "", defaultDuration: 1, sortOrder: 0, executionMode: "SEQUENTIAL" as TaskExecutionMode, sameDay: false, isRequired: true });
      fetchTemplate();
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) return;
    await fetch(`/api/service-catalog/task-templates/${id}`, { method: "DELETE" });
    fetchTemplate();
  };

  // Add employee
  const handleAddEmployee = async (userId: string) => {
    const res = await fetch(`/api/service-catalog/templates/${templateId}/employees`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      fetchTemplate();
      setEmpSearch("");
      setEmpResults([]);
    }
  };

  const handleRemoveEmployee = async (userId: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا الموظف؟")) return;
    await fetch(`/api/service-catalog/templates/${templateId}/employees?userId=${userId}`, {
      method: "DELETE",
    });
    fetchTemplate();
  };

  // Search escalation employees
  const searchEscEmployees = async (q: string) => {
    setEscSearch(q);
    if (q.length < 2) { setEscResults([]); return; }
    setEscSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${q}&roles=ADMIN,MANAGER,EXECUTOR`);
      if (res.ok) {
        const data = await res.json();
        const existingIds = escalations.map(e => e.user.id);
        setEscResults(data.filter((u: UserOption) => !existingIds.includes(u.id) && ["ADMIN", "MANAGER", "EXECUTOR"].includes(u.role)));
      }
    } catch {} finally {
      setEscSearching(false);
    }
  };

  const handleAddEscalation = async (userId: string) => {
    const res = await fetch(`/api/service-catalog/templates/${templateId}/escalation`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      fetchEscalations();
      setEscSearch("");
      setEscResults([]);
    }
  };

  const handleRemoveEscalation = async (userId: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا الموظف من قائمة الطوارئ؟")) return;
    await fetch(`/api/service-catalog/templates/${templateId}/escalation?userId=${userId}`, {
      method: "DELETE",
    });
    fetchEscalations();
  };

  const handleReorderEscalation = async (userId: string, direction: "up" | "down") => {
    const idx = escalations.findIndex(e => e.user.id === userId);
    if (idx < 0) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === escalations.length - 1) return;

    const newOrder = escalations.map(e => e.user.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    // Optimistic update
    const newEscalations = [...escalations];
    [newEscalations[idx], newEscalations[swapIdx]] = [newEscalations[swapIdx], newEscalations[idx]];
    newEscalations.forEach((e, i) => e.priority = i + 1);
    setEscalations(newEscalations);

    await fetch(`/api/service-catalog/templates/${templateId}/escalation`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: newOrder }),
    });
    fetchEscalations();
  };

  // Edit template
  const handleEditTemplate = async () => {
    const res = await fetch(`/api/service-catalog/templates/${templateId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        defaultPrice: editForm.defaultPrice ? parseFloat(editForm.defaultPrice) : null,
        defaultDuration: editForm.defaultDuration ? parseInt(editForm.defaultDuration) : null,
      }),
    });
    if (res.ok) {
      setShowEditModal(false);
      fetchTemplate();
    }
  };

  // Toggle active
  const handleToggleActive = async () => {
    if (!template) return;
    await fetch(`/api/service-catalog/templates/${templateId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !template.isActive }),
    });
    fetchTemplate();
  };

  // Drag and drop for tasks
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx || !template) return;
    const tasks = [...template.taskTemplates];
    const [moved] = tasks.splice(dragIdx, 1);
    tasks.splice(idx, 0, moved);
    setTemplate({ ...template, taskTemplates: tasks });
    setDragIdx(idx);
  };
  const handleDragEnd = async () => {
    if (!template) return;
    setDragIdx(null);
    // Update sort orders
    for (let i = 0; i < template.taskTemplates.length; i++) {
      const t = template.taskTemplates[i];
      if (t.sortOrder !== i) {
        await fetch(`/api/service-catalog/task-templates/${t.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: i }),
        });
      }
    }
    fetchTemplate();
  };

  const openEditTask = (task: TaskTemplate) => {
    setEditingTask(task);
    setTaskForm({ name: task.name, description: task.description || "", defaultDuration: task.defaultDuration, sortOrder: task.sortOrder, executionMode: task.executionMode, sameDay: task.sameDay, isRequired: task.isRequired });
    setShowTaskModal(true);
  };

  const roleLabels: Record<string, string> = { ADMIN: "مدير", MANAGER: "مشرف", EXECUTOR: "منفذ" };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">الخدمة غير موجودة</p>
        <Link href="/dashboard/service-catalog" className="text-amber-600 text-sm mt-2 inline-block">العودة للكتالوج</Link>
      </div>
    );
  }

  const totalDuration = (() => {
    let total = 0;
    const tasks = [...template.taskTemplates].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.executionMode === "PARALLEL" || task.sameDay) {
        // parallel: take max of current group
        const prev = tasks[i - 1];
        if (prev) {
          total = total - prev.defaultDuration + Math.max(prev.defaultDuration, task.defaultDuration);
        } else {
          total += task.defaultDuration;
        }
      } else {
        total += task.defaultDuration;
      }
    }
    return total;
  })();

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/dashboard/service-catalog" className="hover:text-amber-600 transition-colors">كتالوج الخدمات</Link>
        <ArrowRight size={14} />
        <span style={{ color: "#1C1B2E" }}>{template.name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: template.category.color || "#3B82F6" }}
            >
              {template.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{template.name}</h1>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={template.isActive
                    ? { backgroundColor: "#ECFDF5", color: "#059669" }
                    : { backgroundColor: "#FEF2F2", color: "#DC2626" }
                  }
                >
                  {template.isActive ? "نشط" : "معطل"}
                </span>
              </div>
              {template.description && <p className="text-sm text-gray-500 mb-2">{template.description}</p>}
              <div className="flex items-center gap-1 text-xs" style={{ color: template.category.color || "#3B82F6" }}>
                <BookOpen size={12} />
                <span>{template.category.name}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MarsaButton
              onClick={() => {
                setEditForm({
                  name: template.name,
                  description: template.description || "",
                  defaultPrice: template.defaultPrice?.toString() || "",
                  defaultDuration: template.defaultDuration?.toString() || "",
                  workflowType: template.workflowType,
                });
                setShowEditModal(true);
              }}
              variant="secondary" icon={<Edit3 size={16} />}
            >
              تعديل
            </MarsaButton>
            <MarsaButton
              onClick={handleToggleActive}
              variant={template.isActive ? "danger" : "primary"}
              icon={template.isActive ? <X size={16} /> : <Check size={16} />}
              style={{ backgroundColor: template.isActive ? undefined : "#10B981" }}
            >
              {template.isActive ? "تعطيل" : "تفعيل"}
            </MarsaButton>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <DollarSign size={16} />
              <span className="text-xs">السعر الافتراضي</span>
            </div>
            <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              {template.defaultPrice ? <>{template.defaultPrice.toLocaleString("en-US")} <SarSymbol size={18} /></> : "—"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Clock size={16} />
              <span className="text-xs">المدة الافتراضية</span>
            </div>
            <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              {template.defaultDuration ? `${template.defaultDuration} يوم` : `${totalDuration} يوم`}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <ListChecks size={16} />
              <span className="text-xs">عدد المهام</span>
            </div>
            <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{template.taskTemplates.length}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              {template.workflowType === "SEQUENTIAL" ? <ArrowDown size={16} /> : <ArrowLeftRight size={16} />}
              <span className="text-xs">سير العمل</span>
            </div>
            <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              {template.workflowType === "SEQUENTIAL" ? "تسلسلي" : "مستقل"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tasks Section - 2/3 */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ListChecks size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>المهام (القالب)</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{template.taskTemplates.length}</span>
              </div>
              <MarsaButton
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({ name: "", description: "", defaultDuration: 1, sortOrder: template.taskTemplates.length, executionMode: "SEQUENTIAL" as TaskExecutionMode, sameDay: false, isRequired: true });
                  setShowTaskModal(true);
                }}
                variant="gold" size="sm" icon={<Plus size={16} />}
              >
                إضافة مهمة
              </MarsaButton>
            </div>

            <div className="p-5">
              {template.taskTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <ListChecks size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-400 text-sm">لا توجد مهام بعد. أضف أول مهمة للقالب.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {template.taskTemplates.map((task, idx) => (
                    <div
                      key={task.id}
                      draggable={template.workflowType === "SEQUENTIAL"}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`flex flex-col p-4 rounded-xl border transition-all ${
                        dragIdx === idx ? "border-amber-300 bg-amber-50" : "border-gray-100 hover:border-gray-200 bg-gray-50/50"
                      }`}
                    >
                     <div className="flex items-center gap-3">
                      {template.workflowType === "SEQUENTIAL" && (
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-gray-300 cursor-grab" />
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ backgroundColor: template.category.color || "#3B82F6" }}
                          >
                            {idx + 1}
                          </div>
                          {idx < template.taskTemplates.length - 1 && (
                            <div className="absolute mr-[52px] mt-12 w-0.5 h-4" style={{ backgroundColor: template.category.color || "#3B82F6", opacity: 0.3 }} />
                          )}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{task.name}</h4>
                          {task.isRequired ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500">إجبارية</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">اختيارية</span>
                          )}
                          {task.executionMode === "PARALLEL" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                              متوازي
                            </span>
                          )}
                          {task.executionMode === "INDEPENDENT" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                              مستقل
                            </span>
                          )}
                          {task.sameDay && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                              نفس اليوم
                            </span>
                          )}
                        </div>
                        {task.description && <p className="text-xs text-gray-400 mt-0.5">{task.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} />
                        <span>{task.defaultDuration} يوم</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditTask(task)} className="p-1.5 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-blue-500">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                     </div>
                     <TaskRequirementsEditor taskTemplateId={task.id} />
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline visualization for SEQUENTIAL */}
              {template.workflowType === "SEQUENTIAL" && template.taskTemplates.length > 1 && (() => {
                // Group tasks: PARALLEL tasks are grouped with the previous sequential task
                const groups: { tasks: TaskTemplate[]; isParallel: boolean }[] = [];
                template.taskTemplates.forEach((task) => {
                  if (task.executionMode === "PARALLEL" && groups.length > 0) {
                    // Add to last group as parallel
                    const lastGroup = groups[groups.length - 1];
                    if (!lastGroup.isParallel) {
                      groups[groups.length - 1] = { tasks: [...lastGroup.tasks, task], isParallel: true };
                    } else {
                      lastGroup.tasks.push(task);
                    }
                  } else {
                    groups.push({ tasks: [task], isParallel: false });
                  }
                });

                return (
                  <div className="mt-6 pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-3">مخطط التنفيذ</p>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {groups.map((group, gIdx) => {
                        const groupDuration = Math.max(...group.tasks.map(t => t.defaultDuration));
                        const widthPercent = totalDuration > 0 ? (groupDuration / totalDuration) * 100 : 0;
                        return (
                          <div key={gIdx} className="flex items-center gap-1" style={{ minWidth: `${Math.max(widthPercent, 10)}%` }}>
                            {group.isParallel ? (
                              <div className="flex-1 rounded-lg overflow-hidden" style={{ border: "2px solid #2563EB" }}>
                                {group.tasks.map((task) => (
                                  <div
                                    key={task.id}
                                    className="py-1.5 px-2 text-center text-[10px] text-white font-medium truncate"
                                    style={{ backgroundColor: template.category.color || "#3B82F6" }}
                                  >
                                    {task.name} ({task.defaultDuration}د)
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div
                                className="flex-1 py-2 px-3 rounded-lg text-center text-[10px] text-white font-medium truncate"
                                style={{
                                  backgroundColor: group.tasks[0].executionMode === "INDEPENDENT" ? "#9CA3AF" : (template.category.color || "#3B82F6"),
                                  opacity: group.tasks[0].executionMode === "INDEPENDENT" ? 0.6 : 0.85,
                                }}
                              >
                                {group.tasks[0].name} ({group.tasks[0].defaultDuration}د)
                                {group.tasks[0].executionMode === "INDEPENDENT" && " ⊘"}
                              </div>
                            )}
                            {gIdx < groups.length - 1 && (
                              <ArrowRight size={12} className="text-gray-300 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs text-gray-400 text-left">إجمالي: {totalDuration} يوم</p>
                      {groups.some(g => g.isParallel) && (
                        <p className="text-[10px] flex items-center gap-1" style={{ color: "#2563EB" }}>
                          <span className="w-3 h-3 rounded border-2" style={{ borderColor: "#2563EB" }} />
                          مهام متوازية
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Employees Section - 1/3 */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>الموظفين المؤهلين</h2>
              </div>
              <MarsaButton
                onClick={() => { setShowEmpModal(true); setEmpSearch(""); setEmpResults([]); }}
                variant="ghost" size="sm" iconOnly icon={<UserPlus size={18} />}
                style={{ color: "#C9A84C" }}
              />
            </div>

            <div className="p-5">
              {template.qualifiedEmployees.length === 0 ? (
                <div className="text-center py-6">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-400 text-xs">لا يوجد موظفين مؤهلين</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {template.qualifiedEmployees.map((emp) => (
                    <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: template.category.color || "#3B82F6" }}
                      >
                        {emp.user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>{emp.user.name}</p>
                        <p className="text-xs text-gray-400">{roleLabels[emp.user.role] || emp.user.role}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveEmployee(emp.user.id)}
                        className="p-1 rounded-lg hover:bg-white transition-colors text-gray-300 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Escalation Employees Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100" style={{ borderColor: "#FED7AA" }}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#FED7AA", backgroundColor: "#FFF7ED", borderTopLeftRadius: "1rem", borderTopRightRadius: "1rem" }}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} style={{ color: "#EA580C" }} />
                <h2 className="text-base font-bold" style={{ color: "#9A3412" }}>موظفي الطوارئ</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FFEDD5", color: "#EA580C" }}>
                  {escalations.length}
                </span>
              </div>
              <MarsaButton
                onClick={() => { setShowEscModal(true); setEscSearch(""); setEscResults([]); }}
                variant="ghost" size="sm" iconOnly icon={<UserPlus size={18} />}
                style={{ color: "#EA580C" }}
              />
            </div>

            <div className="p-5">
              {escalations.length === 0 ? (
                <div className="text-center py-6">
                  <AlertTriangle size={32} className="mx-auto mb-2" style={{ color: "#FDBA74" }} />
                  <p className="text-xs" style={{ color: "#9A3412" }}>لا يوجد موظفين طوارئ</p>
                  <p className="text-xs text-gray-400 mt-1">يتم تصعيد المهام المتأخرة إليهم تلقائياً</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {escalations.map((esc, idx) => (
                    <div key={esc.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ backgroundColor: "#FFF7ED" }}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: "#EA580C" }}
                      >
                        {esc.priority}
                      </div>
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: "#F97316" }}
                      >
                        {esc.user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>{esc.user.name}</p>
                        <p className="text-xs text-gray-400">{roleLabels[esc.user.role] || esc.user.role}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleReorderEscalation(esc.user.id, "up")}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-white transition-colors disabled:opacity-30"
                          style={{ color: "#EA580C" }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => handleReorderEscalation(esc.user.id, "down")}
                          disabled={idx === escalations.length - 1}
                          className="p-1 rounded hover:bg-white transition-colors disabled:opacity-30"
                          style={{ color: "#EA580C" }}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemoveEscalation(esc.user.id)}
                        className="p-1 rounded-lg hover:bg-white transition-colors text-gray-300 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTaskModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>
              {editingTask ? "تعديل المهمة" : "إضافة مهمة جديدة"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المهمة *</label>
                <input
                  type="text"
                  value={taskForm.name}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  placeholder="مثل: مراجعة المستندات"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدة (أيام)</label>
                  <input
                    type="number"
                    min={1}
                    value={taskForm.defaultDuration}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, defaultDuration: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
                  <input
                    type="number"
                    value={taskForm.sortOrder}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">طريقة التنفيذ</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskForm(prev => ({ ...prev, executionMode: "SEQUENTIAL" as TaskExecutionMode }))}
                    className="p-3 rounded-xl border-2 text-center transition-all"
                    style={taskForm.executionMode === "SEQUENTIAL"
                      ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <ArrowDown size={18} className="mx-auto mb-1" style={{ color: taskForm.executionMode === "SEQUENTIAL" ? "#C9A84C" : "#9CA3AF" }} />
                    <span className="text-xs font-medium block" style={{ color: taskForm.executionMode === "SEQUENTIAL" ? "#1C1B2E" : "#6B7280" }}>متسلسل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskForm(prev => ({ ...prev, executionMode: "PARALLEL" as TaskExecutionMode }))}
                    className="p-3 rounded-xl border-2 text-center transition-all"
                    style={taskForm.executionMode === "PARALLEL"
                      ? { borderColor: "#2563EB", backgroundColor: "rgba(37, 99, 235, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <ArrowLeftRight size={18} className="mx-auto mb-1" style={{ color: taskForm.executionMode === "PARALLEL" ? "#2563EB" : "#9CA3AF" }} />
                    <span className="text-xs font-medium block" style={{ color: taskForm.executionMode === "PARALLEL" ? "#1C1B2E" : "#6B7280" }}>متوازي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskForm(prev => ({ ...prev, executionMode: "INDEPENDENT" as TaskExecutionMode }))}
                    className="p-3 rounded-xl border-2 text-center transition-all"
                    style={taskForm.executionMode === "INDEPENDENT"
                      ? { borderColor: "#6B7280", backgroundColor: "rgba(107, 114, 128, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <X size={18} className="mx-auto mb-1" style={{ color: taskForm.executionMode === "INDEPENDENT" ? "#6B7280" : "#9CA3AF" }} />
                    <span className="text-xs font-medium block" style={{ color: taskForm.executionMode === "INDEPENDENT" ? "#1C1B2E" : "#6B7280" }}>مستقل</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">تُنفَّذ في نفس اليوم</label>
                <button
                  onClick={() => setTaskForm(prev => ({ ...prev, sameDay: !prev.sameDay }))}
                  className="w-10 h-6 rounded-full transition-all relative"
                  style={{ backgroundColor: taskForm.sameDay ? "#2563EB" : "#D1D5DB" }}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                    style={{ left: taskForm.sameDay ? "4px" : "22px" }}
                  />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">إجبارية</label>
                <button
                  onClick={() => setTaskForm(prev => ({ ...prev, isRequired: !prev.isRequired }))}
                  className="w-10 h-6 rounded-full transition-all relative"
                  style={{ backgroundColor: taskForm.isRequired ? "#C9A84C" : "#D1D5DB" }}
                >
                  <div
                    className="w-4 h-4 rounded-full bg-white absolute top-1 transition-all"
                    style={{ left: taskForm.isRequired ? "4px" : "22px" }}
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <MarsaButton onClick={handleSaveTask} disabled={!taskForm.name} variant="gold" className="flex-1">
                {editingTask ? "حفظ التعديلات" : "إضافة المهمة"}
              </MarsaButton>
              <MarsaButton onClick={() => setShowTaskModal(false)} variant="secondary">
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEmpModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>إضافة موظف مؤهل</h3>
            <div className="relative mb-4">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={empSearch}
                onChange={(e) => searchEmployees(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                placeholder="ابحث باسم الموظف..."
              />
            </div>
            {empSearching && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {empResults.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: "#5E5495" }}>
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>{user.name}</p>
                    <p className="text-xs text-gray-400">{roleLabels[user.role] || user.role} • {user.email}</p>
                  </div>
                  <MarsaButton onClick={() => handleAddEmployee(user.id)} variant="gold" size="xs" iconOnly icon={<Plus size={16} />} />
                </div>
              ))}
              {empSearch.length >= 2 && !empSearching && empResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">لا توجد نتائج</p>
              )}
            </div>
            <MarsaButton onClick={() => setShowEmpModal(false)} variant="secondary" className="w-full mt-4">
              إغلاق
            </MarsaButton>
          </div>
        </div>
      )}

      {/* Escalation Employee Modal */}
      {showEscModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEscModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle size={20} style={{ color: "#EA580C" }} />
              <h3 className="text-lg font-bold" style={{ color: "#9A3412" }}>إضافة موظف طوارئ</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">يتم تصعيد المهام المتأخرة تلقائياً حسب ترتيب الأولوية</p>
            <div className="relative mb-4">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={escSearch}
                onChange={(e) => searchEscEmployees(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 text-sm"
                style={{ borderColor: "#FED7AA" }}
                placeholder="ابحث باسم الموظف..."
              />
            </div>
            {escSearching && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#EA580C", borderTopColor: "transparent" }} />
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {escResults.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ backgroundColor: "#FFF7ED" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: "#F97316" }}>
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>{user.name}</p>
                    <p className="text-xs text-gray-400">{roleLabels[user.role] || user.role} • {user.email}</p>
                  </div>
                  <MarsaButton onClick={() => handleAddEscalation(user.id)} variant="gold" size="xs" iconOnly icon={<Plus size={16} />} style={{ backgroundColor: "#EA580C" }} />
                </div>
              ))}
              {escSearch.length >= 2 && !escSearching && escResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">لا توجد نتائج</p>
              )}
            </div>
            <MarsaButton onClick={() => setShowEscModal(false)} variant="secondary" className="w-full mt-4" style={{ borderColor: "#FED7AA" }}>
              إغلاق
            </MarsaButton>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>تعديل الخدمة</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخدمة *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر (<SarSymbol size={14} />)</label>
                  <input
                    type="number"
                    value={editForm.defaultPrice}
                    onChange={(e) => setEditForm(prev => ({ ...prev, defaultPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدة (أيام)</label>
                  <input
                    type="number"
                    value={editForm.defaultDuration}
                    onChange={(e) => setEditForm(prev => ({ ...prev, defaultDuration: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع سير العمل</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setEditForm(prev => ({ ...prev, workflowType: "SEQUENTIAL" }))}
                    className="p-3 rounded-xl border-2 text-right transition-all"
                    style={editForm.workflowType === "SEQUENTIAL"
                      ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <div className="flex items-center gap-2">
                      <ArrowDown size={16} />
                      <span className="text-sm font-medium">تسلسلي</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setEditForm(prev => ({ ...prev, workflowType: "INDEPENDENT" }))}
                    className="p-3 rounded-xl border-2 text-right transition-all"
                    style={editForm.workflowType === "INDEPENDENT"
                      ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight size={16} />
                      <span className="text-sm font-medium">مستقل</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <MarsaButton onClick={handleEditTemplate} disabled={!editForm.name} variant="gold" className="flex-1">
                حفظ التعديلات
              </MarsaButton>
              <MarsaButton onClick={() => setShowEditModal(false)} variant="secondary">
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
