"use client";

import { useState, useEffect, useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import {
  ShieldCheck,
  Search,
  Loader2,
  Save,
  ChevronDown,
  X,
  CheckSquare,
  Square,
  Zap,
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  permCount?: number;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  module: string;
}

const roleLabels: Record<string, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مدير",
  EXECUTOR: "منفذ",
  EXTERNAL_PROVIDER: "مزود خدمات",
  FINANCE_MANAGER: "مدير مالي",
  TREASURY_MANAGER: "مدير خزينة",
};

const roleBadgeColors: Record<string, { bg: string; text: string }> = {
  ADMIN: { bg: "#FEF2F2", text: "#DC2626" },
  MANAGER: { bg: "#EFF6FF", text: "#2563EB" },
  EXECUTOR: { bg: "#F5F3FF", text: "#7C3AED" },
  EXTERNAL_PROVIDER: { bg: "#FFF7ED", text: "#EA580C" },
  FINANCE_MANAGER: { bg: "#ECFDF5", text: "#059669" },
  TREASURY_MANAGER: { bg: "#ECFDF5", text: "#059669" },
};

const presets: { label: string; keys: string[] }[] = [
  {
    label: "basic",
    keys: ["tasks.view", "tasks.update_status", "projects.view", "clients.view"],
  },
  {
    label: "advanced",
    keys: [
      "tasks.view", "tasks.update_status", "tasks.transfer", "tasks.assign",
      "projects.view", "clients.view", "clients.create", "contracts.view",
    ],
  },
  {
    label: "manager",
    keys: [
      "tasks.view", "tasks.update_status", "tasks.transfer", "tasks.assign",
      "projects.view", "projects.create", "projects.edit",
      "clients.view", "clients.create",
      "contracts.view", "contracts.create",
      "finance.view",
    ],
  },
];

export default function PermissionsPage() {
  const { t } = useLang();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState("");

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [grouped, setGrouped] = useState<Record<string, Permission[]>>({});
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [originalKeys, setOriginalKeys] = useState<Set<string>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    document.title = `${t.permissions.title} | مرسى`;
  }, []);

  // Fetch users (non-CLIENT)
  useEffect(() => {
    setLoadingUsers(true);
    fetch("/api/users?excludeRole=CLIENT")
      .then((r) => r.json())
      .then(async (data) => {
        const list: UserItem[] = (Array.isArray(data) ? data : data.users || [])
          .filter((u: UserItem) => u.role !== "CLIENT");

        // Fetch permission counts
        const withCounts = await Promise.all(
          list.map(async (u) => {
            try {
              const r = await fetch(`/api/users/${u.id}/permissions`);
              const d = await r.json();
              return { ...u, permCount: d.permissionKeys?.length || 0 };
            } catch {
              return { ...u, permCount: 0 };
            }
          })
        );
        setUsers(withCounts);
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [saveSuccess]);

  // Fetch all permissions
  useEffect(() => {
    fetch("/api/permissions")
      .then((r) => r.json())
      .then((data) => {
        if (data.permissions) setAllPermissions(data.permissions);
        if (data.grouped) {
          setGrouped(data.grouped);
          setOpenModules(new Set(Object.keys(data.grouped)));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch selected user's permissions
  useEffect(() => {
    if (!selectedUserId) return;
    setLoadingPerms(true);
    fetch(`/api/users/${selectedUserId}/permissions`)
      .then((r) => r.json())
      .then((data) => {
        const keys = new Set<string>(data.permissionKeys || []);
        setCheckedKeys(keys);
        setOriginalKeys(new Set(keys));
      })
      .catch(() => {})
      .finally(() => setLoadingPerms(false));
  }, [selectedUserId]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const hasChanges = useMemo(() => {
    if (checkedKeys.size !== originalKeys.size) return true;
    for (const k of checkedKeys) {
      if (!originalKeys.has(k)) return true;
    }
    return false;
  }, [checkedKeys, originalKeys]);

  const toggleKey = (key: string) => {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setCheckedKeys(new Set(allPermissions.map((p) => p.key)));
  };

  const clearAll = () => {
    setCheckedKeys(new Set());
  };

  const applyPreset = (keys: string[]) => {
    setCheckedKeys(new Set(keys));
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${selectedUserId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: Array.from(checkedKeys) }),
      });
      if (res.ok) {
        const data = await res.json();
        const keys = new Set<string>(data.permissionKeys || []);
        setCheckedKeys(keys);
        setOriginalKeys(new Set(keys));
        setSaveSuccess((p) => !p);
      }
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const toggleModule = (mod: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  const filteredUsers = userSearch.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(userSearch.toLowerCase()))
    : users;

  return (
    <div className="p-6 lg:p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={24} style={{ color: "#5E5495" }} />
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{t.permissions.title}</h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ═══ Right panel: Users list ═══ */}
        <div className="w-full lg:w-[340px] flex-shrink-0">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
            <div className="p-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t.permissions.searchUsers}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8" }}
                />
              </div>
            </div>

            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: "#94A3B8" }}>لا يوجد مستخدمون</div>
              ) : (
                filteredUsers.map((u) => {
                  const badge = roleBadgeColors[u.role] || { bg: "#F3F4F6", text: "#6B7280" };
                  const isSelected = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-right transition-colors"
                      style={{
                        backgroundColor: isSelected ? "rgba(94,84,149,0.08)" : "transparent",
                        borderBottom: "1px solid #F0EDE6",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: isSelected ? "#5E5495" : "rgba(94,84,149,0.1)", color: isSelected ? "#fff" : "#5E5495" }}
                      >
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "#1C1B2E" }}>{u.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: badge.bg, color: badge.text }}>
                            {roleLabels[u.role] || u.role}
                          </span>
                          {(u.permCount ?? 0) > 0 && (
                            <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>
                              {u.permCount} صلاحية
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ═══ Left panel: Permissions matrix ═══ */}
        <div className="flex-1">
          {!selectedUserId ? (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid #E2E0D8" }}>
              <ShieldCheck size={40} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.5 }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>اختر مستخدماً</h3>
              <p className="text-sm" style={{ color: "#94A3B8" }}>اختر مستخدماً من القائمة لتعديل صلاحياته</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-3 p-5" style={{ borderBottom: "1px solid #F0EDE6" }}>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                    {t.permissions.userPermissions}: {selectedUser?.name}
                  </h2>
                  {selectedUser && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: (roleBadgeColors[selectedUser.role] || { bg: "#F3F4F6" }).bg, color: (roleBadgeColors[selectedUser.role] || { text: "#6B7280" }).text }}>
                      {roleLabels[selectedUser.role] || selectedUser.role}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-40"
                  style={{ backgroundColor: "#059669" }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {t.permissions.savePermissions}
                </button>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 flex-wrap px-5 py-3" style={{ borderBottom: "1px solid #F0EDE6" }}>
                <button onClick={selectAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-50"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}>
                  <CheckSquare size={13} /> {t.permissions.selectAll}
                </button>
                <button onClick={clearAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-50"
                  style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}>
                  <Square size={13} /> {t.permissions.clearAll}
                </button>
                <div className="w-px h-5" style={{ backgroundColor: "#E2E0D8" }} />
                {presets.map((preset) => (
                  <button key={preset.label} onClick={() => applyPreset(preset.keys)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:opacity-90"
                    style={{ backgroundColor: "rgba(94,84,149,0.08)", color: "#5E5495" }}>
                    <Zap size={12} /> {t.permissions.presets[preset.label as keyof typeof t.permissions.presets]}
                  </button>
                ))}
              </div>

              {/* Permission modules */}
              {loadingPerms ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={28} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : (
                <div className="p-5 space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto">
                  {Object.entries(grouped).map(([module, perms]) => {
                    const isOpen = openModules.has(module);
                    const checkedCount = perms.filter((p) => checkedKeys.has(p.key)).length;

                    return (
                      <div key={module} className="rounded-xl overflow-hidden" style={{ border: "1px solid #F0EDE6" }}>
                        <button
                          onClick={() => toggleModule(module)}
                          className="flex items-center justify-between w-full px-4 py-3 text-right transition-colors hover:bg-gray-50"
                          style={{ backgroundColor: "#FAFAFE" }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{module}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: checkedCount > 0 ? "rgba(5,150,105,0.1)" : "#F3F4F6", color: checkedCount > 0 ? "#059669" : "#94A3B8" }}>
                              {checkedCount}/{perms.length}
                            </span>
                          </div>
                          <ChevronDown size={16} style={{ color: "#94A3B8", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
                        </button>

                        {isOpen && (
                          <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" style={{ borderTop: "1px solid #F0EDE6" }}>
                            {perms.map((perm) => {
                              const isChecked = checkedKeys.has(perm.key);
                              return (
                                <label
                                  key={perm.key}
                                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
                                  style={{ backgroundColor: isChecked ? "rgba(5,150,105,0.04)" : "transparent", border: `1px solid ${isChecked ? "rgba(5,150,105,0.2)" : "transparent"}` }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleKey(perm.key)}
                                    className="w-4 h-4 rounded accent-green-600"
                                  />
                                  <span className="text-sm" style={{ color: "#1C1B2E" }}>{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
