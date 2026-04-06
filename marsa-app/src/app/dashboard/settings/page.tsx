"use client";

import { useState, useEffect } from "react";
import { Settings, Building2, Mail, Bell, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

const tabs = [
  { id: "general", label: "الإعدادات العامة", icon: Settings },
  { id: "company", label: "إعدادات الشركة", icon: Building2 },
  { id: "smtp", label: "إعدادات البريد (SMTP)", icon: Mail },
  { id: "reminders", label: "التذكيرات", icon: Bell },
];

const defaults: Record<string, string> = {
  app_name: "مرسى",
  app_url: "http://localhost:3000",
  default_currency: "SAR",
  timezone: "Asia/Riyadh",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [reminderIntervals, setReminderIntervals] = useState<{ value: string; label: string }[]>([
    { value: "1h", label: "كل ساعة" },
    { value: "1d", label: "كل يوم" },
    { value: "3d", label: "كل 3 أيام" },
  ]);

  useEffect(() => { document.title = "الإعدادات | مرسى"; }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setSettings({ ...defaults, ...data });
          // Parse reminder intervals from settings
          const ri = data["reminder_intervals"];
          const rl = data["reminder_intervals_label"];
          if (ri && rl) {
            const values = ri.split(",");
            const labels = rl.split(",");
            setReminderIntervals(values.map((v: string, i: number) => ({ value: v, label: labels[i] || v })));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const getValue = (key: string) => settings[key] || defaults[key] || "";

  const setValue = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (keys: string[]) => {
    setSaving(true);
    const body: Record<string, string> = {};
    for (const key of keys) {
      body[key] = getValue(key);
    }

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showMessage("success", "تم حفظ الإعدادات بنجاح");
      } else {
        showMessage("error", "حدث خطأ أثناء الحفظ");
      }
    } catch {
      showMessage("error", "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const updateReminderInterval = (i: number, field: "value" | "label", val: string) => {
    setReminderIntervals((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));
  };
  const addReminderInterval = () => setReminderIntervals((p) => [...p, { value: "", label: "" }]);
  const removeReminderInterval = (i: number) => setReminderIntervals((p) => p.filter((_, idx) => idx !== i));
  const saveReminderIntervals = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminder_intervals: reminderIntervals.map((r) => r.value).join(","),
          reminder_intervals_label: reminderIntervals.map((r) => r.label).join(","),
        }),
      });
      if (res.ok) {
        showMessage("success", "تم حفظ إعدادات التذكير");
      } else {
        showMessage("error", "حدث خطأ أثناء الحفظ");
      }
    } catch {
      showMessage("error", "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    border: "1px solid #E2E0D8",
    color: "#2D3748",
    backgroundColor: "#FAFAFE",
  };

  const labelStyle: React.CSSProperties = {
    color: "#1C1B2E",
    fontWeight: 600,
    fontSize: "0.875rem",
    marginBottom: "0.375rem",
    display: "block",
  };

  const renderInput = (key: string, label: string, options?: { type?: string; textarea?: boolean; dropdown?: { value: string; label: string }[]; placeholder?: string }) => (
    <div key={key}>
      <label style={labelStyle}>{label}</label>
      {options?.dropdown ? (
        <select
          value={getValue(key)}
          onChange={(e) => setValue(key, e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none cursor-pointer"
          style={inputStyle}
        >
          {options.dropdown.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : options?.textarea ? (
        <textarea
          value={getValue(key)}
          onChange={(e) => setValue(key, e.target.value)}
          placeholder={options?.placeholder}
          rows={3}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
          style={inputStyle}
        />
      ) : (
        <input
          type={options?.type || "text"}
          value={getValue(key)}
          onChange={(e) => setValue(key, e.target.value)}
          placeholder={options?.placeholder}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={inputStyle}
        />
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen" style={{ backgroundColor: "#F8F9FA" }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
          إعدادات النظام
        </h1>
        <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
          إدارة إعدادات التطبيق والشركة والبريد الإلكتروني
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6 text-sm font-medium"
          style={
            message.type === "success"
              ? { backgroundColor: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" }
              : { backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }
          }
        >
          {message.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <div className="flex" style={{ borderBottom: "1px solid #E2E0D8" }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all"
                style={
                  isActive
                    ? { color: "#C9A84C", borderBottom: "2px solid #C9A84C", marginBottom: "-1px" }
                    : { color: "#2D3748", opacity: 0.5 }
                }
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-8">
          {/* Tab 1 - General */}
          {activeTab === "general" && (
            <div className="space-y-5 max-w-2xl">
              {renderInput("app_name", "اسم التطبيق")}
              {renderInput("app_url", "رابط التطبيق")}
              {renderInput("default_currency", "العملة الافتراضية", {
                dropdown: [
                  { value: "SAR", label: "SAR - ريال سعودي" },
                  { value: "USD", label: "USD - دولار أمريكي" },
                  { value: "EUR", label: "EUR - يورو" },
                ],
              })}
              {renderInput("timezone", "المنطقة الزمنية", {
                dropdown: [
                  { value: "Asia/Riyadh", label: "Asia/Riyadh" },
                  { value: "Asia/Dubai", label: "Asia/Dubai" },
                  { value: "UTC", label: "UTC" },
                ],
              })}
              <MarsaButton
                onClick={() => handleSave(["app_name", "app_url", "default_currency", "timezone"])}
                disabled={saving}
                variant="gold" size="lg" loading={saving}>
                حفظ
              </MarsaButton>
            </div>
          )}

          {/* Tab 2 - Company */}
          {activeTab === "company" && (
            <div className="space-y-5 max-w-2xl">
              {renderInput("company_name", "اسم الشركة")}
              {renderInput("company_address", "العنوان", { textarea: true })}
              {renderInput("company_cr", "رقم السجل التجاري")}
              {renderInput("company_tax_number", "الرقم الضريبي")}
              {renderInput("company_logo", "شعار الشركة", { placeholder: "رابط URL للشعار" })}
              {getValue("company_logo") && (
                <div>
                  <label style={labelStyle}>معاينة الشعار</label>
                  <div
                    className="w-32 h-32 rounded-xl flex items-center justify-center overflow-hidden"
                    style={{ border: "1px solid #E2E0D8", backgroundColor: "#FAFAFE" }}
                  >
                    <img
                      src={getValue("company_logo")}
                      alt="شعار الشركة"
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}
              <MarsaButton
                onClick={() => handleSave(["company_name", "company_address", "company_cr", "company_tax_number", "company_logo"])}
                disabled={saving}
                variant="gold" size="lg" loading={saving}>
                حفظ
              </MarsaButton>
            </div>
          )}

          {/* Tab 3 - SMTP */}
          {activeTab === "smtp" && (
            <div className="space-y-5 max-w-2xl">
              {renderInput("smtp_host", "SMTP Host", { placeholder: "smtp.example.com" })}
              {renderInput("smtp_port", "SMTP Port", { placeholder: "587" })}
              {renderInput("smtp_user", "SMTP User", { placeholder: "user@example.com" })}
              {renderInput("smtp_pass", "SMTP Password", { type: "password" })}
              {renderInput("smtp_from_name", "اسم المرسل")}
              {renderInput("smtp_from_email", "بريد المرسل", { placeholder: "noreply@example.com" })}
              <MarsaButton
                onClick={() => handleSave(["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_name", "smtp_from_email"])}
                disabled={saving}
                variant="gold" size="lg" loading={saving}>
                حفظ
              </MarsaButton>
            </div>
          )}

          {/* Tab 4 - Reminders */}
          {activeTab === "reminders" && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h3 className="text-sm font-bold mb-1" style={{ color: "#1C1B2E" }}>
                  فترات تذكير مزودي الخدمة
                </h3>
                <p className="text-xs mb-3" style={{ color: "#6B7280" }}>
                  حدد الفترات الزمنية المتاحة للمنفذين عند تذكير المورد
                </p>

                {reminderIntervals.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={item.value}
                      onChange={(e) => updateReminderInterval(i, "value", e.target.value)}
                      placeholder="القيمة: 1h أو 1d أو 3d"
                      className="w-28 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "#FAFAFE" }}
                    />
                    <input
                      value={item.label}
                      onChange={(e) => updateReminderInterval(i, "label", e.target.value)}
                      placeholder="التسمية: كل ساعة"
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "#FAFAFE" }}
                    />
                    <button
                      onClick={() => removeReminderInterval(i)}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                      style={{ color: "#94A3B8" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <MarsaButton onClick={addReminderInterval} variant="link" size="sm" style={{ color: "#5E5495" }}>
                  + إضافة فترة
                </MarsaButton>
              </div>

              <MarsaButton onClick={saveReminderIntervals} disabled={saving} variant="gold" size="lg" loading={saving}>
                حفظ إعدادات التذكير
              </MarsaButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
