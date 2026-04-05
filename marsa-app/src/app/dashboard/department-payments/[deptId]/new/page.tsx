"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Save,
  Loader2,
  CreditCard,
  User,
  FileText,
  Calendar,
  Hash,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

/* ─── Types ─── */
interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

/* ─── Page ─── */
export default function NewDepartmentPaymentPage({ params }: { params: Promise<{ deptId: string }> }) {
  const { deptId } = use(params);
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  const [form, setForm] = useState({
    amount: "",
    clientId: "",
    paymentMethod: "",
    paymentType: "FULL" as "FULL" | "INSTALLMENTS",
    installmentCount: "",
    dueDate: "",
    notes: "",
    projectId: "",
    serviceId: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch(`/api/departments/${deptId}/projects`).then((r) => r.json()).catch(() => []),
    ])
      .then(([cls, prjs]) => {
        if (Array.isArray(cls)) setClients(cls);
        if (Array.isArray(prjs)) setProjects(prjs);
        setLoadingData(false);
      })
      .catch(() => setLoadingData(false));
  }, [deptId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.amount || Number(form.amount) <= 0) {
      setError("المبلغ مطلوب ويجب أن يكون أكبر من صفر");
      return;
    }
    if (!form.clientId) {
      setError("يجب اختيار العميل");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        amount: Number(form.amount),
        clientId: form.clientId,
        departmentId: deptId,
        paymentType: form.paymentType,
      };
      if (form.paymentMethod) body.paymentMethod = form.paymentMethod;
      if (form.paymentType === "INSTALLMENTS" && form.installmentCount) {
        body.installmentCount = Number(form.installmentCount);
      }
      if (form.dueDate) body.dueDate = form.dueDate;
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.projectId) body.projectId = form.projectId;
      if (form.serviceId) body.serviceId = form.serviceId;

      const res = await fetch("/api/department-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push(`/dashboard/department-payments/${deptId}`);
      } else {
        const data = await res.json();
        setError(data.error || "حدث خطأ أثناء إنشاء الدفعة");
        setSaving(false);
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم");
      setSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all";

  if (loadingData) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#5E5495" }} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-8">
        <MarsaButton
          href={`/dashboard/department-payments/${deptId}`}
          variant="ghost"
          size="md"
          iconOnly
          icon={<ArrowRight size={20} />}
          style={{ border: "1px solid #E2E0D8" }}
        />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إضافة دفعة جديدة
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
            أدخل بيانات الدفعة المالية للقسم
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mr-auto"
          style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
        >
          <CreditCard size={24} style={{ color: "#C9A84C" }} />
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl flex items-center gap-3"
          style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(220,38,38,0.1)" }}>
            <span className="text-red-600 text-sm font-bold">!</span>
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Basic Info ── */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            البيانات الأساسية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Client */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <User size={14} style={{ color: "#C9A84C" }} />
                العميل <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <select
                name="clientId"
                value={form.clientId}
                onChange={handleChange}
                className={inputClass}
                style={{ border: "1px solid #E2E0D8", color: form.clientId ? "#2D3748" : "#9CA3AF" }}
              >
                <option value="">اختر العميل...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Hash size={14} style={{ color: "#C9A84C" }} />
                المبلغ (ر.س) <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={form.amount}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <CreditCard size={14} style={{ color: "#C9A84C" }} />
                طريقة الدفع <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleChange}
                className={inputClass}
                style={{ border: "1px solid #E2E0D8", color: form.paymentMethod ? "#2D3748" : "#9CA3AF" }}
              >
                <option value="">اختر طريقة الدفع...</option>
                <option value="BANK_TRANSFER">تحويل بنكي</option>
                <option value="CASH">نقدا</option>
                <option value="CHECK">شيك</option>
                <option value="CREDIT_CARD">بطاقة ائتمان</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Calendar size={14} style={{ color: "#C9A84C" }} />
                تاريخ الاستحقاق <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
              />
            </div>
          </div>
        </div>

        {/* ── Payment Type ── */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            نوع الدفع
          </h2>

          <div className="flex items-center gap-4 mb-5">
            {(["FULL", "INSTALLMENTS"] as const).map((type) => (
              <label
                key={type}
                className="flex items-center gap-3 px-5 py-3.5 rounded-xl cursor-pointer transition-all"
                style={{
                  border: form.paymentType === type ? "2px solid #C9A84C" : "2px solid #E2E0D8",
                  backgroundColor: form.paymentType === type ? "rgba(201,168,76,0.06)" : "transparent",
                }}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value={type}
                  checked={form.paymentType === type}
                  onChange={handleChange}
                  className="hidden"
                />
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: form.paymentType === type ? "#C9A84C" : "#D1D5DB" }}
                >
                  {form.paymentType === type && (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#C9A84C" }} />
                  )}
                </div>
                <span className="text-sm font-medium" style={{ color: "#2D3748" }}>
                  {type === "FULL" ? "دفعة كاملة" : "أقساط"}
                </span>
              </label>
            ))}
          </div>

          {form.paymentType === "INSTALLMENTS" && (
            <div className="max-w-xs">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <Hash size={14} style={{ color: "#C9A84C" }} />
                عدد الأقساط
              </label>
              <input
                type="number"
                name="installmentCount"
                value={form.installmentCount}
                onChange={handleChange}
                placeholder="مثال: 4"
                min="2"
                dir="ltr"
                className={`${inputClass} text-left`}
                style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
              />
            </div>
          )}
        </div>

        {/* ── Optional Details ── */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
            تفاصيل إضافية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Project */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <FileText size={14} style={{ color: "#C9A84C" }} />
                المشروع <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <select
                name="projectId"
                value={form.projectId}
                onChange={handleChange}
                className={inputClass}
                style={{ border: "1px solid #E2E0D8", color: form.projectId ? "#2D3748" : "#9CA3AF" }}
              >
                <option value="">بدون مشروع</option>
                {projects.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>

            {/* Service ID */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <FileText size={14} style={{ color: "#C9A84C" }} />
                معرف الخدمة <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <input
                type="text"
                name="serviceId"
                value={form.serviceId}
                onChange={handleChange}
                placeholder="معرف الخدمة"
                className={inputClass}
                style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                <FileText size={14} style={{ color: "#C9A84C" }} />
                ملاحظات <span className="text-xs opacity-50">(اختياري)</span>
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="أضف أي ملاحظات..."
                className={`${inputClass} resize-none`}
                style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                onBlur={(e) => (e.target.style.borderColor = "#E2E0D8")}
              />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-2">
          <MarsaButton type="submit" variant="gold" size="lg" loading={saving} icon={<Save size={18} />}>
            {saving ? "جارٍ الحفظ..." : "حفظ الدفعة"}
          </MarsaButton>
          <MarsaButton
            href={`/dashboard/department-payments/${deptId}`}
            variant="secondary"
            size="lg"
          >
            إلغاء
          </MarsaButton>
        </div>
      </form>
    </div>
  );
}
