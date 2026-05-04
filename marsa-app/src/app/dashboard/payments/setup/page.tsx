"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  FileText,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Settings,
  Link2,
  Zap,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface ContractRow {
  id: string;
  contractNumber: number | null;
  status: string;
  signedAt: string | null;
  startDate: string | null;
  contractValue: number | null;
  effectiveValue: number | null;
  valueSource: "contract" | "project" | "missing";
  createdAt: string;
  client: { id: string; name: string; phone: string | null } | null;
  project: {
    id: string;
    name: string;
    projectCode: string | null;
    status: string;
    totalPrice: number | null;
  } | null;
}

interface ServiceOption {
  id: string;
  name: string;
  serviceOrder: number;
  hasTasks: boolean;
}

// ─── Trigger model ─────────────────────────────────────────────────────
//
// The system is milestone-based. A payment becomes due either:
//   - UPFRONT       — paid before any work starts (no task link)
//   - AFTER_SERVICE — paid after a specific service finishes; we link
//                     the installment to that service's first task
//
// (The legacy time-based "X days after signing" model is gone from
//  this UI — the wizard always emits milestone-based rows.)
type Trigger = "UPFRONT" | "AFTER_SERVICE";

interface Split {
  title: string;
  // We store the percentage as a string for input ergonomics. The
  // amount is derived from percentage × contractValue at render time
  // and on submit.
  percentage: string;
  trigger: Trigger;
  linkedServiceId: string | null;
}

// Quick-pick templates. Each template is a list of splits with
// percentages that sum to 100%. The trigger choice is encoded per
// split:
//   - "upfront" → UPFRONT (no service link required)
//   - "first"   → AFTER_SERVICE on the first project service
//   - "last"    → AFTER_SERVICE on the last project service
//   - "service:N" → AFTER_SERVICE on service at that index (N ≥ 0)
const TEMPLATES: {
  key: string;
  label: string;
  splits: { percentage: number; title: string; on: "upfront" | "first" | "last" }[];
}[] = [
  {
    key: "single-upfront",
    label: "دفعة واحدة عند البدء",
    splits: [{ percentage: 100, title: "الدفعة الكاملة", on: "upfront" }],
  },
  {
    key: "single-final",
    label: "دفعة واحدة عند الإنجاز",
    splits: [{ percentage: 100, title: "الدفعة عند التسليم", on: "last" }],
  },
  {
    key: "fifty-fifty",
    label: "50% مقدمة + 50% بعد الإنجاز",
    splits: [
      { percentage: 50, title: "الدفعة المقدمة", on: "upfront" },
      { percentage: 50, title: "الدفعة النهائية", on: "last" },
    ],
  },
  {
    key: "third-third-final",
    label: "30% مقدم + 30% بعد أول خدمة + 40% نهائية",
    splits: [
      { percentage: 30, title: "الدفعة المقدمة", on: "upfront" },
      { percentage: 30, title: "الدفعة الثانية", on: "first" },
      { percentage: 40, title: "الدفعة النهائية", on: "last" },
    ],
  },
];

function templateToSplits(key: string, services: ServiceOption[]): Split[] {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) return [];
  const firstSvc = services[0];
  const lastSvc = services[services.length - 1];
  return t.splits.map((s) => {
    if (s.on === "upfront") {
      return {
        title: s.title,
        percentage: String(s.percentage),
        trigger: "UPFRONT" as const,
        linkedServiceId: null,
      };
    }
    const svc = s.on === "first" ? firstSvc : lastSvc;
    return {
      title: s.title,
      percentage: String(s.percentage),
      trigger: "AFTER_SERVICE" as const,
      linkedServiceId: svc?.id ?? null,
    };
  });
}

export default function PaymentsSetupPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ContractRow | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/contracts-needing-setup");
      if (res.ok) {
        const data = await res.json();
        setContracts(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") load();
  }, [authStatus, load]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);
  if (!["ADMIN", "MANAGER", "FINANCE_MANAGER"].includes(session.user.role)) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">غير مصرح</p>
      </div>
    );
  }

  const visible = contracts.filter((c) => !skipped.has(c.id));

  return (
    <div className="p-6 pb-12" dir="rtl">
      <MarsaButton
        variant="ghost"
        size="sm"
        icon={<ArrowRight size={16} />}
        onClick={() => router.push("/dashboard/payments")}
        className="mb-4"
      >
        العودة للدفعات
      </MarsaButton>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <Settings size={24} style={{ color: "#5E5495" }} />
          إعداد جداول الدفعات
        </h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          عقود نشطة بدون جدول دفعات معرّف. الدفعات ترتبط بإنجاز خدمات المشروع، لا بمواعيد زمنية.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#16A34A" }} />
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
            {contracts.length === 0
              ? "كل العقود مُعَدَّة جداول دفعاتها."
              : "تم تخطي كل العقود في هذه الجلسة."}
          </p>
          <Link href="/dashboard/payments" className="text-xs mt-2 inline-block" style={{ color: "#5E5495" }}>
            ← العودة للدفعات
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-4 flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
              {visible.length} عقد بحاجة لإعداد
              {skipped.size > 0 && (
                <span className="text-xs ms-2" style={{ color: "#9CA3AF" }}>
                  (تم تخطي {skipped.size})
                </span>
              )}
            </p>
            {skipped.size > 0 && (
              <MarsaButton size="xs" variant="ghost" onClick={() => setSkipped(new Set())}>
                إلغاء التخطي
              </MarsaButton>
            )}
          </div>

          <div className="space-y-2">
            {visible.map((c) => (
              <ContractRowView
                key={c.id}
                contract={c}
                onSetup={() => setEditing(c)}
                onSkip={() =>
                  setSkipped((prev) => {
                    const next = new Set(prev);
                    next.add(c.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <SetupModal
          contract={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────

function ContractRowView({
  contract,
  onSetup,
  onSkip,
}: {
  contract: ContractRow;
  onSetup: () => void;
  onSkip: () => void;
}) {
  const project = contract.project;
  const isDraft = contract.status === "DRAFT";
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: isDraft ? "rgba(234,88,12,0.10)" : "rgba(22,163,74,0.10)",
              color: isDraft ? "#EA580C" : "#16A34A",
            }}
          >
            {isDraft ? "مسودة" : contract.status}
          </span>
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
            {project?.name ?? "—"}
          </p>
          {contract.contractNumber != null && (
            <span className="text-[10px] font-mono" style={{ color: "#5E5495" }}>
              عقد #{contract.contractNumber}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] mt-1 flex-wrap" style={{ color: "#6B7280" }}>
          <span>{contract.client?.name ?? "—"}</span>
          {contract.client?.phone && (
            <span style={{ direction: "ltr", color: "#9CA3AF" }}>{contract.client.phone}</span>
          )}
          {contract.signedAt && (
            <span>· وُقّع {new Date(contract.signedAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
          )}
        </div>
      </div>
      <div className="text-left">
        <p className="text-[10px]" style={{ color: "#9CA3AF" }}>قيمة العقد</p>
        <p
          className="text-base font-bold font-mono"
          style={{
            color:
              contract.valueSource === "missing"
                ? "#DC2626"
                : contract.valueSource === "project"
                  ? "#EA580C"
                  : "#1C1B2E",
          }}
          title={
            contract.valueSource === "project"
              ? "القيمة مأخوذة من totalPrice (سيُحفظ على العقد عند الإعداد)"
              : contract.valueSource === "missing"
                ? "القيمة غير محددة — أدخلها في نموذج الإعداد"
                : ""
          }
        >
          {contract.effectiveValue
            ? contract.effectiveValue.toLocaleString("en-US")
            : "—"}
          {contract.valueSource === "project" && (
            <span className="text-[9px] font-normal ms-1" style={{ color: "#EA580C" }}>
              (من المشروع)
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <MarsaButton size="sm" variant="primary" icon={<Settings size={13} />} onClick={onSetup}>
          إعداد دفعات
        </MarsaButton>
        <MarsaButton size="sm" variant="ghost" onClick={onSkip}>
          تخطي
        </MarsaButton>
      </div>
    </div>
  );
}

function SetupModal({
  contract,
  onClose,
  onSuccess,
}: {
  contract: ContractRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [templateKey, setTemplateKey] = useState<string>("fifty-fifty");
  const [splits, setSplits] = useState<Split[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const initialEffective = contract.effectiveValue ?? 0;
  const [savedValue, setSavedValue] = useState<number>(initialEffective);
  const [manualValueInput, setManualValueInput] = useState<string>("");
  const [savingValue, setSavingValue] = useState(false);

  const total = savedValue;
  const needsManualValue = total <= 0;
  const sumPct = splits.reduce((s, x) => s + (Number(x.percentage) || 0), 0);
  const sumAmount = splits.reduce(
    (s, x) => s + ((Number(x.percentage) || 0) / 100) * total,
    0
  );
  const isCustom = templateKey === "custom";

  // Load the project's services on open so the trigger dropdown
  // has options. Without services, the AFTER_SERVICE trigger is
  // disabled — only UPFRONT works.
  useEffect(() => {
    let alive = true;
    setLoadingServices(true);
    fetch(`/api/contracts/${contract.id}/services`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        const svcs: ServiceOption[] = data?.services ?? [];
        setServices(svcs);
        // Initialize splits once we know the services.
        setSplits(templateToSplits("fifty-fifty", svcs));
        setLoadingServices(false);
      })
      .catch(() => {
        if (alive) {
          setServices([]);
          setLoadingServices(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [contract.id]);

  function applyTemplate(key: string) {
    setTemplateKey(key);
    if (key !== "custom") {
      setSplits(templateToSplits(key, services));
    }
  }

  function updateSplit<K extends keyof Split>(idx: number, field: K, value: Split[K]) {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
    setTemplateKey("custom");
  }

  function addSplit() {
    setSplits((prev) => [
      ...prev,
      {
        title: `الدفعة ${prev.length + 1}`,
        percentage: "0",
        trigger: "AFTER_SERVICE",
        linkedServiceId: services[0]?.id ?? null,
      },
    ]);
    setTemplateKey("custom");
  }

  function removeSplit(idx: number) {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
    setTemplateKey("custom");
  }

  async function saveContractValue() {
    setError("");
    const num = Number(manualValueInput);
    if (!Number.isFinite(num) || num <= 0) {
      setError("أدخل قيمة عقد موجبة");
      return;
    }
    setSavingValue(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/set-value`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractValue: num }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر حفظ القيمة");
        return;
      }
      setSavedValue(num);
      setManualValueInput("");
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSavingValue(false);
    }
  }

  async function submit() {
    setError("");
    if (needsManualValue) {
      setError("أدخل قيمة العقد أولاً");
      return;
    }
    if (Math.abs(sumPct - 100) > 0.01) {
      setError(`مجموع النسب يجب أن يساوي 100% (الحالي: ${sumPct.toFixed(1)}%)`);
      return;
    }
    if (splits.length === 0) {
      setError("أضف دفعة واحدة على الأقل");
      return;
    }
    // Validate AFTER_SERVICE rows have a linked service
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (s.trigger === "AFTER_SERVICE" && !s.linkedServiceId) {
        setError(`الدفعة #${i + 1}: اختر الخدمة المرتبطة`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/setup-installments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installments: splits.map((s) => ({
            title: s.title.trim(),
            percentage: Number(s.percentage),
            isUpfront: s.trigger === "UPFRONT",
            linkedServiceId:
              s.trigger === "AFTER_SERVICE" ? s.linkedServiceId : null,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر الحفظ");
        return;
      }
      onSuccess();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  const noServicesAvailable =
    !loadingServices && services.filter((s) => s.hasTasks).length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              إعداد دفعات: {contract.project?.name ?? contract.client?.name}
            </h3>
            <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>
              قيمة العقد:{" "}
              {needsManualValue ? (
                <span style={{ color: "#DC2626", fontWeight: 600 }}>غير محددة</span>
              ) : (
                <>{total.toLocaleString("en-US")} ريال</>
              )}
            </p>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={submitting} />
        </div>

        <div className="p-5 space-y-4">
          {needsManualValue && (
            <div
              className="p-4 rounded-xl space-y-3"
              style={{
                backgroundColor: "rgba(234,88,12,0.06)",
                border: "1px solid rgba(234,88,12,0.30)",
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} style={{ color: "#EA580C" }} className="shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold" style={{ color: "#1C1B2E" }}>
                    قيمة العقد غير محددة
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                    أدخل قيمة العقد لتفعيل قوالب توزيع الدفعات. ستُحفظ على العقد فوراً.
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label
                    className="block text-[10px] font-semibold mb-1"
                    style={{ color: "#6B7280" }}
                  >
                    قيمة العقد (ريال) <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={manualValueInput}
                    onChange={(e) => setManualValueInput(e.target.value)}
                    disabled={savingValue || submitting}
                    placeholder="مثلاً 25000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-200"
                    style={{ direction: "ltr", textAlign: "right" }}
                  />
                </div>
                <button
                  type="button"
                  onClick={saveContractValue}
                  disabled={savingValue || submitting || !manualValueInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-105 disabled:opacity-50"
                  style={{ backgroundColor: "#EA580C", color: "white" }}
                >
                  {savingValue ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                  حفظ القيمة
                </button>
              </div>
            </div>
          )}

          {!needsManualValue && contract.valueSource === "project" && total === initialEffective && (
            <div
              className="p-3 rounded-xl flex items-start gap-2"
              style={{
                backgroundColor: "rgba(234,88,12,0.04)",
                border: "1px solid rgba(234,88,12,0.20)",
              }}
            >
              <AlertTriangle size={14} style={{ color: "#EA580C" }} className="shrink-0 mt-0.5" />
              <p className="text-[11px]" style={{ color: "#374151" }}>
                القيمة الحالية مأخوذة من <strong>إجمالي المشروع</strong>.
                ستُحفظ على العقد عند إنشاء الأقساط.
              </p>
            </div>
          )}

          {noServicesAvailable && (
            <div
              className="p-3 rounded-xl flex items-start gap-2"
              style={{
                backgroundColor: "rgba(220,38,38,0.05)",
                border: "1px solid rgba(220,38,38,0.20)",
              }}
            >
              <AlertTriangle size={14} style={{ color: "#DC2626" }} className="shrink-0 mt-0.5" />
              <p className="text-[11px]" style={{ color: "#374151" }}>
                لا توجد خدمات بمهام في هذا المشروع — جميع الدفعات يجب أن تكون <strong>مقدمة</strong>.
              </p>
            </div>
          )}

          <div style={needsManualValue ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>
              نموذج التوزيع
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {TEMPLATES.map((t) => {
                const active = templateKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    disabled={submitting || loadingServices}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-right transition-all"
                    style={{
                      backgroundColor: active ? "rgba(94,84,149,0.08)" : "white",
                      color: active ? "#5E5495" : "#1C1B2E",
                      border: `1.5px solid ${active ? "#5E5495" : "#E5E7EB"}`,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => applyTemplate("custom")}
                disabled={submitting}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-right transition-all md:col-span-2"
                style={{
                  backgroundColor: isCustom ? "rgba(94,84,149,0.08)" : "white",
                  color: isCustom ? "#5E5495" : "#1C1B2E",
                  border: `1.5px solid ${isCustom ? "#5E5495" : "#E5E7EB"}`,
                }}
              >
                مخصص
              </button>
            </div>
          </div>

          <div
            className="space-y-2"
            style={needsManualValue ? { opacity: 0.4, pointerEvents: "none" } : undefined}
          >
            {splits.map((s, idx) => {
              const amount = ((Number(s.percentage) || 0) / 100) * total;
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl space-y-2"
                  style={{ backgroundColor: "#F8F8F4", border: "1px solid #E5E7EB" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold" style={{ color: "#5E5495" }}>
                      الدفعة {idx + 1}
                    </p>
                    {splits.length > 1 && (
                      <MarsaButton
                        size="xs"
                        variant="ghost"
                        iconOnly
                        icon={<Trash2 size={13} />}
                        onClick={() => removeSplit(idx)}
                        disabled={submitting}
                        title="حذف"
                        style={{ color: "#DC2626" }}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 md:col-span-6">
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>الوصف</label>
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => updateSplit(idx, "title", e.target.value)}
                        disabled={submitting}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>%</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={s.percentage}
                        onChange={(e) => updateSplit(idx, "percentage", e.target.value)}
                        disabled={submitting}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none"
                        style={{ direction: "ltr", textAlign: "right" }}
                      />
                    </div>
                    <div className="col-span-6 md:col-span-3">
                      <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>المبلغ</label>
                      <p className="px-2 py-1.5 rounded-lg text-xs font-mono font-bold" style={{ color: "#1C1B2E", direction: "ltr", textAlign: "right" }}>
                        {amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Trigger row — UPFRONT vs AFTER_SERVICE */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-semibold" style={{ color: "#6B7280" }}>متى تستحق</p>
                    <div className="flex gap-2 flex-wrap">
                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: s.trigger === "UPFRONT" ? "rgba(22,163,74,0.10)" : "white",
                          color: s.trigger === "UPFRONT" ? "#16A34A" : "#6B7280",
                          border: `1.5px solid ${s.trigger === "UPFRONT" ? "#16A34A" : "#E5E7EB"}`,
                        }}
                      >
                        <input
                          type="radio"
                          name={`trigger-${idx}`}
                          value="UPFRONT"
                          checked={s.trigger === "UPFRONT"}
                          onChange={() => {
                            updateSplit(idx, "trigger", "UPFRONT");
                            updateSplit(idx, "linkedServiceId", null);
                          }}
                          disabled={submitting}
                          className="hidden"
                        />
                        <Zap size={12} />
                        دفعة مقدمة
                      </label>
                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: s.trigger === "AFTER_SERVICE" ? "rgba(94,84,149,0.10)" : "white",
                          color: s.trigger === "AFTER_SERVICE" ? "#5E5495" : "#6B7280",
                          border: `1.5px solid ${s.trigger === "AFTER_SERVICE" ? "#5E5495" : "#E5E7EB"}`,
                          opacity: noServicesAvailable ? 0.4 : 1,
                          pointerEvents: noServicesAvailable ? "none" : "auto",
                        }}
                      >
                        <input
                          type="radio"
                          name={`trigger-${idx}`}
                          value="AFTER_SERVICE"
                          checked={s.trigger === "AFTER_SERVICE"}
                          onChange={() => {
                            updateSplit(idx, "trigger", "AFTER_SERVICE");
                            if (!s.linkedServiceId && services[0]) {
                              updateSplit(idx, "linkedServiceId", services[0].id);
                            }
                          }}
                          disabled={submitting || noServicesAvailable}
                          className="hidden"
                        />
                        <Link2 size={12} />
                        بعد إكمال خدمة
                      </label>
                    </div>
                    {s.trigger === "AFTER_SERVICE" && (
                      <select
                        value={s.linkedServiceId ?? ""}
                        onChange={(e) =>
                          updateSplit(idx, "linkedServiceId", e.target.value || null)
                        }
                        disabled={submitting || loadingServices}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                      >
                        <option value="">— اختر الخدمة —</option>
                        {services.map((svc) => (
                          <option
                            key={svc.id}
                            value={svc.id}
                            disabled={!svc.hasTasks}
                          >
                            {svc.serviceOrder + 1}. {svc.name}
                            {!svc.hasTasks ? " (بدون مهام)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
            <MarsaButton size="xs" variant="ghost" icon={<Plus size={13} />} onClick={addSplit} disabled={submitting}>
              إضافة دفعة
            </MarsaButton>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl" style={{
            backgroundColor: Math.abs(sumPct - 100) < 0.01 ? "rgba(22,163,74,0.05)" : "rgba(220,38,38,0.05)",
            border: `1px solid ${Math.abs(sumPct - 100) < 0.01 ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
          }}>
            <div>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>مجموع النسب</p>
              <p className="text-sm font-bold font-mono" style={{ color: Math.abs(sumPct - 100) < 0.01 ? "#16A34A" : "#DC2626" }}>
                {sumPct.toFixed(1)}%
              </p>
            </div>
            <div className="text-left">
              <p className="text-[10px]" style={{ color: "#6B7280" }}>مجموع المبالغ</p>
              <p className="text-sm font-bold font-mono" style={{ color: "#1C1B2E" }}>
                {sumAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || needsManualValue || Math.abs(sumPct - 100) > 0.01 || splits.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#5E5495", color: "white" }}
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
            حفظ + التالي
          </button>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}
