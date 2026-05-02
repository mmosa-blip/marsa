"use client";

import { useEffect, useState } from "react";
import {
  X,
  CheckCircle2,
  Loader2,
  FileText,
  Lock,
  KeyRound,
  StickyNote,
  AlertTriangle,
  Link as LinkIcon,
  Upload,
  RefreshCw,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { UploadButton } from "@/lib/uploadthing";

// ═══════════════════════════════════════════════════════════════════════
// Tier 4 — TaskRecordLinksModal
// ───────────────────────────────────────────────────────────────────────
// Shown either before completing a task, or in response to a 400 with
// `blockingRecordItems` from the task complete endpoints. Lists each
// linked record item, lets the user upload-on-the-fly for DOCUMENT
// items, and refreshes after each upload so APPROVED items disappear
// from the blocking list.

type Kind =
  | "DOCUMENT"
  | "NOTE"
  | "SENSITIVE_DATA"
  | "PLATFORM_ACCOUNT"
  | "PLATFORM_LINK"
  | "ISSUE";

type Status =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "MISSING"
  | "EXPIRED"
  | "ARCHIVED";

type IconCmp = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

interface RecordLink {
  id: string;
  isRequired: boolean;
  recordItem: {
    id: string;
    title: string;
    description: string | null;
    kind: Kind;
    status: Status;
    fileUrl: string | null;
    documentType: { id: string; name: string } | null;
    partner: {
      id: string;
      partnerNumber: number;
      name: string | null;
    } | null;
    service: { id: string; name: string } | null;
  };
}

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  onAllResolved?: () => void;
}

const KIND_META: Record<Kind, { label: string; icon: IconCmp; color: string }> = {
  DOCUMENT: { label: "مستند", icon: FileText, color: "#5E5495" },
  NOTE: { label: "ملاحظة", icon: StickyNote, color: "#C9A84C" },
  PLATFORM_LINK: { label: "رابط", icon: LinkIcon, color: "#1B2A4A" },
  PLATFORM_ACCOUNT: { label: "حساب", icon: KeyRound, color: "#0EA5E9" },
  SENSITIVE_DATA: { label: "حساس", icon: Lock, color: "#7C3AED" },
  ISSUE: { label: "مشكلة", icon: AlertTriangle, color: "#DC2626" },
};

const STATUS_META: Record<Status, { label: string; color: string }> = {
  MISSING: { label: "مفقود", color: "#DC2626" },
  DRAFT: { label: "مسودة", color: "#94A3B8" },
  PENDING_REVIEW: { label: "للمراجعة", color: "#EA580C" },
  APPROVED: { label: "معتمد", color: "#16A34A" },
  REJECTED: { label: "مرفوض", color: "#DC2626" },
  EXPIRED: { label: "منتهي", color: "#A16207" },
  ARCHIVED: { label: "مؤرشف", color: "#6B7280" },
};

export default function TaskRecordLinksModal({
  taskId,
  taskTitle,
  onClose,
  onAllResolved,
}: Props) {
  const [links, setLinks] = useState<RecordLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Per-item upload progress (0-100). Cleared when the file lands and
  // the PATCH to /api/record-items/[id] resolves.
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/record-links`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error || "تعذّر تحميل المتطلبات");
        setLinks([]);
        return;
      }
      const data = (await res.json()) as RecordLink[];
      setLinks(data);
      // Don't auto-fire onAllResolved here — surface an explicit
      // "إكمال المهمة الآن" button instead so the executor controls
      // the moment of completion (and isn't surprised by the modal
      // closing on them mid-action).
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(item: RecordLink["recordItem"], fileUrl: string) {
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/record-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error || "تعذّر الرفع");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  const blocking = links.filter(
    (l) => l.isRequired && l.recordItem.status !== "APPROVED"
  );
  const allResolved = links.length > 0 && blocking.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !busyId && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              متطلبات إنهاء المهمة
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
              {taskTitle}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <MarsaButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<RefreshCw size={16} />}
              onClick={refresh}
              disabled={loading || !!busyId}
              title="تحديث"
            />
            <MarsaButton
              variant="ghost"
              size="sm"
              iconOnly
              icon={<X size={18} />}
              onClick={onClose}
              disabled={!!busyId}
            />
          </div>
        </div>

        <div className="p-5 space-y-3">
          {loading ? (
            <div className="text-center py-12">
              <Loader2
                size={28}
                className="animate-spin mx-auto"
                style={{ color: "#C9A84C" }}
              />
              <p className="text-sm mt-3" style={{ color: "#6B7280" }}>
                جاري التحميل…
              </p>
            </div>
          ) : links.length === 0 ? (
            <div
              className="p-6 rounded-xl text-center"
              style={{ backgroundColor: "#F8F8F4" }}
            >
              <CheckCircle2
                size={28}
                className="mx-auto mb-2"
                style={{ color: "#16A34A" }}
              />
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                لا توجد متطلبات سجل لهذه المهمة
              </p>
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                يمكنك إنهاء المهمة مباشرة.
              </p>
            </div>
          ) : (
            <>
              {allResolved && (
                <div
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    backgroundColor: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.3)",
                  }}
                >
                  <CheckCircle2 size={20} style={{ color: "#16A34A" }} className="shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
                      كل المتطلبات الإجبارية معتمدة
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#15803D" }}>
                      اضغط "إكمال المهمة الآن" لإنهائها.
                    </p>
                  </div>
                </div>
              )}
              {links.map((link) => {
                const it = link.recordItem;
                const kind = KIND_META[it.kind];
                const status = STATUS_META[it.status];
                const Icon = kind.icon;
                const isBlocking = link.isRequired && it.status !== "APPROVED";
                return (
                  <div
                    key={link.id}
                    className="p-3 rounded-xl border"
                    style={{
                      borderColor: isBlocking ? "#FECACA" : "#E5E7EB",
                      backgroundColor: isBlocking ? "rgba(220,38,38,0.03)" : "white",
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Icon size={16} style={{ color: kind.color }} />
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-bold"
                          style={{ color: "#1C1B2E" }}
                        >
                          {it.title}
                        </p>
                        {it.description && (
                          <p
                            className="text-xs mt-0.5 line-clamp-2"
                            style={{ color: "#6B7280" }}
                          >
                            {it.description}
                          </p>
                        )}
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: `${status.color}15`,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {it.partner && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(201,168,76,0.12)",
                            color: "#C9A84C",
                          }}
                        >
                          {it.partner.name || `الشريك ${it.partner.partnerNumber}`}
                        </span>
                      )}
                      {it.service && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(94,84,149,0.1)",
                            color: "#5E5495",
                          }}
                        >
                          {it.service.name}
                        </span>
                      )}
                      {!link.isRequired && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: "rgba(148,163,184,0.15)",
                            color: "#64748B",
                          }}
                        >
                          اختياري
                        </span>
                      )}
                    </div>
                    {/* Inline upload for DOCUMENT items that are still missing/draft */}
                    {it.kind === "DOCUMENT" &&
                      ["MISSING", "DRAFT", "REJECTED", "EXPIRED"].includes(it.status) && (
                        <div className="mt-2">
                          {(() => {
                            const pct = progress[it.id];
                            // Three states: uploading (pct < 100), saving (busyId set,
                            // pct undefined or 100), idle (show button).
                            if (pct !== undefined && pct < 100) {
                              return (
                                <div
                                  className="p-2 rounded-lg"
                                  style={{ backgroundColor: "#F8F8F4" }}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs flex items-center gap-1" style={{ color: "#5E5495" }}>
                                      <Upload size={12} />
                                      جاري رفع الملف…
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: "#5E5495" }}>
                                      {pct}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                                    <div
                                      className="h-full transition-all duration-200 ease-out"
                                      style={{ width: `${pct}%`, backgroundColor: "#5E5495" }}
                                    />
                                  </div>
                                </div>
                              );
                            }
                            if (busyId === it.id) {
                              return (
                                <div
                                  className="flex items-center gap-2 p-2 rounded-lg"
                                  style={{ backgroundColor: "#F8F8F4" }}
                                >
                                  <Loader2 size={14} className="animate-spin" style={{ color: "#C9A84C" }} />
                                  <span className="text-xs" style={{ color: "#6B7280" }}>
                                    جاري الحفظ…
                                  </span>
                                </div>
                              );
                            }
                            return (
                              <UploadButton
                                endpoint="documentUploader"
                                onUploadProgress={(p) =>
                                  setProgress((prev) => ({ ...prev, [it.id]: p }))
                                }
                                onClientUploadComplete={(res) => {
                                  const url = res?.[0]?.url;
                                  setProgress((prev) => {
                                    const { [it.id]: _drop, ...rest } = prev;
                                    void _drop;
                                    return rest;
                                  });
                                  if (url) uploadDocument(it, url);
                                }}
                                onUploadError={(e) => {
                                  setProgress((prev) => {
                                    const { [it.id]: _drop, ...rest } = prev;
                                    void _drop;
                                    return rest;
                                  });
                                  setError(e.message);
                                }}
                                appearance={{
                                  button: {
                                    backgroundColor: "#5E5495",
                                    color: "white",
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                  },
                                  container: { width: "100%" },
                                }}
                                content={{
                                  button: (
                                    <span className="flex items-center gap-1">
                                      <Upload size={12} />
                                      رفع ملف
                                    </span>
                                  ),
                                }}
                              />
                            );
                          })()}
                        </div>
                      )}
                    {it.kind === "DOCUMENT" && it.fileUrl && (
                      <a
                        href={it.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] mt-1"
                        style={{ color: "#5E5495" }}
                      >
                        <FileText size={12} />
                        عرض الملف الحالي
                      </a>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {error && (
            <div
              className="p-3 rounded-lg text-xs"
              style={{
                backgroundColor: "#FEF2F2",
                color: "#DC2626",
                border: "1px solid #FECACA",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 sticky bottom-0 bg-white flex items-center justify-between gap-3">
          <MarsaButton variant="secondary" onClick={onClose} disabled={!!busyId}>
            إغلاق
          </MarsaButton>
          {allResolved && onAllResolved && (
            <button
              type="button"
              onClick={onAllResolved}
              disabled={!!busyId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:brightness-105 active:brightness-95 disabled:opacity-50"
              style={{ backgroundColor: "#16A34A", color: "white" }}
            >
              <CheckCircle2 size={16} />
              إكمال المهمة الآن
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
