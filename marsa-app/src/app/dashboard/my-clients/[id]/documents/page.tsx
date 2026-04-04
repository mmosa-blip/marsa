"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowRight, FileText, Loader2, Plus, X, Link2, Upload,
  ExternalLink, Calendar, AlertCircle,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";

interface Document {
  id: string;
  title: string;
  type: string;
  customTypeName: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  company: { name: string } | null;
}

interface ClientInfo {
  id: string;
  name: string;
  email: string;
}

const typeLabels: Record<string, string> = {
  COMMERCIAL_REGISTER: "سجل تجاري",
  MUNICIPAL_LICENSE: "رخصة بلدية",
  ZAKAT_CERTIFICATE: "شهادة زكاة",
  INSURANCE_CERTIFICATE: "شهادة تأمين",
  CHAMBER_CERTIFICATE: "شهادة غرفة تجارية",
  LEASE_CONTRACT: "عقد إيجار",
  CIVIL_DEFENSE: "دفاع مدني",
  SAUDIZATION: "شهادة سعودة",
  GOSI_CERTIFICATE: "شهادة تأمينات",
  CUSTOM: "مخصص",
};

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  VALID: { label: "ساري", bg: "#DCFCE7", text: "#16A34A" },
  EXPIRING_SOON: { label: "ينتهي قريباً", bg: "#FEF9C3", text: "#CA8A04" },
  EXPIRED: { label: "منتهي", bg: "#FEF2F2", text: "#DC2626" },
  PENDING_RENEWAL: { label: "بانتظار التجديد", bg: "#DBEAFE", text: "#2563EB" },
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
};

export default function ClientDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Add document modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<"PDF" | "LINK">("PDF");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [documentCategory, setDocumentCategory] = useState("CUSTOM");
  const [expiryDate, setExpiryDate] = useState("");

  useEffect(() => { document.title = "وثائق العميل | مرسى"; }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/clients/${clientId}`).then((r) => r.json()),
      fetch(`/api/clients/${clientId}/documents`).then((r) => r.json()),
    ])
      .then(([clientData, docsData]) => {
        if (clientData && !clientData.error) {
          setClient({ id: clientData.id, name: clientData.name, email: clientData.email });
        }
        if (Array.isArray(docsData)) setDocuments(docsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetModal = () => {
    setDocType("PDF");
    setTitle("");
    setUrl("");
    setDescription("");
    setNotes("");
    setFileUrl("");
    setDocumentCategory("CUSTOM");
    setExpiryDate("");
    setShowModal(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (docType === "PDF" && !fileUrl) return;
    if (docType === "LINK" && !url.trim()) return;

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        type: documentCategory,
        notes: notes || null,
        expiryDate: expiryDate || null,
      };

      if (docType === "PDF") {
        body.fileUrl = fileUrl;
      } else {
        body.fileUrl = url;
        body.customTypeName = description || null;
      }

      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        resetModal();
        fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/my-clients"
          className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white transition-colors"
          style={{ border: "1px solid #E2E0D8" }}
        >
          <ArrowRight size={20} style={{ color: "#1C1B2E" }} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            وثائق العميل: {client?.name || "..."}
          </h1>
          {client?.email && (
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>{client.email}</p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#5E5495" }}
        >
          <Plus size={18} /> إضافة وثيقة
        </button>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
          <FileText size={40} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.5 }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>لا توجد وثائق</h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>أضف وثائق العميل من الزر أعلاه</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الوثيقة</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>النوع</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الحالة</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>تاريخ الانتهاء</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>الملف</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const st = statusConfig[doc.status] || statusConfig.VALID;
                  return (
                    <tr key={doc.id} className="hover:bg-[#FAFAF8] transition-colors" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText size={16} style={{ color: "#C9A84C" }} />
                          <div>
                            <span className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{doc.title}</span>
                            {doc.notes && <p className="text-xs mt-0.5 max-w-[200px] truncate" style={{ color: "#94A3B8" }}>{doc.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "#2D3748" }}>
                        {typeLabels[doc.type] || doc.customTypeName || doc.type}
                        {doc.company && <p className="text-xs" style={{ color: "#94A3B8" }}>{doc.company.name}</p>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: "#2D3748" }}>
                          <Calendar size={13} style={{ color: "#94A3B8" }} />
                          {formatDate(doc.expiryDate)}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {doc.fileUrl ? (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                            style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}
                          >
                            <ExternalLink size={12} />
                            عرض
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: "#94A3B8" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ Add Document Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>إضافة وثيقة</h2>
              <button onClick={resetModal} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5" dir="rtl">
              {/* Type Selector */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>نوع الوثيقة</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDocType("PDF")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                    style={docType === "PDF"
                      ? { backgroundColor: "#5E5495", color: "#fff" }
                      : { backgroundColor: "#F3F4F6", color: "#6B7280", border: "1px solid #E2E0D8" }
                    }
                  >
                    <Upload size={16} /> ملف PDF
                  </button>
                  <button
                    onClick={() => setDocType("LINK")}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all"
                    style={docType === "LINK"
                      ? { backgroundColor: "#5E5495", color: "#fff" }
                      : { backgroundColor: "#F3F4F6", color: "#6B7280", border: "1px solid #E2E0D8" }
                    }
                  >
                    <Link2 size={16} /> رابط خارجي
                  </button>
                </div>
              </div>

              {/* Document Category */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>تصنيف الوثيقة</label>
                <select
                  value={documentCategory}
                  onChange={(e) => setDocumentCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-white"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>العنوان *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان الوثيقة..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
              </div>

              {/* PDF Upload */}
              {docType === "PDF" && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>رفع الملف *</label>
                  {fileUrl ? (
                    <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                      <div className="flex items-center gap-2">
                        <FileText size={16} style={{ color: "#059669" }} />
                        <span className="text-sm font-medium" style={{ color: "#059669" }}>تم رفع الملف بنجاح</span>
                      </div>
                      <button onClick={() => setFileUrl("")} className="text-xs" style={{ color: "#DC2626" }}>حذف</button>
                    </div>
                  ) : (
                    <UploadButton
                      endpoint="avatarUploader"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]) setFileUrl(res[0].ufsUrl);
                      }}
                      onUploadError={(error) => {
                        alert("خطأ في الرفع: " + error.message);
                      }}
                      appearance={{
                        button: { backgroundColor: "#5E5495", color: "white", borderRadius: "0.75rem", fontSize: "0.875rem", width: "100%" },
                        allowedContent: { color: "#6B7280", fontSize: "0.75rem" },
                      }}
                      content={{
                        button: () => "رفع ملف",
                        allowedContent: () => "PDF أو صورة (4MB كحد أقصى)",
                      }}
                    />
                  )}
                </div>
              )}

              {/* Link inputs */}
              {docType === "LINK" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>الرابط *</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>وصف الرابط</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="معلومات إضافية عن الرابط..."
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                    />
                  </div>
                </>
              )}

              {/* Expiry Date */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>تاريخ الانتهاء</label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="ملاحظات إضافية..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                />
              </div>

              {/* Validation message */}
              {(!title.trim() || (docType === "PDF" && !fileUrl) || (docType === "LINK" && !url.trim())) && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#DC2626" }}>
                  <AlertCircle size={14} />
                  {!title.trim() ? "العنوان مطلوب" : docType === "PDF" ? "يجب رفع ملف" : "الرابط مطلوب"}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #F0EDE6" }}>
              <button onClick={resetModal} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#6B7280", border: "1px solid #E2E0D8" }}>
                إلغاء
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !title.trim() || (docType === "PDF" && !fileUrl) || (docType === "LINK" && !url.trim())}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#5E5495" }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                إضافة الوثيقة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
