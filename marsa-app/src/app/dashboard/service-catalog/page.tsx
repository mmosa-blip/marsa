"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  ChevronDown,
  ChevronLeft,
  Clock,
  DollarSign,
  ListChecks,
  Users,
  Layers,
  Package,
  Activity,
  Edit3,
  Trash2,
  ArrowLeftRight,
  ArrowDown,
  GripVertical,
  Check,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

type TaskExecutionMode = "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";

interface TaskTemplate {
  id: string;
  name: string;
  defaultDuration: number;
  sortOrder: number;
  executionMode: TaskExecutionMode;
  sameDay: boolean;
  isRequired: boolean;
}

interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number | null;
  defaultDuration: number | null;
  workflowType: "SEQUENTIAL" | "INDEPENDENT";
  isActive: boolean;
  sortOrder: number;
  _count: { taskTemplates: number; qualifiedEmployees: number };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  _count: { templates: number };
  templates?: ServiceTemplate[];
}

export default function ServiceCatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [categoryTemplates, setCategoryTemplates] = useState<Record<string, ServiceTemplate[]>>({});
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [stats, setStats] = useState({ categories: 0, templates: 0, activeTemplates: 0, taskTemplates: 0 });

  // Category form
  const [catForm, setCatForm] = useState({ name: "", description: "", color: "#3B82F6", sortOrder: 0 });
  // Template form
  const [tplForm, setTplForm] = useState({
    name: "", description: "", categoryId: "", defaultPrice: "",
    defaultDuration: "", workflowType: "SEQUENTIAL" as "SEQUENTIAL" | "INDEPENDENT", sortOrder: 0,
  });
  // Tasks for new template
  const [tplTasks, setTplTasks] = useState<{ name: string; defaultDuration: number; isRequired: boolean; description: string; dependsOnIndex: number | null; executionMode: TaskExecutionMode; sameDay: boolean }[]>([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("1");
  const [newTaskRequired, setNewTaskRequired] = useState(true);
  const [newTaskDependsOn, setNewTaskDependsOn] = useState<number | null>(null);
  const [newTaskExecutionMode, setNewTaskExecutionMode] = useState<TaskExecutionMode>("SEQUENTIAL");
  const [newTaskSameDay, setNewTaskSameDay] = useState(false);
  const [taskDragIndex, setTaskDragIndex] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/service-catalog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        const totalTemplates = data.reduce((s: number, c: Category) => s + c._count.templates, 0);
        setStats(prev => ({ ...prev, categories: data.length, templates: totalTemplates }));
      }
    } catch {}
  }, []);

  const fetchAllStats = useCallback(async () => {
    try {
      const res = await fetch("/api/service-catalog/templates");
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((t: ServiceTemplate) => t.isActive).length;
        const tasks = data.reduce((s: number, t: ServiceTemplate) => s + t._count.taskTemplates, 0);
        setStats(prev => ({ ...prev, templates: data.length, activeTemplates: active, taskTemplates: tasks }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchCategories(), fetchAllStats()]).finally(() => setLoading(false));
  }, [fetchCategories, fetchAllStats]);

  const toggleCategory = async (catId: string) => {
    if (expandedCategory === catId) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(catId);
    if (!categoryTemplates[catId]) {
      const res = await fetch(`/api/service-catalog/templates?categoryId=${catId}`);
      if (res.ok) {
        const data = await res.json();
        setCategoryTemplates(prev => ({ ...prev, [catId]: data }));
      }
    }
  };

  const handleSaveCategory = async () => {
    const method = editingCategory ? "PATCH" : "POST";
    const url = editingCategory
      ? `/api/service-catalog/categories/${editingCategory.id}`
      : "/api/service-catalog/categories";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catForm),
    });
    if (res.ok) {
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCatForm({ name: "", description: "", color: "#3B82F6", sortOrder: 0 });
      fetchCategories();
    } else {
      const data = await res.json();
      alert(data.error || "حدث خطأ أثناء حفظ التصنيف");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفئة؟")) return;
    const res = await fetch(`/api/service-catalog/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchCategories();
      if (expandedCategory === id) setExpandedCategory(null);
    } else {
      const data = await res.json();
      alert(data.error || "خطأ في الحذف");
    }
  };

  const resetTplForm = () => {
    setTplForm({ name: "", description: "", categoryId: "", defaultPrice: "", defaultDuration: "", workflowType: "SEQUENTIAL", sortOrder: 0 });
    setTplTasks([]);
    setNewTaskName("");
    setNewTaskDuration("1");
    setNewTaskRequired(true);
    setNewTaskDependsOn(null);
    setNewTaskExecutionMode("SEQUENTIAL");
    setCloneOriginalName(null);
    setTplNameError("");
  };

  const handleSaveTemplate = async () => {
    if (cloneOriginalName !== null && tplForm.name.trim() === cloneOriginalName) {
      setTplNameError("يجب اختيار اسم مختلف عن القالب الأصلي");
      return;
    }
    setTplNameError("");
    const method = editingTemplate ? "PATCH" : "POST";
    const url = editingTemplate
      ? `/api/service-catalog/templates/${editingTemplate.id}`
      : "/api/service-catalog/templates";
    const body: Record<string, unknown> = {
      ...tplForm,
      defaultPrice: tplForm.defaultPrice ? parseFloat(tplForm.defaultPrice) : null,
      defaultDuration: tplForm.defaultDuration ? parseInt(tplForm.defaultDuration) : null,
    };
    // Include tasks only for new templates
    if (!editingTemplate && tplTasks.length > 0) {
      body.tasks = tplTasks.map((t) => ({
        name: t.name,
        description: t.description || null,
        defaultDuration: t.defaultDuration,
        isRequired: t.isRequired,
        dependsOnIndex: t.dependsOnIndex,
        executionMode: t.executionMode,
        sameDay: t.sameDay,
      }));
    }
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowTemplateModal(false);
      setEditingTemplate(null);
      resetTplForm();
      fetchCategories();
      fetchAllStats();
      if (expandedCategory) {
        const r = await fetch(`/api/service-catalog/templates?categoryId=${expandedCategory}`);
        if (r.ok) {
          const data = await r.json();
          setCategoryTemplates(prev => ({ ...prev, [expandedCategory]: data }));
        }
      }
    } else {
      const d = await res.json();
      if (res.status === 400 || res.status === 409) {
        setTplNameError(d.error || "خطأ في الحفظ");
      } else {
        alert(d.error || "حدث خطأ أثناء حفظ القالب");
      }
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخدمة؟")) return;
    const res = await fetch(`/api/service-catalog/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchCategories();
      fetchAllStats();
      if (expandedCategory) {
        const r = await fetch(`/api/service-catalog/templates?categoryId=${expandedCategory}`);
        if (r.ok) {
          const data = await r.json();
          setCategoryTemplates(prev => ({ ...prev, [expandedCategory]: data }));
        }
      }
    }
  };

  const toggleCategoryPublic = async (cat: Category) => {
    const res = await fetch(`/api/service-catalog/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !cat.isPublic }),
    });
    if (res.ok) fetchCategories();
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatForm({ name: cat.name, description: cat.description || "", color: cat.color || "#3B82F6", sortOrder: cat.sortOrder });
    setShowCategoryModal(true);
  };

  const openEditTemplate = (tpl: ServiceTemplate) => {
    setEditingTemplate(tpl);
    setCloneOriginalName(null);
    setTplNameError("");
    setTplForm({
      name: tpl.name, description: tpl.description || "",
      categoryId: "", defaultPrice: tpl.defaultPrice?.toString() || "",
      defaultDuration: tpl.defaultDuration?.toString() || "",
      workflowType: tpl.workflowType, sortOrder: tpl.sortOrder,
    });
    setShowTemplateModal(true);
  };

  // Clone state
  const [cloneOriginalName, setCloneOriginalName] = useState<string | null>(null);
  const [tplNameError, setTplNameError] = useState("");

  const handleCloneTemplate = async (id: string, catId: string) => {
    try {
      const res = await fetch(`/api/service-catalog/templates/${id}/clone`, { method: "POST" });
      if (!res.ok) return;
      const { template: t } = await res.json();
      setEditingTemplate(null);
      setCloneOriginalName(t.name);
      setTplNameError("يجب إدخال اسم جديد للقالب");
      setTplForm({
        name: "",
        description: t.description || "",
        categoryId: catId,
        defaultPrice: t.defaultPrice?.toString() || "",
        defaultDuration: t.defaultDuration?.toString() || "",
        workflowType: t.workflowType || "SEQUENTIAL",
        sortOrder: t.sortOrder || 0,
      });
      // Pre-fill tasks
      if (t.taskTemplates && Array.isArray(t.taskTemplates)) {
        setTplTasks(t.taskTemplates.map((tt: { name: string; defaultDuration: number; isRequired: boolean; description?: string; dependsOnId?: string | null; executionMode?: string; sameDay?: boolean }) => ({
          name: tt.name,
          defaultDuration: tt.defaultDuration,
          isRequired: tt.isRequired,
          description: tt.description || "",
          dependsOnIndex: null,
          executionMode: (tt.executionMode || "SEQUENTIAL") as TaskExecutionMode,
          sameDay: tt.sameDay || false,
        })));
      } else {
        setTplTasks([]);
      }
      setShowTemplateModal(true);
    } catch { /* ignore */ }
  };

  const statCards = [
    { label: "إجمالي الفئات", value: stats.categories, icon: Layers, color: "#3B82F6" },
    { label: "إجمالي الخدمات", value: stats.templates, icon: Package, color: "#8B5CF6" },
    { label: "الخدمات النشطة", value: stats.activeTemplates, icon: Activity, color: "#10B981" },
    { label: "إجمالي المهام المحددة", value: stats.taskTemplates, icon: ListChecks, color: "#F59E0B" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "rgba(201, 168, 76, 0.15)" }}>
            <BookOpen size={24} style={{ color: "#C9A84C" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>كتالوج الخدمات</h1>
            <p className="text-sm text-gray-500">إدارة فئات الخدمات والقوالب والمهام</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingCategory(null); setCatForm({ name: "", description: "", color: "#3B82F6", sortOrder: 0 }); setShowCategoryModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#5E5495" }}
          >
            <Plus size={18} />
            إضافة فئة
          </button>
          <button
            onClick={() => { setEditingTemplate(null); resetTplForm(); setShowTemplateModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
            style={{ backgroundColor: "#C9A84C" }}
          >
            <Plus size={18} />
            إضافة خدمة
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${card.color}15` }}>
                <card.icon size={20} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Categories Accordion */}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <Layers size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">لا توجد فئات بعد. أضف أول فئة للبدء.</p>
          </div>
        ) : (
          categories.map((cat) => (
            <div key={cat.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden${!cat.isPublic ? " opacity-50" : ""}`}>
              {/* Category Header */}
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleCategory(cat.id)}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: cat.color || "#3B82F6" }}
                >
                  {cat.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{cat.name}</h3>
                    {!cat.isPublic && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                        مخفية
                      </span>
                    )}
                  </div>
                  {cat.description && <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {cat._count.templates} خدمة
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCategoryPublic(cat); }}
                      className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${cat.isPublic ? "text-green-500 hover:text-red-500" : "text-gray-400 hover:text-green-500"}`}
                      title={cat.isPublic ? "إخفاء عن العملاء" : "إظهار للعملاء"}
                    >
                      {cat.isPublic ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditCategory(cat); }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-gray-400 transition-transform duration-200 ${expandedCategory === cat.id ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {/* Templates */}
              {expandedCategory === cat.id && (
                <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                  {!categoryTemplates[cat.id] ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
                    </div>
                  ) : categoryTemplates[cat.id].length === 0 ? (
                    <p className="text-center text-gray-400 py-4">لا توجد خدمات في هذه الفئة</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryTemplates[cat.id].map((tpl) => (
                        <div key={tpl.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <h4 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>{tpl.name}</h4>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={tpl.isActive
                                ? { backgroundColor: "#ECFDF5", color: "#059669" }
                                : { backgroundColor: "#FEF2F2", color: "#DC2626" }
                              }
                            >
                              {tpl.isActive ? "نشط" : "معطل"}
                            </span>
                          </div>
                          {tpl.description && (
                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{tpl.description}</p>
                          )}
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <DollarSign size={14} />
                              <span>{tpl.defaultPrice ? <>{tpl.defaultPrice.toLocaleString("en-US")} <SarSymbol size={12} /></> : "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={14} />
                              <span>{tpl.defaultDuration ? `${tpl.defaultDuration} يوم` : "—"}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <ListChecks size={14} />
                              <span>{tpl._count.taskTemplates} مهمة</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Users size={14} />
                              <span>{tpl._count.qualifiedEmployees} موظف</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              {tpl.workflowType === "SEQUENTIAL" ? (
                                <>
                                  <ArrowDown size={12} />
                                  <span>تسلسلي</span>
                                </>
                              ) : (
                                <>
                                  <ArrowLeftRight size={12} />
                                  <span>مستقل</span>
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditTemplate(tpl)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-500"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleCloneTemplate(tpl.id, cat.id)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-purple-500"
                                title="نسخ"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplate(tpl.id)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                              <Link
                                href={`/dashboard/service-catalog/${tpl.id}`}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-amber-600"
                              >
                                <ChevronLeft size={14} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>
              {editingCategory ? "تعديل الفئة" : "إضافة فئة جديدة"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الفئة *</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  placeholder="مثل: خدمات حكومية"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  rows={2}
                  placeholder="وصف مختصر للفئة"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">اللون</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={catForm.color}
                      onChange={(e) => setCatForm(prev => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <div className="flex gap-2">
                      {["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EF4444", "#EC4899"].map(c => (
                        <button
                          key={c}
                          onClick={() => setCatForm(prev => ({ ...prev, color: c }))}
                          className="w-7 h-7 rounded-full border-2 transition-all"
                          style={{ backgroundColor: c, borderColor: catForm.color === c ? "#1C1B2E" : "transparent" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
                  <input
                    type="number"
                    value={catForm.sortOrder}
                    onChange={(e) => setCatForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveCategory}
                disabled={!catForm.name}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
                style={{ backgroundColor: "#C9A84C" }}
              >
                {editingCategory ? "حفظ التعديلات" : "إضافة الفئة"}
              </button>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowTemplateModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white rounded-t-2xl px-6 pt-6 pb-4 z-10" style={{ borderBottom: "1px solid #F3F4F6" }}>
              <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                {editingTemplate ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
              </h3>
              {!editingTemplate && (
                <p className="text-xs text-gray-400 mt-1">أضف بيانات الخدمة والمهام المطلوبة دفعة واحدة</p>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* ─── Service Fields ─── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الفئة *</label>
                  <select
                    value={tplForm.categoryId}
                    onChange={(e) => setTplForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  >
                    <option value="">اختر الفئة</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">اسم الخدمة *</label>
                  <input
                    type="text"
                    value={tplForm.name}
                    onChange={(e) => { setTplForm(prev => ({ ...prev, name: e.target.value })); setTplNameError(""); }}
                    className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    style={{ border: `1px solid ${tplNameError ? "#DC2626" : "#E5E7EB"}` }}
                    placeholder="مثل: إصدار سجل تجاري"
                  />
                  {tplNameError && (
                    <p className="text-xs mt-1 font-medium" style={{ color: "#DC2626" }}>{tplNameError}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الوصف</label>
                <textarea
                  value={tplForm.description}
                  onChange={(e) => setTplForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السعر الافتراضي (<SarSymbol size={14} />)</label>
                  <input
                    type="number"
                    value={tplForm.defaultPrice}
                    onChange={(e) => setTplForm(prev => ({ ...prev, defaultPrice: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المدة الافتراضية (أيام)</label>
                  <input
                    type="number"
                    value={tplForm.defaultDuration}
                    onChange={(e) => setTplForm(prev => ({ ...prev, defaultDuration: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-200 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">نوع سير العمل</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTplForm(prev => ({ ...prev, workflowType: "SEQUENTIAL" }))}
                    className="p-3 rounded-xl border-2 text-right transition-all"
                    style={tplForm.workflowType === "SEQUENTIAL"
                      ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDown size={16} style={{ color: tplForm.workflowType === "SEQUENTIAL" ? "#C9A84C" : "#9CA3AF" }} />
                      <span className="text-sm font-medium" style={{ color: tplForm.workflowType === "SEQUENTIAL" ? "#1C1B2E" : "#6B7280" }}>تسلسلي</span>
                    </div>
                    <p className="text-xs text-gray-400">المهام تُنفذ بالتتابع</p>
                  </button>
                  <button
                    onClick={() => setTplForm(prev => ({ ...prev, workflowType: "INDEPENDENT" }))}
                    className="p-3 rounded-xl border-2 text-right transition-all"
                    style={tplForm.workflowType === "INDEPENDENT"
                      ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                      : { borderColor: "#E5E7EB" }
                    }
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowLeftRight size={16} style={{ color: tplForm.workflowType === "INDEPENDENT" ? "#C9A84C" : "#9CA3AF" }} />
                      <span className="text-sm font-medium" style={{ color: tplForm.workflowType === "INDEPENDENT" ? "#1C1B2E" : "#6B7280" }}>مستقل</span>
                    </div>
                    <p className="text-xs text-gray-400">المهام تُنفذ بشكل متوازي</p>
                  </button>
                </div>
              </div>

              {/* ─── Tasks Section (only for new templates) ─── */}
              {!editingTemplate && (
                <div className="pt-2">
                  <div className="rounded-2xl p-5" style={{ border: "1px solid #E2E0D8", backgroundColor: "rgba(27, 42, 74, 0.01)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <ListChecks size={18} style={{ color: "#C9A84C" }} />
                        <h4 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>المهام وخطوات العمل</h4>
                      </div>
                      {tplTasks.length > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(201, 168, 76, 0.12)", color: "#C9A84C" }}>
                          {tplTasks.length} مهمة
                        </span>
                      )}
                    </div>

                    {/* Task list */}
                    {tplTasks.length > 0 && (
                      <div className="space-y-1.5 mb-4">
                        {tplTasks.map((task, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => setTaskDragIndex(idx)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (taskDragIndex === null || taskDragIndex === idx) return;
                              setTplTasks(prev => {
                                const items = [...prev];
                                const [moved] = items.splice(taskDragIndex, 1);
                                items.splice(idx, 0, moved);
                                return items;
                              });
                              setTaskDragIndex(idx);
                            }}
                            onDragEnd={() => setTaskDragIndex(null)}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white transition-all group"
                            style={{
                              border: taskDragIndex === idx ? "1px dashed #C9A84C" : "1px solid #F3F4F6",
                            }}
                          >
                            <div className="cursor-grab text-gray-300 hover:text-gray-500 transition-colors">
                              <GripVertical size={14} />
                            </div>
                            <span className="text-xs font-mono text-gray-300 w-5 text-center">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>{task.name}</p>
                              {task.dependsOnIndex !== null && tplTasks[task.dependsOnIndex] && (
                                <p className="text-[10px] mt-0.5 truncate" style={{ color: "#94A3B8" }}>
                                  تعتمد على: {tplTasks[task.dependsOnIndex].name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={11} />
                                {task.defaultDuration} يوم
                              </span>
                              {task.dependsOnIndex !== null && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6" }}>
                                  مرتبطة
                                </span>
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
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                                style={task.isRequired
                                  ? { backgroundColor: "#FEF3C7", color: "#92400E" }
                                  : { backgroundColor: "#F3F4F6", color: "#9CA3AF" }
                                }
                              >
                                {task.isRequired ? "إجبارية" : "اختيارية"}
                              </span>
                              <button
                                onClick={() => {
                                  // When removing a task, clear dependencies that reference it
                                  setTplTasks(prev => prev
                                    .filter((_, i) => i !== idx)
                                    .map(t => ({
                                      ...t,
                                      dependsOnIndex: t.dependsOnIndex === null ? null
                                        : t.dependsOnIndex === idx ? null
                                        : t.dependsOnIndex > idx ? t.dependsOnIndex - 1
                                        : t.dependsOnIndex
                                    }))
                                  );
                                }}
                                className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {tplTasks.length === 0 && (
                      <div className="text-center py-4 mb-4">
                        <ListChecks size={28} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-xs text-gray-400">لم تُضف أي مهام بعد</p>
                        <p className="text-[10px] text-gray-300 mt-0.5">أضف المهام المطلوبة لتنفيذ هذه الخدمة</p>
                      </div>
                    )}

                    {/* Add task form */}
                    <div className="p-3 rounded-xl space-y-2" style={{ backgroundColor: "rgba(201, 168, 76, 0.04)", border: "1px solid rgba(201, 168, 76, 0.15)" }}>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newTaskName}
                          onChange={(e) => setNewTaskName(e.target.value)}
                          placeholder="اسم المهمة..."
                          className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
                          style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTaskName.trim()) {
                              setTplTasks(prev => [...prev, {
                                name: newTaskName.trim(),
                                defaultDuration: parseInt(newTaskDuration) || 1,
                                isRequired: newTaskRequired,
                                description: "",
                                dependsOnIndex: newTaskDependsOn,
                                executionMode: newTaskExecutionMode,
                                sameDay: newTaskSameDay,
                              }]);
                              setNewTaskName("");
                              setNewTaskDuration("1");
                              setNewTaskRequired(true);
                              setNewTaskDependsOn(null);
                              setNewTaskExecutionMode("SEQUENTIAL");
                              setNewTaskSameDay(false);
                            }
                          }}
                        />
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={newTaskDuration}
                            onChange={(e) => setNewTaskDuration(e.target.value)}
                            className="w-14 px-2 py-2 rounded-lg border text-sm outline-none text-center"
                            style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                          />
                          <span className="text-xs text-gray-400">يوم</span>
                        </div>
                        <button
                          onClick={() => setNewTaskRequired(!newTaskRequired)}
                          className="px-2.5 py-2 rounded-lg text-xs font-medium transition-all border flex-shrink-0"
                          title={newTaskRequired ? "إجبارية - اضغط للتغيير" : "اختيارية - اضغط للتغيير"}
                          style={newTaskRequired
                            ? { backgroundColor: "#FEF3C7", color: "#92400E", borderColor: "#FDE68A" }
                            : { backgroundColor: "#F9FAFB", color: "#9CA3AF", borderColor: "#E5E7EB" }
                          }
                        >
                          {newTaskRequired ? "إجبارية" : "اختيارية"}
                        </button>
                        <button
                          onClick={() => {
                            if (!newTaskName.trim()) return;
                            setTplTasks(prev => [...prev, {
                              name: newTaskName.trim(),
                              defaultDuration: parseInt(newTaskDuration) || 1,
                              isRequired: newTaskRequired,
                              description: "",
                              dependsOnIndex: newTaskDependsOn,
                              executionMode: newTaskExecutionMode,
                              sameDay: newTaskSameDay,
                            }]);
                            setNewTaskName("");
                            setNewTaskDuration("1");
                            setNewTaskRequired(true);
                            setNewTaskDependsOn(null);
                            setNewTaskExecutionMode("SEQUENTIAL");
                            setNewTaskSameDay(false);
                          }}
                          disabled={!newTaskName.trim()}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-40 flex-shrink-0"
                          style={{ backgroundColor: "#C9A84C" }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {/* Dependency selector & parallel group */}
                      <div className="flex items-center gap-4">
                        {tplTasks.length > 0 && (
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-xs text-gray-400 flex-shrink-0">تعتمد على:</span>
                            <select
                              value={newTaskDependsOn ?? ""}
                              onChange={(e) => setNewTaskDependsOn(e.target.value ? parseInt(e.target.value) : null)}
                              className="flex-1 px-3 py-1.5 rounded-lg border text-xs outline-none bg-white"
                              style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                            >
                              <option value="">مستقلة (بدون ارتباط)</option>
                              {tplTasks.map((t, i) => (
                                <option key={i} value={i}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 flex-shrink-0">التنفيذ:</span>
                          <select
                            value={newTaskExecutionMode}
                            onChange={(e) => setNewTaskExecutionMode(e.target.value as TaskExecutionMode)}
                            className="px-2 py-1.5 rounded-lg border text-xs outline-none bg-white"
                            style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                          >
                            <option value="SEQUENTIAL">متسلسل</option>
                            <option value="PARALLEL">متوازي</option>
                            <option value="INDEPENDENT">مستقل</option>
                          </select>
                        </div>
                        <button
                          onClick={() => setNewTaskSameDay(!newTaskSameDay)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border flex-shrink-0"
                          title={newTaskSameDay ? "نفس اليوم - اضغط للتغيير" : "ليس نفس اليوم - اضغط للتغيير"}
                          style={newTaskSameDay
                            ? { backgroundColor: "#FEF3C7", color: "#92400E", borderColor: "#FDE68A" }
                            : { backgroundColor: "#F9FAFB", color: "#9CA3AF", borderColor: "#E5E7EB" }
                          }
                        >
                          {newTaskSameDay ? "نفس اليوم" : "يوم مختلف"}
                        </button>
                      </div>
                    </div>

                    {/* Auto-calculate duration hint */}
                    {tplTasks.length > 0 && (
                      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
                        <span className="text-xs text-gray-400">مجموع المدة</span>
                        <span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>
                          {tplTasks.reduce((s, t) => s + t.defaultDuration, 0)} يوم
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white rounded-b-2xl px-6 py-4 flex gap-3" style={{ borderTop: "1px solid #F3F4F6" }}>
              <button
                onClick={handleSaveTemplate}
                disabled={!tplForm.name || !tplForm.categoryId || (cloneOriginalName !== null && tplForm.name.trim() === cloneOriginalName)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#C9A84C" }}
              >
                <Check size={16} />
                {editingTemplate ? "حفظ التعديلات" : cloneOriginalName !== null ? "حفظ النسخة" : tplTasks.length > 0 ? `إضافة الخدمة مع ${tplTasks.length} مهمة` : "إضافة الخدمة"}
              </button>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
