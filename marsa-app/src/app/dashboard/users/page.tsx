"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Users2, Search, Filter, UserPlus, ShieldCheck, UserCog,
  Briefcase, Handshake, Edit3, Ban, CheckCircle, Trash2, Loader2, Download,
} from "lucide-react";
import { exportToExcel } from "@/lib/export-utils";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  companyName: string | null;
  isActive: boolean;
  createdAt: string;
  ownedCompanies?: { name: string }[];
}

const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
  ADMIN: { label: "مدير النظام", bg: "#FEF2F2", text: "#DC2626" },
  MANAGER: { label: "مشرف", bg: "#EFF6FF", text: "#2563EB" },
  FINANCE_MANAGER: { label: "مدير مالي", bg: "#ECFDF5", text: "#059669" },
  TREASURY_MANAGER: { label: "أمين صندوق", bg: "#F5F3FF", text: "#7C3AED" },
  EXECUTOR: { label: "منفذ", bg: "#FFF7ED", text: "#EA580C" },
  CLIENT: { label: "عميل", bg: "#ECFDF5", text: "#059669" },
  EXTERNAL_PROVIDER: { label: "مقدم خدمة خارجي", bg: "#FDF2F8", text: "#DB2777" },
};

const allRoles = Object.keys(roleConfig);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: session } = useSession();

  // Edit modal state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", role: "", password: "", isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  useEffect(() => { document.title = "إدارة المستخدمين | مرسى"; }, []);

  const fetchUsers = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter) params.set("role", roleFilter);
    if (search) params.set("search", search);
    if (statusFilter) params.set("isActive", statusFilter);

    fetch(`/api/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setUsers(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const timer = setTimeout(fetchUsers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [roleFilter, statusFilter, search]);

  const totalUsers = users.length;
  const adminsManagers = users.filter((u) => u.role === "ADMIN" || u.role === "MANAGER").length;
  const executors = users.filter((u) => u.role === "EXECUTOR").length;
  const clients = users.filter((u) => u.role === "CLIENT").length;
  const providers = users.filter((u) => u.role === "EXTERNAL_PROVIDER").length;

  const stats = [
    { label: "إجمالي المستخدمين", value: totalUsers, icon: Users2, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "المدراء والمشرفين", value: adminsManagers, icon: ShieldCheck, color: "#DC2626", bg: "rgba(220,38,38,0.06)" },
    { label: "المنفذين", value: executors, icon: UserCog, color: "#EA580C", bg: "rgba(234,88,12,0.06)" },
    { label: "العملاء", value: clients, icon: Briefcase, color: "#059669", bg: "rgba(5,150,105,0.06)" },
    { label: "مقدمي الخدمات", value: providers, icon: Handshake, color: "#DB2777", bg: "rgba(219,39,119,0.06)" },
  ];

  const handleToggleStatus = async (userId: string) => {
    if (actionLoading) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}/toggle-status`, { method: "PATCH" });
      if (res.ok) fetchUsers();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (actionLoading) return;
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${userName}"؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      password: "",
      isActive: user.isActive,
    });
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    setEditError("");
    try {
      const payload: Record<string, unknown> = {};
      if (editForm.name !== editingUser.name) payload.name = editForm.name;
      if (editForm.email !== editingUser.email) payload.email = editForm.email;
      if (editForm.phone !== (editingUser.phone || "")) payload.phone = editForm.phone || null;
      if (editForm.role !== editingUser.role) payload.role = editForm.role;
      if (editForm.isActive !== editingUser.isActive) payload.isActive = editForm.isActive;
      if (editForm.password) payload.password = editForm.password;

      if (Object.keys(payload).length === 0) {
        setEditingUser(null);
        return;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const data = await res.json();
        setEditError(data.error || "حدث خطأ");
      }
    } catch {
      setEditError("حدث خطأ في الاتصال");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إدارة المستخدمين
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            عرض وإدارة جميع مستخدمي النظام
          </p>
        </div>
        <Link
          href="/dashboard/users/new"
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all"
          style={{ backgroundColor: "#C9A84C", boxShadow: "0 4px 12px rgba(201,168,76,0.25)" }}
        >
          <UserPlus size={18} />
          إضافة مستخدم
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>
                {s.label}
              </span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: s.bg }}
              >
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value.toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <button
          onClick={() => {
            const headers = [
              { key: "name", label: "الاسم" },
              { key: "email", label: "البريد الإلكتروني" },
              { key: "role", label: "الدور" },
              { key: "status", label: "الحالة" },
              { key: "createdAt", label: "تاريخ التسجيل" },
            ];
            const rows = users.map((u) => ({
              name: u.name,
              email: u.email,
              role: (roleConfig[u.role]?.label) || u.role,
              status: u.isActive ? "نشط" : "معطل",
              createdAt: formatDate(u.createdAt),
            }));
            exportToExcel(rows, headers, "users");
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "#5E5495" }}
        >
          <Download size={16} />
          تصدير Excel
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={16} style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو البريد الإلكتروني..."
            className="flex-1 py-2 text-sm outline-none"
            style={{ color: "#2D3748", backgroundColor: "transparent" }}
          />
        </div>
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">كل الأدوار</option>
          {allRoles.map((r) => (
            <option key={r} value={r}>
              {roleConfig[r].label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">الكل</option>
          <option value="true">نشط</option>
          <option value="false">معطل</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
        </div>
      ) : users.length === 0 ? (
        <div
          className="text-center py-20 bg-white rounded-2xl"
          style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <Users2 size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>
            لا يوجد مستخدمين
          </p>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>
            قم بإضافة مستخدم جديد للبدء
          </p>
        </div>
      ) : (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الاسم
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الدور
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الشركة
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الحالة
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    تاريخ التسجيل
                  </th>
                  <th className="text-center px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const role = roleConfig[user.role] || {
                    label: user.role,
                    bg: "#F3F4F6",
                    text: "#6B7280",
                  };
                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-[#FAFAF8]"
                      style={{ borderBottom: "1px solid #F0EDE6" }}
                    >
                      {/* Name + Email */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
                              {user.name}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Role */}
                      <td className="px-5 py-4">
                        <span
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: role.bg, color: role.text }}
                        >
                          {role.label}
                        </span>
                      </td>
                      {/* Company */}
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: "#2D3748" }}>
                          {user.companyName || "—"}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span
                          className="px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={
                            user.isActive
                              ? { backgroundColor: "#ECFDF5", color: "#059669" }
                              : { backgroundColor: "#FEF2F2", color: "#DC2626" }
                          }
                        >
                          {user.isActive ? "نشط" : "معطل"}
                        </span>
                      </td>
                      {/* Date */}
                      <td className="px-5 py-4">
                        <span className="text-sm" style={{ color: "#2D3748" }}>
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#EFF6FF]"
                            title="تعديل"
                          >
                            <Edit3 size={16} style={{ color: "#2563EB" }} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            disabled={actionLoading === user.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#FFF7ED] disabled:opacity-50"
                            title={user.isActive ? "تعطيل" : "تفعيل"}
                          >
                            {user.isActive ? (
                              <Ban size={16} style={{ color: "#EA580C" }} />
                            ) : (
                              <CheckCircle size={16} style={{ color: "#059669" }} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            disabled={actionLoading === user.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#FEF2F2] disabled:opacity-50"
                            title="حذف"
                          >
                            <Trash2 size={16} style={{ color: "#DC2626" }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 mx-4" dir="rtl" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تعديل المستخدم</h2>
              <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <Ban size={18} style={{ color: "#94A3B8" }} />
              </button>
            </div>
            {editError && <p className="text-sm text-red-600 mb-3 bg-red-50 p-2 rounded-lg">{editError}</p>}
            <div className="space-y-3">
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "#6B7280" }}>الاسم الكامل</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
              </div>
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "#6B7280" }}>البريد الإلكتروني</label>
                <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr" />
              </div>
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "#6B7280" }}>رقم الجوال</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr" />
              </div>
              {session?.user?.role === "ADMIN" && (
                <div>
                  <label className="block text-xs mb-1 font-medium" style={{ color: "#6B7280" }}>الدور</label>
                  <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: "1px solid #E2E0D8" }}>
                    <option value="ADMIN">مدير النظام</option>
                    <option value="MANAGER">مشرف</option>
                    <option value="FINANCE_MANAGER">مدير مالي</option>
                    <option value="TREASURY_MANAGER">أمين صندوق</option>
                    <option value="EXECUTOR">منفذ</option>
                    <option value="CLIENT">عميل</option>
                    <option value="EXTERNAL_PROVIDER">مقدم خدمة خارجي</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs mb-1 font-medium" style={{ color: "#6B7280" }}>كلمة مرور جديدة (اختياري)</label>
                <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr" />
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: "#1C1B2E" }}>حساب نشط</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveEdit} disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#5E5495" }}>
                {editSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
              <button onClick={() => setEditingUser(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ border: "1px solid #E2E0D8", color: "#6B7280" }}>
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
