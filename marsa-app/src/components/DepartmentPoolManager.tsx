"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Shuffle,
  Layers,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Department {
  id: string;
  name: string;
  color: string | null;
}

interface UserLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface PoolMember {
  id: string;
  userId: string;
  mode: "ROUND_ROBIN" | "ALL";
  order: number;
  lastAssigned: string | null;
  user: UserLite;
}

export default function DepartmentPoolManager() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [poolsByDept, setPoolsByDept] = useState<Record<string, PoolMember[]>>({});
  const [allUsers, setAllUsers] = useState<UserLite[]>([]);
  const [addTarget, setAddTarget] = useState<Record<string, string>>({});
  const [savingDept, setSavingDept] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [depRes, usersRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/users?transferTargets=true"),
      ]);
      const depData = depRes.ok ? await depRes.json() : [];
      const usersData = usersRes.ok ? await usersRes.json() : [];
      const deps: Department[] = Array.isArray(depData) ? depData : [];
      const users: UserLite[] = Array.isArray(usersData) ? usersData : (usersData?.users ?? []);
      setDepartments(deps);
      setAllUsers(users);

      // Fetch each department's pool in parallel
      const pools = await Promise.all(
        deps.map((d) =>
          fetch(`/api/departments/${d.id}/assignment-pool`)
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => [])
        )
      );
      const byDept: Record<string, PoolMember[]> = {};
      deps.forEach((d, i) => {
        byDept[d.id] = Array.isArray(pools[i]) ? pools[i] : [];
      });
      setPoolsByDept(byDept);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && departments.length === 0) loadAll();
  }, [expanded, departments.length, loadAll]);

  const addMember = async (deptId: string) => {
    const userId = addTarget[deptId];
    if (!userId) return;
    setSavingDept(deptId);
    try {
      const currentMode = (poolsByDept[deptId]?.[0]?.mode as "ROUND_ROBIN" | "ALL") || "ROUND_ROBIN";
      const res = await fetch(`/api/departments/${deptId}/assignment-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, mode: currentMode }),
      });
      if (res.ok) {
        const created = (await res.json()) as PoolMember;
        setPoolsByDept((prev) => ({
          ...prev,
          [deptId]: [...(prev[deptId] || []), created],
        }));
        setAddTarget((prev) => ({ ...prev, [deptId]: "" }));
      }
    } finally {
      setSavingDept(null);
    }
  };

  const removeMember = async (deptId: string, userId: string) => {
    if (!confirm("حذف هذا العضو من فريق التوزيع؟")) return;
    setSavingDept(deptId);
    try {
      const res = await fetch(`/api/departments/${deptId}/assignment-pool/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPoolsByDept((prev) => ({
          ...prev,
          [deptId]: (prev[deptId] || []).filter((m) => m.userId !== userId),
        }));
      }
    } finally {
      setSavingDept(null);
    }
  };

  const setMode = async (deptId: string, newMode: "ROUND_ROBIN" | "ALL") => {
    const members = poolsByDept[deptId] || [];
    if (members.length === 0) return;
    setSavingDept(deptId);
    try {
      // Re-upsert the first member with applyModeToAll=true so the server
      // updates every pool member's mode atomically.
      await fetch(`/api/departments/${deptId}/assignment-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: members[0].userId,
          mode: newMode,
          applyModeToAll: true,
        }),
      });
      setPoolsByDept((prev) => ({
        ...prev,
        [deptId]: (prev[deptId] || []).map((m) => ({ ...m, mode: newMode })),
      }));
    } finally {
      setSavingDept(null);
    }
  };

  return (
    <div
      className="mt-8 bg-white rounded-2xl p-6"
      dir="rtl"
      style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(94,84,149,0.12)" }}
          >
            <Users size={20} style={{ color: "#5E5495" }} />
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
              فريق المشاريع الافتراضي
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#2D3748", opacity: 0.6 }}>
              توزيع تلقائي للمشاريع عند الإنشاء لكل قسم
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="mt-6">
          {loading && departments.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : departments.length === 0 ? (
            <p className="text-sm text-gray-500">لا توجد أقسام.</p>
          ) : (
            <div className="space-y-4">
              {departments.map((dept) => {
                const members = poolsByDept[dept.id] || [];
                const currentMode = (members[0]?.mode as "ROUND_ROBIN" | "ALL") || "ROUND_ROBIN";
                const available = allUsers.filter(
                  (u) => !members.some((m) => m.userId === u.id)
                );
                return (
                  <div
                    key={dept.id}
                    className="rounded-xl p-4"
                    style={{ border: "1px solid #F0EDE6", backgroundColor: "#FAFAF7" }}
                  >
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Layers size={16} style={{ color: dept.color || "#5E5495" }} />
                        <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                          {dept.name}
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white text-gray-500">
                          {members.length} عضو
                        </span>
                      </div>

                      <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: "#F3F2EE" }}>
                        <button
                          type="button"
                          disabled={members.length === 0 || savingDept === dept.id}
                          onClick={() => setMode(dept.id, "ROUND_ROBIN")}
                          className="text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors"
                          style={
                            currentMode === "ROUND_ROBIN"
                              ? { backgroundColor: "#C9A84C", color: "white" }
                              : { color: "#6B7280" }
                          }
                        >
                          <Shuffle size={12} />
                          توزيع دوري
                        </button>
                        <button
                          type="button"
                          disabled={members.length === 0 || savingDept === dept.id}
                          onClick={() => setMode(dept.id, "ALL")}
                          className="text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors"
                          style={
                            currentMode === "ALL"
                              ? { backgroundColor: "#5E5495", color: "white" }
                              : { color: "#6B7280" }
                          }
                        >
                          <Users size={12} />
                          كل الفريق
                        </button>
                      </div>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-xs text-gray-400 mb-3">
                        لا يوجد فريق افتراضي. المشاريع الجديدة ستُسند لمُنشئها.
                      </p>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white"
                            style={{ border: "1px solid #F0EDE6" }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                style={{ backgroundColor: "#5E5495" }}
                              >
                                {(m.user.name || "?").slice(0, 2)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: "#1C1B2E" }}>
                                  {m.user.name}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {m.user.role}
                                  {m.lastAssigned && (
                                    <>
                                      {" · "}
                                      آخر إسناد:{" "}
                                      {new Date(m.lastAssigned).toLocaleDateString("ar-SA-u-nu-latn", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMember(dept.id, m.userId)}
                              disabled={savingDept === dept.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <select
                        value={addTarget[dept.id] || ""}
                        onChange={(e) =>
                          setAddTarget((prev) => ({ ...prev, [dept.id]: e.target.value }))
                        }
                        className="flex-1 px-3 py-2 rounded-lg text-xs outline-none bg-white"
                        style={{ border: "1px solid #E2E0D8" }}
                      >
                        <option value="">— اختر مستخدماً لإضافته —</option>
                        {available.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                      <MarsaButton
                        variant="primary"
                        size="sm"
                        onClick={() => addMember(dept.id)}
                        disabled={!addTarget[dept.id] || savingDept === dept.id}
                        icon={<UserPlus size={13} />}
                      >
                        إضافة
                      </MarsaButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
