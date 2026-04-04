"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  User,
  Phone,
  Building2,
  Briefcase,
  Filter,
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
  phone: string | null;
  email: string | null;
  status: string;
  baseSalary: number | null;
  company: { name: string };
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_LEAVE: { label: "إجازة", bg: "#FFF7ED", text: "#EA580C" },
  TERMINATED: { label: "منتهي", bg: "#FEF2F2", text: "#DC2626" },
};

const departments = ["الإدارة", "المالية", "الموارد البشرية", "التقنية", "التسويق", "العمليات"];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    fetchEmployees();
  }, []);

  function fetchEmployees() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterDept) params.set("department", filterDept);
    if (filterStatus) params.set("status", filterStatus);

    fetch(`/api/hr/employees?${params}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEmployees(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(fetchEmployees, 300);
    return () => clearTimeout(t);
  }, [search, filterDept, filterStatus]);

  return (
    <div className="p-8">
      {/* الهيدر */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>الموظفين</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            إدارة بيانات الموظفين ({employees.length} موظف)
          </p>
        </div>
        <MarsaButton href="/dashboard/hr/employees/new" variant="primary" size="lg" icon={<Plus size={18} />}>
          إضافة موظف
        </MarsaButton>
      </div>

      {/* البحث والفلاتر */}
      <div className="bg-white rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center" style={{ border: "1px solid #E2E0D8" }}>
        <div className="relative flex-1 min-w-[250px]">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#C9A84C" }} />
          <input
            type="text"
            placeholder="ابحث بالاسم أو رقم الهوية أو الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
            style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
            onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
            onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} style={{ color: "#94A3B8" }} />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white"
            style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
          >
            <option value="">كل الأقسام</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl border text-sm outline-none bg-white"
            style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
          >
            <option value="">كل الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="ON_LEAVE">إجازة</option>
            <option value="TERMINATED">منتهي</option>
          </select>
        </div>
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="flex justify-center py-20">
          <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <User size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا يوجد موظفين</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
                  {["الموظف", "القسم", "الوظيفة", "الجوال", "الراتب", "الحالة", ""].map((h, i) => (
                    <th key={i} className="text-right px-5 py-3.5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const st = statusConfig[emp.status] || statusConfig.ACTIVE;
                  return (
                    <tr
                      key={emp.id}
                      className="transition-colors hover:bg-gray-50/50"
                      style={{ borderBottom: "1px solid #F0EDE6" }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}>
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{emp.name}</p>
                            <p className="text-xs" style={{ color: "#2D3748", opacity: 0.5 }}>{emp.nationality || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748" }}>
                          <Building2 size={14} style={{ color: "#C9A84C" }} />
                          {emp.department || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748" }}>
                          <Briefcase size={14} style={{ color: "#94A3B8" }} />
                          {emp.jobTitle || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748" }}>
                          <Phone size={14} style={{ color: "#94A3B8" }} />
                          {emp.phone || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold flex items-center gap-1" style={{ color: "#1C1B2E" }}>
                          {emp.baseSalary ? <>{emp.baseSalary.toLocaleString("en-US")} <SarSymbol size={14} /></> : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <MarsaButton href={`/dashboard/hr/employees/${emp.id}`} variant="link" size="xs">
                          التفاصيل
                        </MarsaButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
