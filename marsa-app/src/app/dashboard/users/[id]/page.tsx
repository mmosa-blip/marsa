"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Edit3,
  Loader2,
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Receipt,
  FolderOpen,
  Star,
  Banknote,
  Building2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

/* ── role config (same as users list page) ── */
const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
  ADMIN: { label: "مدير النظام", bg: "#FEF2F2", text: "#DC2626" },
  MANAGER: { label: "مشرف", bg: "#EFF6FF", text: "#2563EB" },
  FINANCE_MANAGER: { label: "مدير مالي", bg: "#ECFDF5", text: "#059669" },
  TREASURY_MANAGER: { label: "أمين صندوق", bg: "#F5F3FF", text: "#7C3AED" },
  EXECUTOR: { label: "منفذ", bg: "#FFF7ED", text: "#EA580C" },
  CLIENT: { label: "عميل", bg: "#ECFDF5", text: "#059669" },
  EXTERNAL_PROVIDER: { label: "مقدم خدمة خارجي", bg: "#FDF2F8", text: "#DB2777" },
};

const taskStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO: { label: "قيد الانتظار", bg: "#F3F4F6", text: "#6B7280" },
  IN_PROGRESS: { label: "جاري التنفيذ", bg: "#EFF6FF", text: "#2563EB" },
  IN_REVIEW: { label: "قيد المراجعة", bg: "#FFF7ED", text: "#EA580C" },
  DONE: { label: "مكتمل", bg: "#ECFDF5", text: "#059669" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};

const projectStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#EFF6FF", text: "#2563EB" },
  ON_HOLD: { label: "معلق", bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { label: "مكتمل", bg: "#ECFDF5", text: "#059669" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};

const invoiceStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  SENT: { label: "مرسلة", bg: "#EFF6FF", text: "#2563EB" },
  PAID: { label: "مدفوعة", bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخرة", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "ملغية", bg: "#FEF2F2", text: "#DC2626" },
};

/* ── helpers ── */
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0].charAt(0) + parts[1].charAt(0);
  return name.charAt(0);
};

/* ── types ── */
interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  isExternal: boolean;
  createdAt: string;
  updatedAt: string;
  authorizationType: string;
  specialization: string | null;
  costPerTask: number | null;
  bankName: string | null;
  bankIban: string | null;
  supervisorId: string | null;
  supervisor: { id: string; name: string } | null;
  // Provider / Executor data
  stats?: {
    assignedTasks?: number;
    completedTasks?: number;
    inProgressTasks?: number;
    rejections?: number;
    projects?: number;
    services?: number;
    invoices?: number;
    documents?: number;
  };
  providedServices?: Array<{
    id: string;
    isActive: boolean;
    priority: number;
    serviceTemplate: {
      id: string;
      name: string;
      category: { id: string; name: string };
    };
  }>;
  recentTasks?: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    createdAt: string;
    project: { id: string; name: string };
  }>;
  taskRejections?: Array<{
    id: string;
    reason: string;
    createdAt: string;
    task: { id: string; title: string };
  }>;
  // Client data
  recentProjects?: Array<{
    id: string;
    name: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  recentInvoices?: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    totalAmount: number;
    status: string;
    dueDate: string;
    createdAt: string;
  }>;
}

/* ── card wrapper ── */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl p-6 ${className}`}
      style={{
        border: "1px solid #E2E0D8",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      {children}
    </div>
  );
}

/* ── stat card ── */
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{
        border: "1px solid #E2E0D8",
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium"
          style={{ color: "#2D3748", opacity: 0.6 }}
        >
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bg }}
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>
        {value.toLocaleString("en-US")}
      </p>
    </div>
  );
}

/* ── status badge helper ── */
function StatusBadge({
  config,
  status,
}: {
  config: Record<string, { label: string; bg: string; text: string }>;
  status: string;
}) {
  const s = config[status] || { label: status, bg: "#F3F4F6", text: "#6B7280" };
  return (
    <span
      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
export default function UserDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userServices, setUserServices] = useState<{id: string; service: {id: string; name: string; category: string | null}}[]>([]);
  const [allServices, setAllServices] = useState<{id: string; name: string; category: string | null}[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/users/${id}/details`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        setUser(d);
        console.log("USER ROLE:", d.role);
        setLoading(false);
      })
      .catch(() => {
        setError("لم يتم العثور على المستخدم أو حدث خطأ في التحميل.");
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/users/${id}/services`).then(r => r.json()).then(d => { if (Array.isArray(d)) setUserServices(d); });
    fetch("/api/services").then(r => r.json()).then(d => { if (Array.isArray(d)) setAllServices(d); });
  }, [id]);

  /* ── loading ── */
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <Loader2
          size={40}
          className="animate-spin"
          style={{ color: "#1C1B2E" }}
        />
      </div>
    );
  }

  /* ── error ── */
  if (error || !user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        dir="rtl"
        style={{ backgroundColor: "#F8F9FA" }}
      >
        <AlertTriangle size={48} style={{ color: "#C9A84C" }} />
        <p className="text-lg font-semibold" style={{ color: "#1C1B2E" }}>
          {error || "المستخدم غير موجود"}
        </p>
        <Link
          href="/dashboard/users"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ backgroundColor: "#5E5495" }}
        >
          العودة للقائمة
        </Link>
      </div>
    );
  }

  const role = roleConfig[user.role] || {
    label: user.role,
    bg: "#F3F4F6",
    text: "#6B7280",
  };
  const handleAddService = async (serviceId: string) => {
    await fetch(`/api/users/${id}/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
    fetch(`/api/users/${id}/services`).then(r => r.json()).then(d => { if (Array.isArray(d)) setUserServices(d); });
  };
  const handleRemoveService = async (serviceId: string) => {
    await fetch(`/api/users/${id}/services`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId }),
    });
    setUserServices(prev => prev.filter(s => s.service.id !== serviceId));
  };

  const isProvider =
    user.role === "EXECUTOR" || user.role === "EXTERNAL_PROVIDER";
  const isClient = user.role === "CLIENT";

  return (
    <div
      className="p-8 min-h-screen"
      dir="rtl"
      style={{ backgroundColor: "#F8F9FA" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/users"
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white"
            style={{ border: "1px solid #E2E0D8" }}
            title="العودة"
          >
            <ArrowRight size={20} style={{ color: "#1C1B2E" }} />
          </Link>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "#1C1B2E" }}
            >
              {user.name}
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "#2D3748", opacity: 0.6 }}
            >
              تفاصيل المستخدم
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/users/${user.id}/edit`}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all"
          style={{
            backgroundColor: "#C9A84C",
            boxShadow: "0 4px 12px rgba(201,168,76,0.25)",
          }}
        >
          <Edit3 size={18} />
          تعديل
        </Link>
      </div>

      {/* ── User info card ── */}
      <Card className="mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex items-start justify-center">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{
                backgroundColor: "rgba(201,168,76,0.12)",
                color: "#C9A84C",
              }}
            >
              {getInitials(user.name)}
            </div>
          </div>

          {/* Info grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Name */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <UserIcon size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  الاسم
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.name}
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <Mail size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  البريد الإلكتروني
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.email}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <Phone size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  الهاتف
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.phone || "—"}
                </p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <ShieldCheck size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  الدور
                </p>
                <span
                  className="px-3 py-1 rounded-lg text-xs font-semibold"
                  style={{ backgroundColor: role.bg, color: role.text }}
                >
                  {role.label}
                </span>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                {user.isActive ? (
                  <CheckCircle2 size={16} style={{ color: "#059669" }} />
                ) : (
                  <XCircle size={16} style={{ color: "#DC2626" }} />
                )}
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  الحالة
                </p>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={
                    user.isActive
                      ? { backgroundColor: "#ECFDF5", color: "#059669" }
                      : { backgroundColor: "#FEF2F2", color: "#DC2626" }
                  }
                >
                  {user.isActive ? "نشط" : "معطل"}
                </span>
              </div>
            </div>

            {/* Creation date */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <Calendar size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  تاريخ التسجيل
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {formatDate(user.createdAt)}
                </p>
              </div>
            </div>

            {/* Specialization (providers only) */}
            {isProvider && user.specialization && (
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
                >
                  <Star size={16} style={{ color: "#C9A84C" }} />
                </div>
                <div>
                  <p
                    className="text-xs"
                    style={{ color: "#2D3748", opacity: 0.5 }}
                  >
                    التخصص
                  </p>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#1C1B2E" }}
                  >
                    {user.specialization}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* External provider extra info */}
        {user.role === "EXTERNAL_PROVIDER" && (
          <div
            className="mt-6 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-5"
            style={{ borderTop: "1px solid #E2E0D8" }}
          >
            {/* Supervisor */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <UserIcon size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  المشرف
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.supervisor?.name || "—"}
                </p>
              </div>
            </div>

            {/* Bank info */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <Building2 size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  البنك / الآيبان
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.bankName || "—"}
                  {user.bankIban ? ` / ${user.bankIban}` : ""}
                </p>
              </div>
            </div>

            {/* Cost per task */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "rgba(27,42,74,0.06)" }}
              >
                <Banknote size={16} style={{ color: "#1C1B2E" }} />
              </div>
              <div>
                <p
                  className="text-xs"
                  style={{ color: "#2D3748", opacity: 0.5 }}
                >
                  تكلفة المهمة
                </p>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#1C1B2E" }}
                >
                  {user.costPerTask != null
                    ? <>{user.costPerTask.toLocaleString("en-US")} <SarSymbol size={14} /></>
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ═══════ EXECUTOR / EXTERNAL_PROVIDER sections ═══════ */}
      {isProvider && user.stats && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="المهام المسندة"
              value={user.stats.assignedTasks ?? 0}
              icon={ClipboardList}
              color="#1C1B2E"
              bg="rgba(27,42,74,0.06)"
            />
            <StatCard
              label="المهام المكتملة"
              value={user.stats.completedTasks ?? 0}
              icon={CheckCircle2}
              color="#059669"
              bg="rgba(5,150,105,0.06)"
            />
            <StatCard
              label="المهام الجارية"
              value={user.stats.inProgressTasks ?? 0}
              icon={Clock}
              color="#2563EB"
              bg="rgba(37,99,235,0.06)"
            />
            <StatCard
              label="رفض المهام"
              value={user.stats.rejections ?? 0}
              icon={XCircle}
              color="#DC2626"
              bg="rgba(220,38,38,0.06)"
            />
          </div>

          {/* Assigned Services */}
          {user.providedServices && user.providedServices.length > 0 && (
            <Card className="mb-8">
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                الخدمات المسندة
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#FAFAFE",
                        borderBottom: "1px solid #E2E0D8",
                      }}
                    >
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الخدمة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        التصنيف
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الأولوية
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الحالة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.providedServices.map((spm) => (
                      <tr
                        key={spm.id}
                        className="transition-colors hover:bg-[#FAFAF8]"
                        style={{ borderBottom: "1px solid #F0EDE6" }}
                      >
                        <td className="px-5 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {spm.serviceTemplate.name}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {spm.serviceTemplate.category?.name || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {spm.priority.toLocaleString("en-US")}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold"
                            style={
                              spm.isActive
                                ? {
                                    backgroundColor: "#ECFDF5",
                                    color: "#059669",
                                  }
                                : {
                                    backgroundColor: "#FEF2F2",
                                    color: "#DC2626",
                                  }
                            }
                          >
                            {spm.isActive ? "مفعل" : "معطل"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Recent Tasks */}
          {user.recentTasks && user.recentTasks.length > 0 && (
            <Card className="mb-8">
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                آخر المهام
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#FAFAFE",
                        borderBottom: "1px solid #E2E0D8",
                      }}
                    >
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        المهمة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        المشروع
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الحالة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        تاريخ التسليم
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.recentTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="transition-colors hover:bg-[#FAFAF8]"
                        style={{ borderBottom: "1px solid #F0EDE6" }}
                      >
                        <td className="px-5 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {task.title}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {task.project?.name || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            config={taskStatusConfig}
                            status={task.status}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {task.dueDate ? formatDate(task.dueDate) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Rejection History */}
          {user.taskRejections && user.taskRejections.length > 0 && (
            <Card className="mb-8">
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                سجل الرفض
              </h2>
              <div className="space-y-3">
                {user.taskRejections.map((rej) => (
                  <div
                    key={rej.id}
                    className="flex items-start gap-3 p-4 rounded-xl"
                    style={{
                      backgroundColor: "#FAFAFE",
                      border: "1px solid #F0EDE6",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(220,38,38,0.06)" }}
                    >
                      <XCircle size={16} style={{ color: "#DC2626" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "#1C1B2E" }}
                        >
                          {rej.task?.title || "—"}
                        </p>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: "#94A3B8" }}
                        >
                          {formatDate(rej.createdAt)}
                        </span>
                      </div>
                      <p
                        className="text-sm"
                        style={{ color: "#2D3748", opacity: 0.8 }}
                      >
                        {rej.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══════ CLIENT sections ═══════ */}
      {isClient && user.stats && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="المشاريع"
              value={user.stats.projects ?? 0}
              icon={FolderOpen}
              color="#1C1B2E"
              bg="rgba(27,42,74,0.06)"
            />
            <StatCard
              label="الخدمات"
              value={user.stats.services ?? 0}
              icon={Briefcase}
              color="#2563EB"
              bg="rgba(37,99,235,0.06)"
            />
            <StatCard
              label="الفواتير"
              value={user.stats.invoices ?? 0}
              icon={Receipt}
              color="#059669"
              bg="rgba(5,150,105,0.06)"
            />
            <StatCard
              label="الوثائق"
              value={user.stats.documents ?? 0}
              icon={FileText}
              color="#C9A84C"
              bg="rgba(201,168,76,0.06)"
            />
          </div>

          {/* Recent Projects */}
          {user.recentProjects && user.recentProjects.length > 0 && (
            <Card className="mb-8">
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                آخر المشاريع
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#FAFAFE",
                        borderBottom: "1px solid #E2E0D8",
                      }}
                    >
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        المشروع
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الحالة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        تاريخ الإنشاء
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.recentProjects.map((proj) => (
                      <tr
                        key={proj.id}
                        className="transition-colors hover:bg-[#FAFAF8]"
                        style={{ borderBottom: "1px solid #F0EDE6" }}
                      >
                        <td className="px-5 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {proj.name}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            config={projectStatusConfig}
                            status={proj.status}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {formatDate(proj.createdAt)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Recent Invoices */}
          {user.recentInvoices && user.recentInvoices.length > 0 && (
            <Card className="mb-8">
              <h2
                className="text-lg font-bold mb-4"
                style={{ color: "#1C1B2E" }}
              >
                آخر الفواتير
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#FAFAFE",
                        borderBottom: "1px solid #E2E0D8",
                      }}
                    >
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        رقم الفاتورة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        العنوان
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        المبلغ
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        الحالة
                      </th>
                      <th
                        className="text-right px-5 py-3 text-xs font-semibold"
                        style={{ color: "#2D3748", opacity: 0.7 }}
                      >
                        تاريخ الاستحقاق
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.recentInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="transition-colors hover:bg-[#FAFAF8]"
                        style={{ borderBottom: "1px solid #F0EDE6" }}
                      >
                        <td className="px-5 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {inv.title}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: "#1C1B2E" }}
                          >
                            {inv.totalAmount.toLocaleString("en-US")} <SarSymbol size={14} />
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge
                            config={invoiceStatusConfig}
                            status={inv.status}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className="text-sm"
                            style={{ color: "#2D3748" }}
                          >
                            {formatDate(inv.dueDate)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ═══════ Executor Services ═══════ */}
      {(user.role === "EXECUTOR" || user.role === "EXTERNAL_PROVIDER") && (
        <div className="bg-white rounded-2xl p-6 mt-6" style={{ border: "1px solid #E2E0D8" }}>
          <h3 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>الخدمات المرتبطة بالمنفذ</h3>

          {/* Search and add */}
          <div className="flex gap-2 mb-4">
            <select
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid #E2E0D8" }}>
              <option value="">اختر خدمة للإضافة...</option>
              {allServices
                .filter(s => !userServices.find(us => us.service.id === s.id))
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}{s.category ? ` - ${s.category}` : ""}</option>
                ))}
            </select>
            <button
              onClick={() => { if (serviceSearch) { handleAddService(serviceSearch); setServiceSearch(""); } }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: "#C9A84C" }}>
              إضافة
            </button>
          </div>

          {/* Current services */}
          <div className="space-y-2">
            {userServices.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#94A3B8" }}>لا توجد خدمات مرتبطة</p>
            ) : (
              userServices.map(us => (
                <div key={us.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: "#F8F7F4" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{us.service.name}</p>
                    {us.service.category && <p className="text-xs" style={{ color: "#94A3B8" }}>{us.service.category}</p>}
                  </div>
                  <button onClick={() => handleRemoveService(us.service.id)}
                    className="text-xs px-3 py-1 rounded-lg"
                    style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                    إلغاء الربط
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
