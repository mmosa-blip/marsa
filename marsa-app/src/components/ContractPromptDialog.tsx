"use client";

import { useState } from "react";
import {
  FileText, FileCheck, Upload, Calendar,
  DollarSign, Hash, X,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Props {
  clientId: string;
  projectId?: string;
  onSuccess: (contractId: string) => void;
  onCancel: () => void;
}

type Mode = "select" | "existing" | "new";

export default function ContractPromptDialog({ clientId, projectId, onSuccess, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>("select");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    contractNumber: "",
    startDate: "",
    endDate: "",
    durationDays: "",
    contractValue: "",
    uploadedFileUrl: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...form, [e.target.name]: e.target.value };
    // Auto-compute duration from dates
    if ((e.target.name === "startDate" || e.target.name === "endDate") && next.startDate && next.endDate) {
      const start = new Date(next.startDate);
      const end = new Date(next.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) next.durationDays = String(days);
    }
    setForm(next);
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.startDate || !form.endDate) {
      setError("تواريخ العقد مطلوبة");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/contracts/standalone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          projectId,
          startDate: form.startDate,
          endDate: form.endDate,
          durationDays: form.durationDays ? parseInt(form.durationDays) : undefined,
          contractValue: form.contractValue ? parseFloat(form.contractValue) : undefined,
          contractNumber: form.contractNumber ? parseInt(form.contractNumber) : undefined,
          uploadedFileUrl: form.uploadedFileUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data.id);
      } else {
        setError(data.error || "حدث خطأ");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(94,84,149,0.12)" }}>
              <FileText size={20} style={{ color: "#5E5495" }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>عقد المشروع</h2>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>العقد إلزامي قبل بدء المشروع</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg" style={{ color: "#9CA3AF" }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: "rgba(220,38,38,0.06)", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {/* Mode selection */}
        {mode === "select" && (
          <>
            <p className="text-sm mb-4" style={{ color: "#1C1B2E" }}>
              هل يوجد عقد قائم مع العميل؟
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setMode("existing")}
                className="p-4 rounded-xl text-right transition-all hover:shadow-md"
                style={{ border: "2px solid #E2E0D8" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E0D8"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(5,150,105,0.1)" }}>
                    <FileCheck size={20} style={{ color: "#059669" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>نعم — ارفع العقد القائم</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>ارفع ملف PDF وحدد التواريخ</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode("new")}
                className="p-4 rounded-xl text-right transition-all hover:shadow-md"
                style={{ border: "2px solid #E2E0D8" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E0D8"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(94,84,149,0.1)" }}>
                    <FileText size={20} style={{ color: "#5E5495" }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>لا — إنشاء عقد جديد</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>أنشئ عقد جديد برقم وقيمة وتواريخ</p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {/* Form */}
        {(mode === "existing" || mode === "new") && (
          <>
            <div className="mb-4 p-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
              <p className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
                {mode === "existing" ? "رفع عقد قائم" : "إنشاء عقد جديد"}
              </p>
            </div>

            <div className="space-y-4">
              {mode === "new" && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    <Hash size={12} style={{ color: "#C9A84C" }} />
                    رقم العقد
                  </label>
                  <input
                    type="number" name="contractNumber" value={form.contractNumber} onChange={handleChange}
                    placeholder="مثال: 1001" dir="ltr"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8" }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    <Calendar size={12} style={{ color: "#C9A84C" }} />
                    تاريخ البداية *
                  </label>
                  <input
                    type="date" name="startDate" value={form.startDate} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8" }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    <Calendar size={12} style={{ color: "#C9A84C" }} />
                    تاريخ الانتهاء *
                  </label>
                  <input
                    type="date" name="endDate" value={form.endDate} onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8" }}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  <Calendar size={12} style={{ color: "#C9A84C" }} />
                  المدة (يوم)
                </label>
                <input
                  type="number" name="durationDays" value={form.durationDays} onChange={handleChange}
                  placeholder="يُحسب تلقائياً من التواريخ" dir="ltr"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8" }}
                />
              </div>

              {mode === "new" && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    <DollarSign size={12} style={{ color: "#C9A84C" }} />
                    قيمة العقد (ر.س)
                  </label>
                  <input
                    type="number" name="contractValue" value={form.contractValue} onChange={handleChange}
                    placeholder="0.00" dir="ltr"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8" }}
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  <Upload size={12} style={{ color: "#C9A84C" }} />
                  رابط ملف العقد (PDF)
                </label>
                <input
                  type="url" name="uploadedFileUrl" value={form.uploadedFileUrl} onChange={handleChange}
                  placeholder="https://..." dir="ltr"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8" }}
                />
                <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>
                  ارفع الملف لـ UploadThing أولاً ثم الصق الرابط
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-5 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
              <MarsaButton variant="gold" size="md" loading={saving} onClick={handleSubmit}>
                حفظ العقد
              </MarsaButton>
              <MarsaButton variant="secondary" size="md" onClick={() => setMode("select")}>
                رجوع
              </MarsaButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
