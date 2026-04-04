"use client";

import { useState, useEffect } from "react";
import {
  ClipboardList, Clock, CheckCircle, XCircle, Layers,
  DollarSign, Calendar, User, ChevronDown, X, AlertCircle, FolderKanban
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

interface RequestItem {
  id: string;
  name: string;
  price: number | null;
  duration: number | null;
  category: string | null;
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
  createdAt: string;
  assignedTo: { id: string; name: string } | null;
  items: RequestItem[];
  projectId: string | null;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: typeof Clock }> = {
  PENDING:     { label: "بانتظار المراجعة", bg: "#FFF7ED", text: "#EA580C", icon: Clock },
  REVIEWING:   { label: "قيد المراجعة",     bg: "#EFF6FF", text: "#2563EB", icon: Clock },
  AWAITING_PAYMENT: { label: "بانتظار الدفع", bg: "#FFF7ED", text: "#D97706", icon: Clock },
  APPROVED:    { label: "تمت الموافقة",      bg: "#ECFDF5", text: "#059669", icon: CheckCircle },
  REJECTED:    { label: "مرفوض",             bg: "#FEF2F2", text: "#DC2626", icon: XCircle },
  IN_PROGRESS: { label: "جاري التنفيذ",      bg: "#F5F3FF", text: "#7C3AED", icon: Layers },
  COMPLETED:   { label: "مكتمل",             bg: "#ECFDF5", text: "#059669", icon: CheckCircle },
  CANCELLED:   { label: "ملغي",              bg: "#F3F4F6", text: "#6B7280", icon: XCircle },
};

function ClientReplySection({ request, onUpdate }: {
  request: ServiceRequest;
  onUpdate: (updated: ServiceRequest) => void;
}) {
  const [reply, setReply] = useState(request.clientReply || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);

  const handleSaveReply = async () => {
    if (!reply.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/service-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientReply: reply }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate(updated);
    } catch {
      alert("حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("requestId", request.id);
      const res = await fetch("/api/service-requests/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUploadedFiles((prev) => [...prev, { name: file.name, url: data.url }]);
    } catch {
      alert("فشل رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const isClosed = ["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>ردك على الإدارة</p>

      {request.clientReply && (
        <div className="p-3 rounded-xl" style={{ backgroundColor: "#F8F7F4" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>ردك السابق</p>
          <p className="text-sm" style={{ color: "#2D3748" }}>{request.clientReply}</p>
        </div>
      )}

      {!isClosed && (
        <>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="اكتب ردك أو ملاحظاتك هنا..."
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
          />
          <div className="flex gap-2">
            <button onClick={handleSaveReply} disabled={saving || !reply.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#5E5495" }}>
              {saving ? "جاري الإرسال..." : "إرسال الرد"}
            </button>
            <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: "#F8F7F4", color: "#1C1B2E", border: "1px solid #E2E0D8" }}>
              {uploading ? "جاري الرفع..." : "📎 رفع وثيقة"}
              <input type="file" className="hidden" onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" disabled={uploading} />
            </label>
          </div>
        </>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-1">
          {uploadedFiles.map((f, i) => (
            <a key={i} href={f.url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg text-xs"
              style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
              📄 {f.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<ServiceRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { document.title = "طلباتي | مرسى"; }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/service-requests?${params}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setRequests(d); })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const handleCancel = async (id: string) => {
    if (!confirm("هل تريد إلغاء هذا الطلب؟")) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!res.ok) throw new Error();
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "CANCELLED" } : r));
      setSelected(null);
    } catch {
      alert("حدث خطأ");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>طلباتي</h1>
        <p className="text-sm mt-1 text-gray-500">متابعة حالة طلبات الخدمات</p>
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
          <p className="text-sm mt-1 text-gray-400">اطلب خدمة من سوق الخدمات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const st = statusConfig[req.status] || statusConfig.PENDING;
            const StIcon = st.icon;
            return (
              <div key={req.id} onClick={() => setSelected(req)}
                className="bg-white rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
                style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                    {req.items.map((i) => i.name).join("، ")}
                  </p>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: st.bg, color: st.text }}>
                    <StIcon size={12} />
                    {st.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                  {req.totalPrice && (
                    <span className="flex items-center gap-1">
                      <DollarSign size={12} />
                      {req.totalPrice.toLocaleString("en-US")} <SarSymbol size={12} />
                    </span>
                  )}
                  {req.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      يبدأ: {new Date(req.startDate).toLocaleDateString("ar-SA-u-nu-latn")}
                    </span>
                  )}
                  {req.assignedTo && (
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {req.assignedTo.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(req.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}
                  </span>
                </div>
                {req.adminNotes && (
                  <div className="mt-2 flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: "#EFF6FF" }}>
                    <AlertCircle size={14} style={{ color: "#2563EB", marginTop: 1 }} />
                    <p className="text-xs" style={{ color: "#2563EB" }}>{req.adminNotes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            style={{ border: "1px solid #E2E0D8" }} dir="rtl">
            <div className="p-6 border-b" style={{ borderColor: "#E8E6F0" }}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تفاصيل الطلب</h2>
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                  <X size={20} style={{ color: "#6B7280" }} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: "#6B7280" }}>الحالة</span>
                {(() => {
                  const st = statusConfig[selected.status] || statusConfig.PENDING;
                  const StIcon = st.icon;
                  return (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: st.bg, color: st.text }}>
                      <StIcon size={12} /> {st.label}
                    </span>
                  );
                })()}
              </div>

              {selected.projectId && (
                <a href="/dashboard/my-projects"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ backgroundColor: "rgba(201, 168, 76, 0.1)", color: "#C9A84C", border: "1px solid rgba(201, 168, 76, 0.3)" }}>
                  <FolderKanban size={16} />
                  متابعة المشروع
                </a>
              )}

              {/* Services */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>الخدمات</p>
                <div className="space-y-2">
                  {selected.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ backgroundColor: "#F8F7F4" }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#2D3748" }}>{item.name}</p>
                        {item.category && <p className="text-xs" style={{ color: "#94A3B8" }}>{item.category}</p>}
                      </div>
                      {item.price && (
                        <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>
                          {item.price.toLocaleString("en-US")} <SarSymbol size={14} />
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 pt-2" style={{ borderTop: "1px solid #E2E0D8" }}>
                {selected.totalPrice && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "#6B7280" }}>السعر الإجمالي</span>
                    <span className="font-bold" style={{ color: "#C9A84C" }}>{selected.totalPrice.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                  </div>
                )}
                {selected.startDate && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "#6B7280" }}>تاريخ البدء</span>
                    <span style={{ color: "#2D3748" }}>{new Date(selected.startDate).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                  </div>
                )}
                {selected.endDate && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "#6B7280" }}>تاريخ الانتهاء</span>
                    <span style={{ color: "#2D3748" }}>{new Date(selected.endDate).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                  </div>
                )}
                {selected.assignedTo && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: "#6B7280" }}>المسؤول</span>
                    <span style={{ color: "#2D3748" }}>{selected.assignedTo.name}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span style={{ color: "#6B7280" }}>نوع التنفيذ</span>
                  <span style={{ color: "#2D3748" }}>{selected.workflowType === "SEQUENTIAL" ? "تسلسلي" : "مستقل"}</span>
                </div>
              </div>

              {selected.notes && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#F8F7F4" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>ملاحظاتك</p>
                  <p className="text-sm" style={{ color: "#6B7280" }}>{selected.notes}</p>
                </div>
              )}
            </div>

            {/* Client Reply */}
            <div className="p-6 space-y-4" style={{ borderTop: "1px solid #E2E0D8" }}>
              {selected.adminNotes && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: "#EFF6FF" }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: "#2563EB" }}>ملاحظات الإدارة</p>
                  <p className="text-sm" style={{ color: "#2563EB" }}>{selected.adminNotes}</p>
                </div>
              )}

              <ClientReplySection request={selected} onUpdate={(updated) => {
                setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
                setSelected(updated);
              }} />

              {["PENDING", "REVIEWING"].includes(selected.status) && (
                <button onClick={() => handleCancel(selected.id)} disabled={cancelling}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                  {cancelling ? "جاري الإلغاء..." : "إلغاء الطلب"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
