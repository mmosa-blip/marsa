"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  CheckCircle2,
  Settings,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";
import SetupInstallmentsModal from "@/components/payments/SetupInstallmentsModal";

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

      {/* Legacy notice — the new project flow enforces a payment
          schedule at creation, so this page is only useful for
          contracts that pre-date that change. */}
      <div
        className="mb-4 rounded-2xl p-3 flex items-start gap-2"
        style={{
          backgroundColor: "rgba(94,84,149,0.05)",
          border: "1px solid rgba(94,84,149,0.20)",
        }}
      >
        <span className="text-base">📌</span>
        <p className="text-[12px]" style={{ color: "#374151" }}>
          هذه الصفحة <strong>للمشاريع القديمة فقط</strong>. المشاريع الجديدة تُدخل دفعاتها مباشرة عند الإنشاء — لن تظهر هنا.
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
              ? "✅ كل المشاريع لها جدول دفعات."
              : "تم تخطي كل العقود في هذه الجلسة."}
          </p>
          {contracts.length === 0 && (
            <p className="text-[11px] mt-1" style={{ color: "#9CA3AF" }}>
              لا حاجة لاستخدام هذه الصفحة بعد الآن.
            </p>
          )}
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
        <SetupInstallmentsModal
          target={{
            contractId: editing.id,
            displayName: editing.project?.name ?? editing.client?.name ?? "—",
            effectiveValue: editing.effectiveValue,
            valueSource: editing.valueSource,
          }}
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

// ─── Row component ─────────────────────────────────────────────────────

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
          <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{project?.name ?? "—"}</p>
          {contract.contractNumber != null && (
            <span className="text-[10px] font-mono" style={{ color: "#5E5495" }}>عقد #{contract.contractNumber}</span>
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
          {contract.effectiveValue ? contract.effectiveValue.toLocaleString("en-US") : "—"}
          {contract.valueSource === "project" && (
            <span className="text-[9px] font-normal ms-1" style={{ color: "#EA580C" }}>(من المشروع)</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <MarsaButton size="sm" variant="primary" icon={<Settings size={13} />} onClick={onSetup}>
          إعداد دفعات
        </MarsaButton>
        <MarsaButton size="sm" variant="ghost" onClick={onSkip}>تخطي</MarsaButton>
      </div>
    </div>
  );
}
