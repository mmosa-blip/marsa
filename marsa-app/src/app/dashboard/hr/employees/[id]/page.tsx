"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, User, Phone, Mail, Building2, Briefcase,
  Calendar, CreditCard, Shield, Clock, MapPin, FileText,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

interface EmployeeDetail {
  id: string; name: string; nationality: string | null; nationalId: string | null;
  dateOfBirth: string | null; jobTitle: string | null; department: string | null;
  hireDate: string | null; baseSalary: number | null; housingAllowance: number | null;
  transportAllowance: number | null; phone: string | null; email: string | null;
  status: string; passportNumber: string | null; residencyExpiry: string | null;
  insuranceExpiry: string | null; company: { name: string };
  leaveRequests: { id: string; type: string; startDate: string; endDate: string; status: string; reason: string | null }[];
  attendances: { id: string; date: string; checkIn: string | null; checkOut: string | null; status: string }[];
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_LEAVE: { label: "إجازة", bg: "#FFF7ED", text: "#EA580C" },
  TERMINATED: { label: "منتهي", bg: "#FEF2F2", text: "#DC2626" },
};

const leaveTypeLabels: Record<string, string> = { ANNUAL: "سنوية", SICK: "مرضية", EMERGENCY: "طارئة" };
const leaveStatusLabels: Record<string, { label: string; color: string }> = {
  PENDING: { label: "معلقة", color: "#C9A84C" },
  APPROVED: { label: "موافق", color: "#059669" },
  REJECTED: { label: "مرفوضة", color: "#DC2626" },
};
const attStatusLabels: Record<string, { label: string; color: string }> = {
  PRESENT: { label: "حاضر", color: "#059669" },
  ABSENT: { label: "غائب", color: "#DC2626" },
  LATE: { label: "متأخر", color: "#EA580C" },
  EXCUSED: { label: "مستأذن", color: "#C9A84C" },
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" });
}
function fmtTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "leaves" | "attendance">("info");

  useEffect(() => {
    fetch(`/api/hr/employees/${id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setEmp(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;
  }
  if (!emp) {
    return <div className="flex items-center justify-center h-screen"><p className="text-lg" style={{ color: "#1C1B2E" }}>الموظف غير موجود</p></div>;
  }

  const st = statusConfig[emp.status] || statusConfig.ACTIVE;
  const totalSalary = (emp.baseSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);

  function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 py-3" style={{ borderBottom: "1px solid #F0EDE6" }}>
        <Icon size={16} style={{ color: "#C9A84C" }} />
        <span className="text-sm flex-1" style={{ color: "#2D3748", opacity: 0.6 }}>{label}</span>
        <span className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{value}</span>
      </div>
    );
  }

  return (
    <div className="p-8">
      <button onClick={() => router.push("/dashboard/hr/employees")} className="flex items-center gap-2 text-sm mb-6" style={{ color: "#2D3748", opacity: 0.5 }}>
        <ArrowRight size={16} /> العودة للموظفين
      </button>

      {/* رأس الملف */}
      <div className="bg-white rounded-2xl p-6 mb-6" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}>
            <User size={36} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{emp.name}</h1>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
            </div>
            <p className="text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>
              {emp.jobTitle || "—"} • {emp.department || "—"} • {emp.company.name}
            </p>
          </div>
          <div className="text-left">
            <p className="text-xs" style={{ color: "#2D3748", opacity: 0.5 }}>إجمالي الراتب</p>
            <p className="text-2xl font-bold flex items-center gap-1" style={{ color: "#1C1B2E" }}>{totalSalary.toLocaleString("en-US")} <SarSymbol size={18} /></p>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl p-1" style={{ border: "1px solid #E2E0D8" }}>
        {([["info", "المعلومات"], ["leaves", "الإجازات"], ["attendance", "الحضور"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={tab === key ? { backgroundColor: "#5E5495", color: "white" } : { color: "#2D3748" }}>
            {label}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      {tab === "info" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات الشخصية</h2>
            <InfoRow icon={MapPin} label="الجنسية" value={emp.nationality || "—"} />
            <InfoRow icon={CreditCard} label="رقم الهوية" value={emp.nationalId || "—"} />
            <InfoRow icon={Calendar} label="تاريخ الميلاد" value={fmt(emp.dateOfBirth)} />
            <InfoRow icon={FileText} label="رقم الجواز" value={emp.passportNumber || "—"} />
            <InfoRow icon={Phone} label="الجوال" value={emp.phone || "—"} />
            <InfoRow icon={Mail} label="البريد" value={emp.email || "—"} />
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات الوظيفية</h2>
              <InfoRow icon={Building2} label="الشركة" value={emp.company.name} />
              <InfoRow icon={Briefcase} label="الوظيفة" value={emp.jobTitle || "—"} />
              <InfoRow icon={Building2} label="القسم" value={emp.department || "—"} />
              <InfoRow icon={Calendar} label="تاريخ التعيين" value={fmt(emp.hireDate)} />
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>البيانات المالية</h2>
              <InfoRow icon={CreditCard} label="الراتب الأساسي" value={<>{(emp.baseSalary || 0).toLocaleString("en-US")} <SarSymbol size={14} /></>} />
              <InfoRow icon={CreditCard} label="بدل السكن" value={<>{(emp.housingAllowance || 0).toLocaleString("en-US")} <SarSymbol size={14} /></>} />
              <InfoRow icon={CreditCard} label="بدل المواصلات" value={<>{(emp.transportAllowance || 0).toLocaleString("en-US")} <SarSymbol size={14} /></>} />
            </div>
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>تواريخ مهمة</h2>
              <InfoRow icon={Shield} label="انتهاء الإقامة" value={fmt(emp.residencyExpiry)} />
              <InfoRow icon={Clock} label="انتهاء التأمين" value={fmt(emp.insuranceExpiry)} />
            </div>
          </div>
        </div>
      )}

      {tab === "leaves" && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          {emp.leaveRequests.length === 0 ? (
            <div className="text-center py-12"><p className="text-sm" style={{ color: "#2D3748", opacity: 0.5 }}>لا توجد طلبات إجازة</p></div>
          ) : (
            <table className="w-full">
              <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
                {["النوع", "من", "إلى", "السبب", "الحالة"].map((h, i) => (
                  <th key={i} className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {emp.leaveRequests.map((l) => {
                  const ls = leaveStatusLabels[l.status] || leaveStatusLabels.PENDING;
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{leaveTypeLabels[l.type] || l.type}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{fmt(l.startDate)}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{fmt(l.endDate)}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748", opacity: 0.6 }}>{l.reason || "—"}</td>
                      <td className="px-5 py-3"><span className="text-xs font-medium" style={{ color: ls.color }}>{ls.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          {emp.attendances.length === 0 ? (
            <div className="text-center py-12"><p className="text-sm" style={{ color: "#2D3748", opacity: 0.5 }}>لا توجد سجلات حضور</p></div>
          ) : (
            <table className="w-full">
              <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
                {["التاريخ", "الحضور", "الانصراف", "الحالة"].map((h, i) => (
                  <th key={i} className="text-right px-5 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {emp.attendances.map((a) => {
                  const as2 = attStatusLabels[a.status] || attStatusLabels.PRESENT;
                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-3 text-sm" style={{ color: "#2D3748" }}>{fmt(a.date)}</td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: "#059669" }}>{fmtTime(a.checkIn)}</td>
                      <td className="px-5 py-3 text-sm font-medium" style={{ color: "#DC2626" }}>{fmtTime(a.checkOut)}</td>
                      <td className="px-5 py-3"><span className="text-xs font-medium" style={{ color: as2.color }}>{as2.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
