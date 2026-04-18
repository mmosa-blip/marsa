"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight, FileText, Plus, Upload, Search, Eye, Download,
  CheckCircle2, XCircle, Clock, Share2, User, Calendar, X, Loader2,
  ClipboardList, Link as LinkIcon,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

type Kind = "FILE" | "TEXT";
type Status = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "RE_UPLOAD_REQUIRED";

interface DocField { name: string; label: string }

interface CompletedTaskRequirements {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  service: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  requirements: {
    id: string;
    label: string;
    type: "TEXT" | "FILE" | "URL" | "SELECT";
    value: {
      textValue: string | null;
      fileUrl: string | null;
      selectedOption: string | null;
      updatedAt: string;
    } | null;
  }[];
}

interface ProjectDoc {
  id: string;
  kind: Kind;
  fileUrl: string | null;
  textData: string | null;
  uploadedOnBehalfOfClient: boolean;
  status: Status;
  rejectionReason: string | null;
  isSharedWithClient: boolean;
  version: number;
  createdAt: string;
  documentType: {
    id: string;
    name: string;
    description: string | null;
    fields: string | null;
    group: { id: string; name: string; displayOrder: number } | null;
  };
  uploadedBy: { id: string; name: string } | null;
  reviewedBy: { id: string; name: string } | null;
  partner?: { id: string; name: string; order: number } | null;
}

interface ProjectPartner {
  id: string;
  name: string;
  order: number;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: typeof Clock }> = {
  PENDING_REVIEW: { label: "قيد المراجعة", color: "#EA580C", icon: Clock },
  APPROVED: { label: "مُعتمد", color: "#059669", icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "#DC2626", icon: XCircle },
  RE_UPLOAD_REQUIRED: { label: "يتطلب إعادة رفع", color: "#DC2626", icon: XCircle },
};

export default function ProjectDocumentsPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const canReview = ["ADMIN", "MANAGER", "EXECUTOR"].includes(role);
  const canShare = ["ADMIN", "MANAGER"].includes(role);

  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskReqs, setTaskReqs] = useState<CompletedTaskRequirements[]>([]);
  const [partners, setPartners] = useState<ProjectPartner[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [viewData, setViewData] = useState<ProjectDoc | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadDocs = useCallback(() => {
    fetch(`/api/projects/${projectId}/documents`).then((r) => r.json()).then((d) => {
      if (Array.isArray(d)) setDocs(d);
      setLoading(false);
    });
  }, [projectId]);

  const loadTaskReqs = useCallback(() => {
    fetch(`/api/projects/${projectId}/task-requirements`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTaskReqs(d);
      })
      .catch(() => {});
  }, [projectId]);

  const loadPartners = useCallback(() => {
    fetch(`/api/projects/${projectId}/partners`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setPartners(d);
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => { loadDocs(); loadTaskReqs(); loadPartners(); }, [loadDocs, loadTaskReqs, loadPartners]);

  const handleApprove = async (docId: string) => {
    await fetch(`/api/projects/${projectId}/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    loadDocs();
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await fetch(`/api/projects/${projectId}/documents/${rejectTarget}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason: rejectReason.trim() }),
    });
    setRejectTarget(null);
    setRejectReason("");
    loadDocs();
  };

  const toggleShare = async (doc: ProjectDoc) => {
    await fetch(`/api/projects/${projectId}/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSharedWithClient: !doc.isSharedWithClient }),
    });
    loadDocs();
  };

  // Filter + group
  const filtered = docs.filter((d) => {
    if (search && !d.documentType.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });

  const byGroup = new Map<string, ProjectDoc[]>();
  for (const d of filtered) {
    const key = d.documentType.group?.name || "غير مصنف";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(d);
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 size={40} className="animate-spin" style={{ color: "#C9A84C" }} /></div>;
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <MarsaButton href={`/dashboard/projects/${projectId}`} variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>متطلبات المشروع</h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{docs.length} مستند</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MarsaButton href={`/dashboard/projects/${projectId}/documents/upload`} variant="primary" size="md" icon={<Upload size={16} />}>
            رفع دفعة مستندات
          </MarsaButton>
          <MarsaButton href={`/dashboard/projects/${projectId}/documents/upload`} variant="gold" size="md" icon={<Plus size={16} />}>
            إضافة مستند
          </MarsaButton>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم..."
            className="w-full pr-10 pl-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #E2E0D8" }}
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }}>
          <option value="">كل الحالات</option>
          <option value="PENDING_REVIEW">قيد المراجعة</option>
          <option value="APPROVED">مُعتمد</option>
          <option value="REJECTED">مرفوض</option>
        </select>
      </div>

      {/* Completed task requirements (data collected at completion) */}
      {taskReqs.length > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={18} style={{ color: "#5E5495" }} />
            <h2 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              متطلبات المهام
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
              {taskReqs.length}
            </span>
          </div>
          <div className="space-y-3">
            {taskReqs.map((task) => (
              <div
                key={task.id}
                className="rounded-xl p-4"
                style={{ border: "1px solid #F0EDE6", backgroundColor: "#FAFAF7" }}
              >
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <CheckCircle2
                      size={14}
                      style={{ color: task.status === "DONE" ? "#059669" : "#EA580C" }}
                    />
                    <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                      {task.title}
                    </p>
                    {task.status !== "DONE" && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "rgba(234,88,12,0.08)", color: "#EA580C" }}>
                        قيد التنفيذ
                      </span>
                    )}
                    {task.service && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                        {task.service.name}
                      </span>
                    )}
                  </div>
                  {task.assignee && (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: "#6B7280" }}>
                      <User size={10} />
                      {task.assignee.name}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {task.requirements.map((r) => {
                    const v = r.value;
                    return (
                      <div
                        key={r.id}
                        className="flex items-start gap-2 text-xs p-2 rounded-lg bg-white"
                        style={{ border: "1px solid #F0EDE6" }}
                      >
                        <span className="font-semibold shrink-0" style={{ color: "#1C1B2E" }}>
                          {r.label}:
                        </span>
                        <span className="flex-1 break-words" style={{ color: "#4B5563" }}>
                          {!v ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(234,88,12,0.08)", color: "#EA580C" }}>لم تُضف بعد</span>
                          ) : r.type === "FILE" && v.fileUrl ? (
                            <a
                              href={v.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 underline"
                            >
                              <Download size={11} />
                              عرض الملف
                            </a>
                          ) : r.type === "URL" && v.textValue ? (
                            <a
                              href={v.textValue}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 underline break-all"
                            >
                              <LinkIcon size={11} />
                              {v.textValue}
                            </a>
                          ) : r.type === "SELECT" && v.selectedOption ? (
                            v.selectedOption
                          ) : r.type === "TEXT" && v.textValue ? (
                            v.textValue
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project partners — listed above docs. Each partner's section
          shows the documents that were explicitly tagged with their
          partnerId; untagged docs fall through to the general grid
          below. */}
      {partners.length > 0 && (
        <div className="bg-white rounded-2xl p-5 mb-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center gap-2 mb-4">
            <User size={18} style={{ color: "#5E5495" }} />
            <h2 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
              الشركاء
            </h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
              {partners.length}
            </span>
          </div>
          <div className="space-y-4">
            {partners.map((partner, idx) => {
              const partnerDocs = filtered.filter((d) => d.partner?.id === partner.id);
              return (
                <div
                  key={partner.id}
                  className="rounded-xl p-4"
                  style={{ border: "1px solid #F0EDE6", backgroundColor: "#FAFAF7" }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: "#5E5495" }}
                    >
                      {idx + 1}
                    </div>
                    <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      {partner.name}
                    </h3>
                    <span className="text-[10px] text-gray-400">
                      {partnerDocs.length} مستند
                    </span>
                  </div>
                  {partnerDocs.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      لا توجد مستندات مسنّدة لهذا الشريك بعد.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {partnerDocs.map((doc) => {
                        const statusCfg = STATUS_CONFIG[doc.status];
                        return (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 p-2.5 rounded-lg bg-white"
                            style={{ border: "1px solid #F0EDE6" }}
                          >
                            <FileText size={14} style={{ color: "#C9A84C" }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: "#1C1B2E" }}>
                                {doc.documentType.name}
                              </p>
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium inline-block mt-0.5"
                                style={{ backgroundColor: `${statusCfg.color}1a`, color: statusCfg.color }}
                              >
                                {statusCfg.label}
                              </span>
                            </div>
                            {doc.fileUrl && (
                              <a
                                href={doc.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded hover:bg-gray-100"
                              >
                                <Eye size={13} style={{ color: "#5E5495" }} />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents by group */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
          <FileText size={40} className="mx-auto mb-3" style={{ color: "#D1D5DB" }} />
          <p style={{ color: "#6B7280" }}>لا توجد مستندات</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byGroup.entries()).map(([groupName, groupDocs]) => (
            <div key={groupName}>
              <h2 className="text-sm font-bold mb-3" style={{ color: "#5E5495" }}>
                {groupName} <span className="text-[10px] opacity-60">({groupDocs.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupDocs.map((doc) => {
                  const statusCfg = STATUS_CONFIG[doc.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <div key={doc.id} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText size={16} style={{ color: "#C9A84C" }} className="mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>
                              {doc.documentType.name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: doc.kind === "FILE" ? "rgba(94,84,149,0.1)" : "rgba(201,168,76,0.1)", color: doc.kind === "FILE" ? "#5E5495" : "#C9A84C" }}>
                                {doc.kind === "FILE" ? "ملف" : "نصي"}
                              </span>
                              {doc.version > 1 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                                  v{doc.version}
                                </span>
                              )}
                              {doc.uploadedOnBehalfOfClient && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(201,168,76,0.08)", color: "#C9A84C" }}>
                                  نيابة عن العميل
                                </span>
                              )}
                              {doc.isSharedWithClient && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: "rgba(5,150,105,0.08)", color: "#059669" }}>
                                  <Share2 size={9} />
                                  مشارك
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                          style={{ backgroundColor: `${statusCfg.color}15`, color: statusCfg.color }}>
                          <StatusIcon size={10} />
                          {statusCfg.label}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-3 text-[10px]" style={{ color: "#9CA3AF" }}>
                        {doc.uploadedBy && (
                          <span className="flex items-center gap-1"><User size={10} />{doc.uploadedBy.name}</span>
                        )}
                        <span className="flex items-center gap-1"><Calendar size={10} />{new Date(doc.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>

                      {/* Rejection reason */}
                      {doc.status === "REJECTED" && doc.rejectionReason && (
                        <div className="mt-2 p-2 rounded-lg text-[10px]" style={{ backgroundColor: "rgba(220,38,38,0.06)", color: "#DC2626" }}>
                          <strong>سبب الرفض:</strong> {doc.rejectionReason}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F3F4F6" }}>
                        {doc.kind === "FILE" && doc.fileUrl && (
                          <>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <MarsaButton variant="ghost" size="xs" icon={<Eye size={12} />}>معاينة</MarsaButton>
                            </a>
                            <a href={doc.fileUrl} download>
                              <MarsaButton variant="ghost" size="xs" icon={<Download size={12} />}>تحميل</MarsaButton>
                            </a>
                          </>
                        )}
                        {doc.kind === "TEXT" && (
                          <MarsaButton variant="ghost" size="xs" icon={<Eye size={12} />} onClick={() => setViewData(doc)}>
                            عرض البيانات
                          </MarsaButton>
                        )}
                        {canReview && doc.status === "PENDING_REVIEW" && (
                          <>
                            <MarsaButton variant="gold" size="xs" icon={<CheckCircle2 size={12} />} onClick={() => handleApprove(doc.id)}>
                              اعتماد
                            </MarsaButton>
                            <MarsaButton variant="dangerSoft" size="xs" icon={<XCircle size={12} />} onClick={() => setRejectTarget(doc.id)}>
                              رفض
                            </MarsaButton>
                          </>
                        )}
                        {canShare && (
                          <button onClick={() => toggleShare(doc)}
                            className="ms-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium"
                            style={{
                              backgroundColor: doc.isSharedWithClient ? "rgba(5,150,105,0.1)" : "#F3F4F6",
                              color: doc.isSharedWithClient ? "#059669" : "#6B7280",
                            }}>
                            <Share2 size={10} />
                            {doc.isSharedWithClient ? "إلغاء المشاركة" : "مشاركة مع العميل"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Data Modal */}
      {viewData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>{viewData.documentType.name}</h2>
              <button onClick={() => setViewData(null)} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {(() => {
                let data: Record<string, string> = {};
                try { data = viewData.textData ? JSON.parse(viewData.textData) : {}; } catch {}
                let fields: DocField[] = [];
                try { fields = viewData.documentType.fields ? JSON.parse(viewData.documentType.fields) : []; } catch {}

                if (fields.length > 0) {
                  return fields.map((f) => (
                    <div key={f.name}>
                      <label className="text-xs font-medium mb-1 block" style={{ color: "#6B7280" }}>{f.label}</label>
                      <div className="p-2.5 rounded-lg text-sm" style={{ backgroundColor: "#F8F9FA", color: "#1C1B2E" }}>
                        {data[f.name] || "—"}
                      </div>
                    </div>
                  ));
                }

                return Object.entries(data).map(([k, v]) => (
                  <div key={k}>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "#6B7280" }}>{k}</label>
                    <div className="p-2.5 rounded-lg text-sm" style={{ backgroundColor: "#F8F9FA", color: "#1C1B2E" }}>
                      {String(v) || "—"}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>رفض المستند</h2>
              <button onClick={() => { setRejectTarget(null); setRejectReason(""); }} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}><X size={18} /></button>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "#2D3748" }}>سبب الرفض *</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                placeholder="اذكر سبب الرفض ليقوم الموظف بإعادة الرفع..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: "1px solid #E2E0D8" }} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <MarsaButton variant="danger" size="md" onClick={handleReject} disabled={!rejectReason.trim()}>
                تأكيد الرفض
              </MarsaButton>
              <MarsaButton variant="secondary" size="md" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
