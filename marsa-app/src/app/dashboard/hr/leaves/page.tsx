"use client";

import { useState, useEffect } from "react";
import { Calendar, CheckCircle, XCircle, Clock } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Leave {
  id: string; type: string; startDate: string; endDate: string; status: string; reason: string | null;
  employee: { id: string; name: string; department: string | null };
}

const typeLabels: Record<string, string> = { ANNUAL: "سنوية", SICK: "مرضية", EMERGENCY: "طارئة" };
const statusConfig: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  PENDING: { label: "معلقة", bg: "#FFF7ED", text: "#C9A84C", icon: Clock },
  APPROVED: { label: "موافق عليها", bg: "#ECFDF5", text: "#059669", icon: CheckCircle },
  REJECTED: { label: "مرفوضة", bg: "#FEF2F2", text: "#DC2626", icon: XCircle },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/hr/leaves")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setLeaves(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleAction(id: string, status: string) {
    const res = await fetch(`/api/hr/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setLeaves(leaves.map((l) => l.id === id ? { ...l, status } : l));
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>طلبات الإجازات</h1>
        <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>مراجعة وإدارة طلبات الإجازات</p>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "معلقة", count: leaves.filter((l) => l.status === "PENDING").length, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
          { label: "موافق عليها", count: leaves.filter((l) => l.status === "APPROVED").length, color: "#059669", bg: "rgba(5,150,105,0.08)" },
          { label: "مرفوضة", count: leaves.filter((l) => l.status === "REJECTED").length, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
            <p className="text-xs mb-2" style={{ color: "#2D3748", opacity: 0.6 }}>{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
          <Calendar size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>لا توجد طلبات إجازة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map((leave) => {
            const st = statusConfig[leave.status] || statusConfig.PENDING;
            const days = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / 86400000) + 1;
            return (
              <div key={leave.id} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: "rgba(27,42,74,0.06)", color: "#1C1B2E" }}>
                      {leave.employee.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{leave.employee.name}</p>
                      <p className="text-xs" style={{ color: "#2D3748", opacity: 0.5 }}>{leave.employee.department || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: "rgba(27,42,74,0.04)", color: "#1C1B2E" }}>
                      {typeLabels[leave.type] || leave.type}
                    </span>
                    <span className="text-sm" style={{ color: "#2D3748" }}>
                      {fmt(leave.startDate)} — {fmt(leave.endDate)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#F0EEF5", color: "#2D3748" }}>
                      {days} يوم
                    </span>
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: st.bg, color: st.text }}>
                      <st.icon size={12} /> {st.label}
                    </span>
                    {leave.status === "PENDING" && (
                      <div className="flex gap-2 mr-2">
                        <MarsaButton onClick={() => handleAction(leave.id, "APPROVED")} variant="gold" size="sm" style={{ backgroundColor: "#059669" }}>قبول</MarsaButton>
                        <MarsaButton onClick={() => handleAction(leave.id, "REJECTED")} variant="danger" size="sm">رفض</MarsaButton>
                      </div>
                    )}
                  </div>
                </div>
                {leave.reason && <p className="text-xs mt-3 pr-16" style={{ color: "#2D3748", opacity: 0.5 }}>السبب: {leave.reason}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
