"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Link2,
  Zap,
  Lock,
  CheckCircle2,
  Save,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ─── Public types ──────────────────────────────────────────────────────

export interface InstallmentEditorTarget {
  contractId: string;
  /** Pre-rendered display name (project name or client) shown in the
   *  modal heading. */
  displayName: string;
}

export interface InstallmentEditorModalProps {
  target: InstallmentEditorTarget;
  onClose: () => void;
  onSuccess: () => void;
}

// Mirrors the GET response from /api/contracts/[id]/installments
interface ServiceOption {
  id: string;
  name: string;
  order: number;
  hasTasks: boolean;
}

interface FetchedRow {
  id: string;
  title: string;
  amount: number;
  percentage: number | null;
  order: number;
  isLocked: boolean;
  isUpfront: boolean;
  linkedTaskId: string | null;
  linkedServiceIndex: number | null;
  paymentStatus: string;
  paidAmount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partialPayments: any;
}

interface ContractDescriptor {
  id: string;
  contractNumber: number | null;
  contractValue: number | null;
  effectiveValue: number | null;
  projectName: string | null;
  services: ServiceOption[];
}

// Editable row state
type Trigger = "UPFRONT" | "AFTER_SERVICE";

interface Row {
  // null id means "new — created on save"
  id: string | null;
  title: string;
  amountStr: string;
  trigger: Trigger;
  linkedServiceIndex: number | null;
  paymentStatus: string;
  paidAmount: number;
  hasPartialPayments: boolean;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "غير مدفوع",
  PARTIAL: "جزئي",
  PAID: "مدفوع",
  PENDING_CONFIRMATION: "بانتظار التأكيد",
};

// ─── Quick-pick templates ──────────────────────────────────────────────

const TEMPLATES: {
  key: string;
  label: string;
  splits: { percentage: number; title: string; on: "upfront" | "first" | "last" | number }[];
}[] = [
  { key: "single-upfront", label: "دفعة واحدة عند البدء", splits: [{ percentage: 100, title: "الدفعة الكاملة", on: "upfront" }] },
  { key: "single-final", label: "دفعة واحدة عند الإنجاز", splits: [{ percentage: 100, title: "الدفعة عند التسليم", on: "last" }] },
  { key: "fifty-fifty", label: "50% + 50%", splits: [
    { percentage: 50, title: "الدفعة المقدمة", on: "upfront" },
    { percentage: 50, title: "الدفعة النهائية", on: "last" },
  ]},
  { key: "third-third-final", label: "30 + 30 + 40", splits: [
    { percentage: 30, title: "الدفعة المقدمة", on: "upfront" },
    { percentage: 30, title: "الدفعة الثانية", on: "first" },
    { percentage: 40, title: "الدفعة النهائية", on: "last" },
  ]},
];

function templateToRows(key: string, total: number, services: ServiceOption[]): Row[] {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) return [];
  const firstSvc = services[0];
  const lastSvc = services[services.length - 1];
  return t.splits.map<Row>((s) => {
    const amount = (s.percentage / 100) * total;
    if (s.on === "upfront") {
      return {
        id: null,
        title: s.title,
        amountStr: String(amount),
        trigger: "UPFRONT",
        linkedServiceIndex: null,
        paymentStatus: "UNPAID",
        paidAmount: 0,
        hasPartialPayments: false,
      };
    }
    const svc = s.on === "first" ? firstSvc : lastSvc;
    return {
      id: null,
      title: s.title,
      amountStr: String(amount),
      trigger: "AFTER_SERVICE",
      linkedServiceIndex:
        services.indexOf(svc as ServiceOption) >= 0
          ? services.indexOf(svc as ServiceOption)
          : null,
      paymentStatus: "UNPAID",
      paidAmount: 0,
      hasPartialPayments: false,
    };
  });
}

// ─── Component ─────────────────────────────────────────────────────────

export default function InstallmentEditorModal({
  target,
  onClose,
  onSuccess,
}: InstallmentEditorModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [contract, setContract] = useState<ContractDescriptor | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [contractValueStr, setContractValueStr] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/contracts/${target.contractId}/installments`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر تحميل البيانات");
        return;
      }
      const data = await res.json();
      const c = data.contract as ContractDescriptor;
      const items = (data.installments as FetchedRow[]) ?? [];
      setContract(c);
      setServices(c.services);
      // Use effectiveValue (with project.totalPrice fallback) when
      // Contract.contractValue is empty, so the editor can launch in
      // a usable state for legacy rows.
      const startingValue =
        c.contractValue && c.contractValue > 0
          ? c.contractValue
          : c.effectiveValue && c.effectiveValue > 0
            ? c.effectiveValue
            : 0;
      setContractValueStr(startingValue > 0 ? String(startingValue) : "");

      setRows(
        items.length > 0
          ? items.map<Row>((it) => ({
              id: it.id,
              title: it.title,
              amountStr: String(it.amount),
              trigger: it.isUpfront ? "UPFRONT" : "AFTER_SERVICE",
              linkedServiceIndex: it.linkedServiceIndex,
              paymentStatus: it.paymentStatus,
              paidAmount: it.paidAmount,
              hasPartialPayments:
                Array.isArray(it.partialPayments) && it.partialPayments.length > 0,
            }))
          : [
              {
                id: null,
                title: "دفعة مقدمة",
                amountStr: "",
                trigger: "UPFRONT",
                linkedServiceIndex: null,
                paymentStatus: "UNPAID",
                paidAmount: 0,
                hasPartialPayments: false,
              },
            ]
      );
    } finally {
      setLoading(false);
    }
  }, [target.contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const contractValueNum = Number(contractValueStr) || 0;
  const sum = rows.reduce((s, r) => s + (Number(r.amountStr) || 0), 0);

  // ─── Live validation ───
  const liveErrors: string[] = (() => {
    const errs: string[] = [];
    if (contractValueNum <= 0) errs.push("قيمة العقد يجب أن تكون أكبر من صفر");
    const upfront = rows.find((r) => r.trigger === "UPFRONT");
    if (!upfront) errs.push("يجب وجود دفعة مقدمة واحدة على الأقل");
    if (contractValueNum > 0 && Math.abs(sum - contractValueNum) > 0.01) {
      errs.push(
        `مجموع الأقساط (${sum.toLocaleString("en-US")}) لا يطابق قيمة العقد (${contractValueNum.toLocaleString("en-US")})`
      );
    }
    const seen = new Set<number>();
    rows.forEach((r, idx) => {
      const amt = Number(r.amountStr) || 0;
      if (amt <= 0) errs.push(`الدفعة ${idx + 1}: المبلغ غير صالح`);
      if (amt < r.paidAmount) {
        errs.push(
          `الدفعة ${idx + 1}: المبلغ (${amt}) أقل من المدفوع (${r.paidAmount})`
        );
      }
      if (r.trigger === "AFTER_SERVICE") {
        if (r.linkedServiceIndex == null) {
          errs.push(`الدفعة ${idx + 1}: اختر الخدمة المرتبطة`);
        } else {
          if (seen.has(r.linkedServiceIndex)) {
            errs.push(`الدفعة ${idx + 1}: الخدمة مكررة`);
          }
          seen.add(r.linkedServiceIndex);
        }
      }
    });
    return errs;
  })();

  function updateRow<K extends keyof Row>(idx: number, key: K, value: Row[K]) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  function addRow() {
    const used = new Set(
      rows
        .filter((r) => r.trigger === "AFTER_SERVICE" && r.linkedServiceIndex != null)
        .map((r) => r.linkedServiceIndex as number)
    );
    const firstFree = services.findIndex((_, i) => !used.has(i));
    setRows((prev) => [
      ...prev,
      {
        id: null,
        title: services[firstFree]?.name ? `بعد ${services[firstFree].name}` : "الدفعة التالية",
        amountStr: "0",
        trigger: "AFTER_SERVICE",
        linkedServiceIndex: firstFree >= 0 ? firstFree : null,
        paymentStatus: "UNPAID",
        paidAmount: 0,
        hasPartialPayments: false,
      },
    ]);
  }

  function removeRow(idx: number) {
    const r = rows[idx];
    if (r.paidAmount > 0) {
      setError(`لا يمكن حذف "${r.title}" — مدفوعة (${r.paidAmount})`);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function applyTemplate(key: string) {
    if (contractValueNum <= 0) {
      setError("أدخل قيمة العقد أولاً");
      return;
    }
    const paidRows = rows.filter((r) => r.paidAmount > 0);
    const unpaidCount = rows.length - paidRows.length;
    if (paidRows.length > 0) {
      const ok = window.confirm(
        `تطبيق القالب سيحذف ${unpaidCount} قسط غير مدفوع.\nالأقساط المدفوعة (${paidRows.length}) ستبقى محفوظة.\n\nمتابعة؟`
      );
      if (!ok) return;
    }
    const newRows = templateToRows(key, contractValueNum, services);
    // Preserve paid rows by appending them after the template; the
    // user can re-shuffle. Templates assume an empty schedule.
    setRows([...newRows, ...paidRows]);
  }

  async function save() {
    setError("");
    if (liveErrors.length > 0) {
      setError("يرجى تصحيح الأخطاء قبل الحفظ");
      return;
    }
    setSaving(true);
    try {
      const body = {
        contractValue: contractValueNum,
        installments: rows.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          title: r.title.trim(),
          amount: Number(r.amountStr) || 0,
          ...(r.trigger === "UPFRONT"
            ? { isUpfront: true as const }
            : { linkedServiceIndex: r.linkedServiceIndex }),
          paymentStatus: r.paymentStatus,
        })),
      };
      const res = await fetch(`/api/contracts/${target.contractId}/installments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || "تعذّر الحفظ");
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.partiallyPaidWarnings) && data.partiallyPaidWarnings.length > 0) {
        setWarnings(data.partiallyPaidWarnings);
      }
      onSuccess();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && onClose()}>
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              تعديل دفعات: {target.displayName}
            </h3>
            <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>
              {contract?.contractNumber != null ? `عقد #${contract.contractNumber}` : "عقد بدون رقم"}
              {contract?.projectName && contract.projectName !== target.displayName ? ` — ${contract.projectName}` : ""}
            </p>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={saving} />
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 size={28} className="animate-spin mx-auto" style={{ color: "#C9A84C" }} />
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Top — contract value + sum */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                  قيمة العقد (ريال) <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={contractValueStr}
                  onChange={(e) => setContractValueStr(e.target.value)}
                  disabled={saving}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"
                  style={{ direction: "ltr", textAlign: "right" }}
                />
              </div>
              <div className="flex items-end">
                <div
                  className="w-full px-3 py-2 rounded-lg flex items-center justify-between"
                  style={{
                    backgroundColor:
                      contractValueNum > 0 && Math.abs(sum - contractValueNum) < 0.01
                        ? "rgba(22,163,74,0.06)"
                        : "rgba(220,38,38,0.05)",
                    border: `1px solid ${
                      contractValueNum > 0 && Math.abs(sum - contractValueNum) < 0.01
                        ? "rgba(22,163,74,0.30)"
                        : "rgba(220,38,38,0.25)"
                    }`,
                  }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: "#6B7280" }}>المجموع</span>
                  <span
                    className="text-sm font-bold font-mono"
                    style={{
                      color:
                        contractValueNum > 0 && Math.abs(sum - contractValueNum) < 0.01
                          ? "#16A34A"
                          : "#DC2626",
                    }}
                  >
                    {sum.toLocaleString("en-US")} / {contractValueNum.toLocaleString("en-US")}
                    {contractValueNum > 0 && Math.abs(sum - contractValueNum) < 0.01 && " ✓"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick templates */}
            <div>
              <p className="text-[11px] font-semibold mb-2" style={{ color: "#6B7280" }}>قوالب سريعة (اختيارية)</p>
              <div className="flex gap-2 flex-wrap">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    disabled={contractValueNum <= 0 || saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:brightness-105 disabled:opacity-40"
                    style={{ borderColor: "#E2E0D8", color: "#5E5495", backgroundColor: "white" }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="space-y-2">
              {rows.map((r, idx) => {
                const amount = Number(r.amountStr) || 0;
                const pct = contractValueNum > 0 ? (amount / contractValueNum) * 100 : 0;
                const isPaid = r.paymentStatus === "PAID" || r.paidAmount >= amount && amount > 0;
                const usedIndexes = new Set(
                  rows
                    .filter(
                      (x, i) =>
                        i !== idx &&
                        x.trigger === "AFTER_SERVICE" &&
                        x.linkedServiceIndex != null
                    )
                    .map((x) => x.linkedServiceIndex as number)
                );
                return (
                  <div
                    key={`${r.id ?? "new"}-${idx}`}
                    className="p-3 rounded-xl space-y-2"
                    style={{
                      backgroundColor: r.trigger === "UPFRONT" ? "rgba(22,163,74,0.05)" : "#F8F8F4",
                      border: `1px solid ${r.trigger === "UPFRONT" ? "rgba(22,163,74,0.25)" : "#E5E7EB"}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[10px] font-bold" style={{ color: r.trigger === "UPFRONT" ? "#16A34A" : "#5E5495" }}>
                          الدفعة {idx + 1}
                        </p>
                        {isPaid && (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                            style={{ backgroundColor: "rgba(220,38,38,0.10)", color: "#DC2626" }}
                          >
                            <Lock size={9} />
                            مدفوعة — لا يمكن تعديل المبلغ تحت {r.paidAmount}
                          </span>
                        )}
                        {r.hasPartialPayments && (
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "rgba(234,88,12,0.10)", color: "#EA580C" }}
                          >
                            ⚠ تحتوي مدفوعات جزئية: {r.paidAmount.toLocaleString("en-US")}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        disabled={r.paidAmount > 0 || saving}
                        className="p-1 rounded-md hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ color: "#DC2626" }}
                        title={r.paidAmount > 0 ? "محمية — مدفوعة" : "حذف"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-12 md:col-span-5">
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>الوصف</label>
                        <input
                          type="text"
                          value={r.title}
                          onChange={(e) => updateRow(idx, "title", e.target.value)}
                          disabled={saving}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                        />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>المبلغ (ريال)</label>
                        <input
                          type="number"
                          min={r.paidAmount}
                          step="0.01"
                          inputMode="decimal"
                          value={r.amountStr}
                          onChange={(e) => updateRow(idx, "amountStr", e.target.value)}
                          disabled={saving}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none"
                          style={{ direction: "ltr", textAlign: "right" }}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>النسبة %</label>
                        <p className="px-2 py-1.5 rounded-lg text-xs font-mono font-bold" style={{ color: "#1C1B2E", direction: "ltr", textAlign: "right" }}>
                          {pct.toFixed(1)}%
                        </p>
                      </div>
                      <div className="col-span-12 md:col-span-2">
                        <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>حالة الدفع</label>
                        <select
                          value={r.paymentStatus}
                          onChange={(e) => updateRow(idx, "paymentStatus", e.target.value)}
                          disabled={saving}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                        >
                          {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Trigger */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[10px] font-semibold" style={{ color: "#6B7280" }}>متى تستحق</p>
                      <div className="flex gap-2 flex-wrap">
                        <label
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                          style={{
                            backgroundColor: r.trigger === "UPFRONT" ? "rgba(22,163,74,0.10)" : "white",
                            color: r.trigger === "UPFRONT" ? "#16A34A" : "#6B7280",
                            border: `1.5px solid ${r.trigger === "UPFRONT" ? "#16A34A" : "#E5E7EB"}`,
                          }}
                        >
                          <input
                            type="radio"
                            name={`trigger-${idx}`}
                            value="UPFRONT"
                            checked={r.trigger === "UPFRONT"}
                            onChange={() => {
                              updateRow(idx, "trigger", "UPFRONT");
                              updateRow(idx, "linkedServiceIndex", null);
                            }}
                            disabled={saving}
                            className="hidden"
                          />
                          <Zap size={12} />
                          دفعة مقدمة
                        </label>
                        <label
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer transition-all"
                          style={{
                            backgroundColor: r.trigger === "AFTER_SERVICE" ? "rgba(94,84,149,0.10)" : "white",
                            color: r.trigger === "AFTER_SERVICE" ? "#5E5495" : "#6B7280",
                            border: `1.5px solid ${r.trigger === "AFTER_SERVICE" ? "#5E5495" : "#E5E7EB"}`,
                          }}
                        >
                          <input
                            type="radio"
                            name={`trigger-${idx}`}
                            value="AFTER_SERVICE"
                            checked={r.trigger === "AFTER_SERVICE"}
                            onChange={() => {
                              updateRow(idx, "trigger", "AFTER_SERVICE");
                              if (r.linkedServiceIndex == null && services[0]) {
                                updateRow(idx, "linkedServiceIndex", 0);
                              }
                            }}
                            disabled={saving}
                            className="hidden"
                          />
                          <Link2 size={12} />
                          بعد إكمال خدمة
                        </label>
                      </div>
                      {r.trigger === "AFTER_SERVICE" && (
                        <select
                          value={r.linkedServiceIndex ?? ""}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              "linkedServiceIndex",
                              e.target.value === "" ? null : parseInt(e.target.value)
                            )
                          }
                          disabled={saving}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                        >
                          <option value="">— اختر الخدمة —</option>
                          {services.map((svc, i) => (
                            <option key={svc.id} value={i} disabled={!svc.hasTasks || usedIndexes.has(i)}>
                              {i + 1}. {svc.name}
                              {!svc.hasTasks ? " (بدون مهام)" : usedIndexes.has(i) ? " (مستخدمة)" : ""}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold border border-dashed transition-all hover:brightness-105"
                style={{ color: "#5E5495", borderColor: "rgba(94,84,149,0.3)", backgroundColor: "white" }}
              >
                <Plus size={14} />
                إضافة دفعة
              </button>
            </div>

            {/* Errors / warnings */}
            {liveErrors.length > 0 && (
              <div
                className="p-3 rounded-xl text-xs"
                style={{ backgroundColor: "rgba(220,38,38,0.05)", border: "1px solid rgba(220,38,38,0.25)", color: "#374151" }}
              >
                <p className="font-bold mb-1 flex items-center gap-1" style={{ color: "#DC2626" }}>
                  <AlertTriangle size={12} />
                  يرجى تصحيح:
                </p>
                <ul className="list-disc pe-5 space-y-0.5">
                  {liveErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div
                className="p-3 rounded-xl text-xs"
                style={{ backgroundColor: "rgba(234,88,12,0.05)", border: "1px solid rgba(234,88,12,0.25)", color: "#374151" }}
              >
                <p className="font-bold mb-1" style={{ color: "#EA580C" }}>
                  ⚠ تنبيه: تم تعديل أقساط مدفوعة جزئياً
                </p>
                <ul className="list-disc pe-5 space-y-0.5">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {error && (
              <div className="p-2 rounded-lg text-xs" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={save}
            disabled={loading || saving || liveErrors.length > 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#5E5495", color: "white" }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            حفظ التغييرات
          </button>
          <MarsaButton variant="secondary" size="sm" onClick={onClose} disabled={saving}>إلغاء</MarsaButton>
        </div>
      </div>
    </div>
  );
}

// Reference unused imports to satisfy strict linter (CheckCircle2 may be used by callers).
void CheckCircle2;
