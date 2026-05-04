"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Link2,
  Zap,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ─── Public types ──────────────────────────────────────────────────────

export interface SetupModalTarget {
  contractId: string;
  /** Project name OR client name — used in the modal heading. */
  displayName: string;
  /** The current effective contract value (already resolved with the
   *  project totalPrice fallback by the caller). null/0 puts the
   *  modal in "manual value" mode. */
  effectiveValue: number | null;
  /** Where effectiveValue came from. Used only to show a soft notice. */
  valueSource: "contract" | "project" | "missing";
}

interface ServiceOption {
  id: string;
  name: string;
  serviceOrder: number;
  hasTasks: boolean;
}

type Trigger = "UPFRONT" | "AFTER_SERVICE";

interface Split {
  title: string;
  percentage: string;
  trigger: Trigger;
  linkedServiceId: string | null;
}

// ─── Quick-pick templates ──────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────────

export interface SetupInstallmentsModalProps {
  target: SetupModalTarget;
  onClose: () => void;
  /** Fired after a successful save. Caller is responsible for
   *  refreshing whatever surface led to opening the modal. */
  onSuccess: () => void;
}

export default function SetupInstallmentsModal({
  target,
  onClose,
  onSuccess,
}: SetupInstallmentsModalProps) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [templateKey, setTemplateKey] = useState<string>("fifty-fifty");
  const [splits, setSplits] = useState<Split[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const initialEffective = target.effectiveValue ?? 0;
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

  useEffect(() => {
    let alive = true;
    setLoadingServices(true);
    fetch(`/api/contracts/${target.contractId}/services`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        const svcs: ServiceOption[] = data?.services ?? [];
        setServices(svcs);
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
  }, [target.contractId]);

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
      const res = await fetch(`/api/contracts/${target.contractId}/set-value`, {
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
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i];
      if (s.trigger === "AFTER_SERVICE" && !s.linkedServiceId) {
        setError(`الدفعة #${i + 1}: اختر الخدمة المرتبطة`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${target.contractId}/setup-installments`, {
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              إعداد دفعات: {target.displayName}
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
                  <p className="text-xs font-bold" style={{ color: "#1C1B2E" }}>قيمة العقد غير محددة</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                    أدخل قيمة العقد لتفعيل قوالب توزيع الدفعات. ستُحفظ على العقد فوراً.
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>
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

          {!needsManualValue && target.valueSource === "project" && total === initialEffective && (
            <div
              className="p-3 rounded-xl flex items-start gap-2"
              style={{
                backgroundColor: "rgba(234,88,12,0.04)",
                border: "1px solid rgba(234,88,12,0.20)",
              }}
            >
              <AlertTriangle size={14} style={{ color: "#EA580C" }} className="shrink-0 mt-0.5" />
              <p className="text-[11px]" style={{ color: "#374151" }}>
                القيمة الحالية مأخوذة من <strong>إجمالي المشروع</strong>. ستُحفظ على العقد عند إنشاء الأقساط.
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
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>نموذج التوزيع</label>
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
                    <p className="text-[10px] font-bold" style={{ color: "#5E5495" }}>الدفعة {idx + 1}</p>
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
                          <option key={svc.id} value={svc.id} disabled={!svc.hasTasks}>
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

          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{
              backgroundColor: Math.abs(sumPct - 100) < 0.01 ? "rgba(22,163,74,0.05)" : "rgba(220,38,38,0.05)",
              border: `1px solid ${Math.abs(sumPct - 100) < 0.01 ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}`,
            }}
          >
            <div>
              <p className="text-[10px]" style={{ color: "#6B7280" }}>مجموع النسب</p>
              <p
                className="text-sm font-bold font-mono"
                style={{ color: Math.abs(sumPct - 100) < 0.01 ? "#16A34A" : "#DC2626" }}
              >
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
            حفظ
          </button>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={submitting}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}
