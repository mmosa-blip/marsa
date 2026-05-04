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
  createdAt: string;
  client: { id: string; name: string; phone: string | null } | null;
  project: {
    id: string;
    name: string;
    projectCode: string | null;
    status: string;
  } | null;
}

// Quick-pick templates that fill the modal in one click. Each entry is
// a list of (percentage, dueAfterDays, title) tuples that sum to 100%.
const TEMPLATES: {
  key: string;
  label: string;
  splits: { percentage: number; dueAfterDays: number; title: string }[];
}[] = [
  { key: "single",  label: "دفعة واحدة (100%)",       splits: [{ percentage: 100, dueAfterDays: 0,  title: "الدفعة الكاملة" }] },
  { key: "two",     label: "دفعتين (50% + 50%)",      splits: [
    { percentage: 50, dueAfterDays: 0,  title: "الدفعة الأولى" },
    { percentage: 50, dueAfterDays: 60, title: "الدفعة النهائية" },
  ]},
  { key: "three",   label: "ثلاث دفعات (40 + 30 + 30)", splits: [
    { percentage: 40, dueAfterDays: 0,  title: "الدفعة الأولى" },
    { percentage: 30, dueAfterDays: 30, title: "الدفعة الثانية" },
    { percentage: 30, dueAfterDays: 60, title: "الدفعة النهائية" },
  ]},
  { key: "four",    label: "أربع دفعات (25% × 4)",     splits: [
    { percentage: 25, dueAfterDays: 0,  title: "الدفعة الأولى" },
    { percentage: 25, dueAfterDays: 30, title: "الدفعة الثانية" },
    { percentage: 25, dueAfterDays: 60, title: "الدفعة الثالثة" },
    { percentage: 25, dueAfterDays: 90, title: "الدفعة الرابعة" },
  ]},
];

interface Split {
  title: string;
  percentage: string;
  dueAfterDays: string;
}

function templateToSplits(key: string): Split[] {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) return [];
  return t.splits.map((s) => ({
    title: s.title,
    percentage: String(s.percentage),
    dueAfterDays: String(s.dueAfterDays),
  }));
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
          عقود نشطة بدون جدول دفعات معرّف. حدد لكل عقد نموذج التوزيع.
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
        <p className="text-base font-bold font-mono" style={{ color: "#1C1B2E" }}>
          {contract.contractValue ? contract.contractValue.toLocaleString("en-US") : "—"}
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
  const [templateKey, setTemplateKey] = useState<string>("two");
  const [splits, setSplits] = useState<Split[]>(() => templateToSplits("two"));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = contract.contractValue ?? 0;
  const sumPct = splits.reduce((s, x) => s + (Number(x.percentage) || 0), 0);
  const sumAmount = splits.reduce(
    (s, x) => s + ((Number(x.percentage) || 0) / 100) * total,
    0
  );
  const isCustom = templateKey === "custom";

  function applyTemplate(key: string) {
    setTemplateKey(key);
    if (key !== "custom") {
      setSplits(templateToSplits(key));
    }
  }

  function updateSplit(idx: number, field: keyof Split, value: string) {
    setSplits((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
    setTemplateKey("custom");
  }

  function addSplit() {
    setSplits((prev) => [
      ...prev,
      { title: `الدفعة ${prev.length + 1}`, percentage: "0", dueAfterDays: "30" },
    ]);
    setTemplateKey("custom");
  }

  function removeSplit(idx: number) {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
    setTemplateKey("custom");
  }

  async function submit() {
    setError("");
    if (Math.abs(sumPct - 100) > 0.01) {
      setError(`مجموع النسب يجب أن يساوي 100% (الحالي: ${sumPct.toFixed(1)}%)`);
      return;
    }
    if (splits.length === 0) {
      setError("أضف دفعة واحدة على الأقل");
      return;
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
            dueAfterDays: Number(s.dueAfterDays),
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
              إعداد دفعات: {contract.project?.name ?? contract.client?.name}
            </h3>
            <p className="text-[11px] truncate" style={{ color: "#6B7280" }}>
              قيمة العقد: {total.toLocaleString("en-US")} ريال
            </p>
          </div>
          <MarsaButton variant="ghost" size="sm" iconOnly icon={<X size={16} />} onClick={onClose} disabled={submitting} />
        </div>

        <div className="p-5 space-y-4">
          {total === 0 && (
            <div className="p-3 rounded-xl flex items-start gap-2" style={{ backgroundColor: "rgba(234,88,12,0.05)", border: "1px solid rgba(234,88,12,0.25)" }}>
              <AlertTriangle size={16} style={{ color: "#EA580C" }} className="shrink-0 mt-0.5" />
              <p className="text-[11px]" style={{ color: "#374151" }}>
                قيمة العقد غير محددة (0). يجب تعديل العقد أولاً ثم إعداد الدفعات.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#374151" }}>نموذج التوزيع</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {TEMPLATES.map((t) => {
                const active = templateKey === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => applyTemplate(t.key)}
                    disabled={submitting}
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
                className="px-3 py-2 rounded-lg text-xs font-semibold text-right transition-all"
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

          <div className="space-y-2">
            {splits.map((s, idx) => {
              const amount = ((Number(s.percentage) || 0) / 100) * total;
              return (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-3 rounded-xl"
                  style={{ backgroundColor: "#F8F8F4", border: "1px solid #E5E7EB" }}
                >
                  <div className="col-span-12 md:col-span-4">
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>الوصف</label>
                    <input
                      type="text"
                      value={s.title}
                      onChange={(e) => updateSplit(idx, "title", e.target.value)}
                      disabled={submitting}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none"
                    />
                  </div>
                  <div className="col-span-4 md:col-span-2">
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
                  <div className="col-span-4 md:col-span-3">
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>المبلغ</label>
                    <p className="px-2 py-1.5 rounded-lg text-xs font-mono font-bold" style={{ color: "#1C1B2E", direction: "ltr", textAlign: "right" }}>
                      {amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-[10px] font-semibold mb-1" style={{ color: "#6B7280" }}>بعد كم يوم</label>
                    <input
                      type="number"
                      min="0"
                      value={s.dueAfterDays}
                      onChange={(e) => updateSplit(idx, "dueAfterDays", e.target.value)}
                      disabled={submitting}
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none"
                      style={{ direction: "ltr", textAlign: "right" }}
                    />
                  </div>
                  <div className="col-span-1 flex items-end justify-end">
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
            disabled={submitting || Math.abs(sumPct - 100) > 0.01 || splits.length === 0}
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
