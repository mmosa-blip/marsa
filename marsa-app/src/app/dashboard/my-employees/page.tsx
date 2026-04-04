"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Loader2,
  Plus,
  X,
  Phone,
  Mail,
  Building2,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Employee {
  id: string;
  name: string;
  nationality: string | null;
  nationalId: string | null;
  jobTitle: string | null;
  department: string | null;
  baseSalary: number | null;
  housingAllowance: number | null;
  transportAllowance: number | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  residencyExpiry: string | null;
  insuranceExpiry: string | null;
  company: { name: string } | null;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isExpiringSoon(d: string | null): "ok" | "warning" | "expired" {
  if (!d) return "ok";
  const diff = new Date(d).getTime() - Date.now();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days < 30) return "warning";
  return "ok";
}

export default function MyEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", commercialRegister: "", sector: "" });
  const [form, setForm] = useState({
    name: "",
    nationality: "",
    nationalId: "",
    jobTitle: "",
    department: "",
    baseSalary: "",
    housingAllowance: "",
    transportAllowance: "",
    phone: "",
    email: "",
    companyId: "",
    hireDate: "",
    residencyExpiry: "",
    insuranceExpiry: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/my-employees").then((res) => {
        if (!res.ok) throw new Error("فشل في تحميل البيانات");
        return res.json();
      }),
      fetch("/api/my-companies").then((res) => {
        if (!res.ok) throw new Error("فشل في تحميل الشركات");
        return res.json();
      }),
    ])
      .then(([employeesData, companiesData]: [Employee[], Company[]]) => {
        setEmployees(employeesData);
        setCompanies(companiesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAddCompany = async () => {
    if (!companyForm.name) return;
    setSubmittingCompany(true);
    try {
      const res = await fetch("/api/my-companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyForm),
      });
      if (!res.ok) throw new Error();
      const newCompany = await res.json();
      setCompanies((prev) => [...prev, newCompany]);
      setShowCompanyModal(false);
      setCompanyForm({ name: "", commercialRegister: "", sector: "" });
    } catch {
      alert("حدث خطأ أثناء إضافة الشركة");
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.companyId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/my-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : null,
          housingAllowance: form.housingAllowance ? parseFloat(form.housingAllowance) : null,
          transportAllowance: form.transportAllowance ? parseFloat(form.transportAllowance) : null,
          nationality: form.nationality || null,
          nationalId: form.nationalId || null,
          jobTitle: form.jobTitle || null,
          department: form.department || null,
          phone: form.phone || null,
          email: form.email || null,
          hireDate: form.hireDate || null,
          residencyExpiry: form.residencyExpiry || null,
          insuranceExpiry: form.insuranceExpiry || null,
        }),
      });
      if (!res.ok) throw new Error("فشل في إضافة الموظف");
      const newEmp = await res.json();
      setEmployees((prev) => [newEmp, ...prev]);
      setShowModal(false);
      setForm({
        name: "", nationality: "", nationalId: "", jobTitle: "", department: "",
        baseSalary: "", housingAllowance: "", transportAllowance: "",
        phone: "", email: "", companyId: "", hireDate: "", residencyExpiry: "", insuranceExpiry: "",
      });
    } catch {
      alert("حدث خطأ أثناء إضافة الموظف");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}
        >
          {error}
        </div>
      </div>
    );
  }

  const expiryColors = {
    ok: { color: "#059669" },
    warning: { color: "#EA580C" },
    expired: { color: "#DC2626" },
  };

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>
            موظفيني
          </h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            إدارة ومتابعة بيانات الموظفين
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MarsaButton onClick={() => setShowCompanyModal(true)}
            variant="secondary"
            icon={<Building2 size={18} />}
          >
            {companies.length === 0 ? "إضافة شركة" : "شركاتي"}
          </MarsaButton>
          {companies.length > 0 && (
            <MarsaButton onClick={() => setShowModal(true)} variant="gold" icon={<Plus size={18} />}>
              إضافة موظف
            </MarsaButton>
          )}
        </div>
      </div>

      {/* Employees Grid */}
      {employees.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(201,168,76,0.1)" }}
          >
            <Users size={32} style={{ color: "#C9A84C" }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            لا يوجد موظفون حالياً
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            أضف موظفيك لمتابعة بياناتهم وتواريخ وثائقهم
          </p>
          {companies.length === 0 && (
            <MarsaButton onClick={() => setShowCompanyModal(true)} variant="primary" icon={<Plus size={18} />} className="mt-4 mx-auto">
              إضافة شركة أولاً
            </MarsaButton>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {employees.map((emp) => {
            const residencyStatus = isExpiringSoon(emp.residencyExpiry);
            const insuranceStatus = isExpiringSoon(emp.insuranceExpiry);

            return (
              <div
                key={emp.id}
                className="rounded-2xl p-6 transition-all duration-300"
                style={{
                  backgroundColor: "white",
                  border: "1px solid #E2E0D8",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(27,42,74,0.1)";
                  e.currentTarget.style.borderColor = "#C9A84C";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.03)";
                  e.currentTarget.style.borderColor = "#E8E6F0";
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold" style={{ color: "#2D3748" }}>
                      {emp.name}
                    </h3>
                    {emp.jobTitle && (
                      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                        {emp.jobTitle}
                      </p>
                    )}
                  </div>
                  {emp.company && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold flex items-center gap-1"
                      style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}
                    >
                      <Building2 size={12} />
                      {emp.company.name}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  {emp.nationality && (
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#6B7280" }}>الجنسية</span>
                      <span style={{ color: "#2D3748" }}>{emp.nationality}</span>
                    </div>
                  )}
                  {emp.department && (
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#6B7280" }}>القسم</span>
                      <span style={{ color: "#2D3748" }}>{emp.department}</span>
                    </div>
                  )}
                  {emp.baseSalary != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: "#6B7280" }}>الراتب الأساسي</span>
                      <span className="font-semibold" style={{ color: "#C9A84C" }}>
                        {emp.baseSalary.toLocaleString("en-US")} <SarSymbol size={12} />
                      </span>
                    </div>
                  )}
                </div>

                {/* Contact */}
                <div className="space-y-1.5 mb-4">
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                      <Phone size={12} />
                      <span dir="ltr">{emp.phone}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                      <Mail size={12} />
                      <span>{emp.email}</span>
                    </div>
                  )}
                </div>

                {/* Expiry Dates */}
                <div className="pt-3 space-y-2" style={{ borderTop: "1px solid #F0EDE6" }}>
                  {emp.residencyExpiry && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1" style={{ color: "#6B7280" }}>
                        <Calendar size={12} />
                        انتهاء الإقامة
                      </span>
                      <span
                        className="flex items-center gap-1 font-semibold"
                        style={expiryColors[residencyStatus]}
                      >
                        {residencyStatus !== "ok" && <AlertTriangle size={12} />}
                        {formatDate(emp.residencyExpiry)}
                      </span>
                    </div>
                  )}
                  {emp.insuranceExpiry && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1" style={{ color: "#6B7280" }}>
                        <Calendar size={12} />
                        انتهاء التأمين
                      </span>
                      <span
                        className="flex items-center gap-1 font-semibold"
                        style={expiryColors[insuranceStatus]}
                      >
                        {insuranceStatus !== "ok" && <AlertTriangle size={12} />}
                        {formatDate(emp.insuranceExpiry)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="rounded-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
                إضافة موظف جديد
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
              >
                <X size={20} style={{ color: "#6B7280" }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name & Company */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الاسم <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الشركة <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={form.companyId}
                    onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748", backgroundColor: "white" }}
                  >
                    <option value="">اختر الشركة</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nationality & National ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الجنسية
                  </label>
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    رقم الهوية
                  </label>
                  <input
                    type="text"
                    value={form.nationalId}
                    onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
              </div>

              {/* Job Title & Department */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    القسم
                  </label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
              </div>

              {/* Salary */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الراتب الأساسي
                  </label>
                  <input
                    type="number"
                    value={form.baseSalary}
                    onChange={(e) => setForm((f) => ({ ...f, baseSalary: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    بدل سكن
                  </label>
                  <input
                    type="number"
                    value={form.housingAllowance}
                    onChange={(e) => setForm((f) => ({ ...f, housingAllowance: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    بدل نقل
                  </label>
                  <input
                    type="number"
                    value={form.transportAllowance}
                    onChange={(e) => setForm((f) => ({ ...f, transportAllowance: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    الهاتف
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                    onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                    onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    تاريخ التعيين
                  </label>
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    انتهاء الإقامة
                  </label>
                  <input
                    type="date"
                    value={form.residencyExpiry}
                    onChange={(e) => setForm((f) => ({ ...f, residencyExpiry: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                    انتهاء التأمين
                  </label>
                  <input
                    type="date"
                    value={form.insuranceExpiry}
                    onChange={(e) => setForm((f) => ({ ...f, insuranceExpiry: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <MarsaButton onClick={handleSubmit} disabled={!form.name || !form.companyId || submitting} variant="gold" loading={submitting} className="flex-1">
                إضافة
              </MarsaButton>
              <MarsaButton onClick={() => setShowModal(false)} variant="secondary" className="flex-1">
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl p-8 w-full max-w-md mx-4" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }} dir="rtl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>إضافة شركة</h2>
              <button onClick={() => setShowCompanyModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                <X size={20} style={{ color: "#6B7280" }} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>اسم الشركة <span style={{ color: "#DC2626" }}>*</span></label>
                <input type="text" value={companyForm.name} onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>السجل التجاري</label>
                <input type="text" value={companyForm.commercialRegister} onChange={(e) => setCompanyForm((f) => ({ ...f, commercialRegister: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>القطاع</label>
                <input type="text" value={companyForm.sector} onChange={(e) => setCompanyForm((f) => ({ ...f, sector: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <MarsaButton onClick={handleAddCompany} disabled={!companyForm.name || submittingCompany} variant="primary" loading={submittingCompany} className="flex-1">
                {submittingCompany ? "جاري الإضافة..." : "إضافة"}
              </MarsaButton>
              <MarsaButton onClick={() => setShowCompanyModal(false)} variant="secondary" className="flex-1">
                إلغاء
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
