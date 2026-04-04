"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "@/components/notifications/NotificationBell";
import { ToastProvider } from "@/components/Toast";
import GlobalSearch from "@/components/GlobalSearch";
import { useLang } from "@/contexts/LanguageContext";
import { SidebarCountsProvider, useSidebarCounts } from "@/contexts/SidebarCountsContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import MarsaLogo from "@/components/MarsaLogo";
import {
  LayoutDashboard,
  FolderKanban,
  ShoppingBag,
  Users,
  Users2,
  Bell,
  Wallet,
  Monitor,
  BookOpen,
  LogOut,
  User,
  ChevronDown,
  UserCog,
  CreditCard,
  Briefcase,
  FileText,
  FilePlus,
  Receipt,
  MessageSquare,
  Link2,
  ArrowLeftRight,
  ClipboardList,
  DollarSign,
  BarChart3,
  Settings,
  Menu,
  X,
  Eye,
  FolderOpen,
  Timer,
  Ticket,
  Headphones,
  Banknote,
  Lock,
  ShieldCheck,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

// ═══════════════════════════════════════════════════
// Sidebar group definitions per role
// ═══════════════════════════════════════════════════

interface NavChild {
  href: string;
  label: string;
  tKey?: string;
  roles?: string[];
  permissionKey?: string;
}

interface NavGroup {
  id: string;
  label: string;
  tGroupKey?: string;
  icon: LucideIcon;
  roles?: string[];
  children: NavChild[];
}

const adminGroups: NavGroup[] = [
  {
    id: "home",
    label: "الرئيسية والمتابعة",
    tGroupKey: "homeAndFollow",
    icon: LayoutDashboard,
    children: [
      { href: "/dashboard", label: "الشاشة الرئيسية", tKey: "home" },
      { href: "/dashboard/chat", label: "المحادثات", tKey: "chat" },
      { href: "/dashboard/reminders", label: "التذكيرات", tKey: "reminders" },
      { href: "/dashboard/user-preview", label: "شاشات المستخدمين", tKey: "userPreview", roles: ["ADMIN"] },
    ],
  },
  {
    id: "projects",
    label: "المشاريع والعقود",
    tGroupKey: "projectsAndContracts",
    icon: FolderOpen,
    children: [
      { href: "/dashboard/projects", label: "المشاريع", tKey: "projects" },
      { href: "/dashboard/quick-service", label: "طلب خدمة سريع", tKey: "quickService" },
      { href: "/dashboard/projects/templates", label: "قوالب المشاريع", tKey: "projectTemplates" },
      { href: "/dashboard/contracts", label: "العقود", tKey: "contracts" },
      { href: "/dashboard/contract-templates", label: "قوالب العقود", tKey: "contractTemplates", roles: ["ADMIN", "MANAGER"] },
      { href: "/dashboard/service-requests", label: "طلبات الخدمات", tKey: "serviceRequests", roles: ["ADMIN", "MANAGER"] },
      { href: "/dashboard/service-catalog", label: "كتالوج الخدمات", tKey: "services" },
      { href: "/services", label: "سوق الخدمات", tKey: "marketplace" },
      { href: "/dashboard/task-transfers", label: "طلبات التحويل", tKey: "transfers" },
    ],
  },
  {
    id: "finance",
    label: "الإدارة المالية",
    tGroupKey: "finance",
    icon: Banknote,
    children: [
      { href: "/dashboard/finance", label: "الإدارة المالية", tKey: "finance" },
      { href: "/dashboard/finance/invoices", label: "الفواتير", tKey: "invoices" },
      { href: "/dashboard/finance/payments", label: "المدفوعات", tKey: "payments" },
      { href: "/dashboard/payment-requests", label: "طلبات الصرف", tKey: "paymentRequests", roles: ["ADMIN", "MANAGER", "FINANCE_MANAGER", "TREASURY_MANAGER"] },
      { href: "/dashboard/cashier", label: "الكاشير", tKey: "cashier", roles: ["ADMIN", "MANAGER", "EXECUTOR"] },
    ],
  },
  {
    id: "people",
    label: "العملاء والموارد",
    tGroupKey: "peopleAndResources",
    icon: Users,
    children: [
      { href: "/dashboard/clients", label: "العملاء", tKey: "clients" },
      { href: "/dashboard/hr/employees", label: "الموظفين", tKey: "employees" },
      { href: "/dashboard/hr/leaves", label: "الإجازات", tKey: "leaves" },
      { href: "/dashboard/hr/attendance", label: "الحضور", tKey: "attendance" },
{ href: "/dashboard/users", label: "إدارة المستخدمين", tKey: "users", roles: ["ADMIN"] },
      { href: "/dashboard/departments", label: "الأقسام", tKey: "departments", roles: ["ADMIN"] },
    ],
  },
  {
    id: "support",
    label: "الدعم والتقارير",
    tGroupKey: "supportAndReports",
    icon: Headphones,
    children: [
      { href: "/dashboard/tickets", label: "التذاكر", tKey: "tickets" },
      { href: "/dashboard/reports", label: "التقارير", tKey: "reports", roles: ["ADMIN", "MANAGER", "FINANCE_MANAGER"] },
      { href: "/dashboard/time-reports", label: "تقارير الوقت", tKey: "timeReports", roles: ["ADMIN", "MANAGER"] },
      { href: "/dashboard/audit-logs", label: "سجل العمليات", tKey: "auditLogs", roles: ["ADMIN", "MANAGER"] },
      { href: "/dashboard/policies", label: "اللوائح والإرشادات", tKey: "policies" },
    ],
  },
  {
    id: "settings",
    label: "الإعدادات",
    tGroupKey: "settings",
    icon: Settings,
    roles: ["ADMIN"],
    children: [
      { href: "/dashboard/settings", label: "الإعدادات", tKey: "settings" },
      { href: "/dashboard/permissions", label: "إدارة الصلاحيات", tKey: "permissions" },
      { href: "/dashboard/recycle-bin", label: "سلة المحذوفات", tKey: "recycleBin" },
    ],
  },
];

const executorGroups: NavGroup[] = [
  {
    id: "home",
    label: "الرئيسية والمتابعة",
    tGroupKey: "homeAndFollow",
    icon: LayoutDashboard,
    children: [
      { href: "/dashboard/my-tasks", label: "مهامي", tKey: "myTasks" },
      { href: "/dashboard/task-transfers", label: "طلبات التحويل", tKey: "transfers" },
      { href: "/dashboard/my-projects", label: "مشاريعي", tKey: "myProjects" },
      { href: "/dashboard/my-health", label: "صحة مشاريعي", tKey: "myHealth" },
      { href: "/dashboard/projects", label: "المشاريع", tKey: "projects", permissionKey: "projects.view" },
      { href: "/dashboard/clients", label: "العملاء", tKey: "clients", permissionKey: "clients.view" },
      { href: "/dashboard/chat", label: "المحادثات", tKey: "chat" },
    ],
  },
  {
    id: "contracts",
    label: "العقود والمالية",
    tGroupKey: "contractsAndFinance",
    icon: FilePlus,
    children: [
      { href: "/dashboard/contracts", label: "العقود", tKey: "contracts", permissionKey: "contracts.view" },
      { href: "/dashboard/cashier", label: "الكاشير", tKey: "cashier", permissionKey: "finance.cashier" },
      { href: "/dashboard/my-payments", label: "مدفوعاتي", tKey: "myPayments" },
      { href: "/dashboard/tickets", label: "التذاكر", tKey: "tickets", permissionKey: "tickets.view" },
      { href: "/dashboard/payment-requests", label: "طلبات الصرف", tKey: "paymentRequests", permissionKey: "finance.expenses" },
      { href: "/dashboard/policies", label: "اللوائح والإرشادات", tKey: "policies" },
    ],
  },
];

const providerGroups: NavGroup[] = [
  {
    id: "home",
    label: "الرئيسية",
    tGroupKey: "home",
    icon: LayoutDashboard,
    children: [
      { href: "/dashboard/my-tasks", label: "مهامي", tKey: "myTasks" },
      { href: "/dashboard/my-payments", label: "مدفوعاتي", tKey: "myPayments" },
      { href: "/dashboard/chat", label: "المحادثات", tKey: "chat" },
      { href: "/dashboard/policies", label: "اللوائح والإرشادات", tKey: "policies" },
    ],
  },
];

const clientGroups: NavGroup[] = [
  {
    id: "home",
    label: "الرئيسية والمتابعة",
    tGroupKey: "homeAndFollow",
    icon: LayoutDashboard,
    children: [
      { href: "/dashboard/my-projects", label: "مشاريعي", tKey: "myProjects" },
      { href: "/dashboard/my-services", label: "خدماتي", tKey: "myServices" },
      { href: "/dashboard/my-service-requests", label: "طلباتي", tKey: "myServiceRequests" },
      { href: "/dashboard/chat", label: "المحادثات", tKey: "chat" },
    ],
  },
  {
    id: "docs",
    label: "الوثائق والمالية",
    tGroupKey: "docsAndFinance",
    icon: FileText,
    children: [
      { href: "/dashboard/my-documents", label: "وثائقي", tKey: "myDocuments" },
      { href: "/dashboard/my-invoices", label: "فواتيري", tKey: "myInvoices" },
      { href: "/dashboard/my-reminders", label: "تذكيراتي", tKey: "myReminders" },
      { href: "/dashboard/my-employees", label: "موظفيني", tKey: "myEmployees" },
      { href: "/dashboard/my-authorization", label: "التفويض", tKey: "myAuthorization" },
    ],
  },
  {
    id: "contracts",
    label: "العقود والدعم",
    tGroupKey: "contractsAndSupport",
    icon: FilePlus,
    children: [
      { href: "/dashboard/contracts", label: "العقود", tKey: "contracts" },
      { href: "/dashboard/tickets", label: "التذاكر", tKey: "tickets" },
      { href: "/dashboard/marketplace", label: "سوق الخدمات", tKey: "marketplace" },
      { href: "/dashboard/policies", label: "اللوائح والإرشادات", tKey: "policies" },
    ],
  },
];

// ═══════════════════════════════════════════════════
// Layout Component
// ═══════════════════════════════════════════════════

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarCountsProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SidebarCountsProvider>
  );
}

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t, isRTL } = useLang();
  const userRole = session?.user?.role || "";
  const userName = session?.user?.name || "مستخدم";
  const userEmail = session?.user?.email || "";
  const userInitial = userName.charAt(0);

  // Resolve nav label from translation key
  const navLabel = (item: NavChild) =>
    item.tKey ? (t.nav as Record<string, string>)[item.tKey] || item.label : item.label;
  const groupLabel = (group: NavGroup) =>
    group.tGroupKey ? (t.groups as Record<string, string>)[group.tGroupKey] || group.label : group.label;

  // Fetch user permissions for sidebar filtering
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  useEffect(() => {
    if (session?.user?.id && userRole !== "ADMIN") {
      fetch(`/api/users/${session.user.id}/permissions`)
        .then((r) => r.ok ? r.json() : { permissionKeys: [] })
        .then((data) => setUserPermissions(data.permissionKeys || []))
        .catch(() => {});
    }
  }, [session?.user?.id, userRole]);

  // Policy unread badge
  const [policyUnread, setPolicyUnread] = useState(0);
  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/policies/unread-count")
        .then((r) => r.json())
        .then((d) => setPolicyUnread(d.count || 0))
        .catch(() => {});
    }
  }, [session?.user?.id]);

  // Sidebar badge counts from context
  const { counts: sidebarCounts } = useSidebarCounts();

  const baseGroups =
    userRole === "CLIENT" ? clientGroups :
    userRole === "EXECUTOR" ? executorGroups :
    userRole === "EXTERNAL_PROVIDER" ? providerGroups :
    adminGroups;

  // Filter sidebar items by permission for non-ADMIN users
  const groups = ["ADMIN", "MANAGER"].includes(userRole) ? baseGroups : baseGroups.map((g) => ({
    ...g,
    children: g.children.filter((c) => {
      if (!c.permissionKey) return true;
      return userPermissions.includes(c.permissionKey);
    }),
  }));

  // Impersonation state
  const [impersonating, setImpersonating] = useState(false);
  const [impersonateName, setImpersonateName] = useState("");

  useEffect(() => {
    const cookie = document.cookie.split(";").find(c => c.trim().startsWith("impersonate_user_id="));
    const nameCookie = document.cookie.split(";").find(c => c.trim().startsWith("impersonate_name="));
    if (cookie && cookie.split("=")[1]) {
      setImpersonating(true);
      if (nameCookie) setImpersonateName(decodeURIComponent(nameCookie.split("=").slice(1).join("=")));
    }
  }, []);

  const stopImpersonating = async () => {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    window.location.href = "/dashboard/user-preview";
  };

  // Sidebar mobile state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Accordion open groups — persist in localStorage
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return groups.map(g => g.id);
    try {
      const saved = localStorage.getItem("kaf_sidebar_groups");
      if (saved) return JSON.parse(saved);
    } catch {}
    return groups.map(g => g.id);
  });

  useEffect(() => {
    try { localStorage.setItem("kaf_sidebar_groups", JSON.stringify(openGroups)); } catch {}
  }, [openGroups]);

  // Auto-open group containing current path
  useEffect(() => {
    for (const g of groups) {
      if (g.children.some(c => pathname === c.href || (c.href !== "/dashboard" && pathname.startsWith(c.href)))) {
        setOpenGroups(prev => prev.includes(g.id) ? prev : [...prev, g.id]);
        break;
      }
    }
  }, [pathname, groups]);

  // Close sidebar on mobile navigation
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  // Topbar user dropdown
  const [userDropdown, setUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdown(false);
      }
    }
    if (userDropdown) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [userDropdown]);

  return (
    <ToastProvider>
    {impersonating && (
      <div className="fixed top-0 left-0 right-0 z-[999] flex items-center justify-between px-6 py-2"
        style={{ backgroundColor: "#5E5495", color: "white" }}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Eye size={16} />
          <span>تستعرض النظام كـ: {impersonateName || "مستخدم"}</span>
        </div>
        <button onClick={stopImpersonating}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>
          × إيقاف الاستعراض
        </button>
      </div>
    )}
    <div className="min-h-screen flex" style={{ backgroundColor: "#F8F9FA" }} dir={isRTL ? "rtl" : "ltr"}>

      {/* ═══ Mobile header bar ═══ */}
      <div
        className={`fixed ${impersonating ? "top-10" : "top-0"} right-0 left-0 h-14 flex items-center justify-between px-4 z-30 lg:hidden`}
        style={{ backgroundColor: "#2A2542" }}
      >
        <div className="flex items-center gap-2">
          <MarsaLogo size={24} variant="light" />
          <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>{t.brand.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <NotificationBell />
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-white/70">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══ Sidebar ═══ */}
      <aside
        className={`w-[270px] fixed ${impersonating ? "top-10" : "top-0"} ${isRTL ? "right-0" : "left-0"} flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#2A2542", boxShadow: isRTL ? "-4px 0 20px rgba(0,0,0,0.15)" : "4px 0 20px rgba(0,0,0,0.15)", height: impersonating ? "calc(100vh - 40px)" : "100vh" }}
      >
        {/* Close button - mobile only */}
        <button
          onClick={() => setSidebarOpen(false)}
          className={`lg:hidden absolute top-4 ${isRTL ? "left-4" : "right-4"} p-1 text-white/50 hover:text-white z-10`}
        >
          <X size={20} />
        </button>

        {/* Logo */}
        <div className="px-6 py-6 flex items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <MarsaLogo size={36} variant="light" />
          <div className="flex-1">
            <span className="text-xl font-bold block" style={{ color: "#C9A84C" }}>{t.brand.name}</span>
            <span className="text-[10px] block" style={{ color: "rgba(255,255,255,0.35)" }}>{t.brand.tagline}</span>
          </div>
          <GlobalSearch />
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
          {groups.map((group, groupIndex) => {
            // Role-based group visibility
            if (group.roles && !group.roles.includes(userRole)) return null;

            const isOpen = openGroups.includes(group.id);
            const GroupIcon = group.icon;

            // Filter children by role
            const visibleChildren = group.children.filter(c => {
              if (!c.roles) return true;
              return c.roles.includes(userRole);
            });

            if (visibleChildren.length === 0) return null;

            const hasActiveChild = visibleChildren.some(c =>
              pathname === c.href || (c.href !== "/dashboard" && c.href !== "/dashboard/finance" && pathname.startsWith(c.href))
            );

            return (
              <div key={group.id} className="mb-0.5">
                {groupIndex > 0 && <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 16px" }} />}
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150"
                  style={{
                    color: hasActiveChild ? "#C9A84C" : "rgba(255,255,255,0.85)",
                    backgroundColor: hasActiveChild ? "rgba(94,84,149,0.12)" : "transparent",
                  }}
                >
                  <GroupIcon size={18} style={{ opacity: 0.8 }} />
                  <span className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>{groupLabel(group)}</span>
                  <ChevronDown
                    size={14}
                    className="transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      opacity: 0.5,
                    }}
                  />
                </button>

                {/* Group children */}
                {isOpen && (
                  <div className={`mt-0.5 ${isRTL ? "mr-4" : "ml-4"} space-y-0.5`} style={isRTL ? { borderRight: "2px solid rgba(94,84,149,0.3)", paddingRight: "12px" } : { borderLeft: "2px solid rgba(94,84,149,0.3)", paddingLeft: "12px" }}>
                    {visibleChildren.map((child) => {
                      const isActive =
                        child.href === "/dashboard"
                          ? pathname === "/dashboard"
                          : child.href === "/dashboard/finance"
                            ? pathname === "/dashboard/finance"
                            : pathname === child.href || pathname.startsWith(child.href + "/");

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="flex items-center px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150"
                          style={
                            isActive
                              ? { backgroundColor: "rgba(201,168,76,0.08)", color: "#C9A84C", borderRight: isRTL ? "3px solid #C9A84C" : "none", borderLeft: isRTL ? "none" : "3px solid #C9A84C" }
                              : { color: "rgba(255,255,255,0.6)" }
                          }
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          {navLabel(child)}
                          {child.href === "/dashboard/policies" && policyUnread > 0 && (
                            <span
                              className="mr-auto w-2 h-2 rounded-full animate-pulse"
                              style={{ backgroundColor: "#C9A84C" }}
                            />
                          )}
                          {(() => {
                            const badgeMap: Record<string, string> = {
                              "/dashboard/chat": "chat",
                              "/dashboard/reminders": "reminders",
                              "/dashboard/my-reminders": "reminders",
                              "/dashboard/service-requests": "serviceRequests",
                              "/dashboard/my-service-requests": "serviceRequests",
                              "/dashboard/task-transfers": "taskTransfers",
                              "/dashboard/payment-requests": "expenseRequests",
                              "/dashboard/finance/invoices": "invoices",
                              "/dashboard/contracts": "contracts",
                            };
                            const countKey = badgeMap[child.href];
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const count = countKey ? (sidebarCounts as any)[countKey] || 0 : 0;
                            if (count <= 0) return null;
                            return (
                              <span
                                className="mr-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                                style={{ backgroundColor: "#EA580C" }}
                              >
                                {count > 99 ? "99+" : count}
                              </span>
                            );
                          })()}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — user info + settings link */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: "#5E5495", color: "#FFFFFF" }}
            >
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate font-medium">{userName}</p>
              <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
                {(t.roles as Record<string, string>)[userRole] || userRole}
              </p>
            </div>
            {["ADMIN"].includes(userRole) && (
              <Link href="/dashboard/settings" className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#C9A84C"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
              >
                <Settings size={16} />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* ═══ Topbar (desktop) ═══ */}
      <div className={`fixed ${impersonating ? "top-10" : "top-0"} ${isRTL ? "right-0 lg:right-[270px] left-0" : "left-0 lg:left-[270px] right-0"} h-14 z-20 hidden lg:flex items-center justify-between px-6`}
        style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E8E6F0" }}
      >
        {/* Left: search placeholder */}
        <div />

        {/* Right: lang toggle + notification + user */}
        <div className="flex items-center gap-3">
          <LanguageToggle variant="light" />
          <NotificationBell />

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdown(!userDropdown)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-colors hover:bg-gray-50"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: "#5E5495", color: "#FFFFFF" }}
              >
                {userInitial}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{userName}</p>
                <p className="text-[10px]" style={{ color: "#9CA3AF" }}>{(t.roles as Record<string, string>)[userRole] || userRole}</p>
              </div>
              <ChevronDown size={14} style={{ color: "#9CA3AF" }} />
            </button>

            {userDropdown && (
              <div
                className="absolute left-0 top-full mt-2 w-52 rounded-xl overflow-hidden z-50"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #E8E6F0", boxShadow: "0 8px 30px rgba(0,0,0,0.1)" }}
              >
                <Link
                  href="/dashboard/profile"
                  onClick={() => setUserDropdown(false)}
                  className="flex items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-gray-50"
                  style={{ color: "#1C1B2E", borderBottom: "1px solid #F3F4F6" }}
                >
                  <User size={16} style={{ color: "#5E5495" }} />
                  {t.nav.profile}
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className={`flex items-center gap-2.5 px-4 py-3 text-sm w-full ${isRTL ? "text-right" : "text-left"} transition-colors hover:bg-red-50`}
                  style={{ color: "#DC2626" }}
                >
                  <LogOut size={16} />
                  {t.nav.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Main content ═══ */}
      <main className={`flex-1 ${isRTL ? "mr-0 lg:mr-[270px]" : "ml-0 lg:ml-[270px]"} ${impersonating ? "pt-24 lg:pt-24" : "pt-14 lg:pt-14"}`}>
        {/* Welcome bar - desktop only */}
        <div className="hidden lg:block px-8 pt-6 pb-2">
          <h2 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
            مرحباً {session?.user?.name || "مستخدم"}
          </h2>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {new Date().toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { year: "numeric", month: "long", day: "numeric" })}
            {" — "}
            {new Date().toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.3), transparent)", marginTop: 12 }} />
        </div>
        {children}
      </main>
    </div>
    </ToastProvider>
  );
}
