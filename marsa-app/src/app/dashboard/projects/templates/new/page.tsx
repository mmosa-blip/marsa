"use client";

/**
 * Standalone create-template page.
 *
 * Replaces the old "إنشاء قالب جديد" link that hijacked the new-project
 * wizard (which forces the user through client/contract/documents steps
 * that have nothing to do with a template). This page only collects the
 * fields a template actually carries:
 *
 *   - name + description
 *   - workflowType (SEQUENTIAL / INDEPENDENT)
 *   - services list with reorder + per-service execution mode toggle
 *   - payment milestones (title + amount + afterServiceIndex)
 *
 * Submit POSTs to /api/project-templates and routes back to the list.
 */

import { useState, useEffect } from "react";
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
  taskTemplates?: { defaultDuration: number }[];
  _count: { taskTemplates: number };
}

interface AttachedService {
  serviceTemplateId: string;
  serviceTemplate: ServiceTemplate;
  executionMode: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
}

interface MilestoneRow {
  localId: string;
  title: string;
  amount: number;
  afterServiceIndex: number; // -1 = before the first service
}

export default function NewProjectTemplatePage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflowType, setWorkflowType] = useState<"SEQUENTIAL" | "INDEPENDENT">("SEQUENTIAL");
  const [services, setServices] = useState<AttachedService[]>([]);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);

  const [allServices, setAllServices] = useState<ServiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Auth gate
  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.role) {
      if (!["ADMIN", "MANAGER"].includes(session.user.role)) {
        router.replace("/dashboard");
      }
    }
  }, [authStatus, session, router]);

  // Service catalog for the picker
  useEffect(() => {
    fetch("/api/service-catalog/templates")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setAllServices(d);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Service ops ──
  const moveService = (index: number, dir: -1 | 1) => {
    setServices((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const removeService = (serviceTemplateId: string) => {
    setServices((prev) => prev.filter((s) => s.serviceTemplateId !== serviceTemplateId));
    // Drop milestones whose afterServiceIndex now exceeds the new bounds
    setMilestones((prev) => prev.filter((m) => m.afterServiceIndex < services.length - 1));
  };
  const addService = (svc: ServiceTemplate) => {
    setServices((prev) => {
      if (prev.some((s) => s.serviceTemplateId === svc.id)) return prev;
      return [...prev, { serviceTemplateId: svc.id, serviceTemplate: svc, executionMode: "SEQUENTIAL" }];
    });
  };
  const toggleServiceMode = (serviceTemplateId: string) => {
    setServices((prev) =>
      prev.map((s) =>
        s.serviceTemplateId === serviceTemplateId
          ? { ...s, executionMode: s.executionMode === "PARALLEL" ? "SEQUENTIAL" : "PARALLEL" }
          : s
      )
    );
  };

  // ── Milestone ops ──
  const addMilestone = (afterIndex: number) => {
    setMilestones((prev) => [
      ...prev,
      {
        localId: `new-${Date.now()}-${Math.random()}`,
        title:
          afterIndex === -1
            ? "دفعة قبل بدء المشروع"
            : `دفعة بعد ${services[afterIndex]?.serviceTemplate.name || "الخدمة"}`,
        amount: 0,
        afterServiceIndex: afterIndex,
      },
    ]);
  };
  const updateMilestone = (
    localId: string,
    field: "title" | "amount",
    value: string | number
  ) => {
    setMilestones((prev) =>
      prev.map((m) => (m.localId === localId ? { ...m, [field]: value } : m))
    );
  };
  const removeMilestone = (localId: string) => {
    setMilestones((prev) => prev.filter((m) => m.localId !== localId));
  };

  // ── Save ──
  const handleSave = async () => {
    if (!name.trim()) {
      setError("اسم القالب مطلوب");
      return;
    }
    if (services.length === 0) {
      setError("يجب إضافة خدمة واحدة على الأقل");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/project-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          workflowType,
          services: services.map((s, i) => ({
            serviceTemplateId: s.serviceTemplateId,
            sortOrder: i,
            executionMode: s.executionMode,
          })),
          milestones: milestones.map((m) => ({
            title: m.title.trim(),
            amount: m.amount,
            afterServiceIndex: m.afterServiceIndex,
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

  // Picker candidates
  const attachedIds = new Set(services.map((s) => s.serviceTemplateId));
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
            إنشاء قالب مشروع جديد
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            عرّف الخدمات والدفعات بدون الحاجة لاختيار عميل أو عقد
          </p>
        </div>
        <MarsaButton
          variant="gold"
          size="lg"
          icon={<Save size={16} />}
          onClick={handleSave}
          disabled={saving}
          loading={saving}
        >
          حفظ القالب
        </MarsaButton>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
        >
          {error}
        </div>
      )}

      {/* Basic info */}
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
              style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
              placeholder="مثلاً: مشروع استحواذ شركة أجنبية"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-1.5" style={{ color: "#374151" }}>
              الوصف (اختياري)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                const active = workflowType === wf;
                return (
                  <button
                    key={wf}
                    type="button"
                    onClick={() => setWorkflowType(wf)}
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
        </div>
      </div>

      {/* Services */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
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

        {services.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#FAFAF8", border: "1px dashed #E2E0D8" }}>
            <Layers size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: "#6B7280" }}>لا توجد خدمات مرتبطة بعد</p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s, i) => (
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
                    disabled={i === services.length - 1}
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
                  <div className="flex items-center gap-2 text-[11px] mt-0.5 flex-wrap" style={{ color: "#9CA3AF" }}>
                    {s.serviceTemplate.category?.name && <span>{s.serviceTemplate.category.name}</span>}
                    <span>{s.serviceTemplate._count.taskTemplates} مهمة</span>
                    {s.serviceTemplate.defaultDuration > 0 && (
                      <span>{s.serviceTemplate.defaultDuration} يوم</span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleServiceMode(s.serviceTemplateId)}
                      className="px-2 py-0.5 rounded-full font-semibold transition-all"
                      style={
                        s.executionMode === "PARALLEL"
                          ? { backgroundColor: "rgba(37,99,235,0.1)", color: "#2563EB", border: "1px solid rgba(37,99,235,0.25)" }
                          : { backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }
                      }
                      title={s.executionMode === "PARALLEL"
                        ? "المهام تعمل بالتوازي — اضغط للتسلسل"
                        : "المهام تعمل بالتسلسل — اضغط للتوازي"}
                    >
                      {s.executionMode === "PARALLEL" ? "⇄ توازي" : "↕ تسلسلي"}
                    </button>
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

      {/* Payment milestones */}
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
              <DollarSign size={18} style={{ color: "#059669" }} />
              دفعات القالب
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              تُنشأ كل دفعة بعد خدمة محددة (أو قبل بدء المشروع)، وعند توليد المشروع تقفل أول مهمة في الخدمة التالية حتى تُستلم الدفعة
            </p>
          </div>
        </div>

        {/* Before-first-service slot */}
        {services.length > 0 && (
          <div className="mb-3 p-3 rounded-xl" style={{ backgroundColor: "rgba(5,150,105,0.04)", border: "1px dashed rgba(5,150,105,0.2)" }}>
            <p className="text-[11px] font-semibold mb-2" style={{ color: "#059669" }}>قبل بدء المشروع</p>
            {milestones.filter((m) => m.afterServiceIndex === -1).map((m) => (
              <div key={m.localId} className="flex items-center gap-2 mb-2 last:mb-0">
                <DollarSign size={14} style={{ color: "#059669" }} />
                <input
                  type="text"
                  value={m.title}
                  onChange={(e) => updateMilestone(m.localId, "title", e.target.value)}
                  placeholder="عنوان الدفعة"
                  className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                  style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#1C1B2E" }}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.amount || ""}
                  onChange={(e) => updateMilestone(m.localId, "amount", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  dir="ltr"
                  className="w-28 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                  style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#059669", fontWeight: 600 }}
                />
                <SarSymbol size={12} />
                <button
                  type="button"
                  onClick={() => removeMilestone(m.localId)}
                  className="p-1.5 rounded-lg hover:bg-red-50"
                  style={{ color: "#DC2626" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addMilestone(-1)}
              className="flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-xs font-medium border border-dashed mt-1"
              style={{ color: "#059669", borderColor: "rgba(5,150,105,0.3)" }}
            >
              <Plus size={12} />
              <span>إضافة دفعة قبل بدء المشروع</span>
            </button>
          </div>
        )}

        {/* Between/after services */}
        {services.length === 0 ? (
          <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#FAFAF8", border: "1px dashed #E2E0D8" }}>
            <DollarSign size={32} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
            <p className="text-sm" style={{ color: "#6B7280" }}>أضف خدمة أولاً لإمكانية إضافة دفعات بينها</p>
          </div>
        ) : (
          services.map((s, idx) => {
            const milestonesAfter = milestones.filter((m) => m.afterServiceIndex === idx);
            return (
              <div key={s.serviceTemplateId} className="mb-3 last:mb-0 p-3 rounded-xl" style={{ backgroundColor: "rgba(5,150,105,0.04)", border: "1px dashed rgba(5,150,105,0.2)" }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: "#059669" }}>
                  بعد: {s.serviceTemplate.name}
                </p>
                {milestonesAfter.map((m) => (
                  <div key={m.localId} className="flex items-center gap-2 mb-2 last:mb-0">
                    <DollarSign size={14} style={{ color: "#059669" }} />
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => updateMilestone(m.localId, "title", e.target.value)}
                      placeholder="عنوان الدفعة"
                      className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                      style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#1C1B2E" }}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={m.amount || ""}
                      onChange={(e) => updateMilestone(m.localId, "amount", parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      dir="ltr"
                      className="w-28 px-2 py-1.5 text-sm rounded-lg outline-none bg-white"
                      style={{ border: "1px solid rgba(5,150,105,0.25)", color: "#059669", fontWeight: 600 }}
                    />
                    <SarSymbol size={12} />
                    <button
                      type="button"
                      onClick={() => removeMilestone(m.localId)}
                      className="p-1.5 rounded-lg hover:bg-red-50"
                      style={{ color: "#DC2626" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addMilestone(idx)}
                  className="flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-xs font-medium border border-dashed mt-1"
                  style={{ color: "#059669", borderColor: "rgba(5,150,105,0.3)" }}
                >
                  <Plus size={12} />
                  <span>إضافة دفعة بعد هذه الخدمة</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Service picker modal */}
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
