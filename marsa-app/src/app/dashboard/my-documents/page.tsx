"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";

const documentStatusConfig: Record<string, { bg: string; text: string; label: string }> = {
  VALID: { bg: "#ECFDF5", text: "#059669", label: "ساري" },
  EXPIRING_SOON: { bg: "#FFF7ED", text: "#EA580C", label: "ينتهي قريباً" },
  EXPIRED: { bg: "#FEF2F2", text: "#DC2626", label: "منتهي" },
  PENDING_RENEWAL: { bg: "#FFF7ED", text: "#EA580C", label: "قيد التجديد" },
};

const documentTypeLabels: Record<string, string> = {
  COMMERCIAL_REGISTER: "سجل تجاري",
  MUNICIPAL_LICENSE: "رخصة بلدية",
  ZAKAT_CERTIFICATE: "شهادة زكاة",
  INSURANCE_CERTIFICATE: "شهادة تأمين",
  CHAMBER_CERTIFICATE: "شهادة غرفة تجارية",
  LEASE_CONTRACT: "عقد إيجار",
  CIVIL_DEFENSE: "دفاع مدني",
  SAUDIZATION: "سعودة",
  GOSI_CERTIFICATE: "شهادة GOSI",
  CUSTOM: "أخرى",
};

const documentTypeOptions = [
  { value: "COMMERCIAL_REGISTER", label: "سجل تجاري" },
  { value: "MUNICIPAL_LICENSE", label: "رخصة بلدية" },
  { value: "ZAKAT_CERTIFICATE", label: "شهادة زكاة" },
  { value: "INSURANCE_CERTIFICATE", label: "شهادة تأمين" },
  { value: "CHAMBER_CERTIFICATE", label: "شهادة غرفة تجارية" },
  { value: "LEASE_CONTRACT", label: "عقد إيجار" },
  { value: "CIVIL_DEFENSE", label: "دفاع مدني" },
  { value: "SAUDIZATION", label: "سعودة" },
  { value: "GOSI_CERTIFICATE", label: "شهادة GOSI" },
  { value: "CUSTOM", label: "أخرى" },
];

interface Document {
  id: string;
  title: string;
  type: string;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
  notes: string | null;
  company: { name: string } | null;
  companyId: string | null;
}

interface Company {
  id: string;
  name: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MyDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    type: "CUSTOM",
    documentNumber: "",
    issueDate: "",
    expiryDate: "",
    companyId: "",
    notes: "",
    fileUrl: "",
  });

  useEffect(() => { document.title = "وثائقي | مرسى"; }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/my-documents").then((r) => {
        if (!r.ok) throw new Error("فشل في تحميل الوثائق");
        return r.json();
      }),
      fetch("/api/my-employees")
        .then((r) => r.json())
        .then((employees: { company?: { name: string }; companyId?: string }[]) => {
          const map = new Map<string, string>();
          if (Array.isArray(employees)) {
            employees.forEach((emp) => {
              if (emp.companyId && emp.company) {
                map.set(emp.companyId, emp.company.name);
              }
            });
          }
          return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
        })
        .catch(() => [] as Company[]),
    ])
      .then(([docs, comps]) => {
        setDocuments(docs);
        // Also extract companies from documents
        const docCompanies = new Map<string, string>();
        docs.forEach((d: Document) => {
          if (d.companyId && d.company) {
            docCompanies.set(d.companyId, d.company.name);
          }
        });
        const allCompanies = new Map<string, string>();
        comps.forEach((c: Company) => allCompanies.set(c.id, c.name));
        docCompanies.forEach((name, id) => allCompanies.set(id, name));
        setCompanies(Array.from(allCompanies.entries()).map(([id, name]) => ({ id, name })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/my-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          companyId: form.companyId || null,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          fileUrl: form.fileUrl || null,
        }),
      });
      if (!res.ok) throw new Error("فشل في إضافة الوثيقة");
      const newDoc = await res.json();
      setDocuments((prev) => [newDoc, ...prev]);
      setShowModal(false);
      setForm({ title: "", type: "CUSTOM", documentNumber: "", issueDate: "", expiryDate: "", companyId: "", notes: "", fileUrl: "" });
    } catch {
      alert("حدث خطأ أثناء إضافة الوثيقة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenewalRequest = (doc: Document) => {
    alert("سيتم إنشاء طلب تجديد");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}
        >
          {error}
        </div>
      </div>
    );
  }

  const totalDocs = documents.length;
  const validDocs = documents.filter((d) => d.status === "VALID").length;
  const expiringDocs = documents.filter((d) => d.status === "EXPIRING_SOON").length;
  const expiredDocs = documents.filter((d) => d.status === "EXPIRED").length;

  const summaryCards = [
    { label: "إجمالي الوثائق", value: totalDocs, icon: FileText, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "ساري", value: validDocs, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "ينتهي قريباً", value: expiringDocs, icon: AlertTriangle, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
    { label: "منتهي", value: expiredDocs, icon: XCircle, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  ];

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>
            وثائقي
          </h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            إدارة ومتابعة جميع الوثائق والمستندات
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#C9A84C" }}
        >
          <Plus size={18} />
          إضافة وثيقة
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-5"
            style={{
              backgroundColor: "white",
              border: "1px solid #E2E0D8",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: card.bg }}
              >
                <card.icon size={20} style={{ color: card.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: "#2D3748" }}>
              {card.value.toLocaleString("en-US")}
            </p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              {card.label}
            </p>
          </div>
        ))}
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
          >
            <FileText size={32} style={{ color: "#C9A84C" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا توجد وثائق حالياً
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            أضف وثائقك لمتابعة تواريخ انتهائها
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          {/* Table Header (desktop) */}
          <div
            className="hidden md:grid grid-cols-8 gap-4 px-6 py-4 text-xs font-semibold"
            style={{ backgroundColor: "#F8F9FA", color: "#6B7280", borderBottom: "1px solid #E2E0D8" }}
          >
            <span className="col-span-2">العنوان</span>
            <span>النوع</span>
            <span>رقم الوثيقة</span>
            <span>تاريخ الإصدار</span>
            <span>تاريخ الانتهاء</span>
            <span>الحالة</span>
            <span>إجراء</span>
          </div>

          {documents.map((doc) => {
            const status = documentStatusConfig[doc.status] || documentStatusConfig.VALID;
            const needsRenewal = doc.status === "EXPIRED" || doc.status === "EXPIRING_SOON";

            return (
              <div
                key={doc.id}
                className="grid grid-cols-1 md:grid-cols-8 gap-4 px-6 py-4 items-center"
                style={{ borderBottom: "1px solid #F0EDE6" }}
              >
                {/* Title + Company */}
                <div className="col-span-2">
                  <p className="font-semibold text-sm" style={{ color: "#2D3748" }}>
                    {doc.title}
                  </p>
                  {doc.company && (
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                      {doc.company.name}
                    </p>
                  )}
                </div>

                {/* Type */}
                <div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    {documentTypeLabels[doc.type] || doc.type}
                  </span>
                </div>

                {/* Document Number */}
                <div>
                  <span className="text-xs font-mono" style={{ color: "#2D3748" }}>
                    {doc.documentNumber || "—"}
                  </span>
                </div>

                {/* Issue Date */}
                <div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    {formatDate(doc.issueDate)}
                  </span>
                </div>

                {/* Expiry Date */}
                <div>
                  <span className="text-xs" style={{ color: "#6B7280" }}>
                    {formatDate(doc.expiryDate)}
                  </span>
                </div>

                {/* Status */}
                <div>
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: status.bg, color: status.text }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Action */}
                <div>
                  {needsRenewal && (
                    <button
                      onClick={() => handleRenewalRequest(doc)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "#FFF7ED", color: "#EA580C" }}
                    >
                      <RefreshCw size={12} />
                      طلب تجديد
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Document Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="rounded-2xl p-8 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
                إضافة وثيقة جديدة
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
              >
                <X size={20} style={{ color: "#6B7280" }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  العنوان <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  placeholder="مثال: سجل تجاري شركة الابتكار"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  نوع الوثيقة
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "white" }}
                >
                  {documentTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Number */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  رقم الوثيقة
                </label>
                <input
                  type="text"
                  value={form.documentNumber}
                  onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    تاريخ الإصدار
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    تاريخ الانتهاء
                  </label>
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  />
                </div>
              </div>

              {/* Company */}
              {companies.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الشركة
                  </label>
                  <select
                    value={form.companyId}
                    onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "white" }}
                  >
                    <option value="">— بدون شركة —</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  ملاحظات
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none transition-colors"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  رفع ملف
                </label>
                {form.fileUrl && (
                  <p className="text-xs mb-2 truncate" style={{ color: "#059669" }}>
                    تم رفع الملف بنجاح
                  </p>
                )}
                <UploadButton
                  endpoint="documentUploader"
                  onClientUploadComplete={(res) => {
                    if (res?.[0]) setForm((prev) => ({ ...prev, fileUrl: res[0].ufsUrl }));
                  }}
                  onUploadError={(error) => alert("خطأ: " + error.message)}
                  appearance={{
                    button: { backgroundColor: "#C9A84C", color: "white", borderRadius: "0.75rem", fontSize: "0.875rem" },
                    allowedContent: { color: "#6B7280", fontSize: "0.75rem" },
                  }}
                  content={{
                    button: () => "رفع ملف",
                    allowedContent: () => "PDF, Word, Excel, صور (16MB كحد أقصى)",
                  }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSubmit}
                disabled={!form.title || submitting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "#C9A84C" }}
              >
                {submitting ? (
                  <Loader2 className="animate-spin mx-auto" size={18} />
                ) : (
                  "إضافة"
                )}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
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
