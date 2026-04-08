"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  SkipForward,
  Info,
  AlertCircle,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface DocField {
  name: string;
  label: string;
}

interface DocType {
  id: string;
  name: string;
  description: string | null;
  kind: "FILE" | "TEXT";
  sampleImageUrl: string | null;
  instructions: string | null;
  fields: string | null;
  isRequired: boolean;
  displayOrder: number;
  group: { id: string; name: string } | null;
}

interface ProjectInfo {
  id: string;
  name: string;
  projectCode: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
}

interface ExistingDoc {
  id: string;
  documentTypeId: string;
  documentType: { name: string };
  status: string;
}

export default function DocumentUploadWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [existingDocs, setExistingDocs] = useState<ExistingDoc[]>([]);
  const [pendingTypes, setPendingTypes] = useState<DocType[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedOnBehalf, setUploadedOnBehalf] = useState(false);

  const [fileUrl, setFileUrl] = useState("");
  const [textData, setTextData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [completed, setCompleted] = useState<{ docTypeId: string; name: string }[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login");
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const projRes = await fetch(`/api/projects/${projectId}`);
        if (!projRes.ok) throw new Error("فشل تحميل المشروع");
        const projData = await projRes.json();
        setProject(projData);

        const deptId = projData.departmentId;
        if (!deptId) {
          setError("المشروع غير مرتبط بقسم");
          setLoading(false);
          return;
        }

        const [typesRes, docsRes] = await Promise.all([
          fetch(`/api/doc-types?departmentId=${deptId}`),
          fetch(`/api/projects/${projectId}/documents`),
        ]);
        const typesData: DocType[] = typesRes.ok ? await typesRes.json() : [];
        const docsData: ExistingDoc[] = docsRes.ok ? await docsRes.json() : [];
        setDocTypes(typesData);
        setExistingDocs(docsData);

        const uploadedTypeIds = new Set(docsData.map((d) => d.documentTypeId));
        const pending = typesData
          .filter((t) => !uploadedTypeIds.has(t.id))
          .sort((a, b) => {
            if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
            return a.displayOrder - b.displayOrder;
          });
        setPendingTypes(pending);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ");
      } finally {
        setLoading(false);
      }
    }
    if (sessionStatus === "authenticated") loadData();
  }, [projectId, sessionStatus]);

  const currentDocType = pendingTypes[currentStep];
  const totalSteps = pendingTypes.length;

  function resetForm() {
    setFileUrl("");
    setTextData({});
    setError("");
  }

  function parseFields(fieldsJson: string | null): DocField[] {
    if (!fieldsJson) return [];
    try {
      const parsed = JSON.parse(fieldsJson);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }

  async function handleNext() {
    if (!currentDocType) return;
    setSubmitting(true);
    setError("");

    try {
      const body: Record<string, unknown> = {
        documentTypeId: currentDocType.id,
        uploadedOnBehalfOfClient: uploadedOnBehalf,
      };

      if (currentDocType.kind === "FILE") {
        if (!fileUrl.trim()) {
          setError("الرجاء إدخال رابط الملف");
          setSubmitting(false);
          return;
        }
        body.fileUrl = fileUrl.trim();
      } else {
        const fields = parseFields(currentDocType.fields);
        const filled: Record<string, string> = {};
        for (const f of fields) {
          const v = textData[f.name];
          if (!v || !v.trim()) {
            setError(`الحقل "${f.label}" مطلوب`);
            setSubmitting(false);
            return;
          }
          filled[f.name] = v.trim();
        }
        body.textData = filled;
      }

      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "فشل رفع المستند");
      }

      setCompleted((prev) => [
        ...prev,
        { docTypeId: currentDocType.id, name: currentDocType.name },
      ]);

      resetForm();
      if (currentStep + 1 >= totalSteps) {
        setShowSummary(true);
      } else {
        setCurrentStep((s) => s + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    if (!currentDocType || currentDocType.isRequired) return;
    resetForm();
    if (currentStep + 1 >= totalSteps) {
      setShowSummary(true);
    } else {
      setCurrentStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (currentStep === 0) return;
    resetForm();
    setCurrentStep((s) => s - 1);
  }

  function handleFinish() {
    router.push(`/dashboard/projects/${projectId}/documents`);
  }

  if (loading || sessionStatus === "loading") {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FAF9F5]">
        <Loader2 className="animate-spin text-[#C9A84C]" size={40} />
      </div>
    );
  }

  if (error && !currentDocType && !showSummary) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-6">
        <div className="bg-white border border-[#E2E0D8] rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <p className="text-gray-800 mb-4">{error}</p>
          <MarsaButton variant="secondary" onClick={() => router.back()}>
            رجوع
          </MarsaButton>
        </div>
      </div>
    );
  }

  if (pendingTypes.length === 0 && !showSummary) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-6">
        <div className="bg-white border border-[#E2E0D8] rounded-2xl p-8 max-w-md text-center">
          <CheckCircle2 className="mx-auto text-green-600 mb-4" size={56} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            جميع المستندات تم رفعها
          </h2>
          <p className="text-gray-600 mb-6">
            لا توجد مستندات متبقية لرفعها لهذا المشروع
          </p>
          <MarsaButton
            variant="primary"
            onClick={() => router.push(`/dashboard/projects/${projectId}/documents`)}
          >
            عرض المستندات
          </MarsaButton>
        </div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FAF9F5] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-[#E2E0D8] rounded-2xl p-8">
            <div className="text-center mb-8">
              <div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                style={{ backgroundColor: "rgba(5,150,105,0.1)" }}
              >
                <CheckCircle2 className="text-[#059669]" size={48} />
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                تم رفع المستندات بنجاح
              </h1>
              <p className="text-gray-600">
                تم رفع {completed.length} من {totalSteps} مستند
              </p>
            </div>

            {completed.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  المستندات المرفوعة:
                </h3>
                <ul className="space-y-2">
                  {completed.map((c) => (
                    <li
                      key={c.docTypeId}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E0D8] bg-[#FAF9F5]"
                    >
                      <CheckCircle2 size={18} className="text-[#059669]" />
                      <span className="text-sm text-gray-800">{c.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <MarsaButton variant="primary" size="lg" onClick={handleFinish}>
                إنهاء
              </MarsaButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fields = currentDocType ? parseFields(currentDocType.fields) : [];
  const progressPct = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  return (
    <div dir="rtl" className="min-h-screen bg-[#FAF9F5] p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">رفع المستندات</h1>
              {project && (
                <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                  <span>{project.name}</span>
                  {project.projectCode && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495", border: "1px solid rgba(94,84,149,0.18)" }}>
                      {project.projectCode}
                    </span>
                  )}
                </p>
              )}
            </div>
            <MarsaButton
              variant="secondary"
              size="sm"
              icon={<ArrowRight size={16} />}
              onClick={() => router.push(`/dashboard/projects/${projectId}/documents`)}
            >
              العودة للمستندات
            </MarsaButton>
          </div>

          {/* Upload on behalf toggle */}
          <div
            className="bg-white border border-[#E2E0D8] rounded-xl p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                الرفع بالنيابة عن العميل
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                فعّل هذا الخيار عند رفع المستندات نيابة عن العميل
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadedOnBehalf((v) => !v)}
              className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
              style={{
                backgroundColor: uploadedOnBehalf ? "#C9A84C" : "#E2E0D8",
              }}
            >
              <span
                className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                style={{
                  transform: uploadedOnBehalf ? "translateX(-22px)" : "translateX(-2px)",
                }}
              />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              {currentStep + 1} من {totalSteps}
            </span>
            <span className="text-xs text-gray-500">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="h-2 bg-[#E2E0D8] rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                backgroundColor: "#C9A84C",
              }}
            />
          </div>
        </div>

        {/* Current step card */}
        {currentDocType && (
          <div className="bg-white border border-[#E2E0D8] rounded-2xl p-6 md:p-8">
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
              >
                {currentDocType.kind === "FILE" ? (
                  <FileText className="text-[#C9A84C]" size={20} />
                ) : (
                  <Info className="text-[#C9A84C]" size={20} />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-800">
                    {currentDocType.name}
                  </h2>
                  {currentDocType.isRequired && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: "rgba(220,38,38,0.1)",
                        color: "#DC2626",
                      }}
                    >
                      مطلوب
                    </span>
                  )}
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      backgroundColor: "rgba(94,84,149,0.1)",
                      color: "#5E5495",
                    }}
                  >
                    {currentDocType.kind === "FILE" ? "ملف" : "نصي"}
                  </span>
                </div>
                {currentDocType.description && (
                  <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                    {currentDocType.description}
                  </p>
                )}
              </div>
            </div>

            {/* Sample image */}
            {currentDocType.sampleImageUrl && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <ImageIcon size={14} />
                  نموذج توضيحي:
                </p>
                <div className="border border-[#E2E0D8] rounded-xl overflow-hidden bg-[#FAF9F5]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentDocType.sampleImageUrl}
                    alt="نموذج"
                    className="max-h-64 w-auto mx-auto"
                  />
                </div>
              </div>
            )}

            {/* Instructions */}
            {currentDocType.instructions && (
              <div
                className="mb-4 p-4 rounded-xl border"
                style={{
                  backgroundColor: "rgba(201,168,76,0.06)",
                  borderColor: "rgba(201,168,76,0.3)",
                }}
              >
                <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Info size={14} className="text-[#C9A84C]" />
                  تعليمات:
                </p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                  {currentDocType.instructions}
                </p>
              </div>
            )}

            {/* FILE input */}
            {currentDocType.kind === "FILE" && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  رابط الملف <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl border border-[#E2E0D8] focus:outline-none focus:border-[#C9A84C] text-sm"
                  dir="ltr"
                />
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  ارفع الملف عبر UploadThing أولاً ثم الصق الرابط هنا
                </p>
              </div>
            )}

            {/* TEXT fields */}
            {currentDocType.kind === "TEXT" && (
              <div className="mb-4 space-y-4">
                {fields.length === 0 && (
                  <p className="text-sm text-gray-500 italic">
                    لا توجد حقول معرّفة لهذا النوع من المستندات
                  </p>
                )}
                {fields.map((f) => (
                  <div key={f.name}>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {f.label} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={textData[f.name] || ""}
                      onChange={(e) =>
                        setTextData((prev) => ({ ...prev, [f.name]: e.target.value }))
                      }
                      className="w-full px-4 py-3 rounded-xl border border-[#E2E0D8] focus:outline-none focus:border-[#C9A84C] text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div
                className="mb-4 p-3 rounded-xl border flex items-center gap-2"
                style={{
                  backgroundColor: "rgba(220,38,38,0.06)",
                  borderColor: "rgba(220,38,38,0.3)",
                }}
              >
                <AlertCircle size={16} className="text-[#DC2626]" />
                <p className="text-sm text-[#DC2626]">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#E2E0D8]">
              <MarsaButton
                variant="secondary"
                size="md"
                icon={<ArrowRight size={16} />}
                onClick={handleBack}
                disabled={currentStep === 0 || submitting}
              >
                السابق
              </MarsaButton>

              <div className="flex items-center gap-2">
                {!currentDocType.isRequired && (
                  <MarsaButton
                    variant="ghost"
                    size="md"
                    icon={<SkipForward size={16} />}
                    onClick={handleSkip}
                    disabled={submitting}
                  >
                    تخطي
                  </MarsaButton>
                )}
                <MarsaButton
                  variant="primary"
                  size="md"
                  loading={submitting}
                  onClick={handleNext}
                  icon={!submitting ? <ArrowLeft size={16} /> : undefined}
                >
                  {currentStep + 1 >= totalSteps ? "إنهاء" : "التالي"}
                </MarsaButton>
              </div>
            </div>
          </div>
        )}

        {/* Existing uploaded info */}
        {existingDocs.length > 0 && (
          <div className="mt-6 p-4 bg-white border border-[#E2E0D8] rounded-xl">
            <p className="text-xs text-gray-600">
              تم تخطي {existingDocs.length} مستند مرفوع مسبقاً
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
