"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import {
  ClipboardList, Clock, CheckCircle, XCircle, Search,
  ChevronDown, User, Calendar, DollarSign, Layers,
  ArrowDown, ArrowLeftRight, X, Check, AlertCircle,
  FolderKanban
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface RequestItem {
  id: string;
  name: string;
  price: number | null;
  duration: number | null;
  category: string | null;
  templateId: string | null;
}

interface ServiceRequest {
  id: string;
  status: string;
  notes: string | null;
  adminNotes: string | null;
  clientReply: string | null;
  startDate: string | null;
  endDate: string | null;
  totalPrice: number | null;
  workflowType: string;
  projectId: string | null;
  createdAt: string;
  client: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string } | null;
  items: RequestItem[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  PENDING:     { label: "بانتظار المراجعة", bg: "#FFF7ED", text: "#EA580C", icon: Clock },
  REVIEWING:   { label: "قيد المراجعة",     bg: "#EFF6FF", text: "#2563EB", icon: Search },
  AWAITING_PAYMENT: { label: "بانتظار الدفع", bg: "#FFF7ED", text: "#D97706", icon: Clock },
  APPROVED:    { label: "تمت الموافقة",      bg: "#ECFDF5", text: "#059669", icon: CheckCircle },
  REJECTED:    { label: "مرفوض",             bg: "#FEF2F2", text: "#DC2626", icon: XCircle },
  IN_PROGRESS: { label: "جاري التنفيذ",      bg: "#F5F3FF", text: "#7C3AED", icon: Layers },
  COMPLETED:   { label: "مكتمل",             bg: "#ECFDF5", text: "#059669", icon: CheckCircle },
  CANCELLED:   { label: "ملغي",              bg: "#F3F4F6", text: "#6B7280", icon: XCircle },
};

export default function ServiceRequestsPage() {
  const { data: session } = useSession();
  const { refreshCounts } = useSidebarCounts();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    status: "",
    adminNotes: "",
    assignedToId: "",
    startDate: "",
    endDate: "",
    totalPrice: "",
    workflowType: "SEQUENTIAL",
  });
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({
    name: "",
    description: "",
    workflowType: "SEQUENTIAL",
    priority: "MEDIUM",
    startDate: "",
    endDate: "",
  });

  useEffect(() => { document.title = "طلبات الخدمات | مرسى"; }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/service-requests?${params}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setRequests(d); })
      .finally(() => setLoading(false));

    fetch("/api/users?role=MANAGER")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setManagers(d); });
  }, [statusFilter]);

  const openRequest = (req: ServiceRequest) => {
    setSelected(req);
    setForm({
      status: req.status,
      adminNotes: req.adminNotes || "",
      assignedToId: req.assignedTo?.id || "",
      startDate: req.startDate ? req.startDate.split("T")[0] : "",
      endDate: req.endDate ? req.endDate.split("T")[0] : "",
      totalPrice: req.totalPrice?.toString() || "",
      workflowType: req.workflowType || "SEQUENTIAL",
    });
  };

  const handleConvertToProject = async () => {
    if (!selected) return;
    setConverting(true);
    try {
      // First approve the request
      await fetch(`/api/service-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });

      // Build services array from items
      const services = selected.items.map((item, idx) => ({
        serviceTemplateId: item.templateId || "",
        price: item.price || 0,
        sortOrder: idx,
      })).filter((s) => s.serviceTemplateId !== "");

      // Set automatic start date = now
      const startDate = new Date().toISOString();

      // Create project
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: convertForm.name || `مشروع - ${selected.client.name}`,
          description: convertForm.description || selected.notes || null,
          clientId: selected.client.id,
          workflowType: convertForm.workflowType,
          priority: convertForm.priority,
          totalPrice: selected.totalPrice || 0,
          startDate,
          services: services.length > 0 ? services : undefined,
        }),
      });

      if (!res.ok) throw new Error();
      const project = await res.json();

      // Link project to service request
      await fetch(`/api/service-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS", projectId: project.id }),
      });

      alert(`تم إنشاء المشروع بنجاح! رقم المشروع: ${project.id}`);
      setShowConvertModal(false);
      setSelected(null);
      setRequests((prev) => prev.map((r) =>
        r.id === selected.id ? { ...r, status: "IN_PROGRESS" } : r
      ));
      refreshCounts();
    } catch {
      alert("حدث خطأ أثناء تحويل الطلب إلى مشروع");
    } finally {
      setConverting(false);
    }
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/service-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          assignedToId: form.assignedToId || null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          totalPrice: form.totalPrice || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
      refreshCounts();
      setSelected(null);
    } catch {
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "PENDING").length,
    inProgress: requests.filter((r) => r.status === "IN_PROGRESS").length,
    completed: requests.filter((r) => r.status === "COMPLETED").length,
  };

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>طلبات الخدمات</h1>
        <p className="text-sm mt-1 text-gray-500">إدارة ومراجعة طلبات الخدمات من العملاء</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "إجمالي الطلبات", value: stats.total, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
          { label: "بانتظار المراجعة", value: stats.pending, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
          { label: "جاري التنفيذ", value: stats.inProgress, color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
          { label: "مكتملة", value: stats.completed, color: "#059669", bg: "rgba(5,150,105,0.08)" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
            <p className="text-xs mb-2" style={{ color: "#6B7280" }}>{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3" style={{ border: "1px solid #E2E0D8" }}>
        <ChevronDown size={16} style={{ color: "#94A3B8" }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="flex-1 text-sm outline-none bg-white" style={{ color: "#2D3748" }}>
          <option value="">كل الطلبات</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <ClipboardList size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد طلبات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const st = statusConfig[req.status] || statusConfig.PENDING;
            const StIcon = st.icon;
            return (
              <div key={req.id} onClick={() => openRequest(req)}
                className="bg-white rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>
                      {req.client.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: "#1C1B2E" }}>{req.client.name}</p>
                      <p className="text-xs" style={{ color: "#94A3B8" }}>{req.client.email}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: st.bg, color: st.text }}>
                    <StIcon size={12} />
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Layers size={12} />
                    {req.items.length} خدمة: {req.items.map((i) => i.name).join("، ")}
                  </span>
                  {req.totalPrice && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {req.totalPrice.toLocaleString("en-US")} <SarSymbol size={12} />
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(req.createdAt).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {req.assignedTo && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {req.assignedTo.name}
                    </span>
                  )}
                </div>
                {req.notes && (
                  <p className="mt-2 text-xs p-2 rounded-lg" style={{ backgroundColor: "#F8F7F4", color: "#6B7280" }}>
                    ملاحظات العميل: {req.notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid #E2E0D8" }} dir="rtl">
            <div className="p-6 border-b" style={{ borderColor: "#E8E6F0" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                    طلب من: {selected.client.name}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
                    {new Date(selected.createdAt).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {selected.projectId && (
                    <a href={`/dashboard/projects/${selected.projectId}`}
                      className="flex items-center gap-1.5 mt-1 text-xs font-medium"
                      style={{ color: "#7C3AED" }}>
                      <FolderKanban size={12} />
                      عرض المشروع المرتبط
                    </a>
                  )}
                </div>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                  <X size={20} style={{ color: "#6B7280" }} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Services */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>الخدمات المطلوبة</p>
                <div className="space-y-2">
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: "#F8F7F4" }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#2D3748" }}>{item.name}</p>
                        {item.category && <p className="text-xs" style={{ color: "#94A3B8" }}>{item.category}</p>}
                      </div>
                      <div className="text-left">
                        {item.price && <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{item.price.toLocaleString("en-US")} <SarSymbol size={14} /></p>}
                        {item.duration && <p className="text-xs" style={{ color: "#94A3B8" }}>{item.duration} يوم</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#1C1B2E" }}>ملاحظات العميل</p>
                  <p className="text-sm p-3 rounded-xl" style={{ backgroundColor: "#F8F7F4", color: "#6B7280" }}>{selected.notes}</p>
                </div>
              )}

              {selected.clientReply && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#ECFDF5" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#059669" }}>رد العميل</p>
                  <p className="text-sm" style={{ color: "#059669" }}>{selected.clientReply}</p>
                </div>
              )}

              {/* Admin Controls */}
              <div className="space-y-4 pt-4" style={{ borderTop: "1px solid #E2E0D8" }}>
                <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>إجراءات الإدارة</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>الحالة</label>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>
                      {Object.entries(statusConfig).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>نوع سير العمل</label>
                    <select value={form.workflowType} onChange={(e) => setForm((f) => ({ ...f, workflowType: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>
                      <option value="SEQUENTIAL">تسلسلي</option>
                      <option value="PARALLEL">مستقل</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>إسناد إلى</label>
                  <select value={form.assignedToId} onChange={(e) => setForm((f) => ({ ...f, assignedToId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>
                    <option value="">بدون إسناد</option>
                    {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>السعر الإجمالي</label>
                    <input type="number" value={form.totalPrice} onChange={(e) => setForm((f) => ({ ...f, totalPrice: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>تاريخ البدء</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>تاريخ الانتهاء</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>ملاحظات الإدارة</label>
                  <textarea value={form.adminNotes} onChange={(e) => setForm((f) => ({ ...f, adminNotes: e.target.value }))}
                    rows={3} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
                </div>
              </div>
            </div>

            <div className="p-6 flex gap-3" style={{ borderTop: "1px solid #E2E0D8" }}>
              {["APPROVED", "REVIEWING"].includes(form.status) && (
                <MarsaButton
                  onClick={() => {
                    setConvertForm({
                      name: `مشروع - ${selected.client.name}`,
                      description: selected.notes || "",
                      workflowType: selected.workflowType || "SEQUENTIAL",
                      priority: "MEDIUM",
                      startDate: "",
                      endDate: "",
                    });
                    setShowConvertModal(true);
                  }}
                  variant="ghost"
                  icon={<FolderKanban size={16} />}
                  style={{ backgroundColor: "rgba(124,58,237,0.1)", color: "#7C3AED" }}
                >
                  تحويل إلى مشروع
                </MarsaButton>
              )}
              <MarsaButton onClick={handleSave} disabled={saving} variant="primary" loading={saving} icon={!saving ? <Check size={16} /> : undefined} className="flex-1">
                {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
              </MarsaButton>
              <MarsaButton onClick={() => setSelected(null)} variant="secondary">
                إغلاق
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {showConvertModal && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
            <div className="p-6 border-b" style={{ borderColor: "#E8E6F0" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تحويل إلى مشروع</h2>
                <button onClick={() => setShowConvertModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                  <X size={20} style={{ color: "#6B7280" }} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>اسم المشروع</label>
                <input value={convertForm.name}
                  onChange={(e) => setConvertForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>وصف المشروع</label>
                <textarea value={convertForm.description}
                  onChange={(e) => setConvertForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>نوع سير العمل</label>
                  <select value={convertForm.workflowType}
                    onChange={(e) => setConvertForm((f) => ({ ...f, workflowType: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
                    style={{ border: "1px solid #E2E0D8" }}>
                    <option value="SEQUENTIAL">تسلسلي</option>
                    <option value="PARALLEL">مستقل</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>الأولوية</label>
                  <select value={convertForm.priority}
                    onChange={(e) => setConvertForm((f) => ({ ...f, priority: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white"
                    style={{ border: "1px solid #E2E0D8" }}>
                    <option value="LOW">منخفضة</option>
                    <option value="MEDIUM">متوسطة</option>
                    <option value="HIGH">عالية</option>
                    <option value="URGENT">عاجلة</option>
                  </select>
                </div>
              </div>
              <div className="p-3 rounded-xl" style={{ backgroundColor: "#F8F7F4" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#1C1B2E" }}>الخدمات ({selected.items.length})</p>
                {selected.items.map((item) => (
                  <p key={item.id} className="text-xs" style={{ color: "#6B7280" }}>• {item.name}</p>
                ))}
              </div>
            </div>
            <div className="p-6 flex gap-3" style={{ borderTop: "1px solid #E2E0D8" }}>
              <MarsaButton onClick={handleConvertToProject} disabled={converting} variant="primary" loading={converting} icon={!converting ? <FolderKanban size={16} /> : undefined} className="flex-1" style={{ backgroundColor: "#7C3AED" }}>
                {converting ? "جاري الإنشاء..." : "إنشاء المشروع"}
              </MarsaButton>
              <MarsaButton onClick={() => setShowConvertModal(false)} variant="secondary">
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
