"use client";

import { useState, useEffect } from "react";
import { Clock, UserCheck, UserX, AlertTriangle } from "lucide-react";

interface AttendanceRecord {
  id: string; date: string; checkIn: string | null; checkOut: string | null; status: string;
  employee: { id: string; name: string; department: string | null; jobTitle: string | null };
}

const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  PRESENT: { label: "حاضر", bg: "#ECFDF5", text: "#059669", icon: UserCheck },
  ABSENT: { label: "غائب", bg: "#FEF2F2", text: "#DC2626", icon: UserX },
  LATE: { label: "متأخر", bg: "#FFF7ED", text: "#EA580C", icon: AlertTriangle },
  EXCUSED: { label: "مستأذن", bg: "#EFF6FF", text: "#2563EB", icon: Clock },
};

function fmtTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/hr/attendance?date=${selectedDate}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setRecords(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedDate]);

  const stats = {
    present: records.filter((r) => r.status === "PRESENT").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    excused: records.filter((r) => r.status === "EXCUSED").length,
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>الحضور والانصراف</h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>سجل الحضور اليومي للموظفين</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2.5 rounded-xl border-2 text-sm outline-none"
          style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
        />
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "حاضر", value: stats.present, icon: UserCheck, color: "#059669", bg: "rgba(5,150,105,0.08)" },
          { label: "غائب", value: stats.absent, icon: UserX, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
          { label: "متأخر", value: stats.late, icon: AlertTriangle, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
          { label: "مستأذن", value: stats.excused, icon: Clock, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.bg }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* الجدول */}
      {loading ? (
        <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : records.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Clock size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد سجلات لهذا اليوم</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          <table className="w-full">
            <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
              {["الموظف", "القسم", "الوظيفة", "الحضور", "الانصراف", "الحالة"].map((h, i) => (
                <th key={i} className="text-right px-5 py-3.5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {records.map((r) => {
                const st = statusConfig[r.status] || statusConfig.PRESENT;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-gray-50/50" style={{ borderBottom: "1px solid #F0EDE6" }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}>
                          {r.employee.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{r.employee.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm" style={{ color: "#2D3748" }}>{r.employee.department || "—"}</td>
                    <td className="px-5 py-4 text-sm" style={{ color: "#2D3748" }}>{r.employee.jobTitle || "—"}</td>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: "#059669" }}>{fmtTime(r.checkIn)}</td>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: "#DC2626" }}>{fmtTime(r.checkOut)}</td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium w-fit" style={{ backgroundColor: st.bg, color: st.text }}>
                        <st.icon size={12} /> {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
