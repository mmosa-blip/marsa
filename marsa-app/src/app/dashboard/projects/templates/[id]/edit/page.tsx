"use client";

/**
 * Edit a Project Template.
 *
 * Loads the existing template via GET /api/project-templates/[id], lets the
 * user change name/description/workflow/isActive and reorder/add/remove
 * the attached services, then PATCHes the same endpoint with the full
 * services array. The PATCH route handles the delete-and-recreate of the
 * ProjectTemplateService rows.
 */

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  Save,
  Layers,
  ArrowDown,
  ArrowLeftRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  X,
  Search,
  Loader2,
  Power,
  PowerOff,
  DollarSign,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface ServiceTemplate {
  id: string;
  name: string;
  defaultDuration: number;
  defaultPrice: number;
  category: { id: string; name: string } | null;
  _count: { taskTemplates: number };
}

interface AttachedService {
  serviceTemplateId: string;
  sortOrder: number;
  serviceTemplate: ServiceTemplate;
}

// Local id used only on the client to track row identity in React lists
// before the row is persisted (real DB rows get a server-assigned cuid).
interface MilestoneRow {
  localId: string;
  title: string;
  amount: number;
  // Index of the service AFTER which the milestone is collected. The
  // server uses this to find the next service's first task and lock it.
  afterServiceIndex: number;
}

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  workflowType: "SEQUENTIAL" | "INDEPENDENT";
  isActive: boolean;
  isSystem: boolean;
  services: AttachedService[];
  milestones: MilestoneRow[];
}

export default function EditProjectTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [allServices, setAllServices] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // ── Auth gate ──
  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        router.replace("/dashboard");
      }
    }
  }, [authStatus, session, router]);

  // ── Initial fetch ──
  useEffect(() => {
    Promise.all([
      fetch(`/api/project-templates/${id}`).then((r) => r.json()),
      fetch("/api/service-catalog/templates").then((r) => r.json()),
    ])
      .then(([tpl, services]) => {
        if (tpl?.error) {
          setError(tpl.error);
          setLoading(false);
          return;
        }
        setTemplate({
          id: tpl.id,
          name: tpl.name,
          description: tpl.description ?? null,
          workflowType: tpl.workflowType,
          isActive: tpl.isActive,
          isSystem: tpl.isSystem,
          services: (tpl.services || []).map(
            (s: {
              serviceTemplateId: string;
              sortOrder: number;
              serviceTemplate: ServiceTemplate;
            }) => ({
              serviceTemplateId: s.serviceTemplateId,
              sortOrder: s.sortOrder,
              serviceTemplate: s.serviceTemplate,
            })
          ),
          milestones: (tpl.milestones || []).map(
            (m: { id: string; title: string; amount: number; afterServiceIndex: number }) => ({
              localId: m.id,
              title: m.title,
              amount: m.amount,
              afterServiceIndex: m.afterServiceIndex,
            })
          ),
        });
        if (Array.isArray(services)) setAllServices(services);
        setLoading(false);
      })
      .catch(() => {
        setError("تعذّر تحميل القالب");
        setLoading(false);
      });
  }, [id]);

  // ── Field updaters ──
  const update = <K extends keyof TemplateData>(key: K, value: TemplateData[K]) => {
    setTemplate((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // ── Service list ops ──
  const moveService = (index: number, dir: -1 | 1) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      const next = [...prev.services];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, services: next.map((s, i) => ({ ...s, sortOrder: i })) };
    });
  };
  const removeService = (serviceTemplateId: string) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        services: prev.services
          .filter((s) => s.serviceTemplateId !== serviceTemplateId)
          .map((s, i) => ({ ...s, sortOrder: i })),
      };
    });
  };
  const addService = (svc: ServiceTemplate) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      if (prev.services.some((s) => s.serviceTemplateId === svc.id)) return prev;
      return {
        ...prev,
        services: [
          ...prev.services,
          { serviceTemplateId: svc.id, sortOrder: prev.services.length, serviceTemplate: svc },
        ],
      };
    });
  };

  // ── Milestone list ops ──
  const addMilestone = () => {
    setTemplate((prev) => {
      if (!prev) return prev;
      // Default to placing the new milestone after the first service so
      // there's always at least one valid afterServiceIndex to start from.
      return {
        ...prev,
        milestones: [
          ...prev.milestones,
          {
            localId: `new-${Date.now()}-${Math.random()}`,
            title: `الدفعة ${prev.milestones.length + 1}`,
            amount: 0,
            afterServiceIndex: 0,
          },
        ],
      };
    });
  };
  const updateMilestone = (
    localId: string,
    field: keyof Omit<MilestoneRow, "localId">,
    value: string | number
  ) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map((m) =>
          m.localId === localId ? { ...m, [field]: value } : m
        ),
      };
    });
  };
  const removeMilestone = (localId: string) => {
    setTemplate((prev) => {
      if (!prev) return prev;
      return { ...prev, milestones: prev.milestones.filter((m) => m.localId !== localId) };
    });
  };

  // ── Save ──
  const handleSave = async () => {
    if (!template) return;
    if (!template.name.trim()) {
      setError("اسم القالب مطلوب");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/project-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name.trim(),
          description: template.description?.trim() || null,
          workflowType: template.workflowType,
          isActive: template.isActive,
          services: template.services.map((s, i) => ({
            serviceTemplateId: s.serviceTemplateId,
            sortOrder: i,
          })),
          milestones: template.milestones.map((m, i) => ({
            title: m.title.trim(),
            amount: m.amount,
            afterServiceIndex: m.afterServiceIndex,
            order: i,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر الحفظ");
        setSaving(false);
        return;
      }
      router.push("/dashboard/projects/templates");
    } catch {
      setError("حدث خطأ");
      setSaving(false);
    }
  };

  // Services available for the picker = catalog minus already-attached
  const attachedIds = new Set((template?.services || []).map((s) => s.serviceTemplateId));
  const pickerCandidates = allServices
    .filter((s) => !attachedIds.has(s.id))
    .filter((s) =>
      pickerSearch.trim() === ""
        ? true
        : s.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()) ||
          s.category?.name.toLowerCase().includes(pickerSearch.trim().toLowerCase())
    );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center" dir="rtl">
        <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }
  if (!template) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="bg-white rounded-2xl p-6 text-center"
          style={{ border: "1px solid #FCA5A5", color: "#DC2626" }}
        >
          {error || "القالب غير موجود"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <MarsaButton
        variant="ghost"
        size="sm"
        icon={<ArrowRight size={16} />}
        onClick={() => router.push("/dashboard/projects/templates")}
        className="mb-6"
      >
        العودة للقوالب
      </MarsaButton>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <Layers size={24} style={{ color: "#C9A84C" }} />
            تعديل قالب المشروع
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            عدّل اسم القالب، نوع سير العمل، والخدمات المرتبطة به
          </p>
        </div>
        <div className="flex items-center gap-2">
          {template.isSystem && (
            <span
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(34,197,94,0.1)", color: "#059669" }}
            >
              قالب نظام
            </span>
          )}
          <MarsaButton
            variant="gold"
            size="lg"
            icon={<Save size={16} />}
            onClick={handleSave}
            disabled={saving}
            loading={saving}
          >
            حفظ التغييرات
          </MarsaButton>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
        >
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>
          البيانات الأساسية
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
              اسم القالب
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
              placeholder="اسم القالب"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
              الوصف (اختياري)
            </label>
            <textarea
              value={template.description || ""}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200 resize-none"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
              placeholder="وصف موجز للقالب"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
              نوع سير العمل
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["SEQUENTIAL", "INDEPENDENT"] as const).map((wf) => {
                const active = template.workflowType === wf;
                return (
                  <button
                    key={wf}
                    type="button"
                    onClick={() => update("workflowType", wf)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      border: active ? "2px solid #C9A84C" : "1px solid #E2E0D8",
                      backgroundColor: active ? "rgba(201,168,76,0.06)" : "white",
                      color: active ? "#1C1B2E" : "#6B7280",
                    }}
                  >
                    {wf === "SEQUENTIAL" ? <ArrowDown size={14} /> : <ArrowLeftRight size={14} />}
                    {wf === "SEQUENTIAL" ? "تسلسلي" : "مستقل"}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
              الحالة
            </label>
            <button
              type="button"
              onClick={() => update("isActive", !template.isActive)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                border: "2px solid",
                borderColor: template.isActive ? "#22C55E" : "#9CA3AF",
                backgroundColor: template.isActive ? "rgba(34,197,94,0.06)" : "rgba(156,163,175,0.06)",
                color: template.isActive ? "#059669" : "#6B7280",
              }}
            >
              {template.isActive ? <Power size={14} /> : <PowerOff size={14} />}
              {template.isActive ? "مفعّل" : "معطّل"}
            </button>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              الخدمات المرتبطة
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              الترتيب يحدد تسلسل تنفيذ الخدمات في المشاريع المنشأة من هذا القالب
            </p>
          </div>
          <MarsaButton
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setPickerSearch("");
              setPickerOpen(true);
            }}
          >
            إضافة خدمة
          </MarsaButton>
        </div>

        {template.services.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#FAFAF8", border: "1px dashed #E2E0D8" }}>
            <Layers size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: "#6B7280" }}>لا توجد خدمات مرتبطة بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {template.services.map((s, i) => (
              <div
                key={s.serviceTemplateId}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ border: "1px solid #E2E0D8", backgroundColor: "white" }}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveService(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 rounded disabled:opacity-30"
                    style={{ color: "#6B7280" }}
                    title="نقل لأعلى"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveService(i, 1)}
                    disabled={i === template.services.length - 1}
                    className="p-0.5 rounded disabled:opacity-30"
                    style={{ color: "#6B7280" }}
                    title="نقل لأسفل"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "#1C1B2E" }}>
                    {s.serviceTemplate.name}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>
                    {s.serviceTemplate.category?.name && <span>{s.serviceTemplate.category.name}</span>}
                    <span>{s.serviceTemplate._count.taskTemplates} مهمة</span>
                    {s.serviceTemplate.defaultDuration > 0 && (
                      <span>{s.serviceTemplate.defaultDuration} يوم</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeService(s.serviceTemplateId)}
                  className="p-2 rounded-lg transition-colors hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                  title="إزالة"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Milestones */}
      <div className="bg-white rounded-2xl p-6 mt-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
              <DollarSign size={18} style={{ color: "#059669" }} />
              دفعات القالب
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              تُنشأ كل دفعة بعد خدمة محددة، وعند توليد المشروع تقفل أول مهمة في الخدمة التالية حتى تُستلم الدفعة
            </p>
          </div>
          <MarsaButton
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={addMilestone}
            disabled={template.services.length === 0}
            title={template.services.length === 0 ? "أضف خدمة واحدة على الأقل أولاً" : undefined}
          >
            إضافة دفعة
          </MarsaButton>
        </div>

        {template.milestones.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#FAFAF8", border: "1px dashed #E2E0D8" }}>
            <DollarSign size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: "#6B7280" }}>لا توجد دفعات في هذا القالب</p>
          </div>
        ) : (
          <div className="space-y-2">
            {template.milestones.map((m) => (
              <div
                key={m.localId}
                className="p-3 rounded-xl"
                style={{ backgroundColor: "rgba(5,150,105,0.04)", border: "1px solid rgba(5,150,105,0.18)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign size={14} style={{ color: "#059669" }} />
                  <input
                    type="text"
                    value={m.title}
                    onChange={(e) => updateMilestone(m.localId, "title", e.target.value)}
                    placeholder="عنوان الدفعة"
                    className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                    style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#1C1B2E" }}
                  />
                  <button
                    type="button"
                    onClick={() => removeMilestone(m.localId)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                    style={{ color: "#DC2626" }}
                    title="إزالة الدفعة"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1 font-semibold" style={{ color: "#6B7280" }}>
                      المبلغ
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.amount || ""}
                        onChange={(e) => updateMilestone(m.localId, "amount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        dir="ltr"
                        className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                        style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#059669", fontWeight: 600 }}
                      />
                      <SarSymbol size={12} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1 font-semibold" style={{ color: "#6B7280" }}>
                      بعد الخدمة
                    </label>
                    <select
                      value={m.afterServiceIndex}
                      onChange={(e) =>
                        updateMilestone(m.localId, "afterServiceIndex", parseInt(e.target.value, 10))
                      }
                      className="w-full px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                      style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#1C1B2E" }}
                    >
                      {template.services.map((s, i) => (
                        <option key={s.serviceTemplateId} value={i}>
                          {i + 1}. {s.serviceTemplate.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: "1px solid #F0EDE6" }}>
              <span className="text-sm font-bold" style={{ color: "#1C1B2E" }}>إجمالي دفعات القالب</span>
              <span className="text-base font-bold" style={{ color: "#059669" }}>
                {template.milestones.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString("en-US")} <SarSymbol size={14} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Service picker modal ─── */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg flex flex-col"
            style={{ maxHeight: "85vh" }}
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex-shrink-0" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
                  <Layers size={18} style={{ color: "#C9A84C" }} />
                  اختيار خدمة
                </h3>
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "#9CA3AF" }}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ border: "1px solid #E2E0D8" }}>
                <Search size={14} style={{ color: "#9CA3AF" }} />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="ابحث باسم الخدمة أو الفئة..."
                  className="flex-1 text-sm outline-none"
                />
              </div>
            </div>
            <div className="p-4 flex-1 overflow-y-auto min-h-0 space-y-2">
              {pickerCandidates.length === 0 ? (
                <p className="text-center text-xs py-6" style={{ color: "#9CA3AF" }}>
                  لا توجد خدمات متاحة للإضافة
                </p>
              ) : (
                pickerCandidates.map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => {
                      addService(svc);
                      setPickerOpen(false);
                    }}
                    className="w-full text-right p-3 rounded-xl transition-all hover:shadow-sm"
                    style={{ border: "1px solid #E2E0D8", backgroundColor: "white" }}
                  >
                    <p className="text-sm font-semibold mb-1" style={{ color: "#1C1B2E" }}>
                      {svc.name}
                    </p>
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "#9CA3AF" }}>
                      {svc.category?.name && <span>{svc.category.name}</span>}
                      <span>{svc._count.taskTemplates} مهمة</span>
                      {svc.defaultDuration > 0 && <span>{svc.defaultDuration} يوم</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
