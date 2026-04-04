"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useSession } from "next-auth/react";
import {
  ClipboardList,
  AlertTriangle,
  AlertCircle,
  Activity,
  CalendarDays,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  RefreshCw,
  User,
  Shield,
  FileText,
  FolderKanban,
  CheckSquare,
  Ticket,
  DollarSign,
  Settings,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface AuditLog {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  module: string;
  severity: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  meta: Record<string, unknown> | null;
  notes: string | null;
  user: { id: string; name: string; role: string } | null;
}

interface Stats {
  critical: number;
  warnings: number;
  total: number;
  today: number;
}

const moduleLabels: Record<string, string> = {
  auth: "المصادقة",
  users: "المستخدمين",
  contracts: "العقود",
  projects: "المشاريع",
  tasks: "المهام",
  finance: "المالية",
  tickets: "التذاكر",
  clients: "العملاء",
  settings: "الإعدادات",
};

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  INFO: { label: "معلومات", color: "#5E5495", bg: "#F0EEF5" },
  WARN: { label: "تحذير", color: "#CA8A04", bg: "#FEF9C3" },
  CRITICAL: { label: "حرج", color: "#DC2626", bg: "#FEE2E2" },
};

const moduleIcons: Record<string, typeof ClipboardList> = {
  auth: Shield,
  users: User,
  contracts: FileText,
  projects: FolderKanban,
  tasks: CheckSquare,
  finance: DollarSign,
  tickets: Ticket,
  clients: User,
  settings: Settings,
};

const actionLabels: Record<string, string> = {
  USER_LOGIN: "تسجيل دخول",
  USER_LOGOUT: "تسجيل خروج",
  LOGIN_FAILED: "فشل تسجيل الدخول",
  USER_CREATED: "إنشاء مستخدم",
  USER_UPDATED: "تحديث مستخدم",
  USER_DELETED: "حذف مستخدم",
  PERMISSION_GRANTED: "منح صلاحية",
  PERMISSION_REVOKED: "سحب صلاحية",
  PERMISSIONS_UPDATED: "تحديث الصلاحيات",
  CONTRACT_CREATED: "إنشاء عقد",
  CONTRACT_SUBMITTED: "رفع عقد للاعتماد",
  CONTRACT_APPROVED: "اعتماد عقد",
  CONTRACT_REJECTED: "رفض عقد",
  CONTRACT_SIGNED: "توقيع عقد",
  CONTRACT_ACTIVATED: "تفعيل عقد",
  CONTRACT_REVISION_REQUESTED: "طلب تعديل عقد",
  PROJECT_CREATED: "إنشاء مشروع",
  PROJECT_UPDATED: "تحديث مشروع",
  PROJECT_DELETED: "حذف مشروع",
  TASK_STARTED: "بدء مهمة",
  TASK_COMPLETED: "إنجاز مهمة",
  TASK_CANCELLED: "إلغاء مهمة",
  TASK_ASSIGNED: "تعيين مهمة",
  TASK_TRANSFER_APPROVED: "قبول تحويل مهمة",
  TASK_TRANSFER_REJECTED: "رفض تحويل مهمة",
  INSTALLMENT_PAID: "دفع كامل",
  INSTALLMENT_PARTIAL: "دفع جزئي",
  INSTALLMENT_APPROVED: "اعتماد دفعة",
  TICKET_CREATED: "إنشاء تذكرة",
  TICKET_ASSIGNED: "تعيين تذكرة",
  TICKET_RESOLVED: "حل تذكرة",
  TICKET_CLOSED: "إغلاق تذكرة",
  TICKET_STATUS_CHANGED: "تغيير حالة تذكرة",
};

const roleLabels: Record<string, string> = {
  ADMIN: "مدير النظام",
  MANAGER: "مدير",
  EXECUTOR: "منفذ",
  CLIENT: "عميل",
  EXTERNAL_PROVIDER: "مزود خارجي",
  FINANCE_MANAGER: "مدير مالي",
  TREASURY_MANAGER: "مدير خزينة",
};

export default function AuditLogsPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({ critical: 0, warnings: 0, total: 0, today: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterModule, setFilterModule] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (filterModule) params.set("module", filterModule);
      if (filterSeverity) params.set("severity", filterSeverity);
      if (filterAction) params.set("action", filterAction);
      if (filterSearch) params.set("search", filterSearch);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setStats(data.stats);
      }
    } catch (e) {
      console.error("Error fetching audit logs:", e);
    } finally {
      setLoading(false);
    }
  }, [page, filterModule, filterSeverity, filterAction, filterSearch, filterDateFrom, filterDateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = () => {
    const headers = ["التاريخ", "المستخدم", "الدور", "الإجراء", "الوحدة", "الأهمية", "الكيان", "ملاحظات"];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString("ar-SA"),
      log.userName || log.user?.name || "—",
      roleLabels[log.userRole || ""] || log.userRole || "—",
      actionLabels[log.action] || log.action,
      moduleLabels[log.module] || log.module,
      severityConfig[log.severity]?.label || log.severity,
      log.entityName || "—",
      log.notes || "",
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilterModule("");
    setFilterSeverity("");
    setFilterAction("");
    setFilterSearch("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(1);
  };

  if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p style={{ color: "#1C1B2E" }}>غير مصرح بالوصول لهذه الصفحة</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#5E5495" }}>
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>سجل العمليات</h1>
            <p className="text-sm" style={{ color: "#6B7280" }}>تتبع جميع الإجراءات والتغييرات في النظام</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MarsaButton
            onClick={handleExportCSV}
            variant="outline"
            size="sm"
            icon={<Download size={16} />}
          >
            تصدير CSV
          </MarsaButton>
          <MarsaButton
            onClick={fetchLogs}
            variant="primary"
            size="sm"
            icon={<RefreshCw size={16} />}
          >
            تحديث
          </MarsaButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0EEF5" }}>
              <Activity size={20} style={{ color: "#5E5495" }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{stats.total.toLocaleString("ar-SA")}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>إجمالي العمليات</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#DBEAFE" }}>
              <CalendarDays size={20} style={{ color: "#2563EB" }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{stats.today.toLocaleString("ar-SA")}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>عمليات اليوم</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEF9C3" }}>
              <AlertTriangle size={20} style={{ color: "#CA8A04" }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{stats.warnings.toLocaleString("ar-SA")}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>تحذيرات</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl p-4 border" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
              <AlertCircle size={20} style={{ color: "#DC2626" }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{stats.critical.toLocaleString("ar-SA")}</p>
              <p className="text-xs" style={{ color: "#6B7280" }}>عمليات حرجة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <Filter size={16} style={{ color: "#5E5495" }} />
            <span className="text-sm font-medium" style={{ color: "#1C1B2E" }}>فلاتر البحث</span>
            {(filterModule || filterSeverity || filterAction || filterSearch || filterDateFrom || filterDateTo) && (
              <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: "#C9A84C" }}>
                نشط
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showFilters && (
          <div className="p-4 pt-0 space-y-4 border-t" style={{ borderColor: "#F0EEF5" }}>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>بحث</label>
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }} />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                    placeholder="بحث..."
                    className="w-full pr-9 pl-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: "#E8E6F0" }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>الوحدة</label>
                <select
                  value={filterModule}
                  onChange={(e) => { setFilterModule(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#E8E6F0" }}
                >
                  <option value="">الكل</option>
                  {Object.entries(moduleLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>الأهمية</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => { setFilterSeverity(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#E8E6F0" }}
                >
                  <option value="">الكل</option>
                  <option value="INFO">معلومات</option>
                  <option value="WARN">تحذير</option>
                  <option value="CRITICAL">حرج</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>الإجراء</label>
                <select
                  value={filterAction}
                  onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#E8E6F0" }}
                >
                  <option value="">الكل</option>
                  {Object.entries(actionLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>من تاريخ</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#E8E6F0" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: "#6B7280" }}>إلى تاريخ</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: "#E8E6F0" }}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <MarsaButton
                onClick={resetFilters}
                variant="ghost"
                size="sm"
              >
                إعادة تعيين
              </MarsaButton>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "white", borderColor: "#E8E6F0" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={24} className="animate-spin" style={{ color: "#5E5495" }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <ClipboardList size={48} style={{ color: "#D1D5DB" }} />
            <p className="mt-3 text-sm" style={{ color: "#6B7280" }}>لا توجد سجلات</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#F8F9FA" }}>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>المستخدم</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>الإجراء</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>الوحدة</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>الأهمية</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}>الكيان</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#6B7280" }}></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const sev = severityConfig[log.severity] || severityConfig.INFO;
                  const ModIcon = moduleIcons[log.module] || ClipboardList;
                  const isExpanded = expandedId === log.id;

                  return (
                    <Fragment key={log.id}>
                      <tr
                        className="border-t cursor-pointer transition-colors"
                        style={{ borderColor: "#F0EEF5" }}
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#FAFAFE"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#6B7280" }}>
                          {new Date(log.createdAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span style={{ color: "#1C1B2E" }}>{log.userName || log.user?.name || "—"}</span>
                            <span className="text-xs" style={{ color: "#9CA3AF" }}>
                              {roleLabels[log.userRole || ""] || log.userRole || ""}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span style={{ color: "#1C1B2E" }}>{actionLabels[log.action] || log.action}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <ModIcon size={14} style={{ color: "#5E5495" }} />
                            <span style={{ color: "#5E5495" }}>{moduleLabels[log.module] || log.module}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: sev.bg, color: sev.color }}
                          >
                            {sev.label}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: "#1C1B2E" }}>
                          {log.entityName || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: "#FAFAFE" }}>
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {log.entityId && (
                                <div>
                                  <span className="font-medium" style={{ color: "#6B7280" }}>معرف الكيان: </span>
                                  <span className="font-mono text-xs" style={{ color: "#1C1B2E" }}>{log.entityId}</span>
                                </div>
                              )}
                              {log.entityType && (
                                <div>
                                  <span className="font-medium" style={{ color: "#6B7280" }}>نوع الكيان: </span>
                                  <span style={{ color: "#1C1B2E" }}>{log.entityType}</span>
                                </div>
                              )}
                              {log.notes && (
                                <div className="md:col-span-2">
                                  <span className="font-medium" style={{ color: "#6B7280" }}>ملاحظات: </span>
                                  <span style={{ color: "#1C1B2E" }}>{log.notes}</span>
                                </div>
                              )}
                              {log.before && (
                                <div>
                                  <span className="font-medium" style={{ color: "#6B7280" }}>قبل:</span>
                                  <pre
                                    className="mt-1 p-2 rounded-lg text-xs overflow-x-auto"
                                    dir="ltr"
                                    style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
                                  >
                                    {JSON.stringify(log.before, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.after && (
                                <div>
                                  <span className="font-medium" style={{ color: "#6B7280" }}>بعد:</span>
                                  <pre
                                    className="mt-1 p-2 rounded-lg text-xs overflow-x-auto"
                                    dir="ltr"
                                    style={{ backgroundColor: "#DCFCE7", color: "#166534" }}
                                  >
                                    {JSON.stringify(log.after, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.meta && (
                                <div className="md:col-span-2">
                                  <span className="font-medium" style={{ color: "#6B7280" }}>بيانات إضافية:</span>
                                  <pre
                                    className="mt-1 p-2 rounded-lg text-xs overflow-x-auto"
                                    dir="ltr"
                                    style={{ backgroundColor: "#F0EEF5", color: "#1C1B2E" }}
                                  >
                                    {JSON.stringify(log.meta, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: "#F0EEF5" }}>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              عرض {((page - 1) * 25) + 1} - {Math.min(page * 25, total)} من {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
                style={{ borderColor: "#E8E6F0", color: "#5E5495" }}
              >
                السابق
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startPage = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = startPage + i;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium"
                    style={{
                      backgroundColor: p === page ? "#5E5495" : "transparent",
                      color: p === page ? "white" : "#5E5495",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm border disabled:opacity-40"
                style={{ borderColor: "#E8E6F0", color: "#5E5495" }}
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
