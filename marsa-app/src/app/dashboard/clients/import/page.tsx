"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; name: string; reason: string }[];
}

export default function ImportClientsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.xlsx?$/i)) {
      setError("يرجى رفع ملف Excel (.xlsx)");
      return;
    }
    setFile(f);
    setError("");
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/clients/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || "حدث خطأ في الاستيراد");
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    window.open("/api/clients/import/template", "_blank");
  };

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <MarsaButton href="/dashboard/clients" variant="ghost" size="md" iconOnly icon={<ArrowRight size={20} />} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>استيراد عملاء من Excel</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>رفع ملف Excel لإضافة عملاء دفعة واحدة</p>
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto" style={{ backgroundColor: "rgba(94,84,149,0.12)" }}>
          <FileSpreadsheet size={24} style={{ color: "#5E5495" }} />
        </div>
      </div>

      {/* Step 1: Download Template */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#5E5495", color: "#fff" }}>1</div>
            <div>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>حمّل نموذج Excel</p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>حمّل القالب واملأه ببيانات العملاء</p>
            </div>
          </div>
          <MarsaButton variant="outline" size="sm" icon={<Download size={14} />} onClick={downloadTemplate}>
            تحميل النموذج
          </MarsaButton>
        </div>
      </div>

      {/* Step 2: Upload File */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#C9A84C", color: "#fff" }}>2</div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>ارفع الملف</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>ارفع ملف Excel بعد ملء البيانات</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className="rounded-xl p-8 text-center cursor-pointer transition-all"
          style={{
            border: `2px dashed ${dragOver ? "#C9A84C" : "#E2E0D8"}`,
            backgroundColor: dragOver ? "rgba(201,168,76,0.04)" : "#FAFAFE",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload size={32} className="mx-auto mb-3" style={{ color: "#9CA3AF" }} />
          {file ? (
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{file.name}</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>{(file.size / 1024).toFixed(1)} KB — اضغط لتغيير الملف</p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium" style={{ color: "#6B7280" }}>اسحب الملف هنا أو اضغط للاختيار</p>
              <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>ملفات Excel فقط (.xlsx)</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl flex items-center gap-2" style={{ backgroundColor: "rgba(220,38,38,0.06)" }}>
            <XCircle size={16} style={{ color: "#DC2626" }} />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Upload button */}
        {file && !result && (
          <div className="mt-4">
            <MarsaButton variant="gold" size="lg" loading={uploading} icon={<Upload size={18} />} onClick={handleUpload} className="w-full">
              {uploading ? "جارٍ الاستيراد..." : "بدء الاستيراد"}
            </MarsaButton>
          </div>
        )}
      </div>

      {/* Step 3: Results */}
      {result && (
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#059669", color: "#fff" }}>3</div>
            <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>نتائج الاستيراد</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: "rgba(5,150,105,0.06)" }}>
              <CheckCircle2 size={20} className="mx-auto mb-1" style={{ color: "#059669" }} />
              <p className="text-2xl font-bold" style={{ color: "#059669" }}>{result.imported}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>تم استيرادهم</p>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: "rgba(234,88,12,0.06)" }}>
              <AlertTriangle size={20} className="mx-auto mb-1" style={{ color: "#EA580C" }} />
              <p className="text-2xl font-bold" style={{ color: "#EA580C" }}>{result.skipped}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>تم تجاهلهم</p>
            </div>
            <div className="p-4 rounded-xl text-center" style={{ backgroundColor: "rgba(94,84,149,0.06)" }}>
              <FileSpreadsheet size={20} className="mx-auto mb-1" style={{ color: "#5E5495" }} />
              <p className="text-2xl font-bold" style={{ color: "#5E5495" }}>{result.total}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>الإجمالي</p>
            </div>
          </div>

          {/* Error details */}
          {result.errors.length > 0 && (
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: "#DC2626" }}>التفاصيل ({result.errors.length} خطأ):</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-sm" style={{ backgroundColor: "rgba(220,38,38,0.04)" }}>
                    <span className="text-xs font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      صف {err.row}
                    </span>
                    <div>
                      <span className="font-medium" style={{ color: "#1C1B2E" }}>{err.name}</span>
                      <span className="mx-1" style={{ color: "#9CA3AF" }}>—</span>
                      <span style={{ color: "#DC2626" }}>{err.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-5 pt-4" style={{ borderTop: "1px solid #F3F4F6" }}>
            <MarsaButton href="/dashboard/clients" variant="primary" size="md">
              عرض العملاء
            </MarsaButton>
            <MarsaButton variant="secondary" size="md" onClick={() => { setFile(null); setResult(null); setError(""); }}>
              استيراد آخر
            </MarsaButton>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: "#C9A84C" }}>ملاحظات مهمة:</p>
        <ul className="text-xs space-y-1" style={{ color: "#6B7280" }}>
          <li>• الحقول المطلوبة: الاسم الكامل ورقم الجوال</li>
          <li>• أرقام الجوال المكررة يتم تجاهلها تلقائياً</li>
          <li>• كلمة المرور الافتراضية للعملاء الجدد: <strong dir="ltr">Marsa@2026</strong></li>
          <li>• يتم إنشاء الشركة تلقائياً إذا تم إدخال اسم الشركة</li>
        </ul>
      </div>
    </div>
  );
}
