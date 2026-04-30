"use client";

import { useState } from "react";
import {
  X,
  FileText,
  Lock,
  KeyRound,
  StickyNote,
  AlertTriangle,
  Link as LinkIcon,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { UploadButton } from "@/lib/uploadthing";

type Kind =
  | "DOCUMENT"
  | "NOTE"
  | "SENSITIVE_DATA"
  | "PLATFORM_ACCOUNT"
  | "PLATFORM_LINK"
  | "ISSUE";

interface PartnerOption {
  id: string;
  partnerNumber: number;
  name: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface Props {
  projectId: string;
  partners: PartnerOption[];
  services: ServiceOption[];
  initial?: {
    kind?: Kind;
    serviceId?: string | null;
    partnerId?: string | null;
    status?: string | null;
  };
  onClose: () => void;
  onCreated: () => void;
}

type IconCmp = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const KIND_OPTIONS: {
  key: Kind;
  label: string;
  icon: IconCmp;
  color: string;
}[] = [
  { key: "DOCUMENT", label: "مستند", icon: FileText, color: "#5E5495" },
  { key: "NOTE", label: "ملاحظة", icon: StickyNote, color: "#C9A84C" },
  { key: "PLATFORM_LINK", label: "رابط منصة", icon: LinkIcon, color: "#1B2A4A" },
  { key: "PLATFORM_ACCOUNT", label: "حساب منصة", icon: KeyRound, color: "#0EA5E9" },
  { key: "SENSITIVE_DATA", label: "بيانات حساسة", icon: Lock, color: "#7C3AED" },
  { key: "ISSUE", label: "مشكلة", icon: AlertTriangle, color: "#DC2626" },
];

export default function NewRecordItemDialog({
  projectId,
  partners,
  services,
  initial,
  onClose,
  onCreated,
}: Props) {
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "DOCUMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [serviceId, setServiceId] = useState<string>(initial?.serviceId ?? "");
  const [partnerId, setPartnerId] = useState<string>(initial?.partnerId ?? "");

  const [fileUrl, setFileUrl] = useState<string>("");
  const [textData, setTextData] = useState("");
  const [sensitiveData, setSensitiveData] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [platformUrl, setPlatformUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [issueSeverity, setIssueSeverity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  >("MEDIUM");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    const payload: Record<string, unknown> = {
      kind,
      title: title.trim(),
      description: description.trim() || undefined,
      serviceId: serviceId || undefined,
      partnerId: partnerId || undefined,
    };

    if (kind === "DOCUMENT") {
      if (!fileUrl) {
        setError("يجب رفع ملف");
        return;
      }
      payload.fileUrl = fileUrl;
    } else if (kind === "NOTE") {
      if (!textData.trim()) {
        setError("نص الملاحظة مطلوب");
        return;
      }
      payload.textData = textData;
    } else if (kind === "SENSITIVE_DATA") {
      if (!sensitiveData.trim()) {
        setError("البيانات الحساسة مطلوبة");
        return;
      }
      payload.sensitiveData = sensitiveData;
    } else if (kind === "PLATFORM_ACCOUNT") {
      if (!platformName.trim() || !username.trim() || !password.trim()) {
        setError("اسم المنصة والمستخدم وكلمة المرور مطلوبة");
        return;
      }
      payload.platformAccount = {
        platformName,
        platformUrl: platformUrl || undefined,
        username,
        password,
      };
    } else if (kind === "PLATFORM_LINK") {
      if (!platformName.trim() || !linkUrl.trim()) {
        setError("اسم المنصة والرابط مطلوبان");
        return;
      }
      payload.platformLink = { platformName, url: linkUrl };
    } else if (kind === "ISSUE") {
      payload.issue = { severity: issueSeverity };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر الإنشاء");
        return;
      }
      onCreated();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <h3 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
            عنصر سجل جديد
          </h3>
          <MarsaButton
            variant="ghost"
            size="sm"
            iconOnly
            icon={<X size={18} />}
            onClick={onClose}
            disabled={submitting}
          />
        </div>

        <div className="p-5 space-y-4">
          {/* Kind picker */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>
              النوع
            </label>
            <div className="grid grid-cols-3 gap-2">
              {KIND_OPTIONS.map((k) => {
                const Icon = k.icon;
                const active = kind === k.key;
                return (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => setKind(k.key)}
                    className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: active ? `${k.color}15` : "#F8F8F4",
                      color: active ? k.color : "#6B7280",
                      border: `1.5px solid ${active ? k.color : "transparent"}`,
                    }}
                  >
                    <Icon size={20} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Common fields */}
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
              العنوان <span style={{ color: "#DC2626" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="مثال: ترخيص بلدية"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
              وصف مختصر
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                الخدمة
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              >
                <option value="">— بدون —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                الشريك
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              >
                <option value="">— بدون —</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || `الشريك ${p.partnerNumber}`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kind-specific body */}
          {kind === "DOCUMENT" && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                الملف <span style={{ color: "#DC2626" }}>*</span>
              </label>
              {fileUrl ? (
                <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: "#ECFDF5", border: "1px solid #BBF7D0" }}>
                  <FileText size={16} style={{ color: "#16A34A" }} />
                  <span className="text-xs flex-1 truncate" style={{ color: "#16A34A" }}>
                    تم رفع الملف
                  </span>
                  <button
                    type="button"
                    onClick={() => setFileUrl("")}
                    className="text-xs"
                    style={{ color: "#DC2626" }}
                  >
                    إزالة
                  </button>
                </div>
              ) : (
                <UploadButton
                  endpoint="documentUploader"
                  onClientUploadComplete={(res) => {
                    const url = res?.[0]?.url;
                    if (url) setFileUrl(url);
                  }}
                  onUploadError={(e) => setError(e.message)}
                  appearance={{
                    button: {
                      backgroundColor: "#5E5495",
                      color: "white",
                      fontSize: "13px",
                      borderRadius: "10px",
                    },
                    container: { width: "100%" },
                  }}
                />
              )}
            </div>
          )}

          {kind === "NOTE" && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                نص الملاحظة <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                value={textData}
                onChange={(e) => setTextData(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
          )}

          {kind === "SENSITIVE_DATA" && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                البيانات الحساسة <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                value={sensitiveData}
                onChange={(e) => setSensitiveData(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 font-mono"
                placeholder="ستُخزن مشفّرة في قاعدة البيانات"
              />
              <p className="text-[11px] mt-1" style={{ color: "#9CA3AF" }}>
                ستُخزن مشفّرة AES-256-GCM ولن تظهر في القوائم.
              </p>
            </div>
          )}

          {kind === "PLATFORM_ACCOUNT" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                    اسم المنصة <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                    رابط المنصة
                  </label>
                  <input
                    type="url"
                    value={platformUrl}
                    onChange={(e) => setPlatformUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none ltr-input"
                    style={{ direction: "ltr", textAlign: "left" }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                    اسم المستخدم <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                    style={{ direction: "ltr", textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                    كلمة المرور <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                    style={{ direction: "ltr", textAlign: "left" }}
                  />
                </div>
              </div>
              <p className="text-[11px]" style={{ color: "#9CA3AF" }}>
                كلمة المرور تُخزن مشفّرة. لكشفها لاحقاً يلزم استخدام نقطة كشف مخصّصة.
              </p>
            </div>
          )}

          {kind === "PLATFORM_LINK" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                  اسم المنصة <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                  الرابط <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
                  style={{ direction: "ltr", textAlign: "left" }}
                />
              </div>
            </div>
          )}

          {kind === "ISSUE" && (
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>
                درجة الخطورة
              </label>
              <select
                value={issueSeverity}
                onChange={(e) =>
                  setIssueSeverity(
                    e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none"
              >
                <option value="LOW">منخفضة</option>
                <option value="MEDIUM">متوسطة</option>
                <option value="HIGH">عالية</option>
                <option value="CRITICAL">حرجة</option>
              </select>
            </div>
          )}

          {error && (
            <div
              className="p-3 rounded-lg text-xs"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
          <MarsaButton
            variant="primary"
            className="flex-1"
            onClick={submit}
            loading={submitting}
            disabled={submitting}
          >
            إنشاء
          </MarsaButton>
          <MarsaButton variant="secondary" onClick={onClose} disabled={submitting}>
            إلغاء
          </MarsaButton>
        </div>
      </div>
    </div>
  );
}
