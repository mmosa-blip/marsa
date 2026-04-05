"use client";

import { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  Loader2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface ScheduleItem {
  id: string;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  label: string | null;
  gateForServiceOrder: number | null;
}

interface Props {
  projectId: string;
  schedule: ScheduleItem[];
  isAdmin: boolean;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "معلق", color: "#6B7280", icon: Clock },
  PAID: { label: "مدفوع", color: "#059669", icon: CheckCircle2 },
  OVERDUE: { label: "متأخر", color: "#DC2626", icon: AlertTriangle },
};

export default function PaymentScheduleCard({ projectId, schedule, isAdmin, onUpdate }: Props) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: "", dueDate: "", label: "", gateForServiceOrder: "" });

  const totalAmount = schedule.reduce((s, p) => s + p.amount, 0);
  const paidAmount = schedule.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);

  const handleAdd = async () => {
    if (!form.amount || !form.dueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/payment-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          dueDate: form.dueDate,
          label: form.label || undefined,
          gateForServiceOrder: form.gateForServiceOrder ? parseInt(form.gateForServiceOrder) : undefined,
        }),
      });
      if (res.ok) {
        setAdding(false);
        setForm({ amount: "", dueDate: "", label: "", gateForServiceOrder: "" });
        onUpdate();
      }
    } catch {}
    setSaving(false);
  };

  const markAsPaid = async (scheduleId: string) => {
    setMarkingPaid(scheduleId);
    try {
      await fetch(`/api/projects/${projectId}/payment-schedule/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      onUpdate();
    } catch {}
    setMarkingPaid(null);
  };

  return (
    <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }} dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard size={18} style={{ color: "#C9A84C" }} />
          <h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>جدول الدفعات</h3>
        </div>
        {isAdmin && !adding && (
          <MarsaButton variant="outline" size="xs" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
            إضافة دفعة
          </MarsaButton>
        )}
      </div>

      {/* Progress bar */}
      {totalAmount > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "#6B7280" }}>المدفوع: {paidAmount.toLocaleString()} ر.س</span>
            <span style={{ color: "#6B7280" }}>الإجمالي: {totalAmount.toLocaleString()} ر.س</span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#F0EEF5" }}>
            <div
              className="h-2.5 rounded-full transition-all"
              style={{ width: `${Math.round((paidAmount / totalAmount) * 100)}%`, backgroundColor: "#059669" }}
            />
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E8E6F0" }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              type="number" placeholder="المبلغ (ر.س)" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr"
            />
            <input
              type="date" value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr"
            />
            <input
              type="text" placeholder="وصف (اختياري)" value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="px-3 py-2 rounded-lg text-sm outline-none col-span-2" style={{ border: "1px solid #E2E0D8" }}
            />
          </div>
          <div className="flex gap-2">
            <MarsaButton variant="gold" size="xs" loading={saving} onClick={handleAdd}>حفظ</MarsaButton>
            <MarsaButton variant="secondary" size="xs" onClick={() => setAdding(false)}>إلغاء</MarsaButton>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {schedule.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: "#9CA3AF" }}>لا توجد دفعات مجدولة</p>
      ) : (
        <div className="space-y-2">
          {schedule.map((item, idx) => {
            const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = config.icon;
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: item.status === "PAID" ? "rgba(5,150,105,0.04)" : "#FAFAFE" }}
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[28px]">
                    <span className="text-xs font-bold" style={{ color: "#9CA3AF" }}>{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
                      {item.amount.toLocaleString()} ر.س
                    </p>
                    <p className="text-[10px]" style={{ color: "#9CA3AF" }}>
                      {item.label || `دفعة ${idx + 1}`} — {new Date(item.dueDate).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: `${config.color}12`, color: config.color }}
                  >
                    <StatusIcon size={10} />
                    {config.label}
                  </span>
                  {isAdmin && item.status === "PENDING" && (
                    <MarsaButton
                      variant="gold" size="xs"
                      loading={markingPaid === item.id}
                      onClick={() => markAsPaid(item.id)}
                    >
                      تم الدفع
                    </MarsaButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
