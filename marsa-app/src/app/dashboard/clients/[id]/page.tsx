"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, User, Building2, Mail, Phone, Calendar,
  FolderKanban, Briefcase, FileText, Bell, CheckSquare,
  DollarSign, TrendingUp, Clock, AlertTriangle, CheckCircle2,
  Shield, ShieldAlert, ShieldOff, FileCheck, FilePlus, Pencil,
  Trash2, Paperclip, Link2, Users, Lock, KeyRound,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

// ===== Types =====
interface ClientData {
  id: string; name: string; email: string; phone: string | null; avatar: string | null; createdAt: string;
  authorizationType: string; authorizationGrantedAt: string | null;
  ownedCompanies: { id: string; name: string; commercialRegister: string | null; sector: string | null }[];
  documents: DocumentItem[];
  stats: {
    totalProjects: number; activeProjects: number; totalServices: number;
    totalTasks: number; completedTasks: number; totalRevenue: number;
    totalPaid: number; totalReminders: number;
    totalDocuments: number; validDocs: number; expiringDocs: number; expiredDocs: number;
  };
}

interface ProjectItem {
  id: string; name: string; status: string; priority: string; startDate: string | null; endDate: string | null;
  progress: number; totalTasks: number; completedTasks: number;
  manager: { name: string } | null;
  invoices: { totalAmount: number; status: string }[];
}

interface ServiceItem {
  id: string; name: string; category: string | null; price: number | null; status: string | null; createdAt: string;
  tasks: { id: string; status: string; title: string }[];
}

interface TaskItem {
  id: string; title: string; status: string; priority: string; dueDate: string | null;
  project: { name: string }; service: { name: string } | null; assignee: { name: string } | null;
}

interface InvoiceItem {
  id: string; invoiceNumber: string; title: string; totalAmount: number; status: string;
  dueDate: string; company: { name: string }; project: { name: string } | null;
  payments: { amount: number }[];
}

interface ReminderItem {
  id: string; title: string; type: string; dueDate: string; status: string; priority: string;
  company: { name: string };
}

interface DocumentItem {
  id: string; title: string; type: string; customTypeName: string | null;
  documentNumber: string | null; issueDate: string | null; expiryDate: string | null;
  status: string; fileUrl: string | null; notes: string | null;
  reminderDays: number; isLinkedToCompany: boolean;
  company: { name: string } | null;
}

interface EmployeeItem {
  id: string; name: string; jobTitle: string | null; department: string | null;
  phone: string | null; status: string; residencyExpiry: string | null;
  company: { name: string };
}

// ===== Configs =====
const tabs = [
  { id: "overview", label: "نظرة عامة", icon: User },
  { id: "projects", label: "المشاريع", icon: FolderKanban },
  { id: "services", label: "الخدمات المفردة", icon: Briefcase },
  { id: "tasks", label: "المهام", icon: CheckSquare },
  { id: "documents", label: "الوثائق الرسمية", icon: FileCheck },
  { id: "employees", label: "الموظفين", icon: Users },
  { id: "invoices", label: "الفواتير", icon: FileText },
  { id: "reminders", label: "التذكيرات", icon: Bell },
];

const projectStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_HOLD: { label: "متوقف", bg: "#FFF7ED", text: "#EA580C" },
  COMPLETED: { label: "مكتمل", bg: "#EFF6FF", text: "#2563EB" },
  CANCELLED: { label: "ملغى", bg: "#FEF2F2", text: "#DC2626" },
};

const taskStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  TODO: { label: "للتنفيذ", bg: "#F3F4F6", text: "#6B7280" },
  WAITING: { label: "في الانتظار", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#EFF6FF", text: "#2563EB" },
  IN_REVIEW: { label: "مراجعة", bg: "#FFF7ED", text: "#EA580C" },
  DONE: { label: "مكتمل", bg: "#ECFDF5", text: "#059669" },
  CANCELLED: { label: "ملغى", bg: "#FEF2F2", text: "#DC2626" },
};

const invoiceStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  SENT: { label: "مرسلة", bg: "#EFF6FF", text: "#2563EB" },
  PAID: { label: "مدفوعة", bg: "#ECFDF5", text: "#059669" },
  OVERDUE: { label: "متأخرة", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "ملغاة", bg: "#F3F4F6", text: "#9CA3AF" },
};

const reminderTypeLabels: Record<string, string> = {
  RESIDENCY_EXPIRY: "انتهاء إقامة", INSURANCE_EXPIRY: "انتهاء تأمين",
  LICENSE_EXPIRY: "انتهاء رخصة", CONTRACT_RENEWAL: "تجديد عقد", CUSTOM: "مخصص",
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "منخفض", color: "#94A3B8" }, MEDIUM: { label: "متوسط", color: "#C9A84C" },
  HIGH: { label: "عالي", color: "#EA580C" }, URGENT: { label: "عاجل", color: "#DC2626" },
  CRITICAL: { label: "حرج", color: "#DC2626" },
};

const serviceStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  PENDING: { label: "معلقة", bg: "#FFF7ED", text: "#EA580C" },
  IN_PROGRESS: { label: "قيد التنفيذ", bg: "#EFF6FF", text: "#2563EB" },
  COMPLETED: { label: "مكتملة", bg: "#ECFDF5", text: "#059669" },
  CANCELLED: { label: "ملغاة", bg: "#FEF2F2", text: "#DC2626" },
};

const docTypeLabels: Record<string, string> = {
  COMMERCIAL_REGISTER: "سجل تجاري", MUNICIPAL_LICENSE: "رخصة بلدية",
  ZAKAT_CERTIFICATE: "شهادة زكاة", INSURANCE_CERTIFICATE: "شهادة تأمينات",
  CHAMBER_CERTIFICATE: "شهادة غرفة تجارية", LEASE_CONTRACT: "عقد إيجار",
  CIVIL_DEFENSE: "رخصة دفاع مدني", SAUDIZATION: "شهادة سعودة",
  GOSI_CERTIFICATE: "شهادة تأمينات اجتماعية", CUSTOM: "مخصص",
};

const docStatusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  VALID: { label: "سارية", bg: "#ECFDF5", text: "#059669", border: "#059669" },
  EXPIRING_SOON: { label: "تنتهي قريباً", bg: "#FFF7ED", text: "#EA580C", border: "#EA580C" },
  EXPIRED: { label: "منتهية", bg: "#FEF2F2", text: "#DC2626", border: "#DC2626" },
  PENDING_RENEWAL: { label: "بانتظار التجديد", bg: "#EFF6FF", text: "#2563EB", border: "#2563EB" },
};

const authConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Shield; desc: string }> = {
  FULL: { label: "تفويض شامل", color: "#059669", bg: "rgba(5,150,105,0.08)", icon: Shield, desc: "الموافقة على إتاحة جميع البيانات لمرسى" },
  PER_SERVICE: { label: "تفويض لكل خدمة", color: "#C9A84C", bg: "rgba(201,168,76,0.1)", icon: ShieldAlert, desc: "كل خدمة تحتاج موافقة عبر OTP" },
  NONE: { label: "بدون تفويض", color: "#94A3B8", bg: "rgba(148,163,184,0.1)", icon: ShieldOff, desc: "البيانات مغلقة" },
};

const employeeStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  ON_LEAVE: { label: "إجازة", bg: "#FFF7ED", text: "#EA580C" },
  TERMINATED: { label: "منتهي", bg: "#FEF2F2", text: "#DC2626" },
};

function fmt(d: string) { return new Date(d).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric" }); }
function daysUntil(d: string) { return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)); }

// ===== Main Component =====
export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState("overview");
  const [client, setClient] = useState<ClientData | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [employeeError, setEmployeeError] = useState<{ requiresAuth?: boolean; requiresOtp?: boolean; message?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  const loadClient = useCallback(() => {
    fetch(`/api/clients/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.id) setClient(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadClient(); }, [loadClient]);

  const loadDocuments = useCallback(() => {
    fetch(`/api/clients/${id}/documents`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDocuments(d); setTabLoading(false); })
      .catch(() => setTabLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab === "overview") return;
    setTabLoading(true);

    if (activeTab === "documents") {
      loadDocuments();
      return;
    }

    if (activeTab === "employees") {
      fetch(`/api/clients/${id}/employees`)
        .then(async (r) => {
          const d = await r.json();
          if (r.ok && Array.isArray(d)) { setEmployees(d); setEmployeeError(null); }
          else { setEmployeeError(d); setEmployees([]); }
          setTabLoading(false);
        })
        .catch(() => setTabLoading(false));
      return;
    }

    fetch(`/api/clients/${id}/${activeTab}`)
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d)) { setTabLoading(false); return; }
        if (activeTab === "projects") setProjects(d);
        else if (activeTab === "services") setServices(d);
        else if (activeTab === "tasks") setTasks(d);
        else if (activeTab === "invoices") setInvoices(d);
        else if (activeTab === "reminders") setReminders(d);
        setTabLoading(false);
      })
      .catch(() => setTabLoading(false));
  }, [activeTab, id, loadDocuments]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <svg className="animate-spin h-10 w-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#1C1B2E" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#1C1B2E" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
    </div>
  );

  if (!client) return <div className="p-8 text-center text-lg" style={{ color: "#DC2626" }}>العميل غير موجود</div>;

  const company = client.ownedCompanies[0];
  const s = client.stats;
  const auth = authConfig[client.authorizationType] || authConfig.NONE;
  const AuthIcon = auth.icon;

  return (
    <div className="p-8" dir="rtl">
      {/* الرأس */}
      <div className="flex items-start gap-4 mb-8">
        <Link href="/dashboard/clients" className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white transition-colors mt-1 shrink-0" style={{ border: "1px solid #E2E0D8" }}>
          <ArrowRight size={20} style={{ color: "#1C1B2E" }} />
        </Link>
        <div className="flex items-start gap-4 flex-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0" style={{ backgroundColor: "rgba(201,168,76,0.12)", color: "#C9A84C" }}>
            {client.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{client.name}</h1>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: auth.bg, color: auth.color }}>
                <AuthIcon size={12} /> {auth.label}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              {company && <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748", opacity: 0.7 }}><Building2 size={14} /> {company.name}</span>}
              <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748", opacity: 0.7 }}><Mail size={14} /> {client.email}</span>
              {client.phone && <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748", opacity: 0.7 }}><Phone size={14} /> {client.phone}</span>}
              <span className="flex items-center gap-1 text-sm" style={{ color: "#2D3748", opacity: 0.5 }}><Calendar size={14} /> عميل منذ {fmt(client.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* تنبيهات الوثائق */}
      {(s.expiredDocs > 0 || s.expiringDocs > 0) && (
        <div className="mb-6 p-4 rounded-2xl flex items-center gap-3" style={{ backgroundColor: s.expiredDocs > 0 ? "rgba(220,38,38,0.06)" : "rgba(234,88,12,0.06)", border: `1px solid ${s.expiredDocs > 0 ? "rgba(220,38,38,0.15)" : "rgba(234,88,12,0.15)"}` }}>
          <AlertTriangle size={20} style={{ color: s.expiredDocs > 0 ? "#DC2626" : "#EA580C" }} />
          <div>
            {s.expiredDocs > 0 && <p className="text-sm font-medium" style={{ color: "#DC2626" }}>{s.expiredDocs} وثيقة منتهية الصلاحية</p>}
            {s.expiringDocs > 0 && <p className="text-sm font-medium" style={{ color: "#EA580C" }}>{s.expiringDocs} وثيقة تنتهي خلال 30 يوم</p>}
          </div>
          <button onClick={() => setActiveTab("documents")} className="mr-auto text-xs font-medium hover:underline" style={{ color: "#C9A84C" }}>عرض الوثائق</button>
        </div>
      )}

      {/* التبويبات */}
      <div className="bg-white rounded-2xl mb-6 overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-5 py-4 text-sm font-medium transition-all whitespace-nowrap relative"
              style={activeTab === tab.id ? { color: "#C9A84C" } : { color: "#94A3B8" }}>
              <tab.icon size={16} /> {tab.label}
              {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "#C9A84C" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* محتوى التبويب */}
      {tabLoading ? (
        <div className="flex justify-center py-16"><svg className="animate-spin h-8 w-8" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#C9A84C" strokeWidth="4" fill="none" /><path className="opacity-75" fill="#C9A84C" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab client={client} stats={s} company={company} auth={auth} AuthIcon={AuthIcon} />}
          {activeTab === "projects" && <ProjectsTab projects={projects} />}
          {activeTab === "services" && <ServicesTab services={services} onDelete={(id) => setServices((prev) => prev.filter((s) => s.id !== id))} />}
          {activeTab === "tasks" && <TasksTab tasks={tasks} />}
          {activeTab === "documents" && <DocumentsTab documents={documents} clientId={id} companyId={company?.id} onRefresh={loadDocuments} />}
          {activeTab === "employees" && <EmployeesTab employees={employees} error={employeeError} clientId={id} authType={client.authorizationType} onVerified={() => { setTabLoading(true); fetch(`/api/clients/${id}/employees`).then((r) => r.json()).then((d) => { if (Array.isArray(d)) { setEmployees(d); setEmployeeError(null); } setTabLoading(false); }); }} />}
          {activeTab === "invoices" && <InvoicesTab invoices={invoices} />}
          {activeTab === "reminders" && <RemindersTab reminders={reminders} />}
        </>
      )}
    </div>
  );
}

// ===== Overview Tab =====
function OverviewTab({ stats: s, company, auth, AuthIcon }: {
  client: ClientData; stats: ClientData["stats"];
  company: ClientData["ownedCompanies"][0] | undefined;
  auth: typeof authConfig["FULL"]; AuthIcon: typeof Shield;
}) {
  const overviewStats = [
    { label: "المشاريع", value: s.totalProjects, sub: `${s.activeProjects} نشط`, icon: FolderKanban, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "الخدمات", value: s.totalServices, icon: Briefcase, color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
    { label: "المهام", value: s.totalTasks, sub: `${s.completedTasks} مكتمل`, icon: CheckSquare, color: "#2563EB", bg: "rgba(37,99,235,0.08)" },
    { label: "الوثائق", value: s.totalDocuments, sub: s.expiredDocs > 0 ? `${s.expiredDocs} منتهية` : undefined, icon: FileCheck, color: "#7C3AED", bg: "rgba(124,58,237,0.08)" },
    { label: "الإيرادات", value: s.totalRevenue, isCurrency: true, icon: DollarSign, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "التذكيرات", value: s.totalReminders, icon: Bell, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {overviewStats.map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: stat.bg }}>
              <stat.icon size={18} style={{ color: stat.color }} />
            </div>
            <p className="text-xl font-bold" style={{ color: stat.color }}>{stat.isCurrency ? stat.value.toLocaleString("en-US") : stat.value}</p>
            {stat.isCurrency && <SarSymbol size={10} />}
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{stat.label}</p>
            {stat.sub && <p className="text-[10px] mt-0.5" style={{ color: stat.sub.includes("منتهية") ? "#DC2626" : "#059669" }}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* حالة التفويض */}
        <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
          <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "#1C1B2E" }}>
            <Shield size={18} style={{ color: "#C9A84C" }} /> حالة التفويض
          </h3>
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: auth.bg }}>
            <AuthIcon size={24} style={{ color: auth.color }} />
            <div>
              <p className="text-sm font-bold" style={{ color: auth.color }}>{auth.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{auth.desc}</p>
            </div>
          </div>
        </div>

        {/* معلومات الشركة */}
        {company && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "#1C1B2E" }}>
              <Building2 size={18} style={{ color: "#C9A84C" }} /> معلومات الشركة
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>اسم الشركة</p><p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{company.name}</p></div>
              {company.commercialRegister && <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>السجل التجاري</p><p className="text-sm font-medium font-mono" style={{ color: "#1C1B2E" }}>{company.commercialRegister}</p></div>}
              {company.sector && <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>القطاع</p><p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{company.sector}</p></div>}
            </div>
          </div>
        )}
      </div>

      {/* الملخص المالي */}
      <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
        <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: "#1C1B2E" }}>
          <DollarSign size={18} style={{ color: "#C9A84C" }} /> الملخص المالي
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>إجمالي الإيرادات</p><p className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{s.totalRevenue.toLocaleString("en-US")} <SarSymbol size={12} /></p></div>
          <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>المحصل</p><p className="text-2xl font-bold" style={{ color: "#059669" }}>{s.totalPaid.toLocaleString("en-US")} <SarSymbol size={12} /></p></div>
          <div><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>المتبقي</p><p className="text-2xl font-bold" style={{ color: (s.totalRevenue - s.totalPaid) > 0 ? "#DC2626" : "#059669" }}>{(s.totalRevenue - s.totalPaid).toLocaleString("en-US")} <SarSymbol size={12} /></p></div>
        </div>
        {s.totalRevenue > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs mb-1" style={{ color: "#94A3B8" }}><span>نسبة التحصيل</span><span>{Math.round((s.totalPaid / s.totalRevenue) * 100)}%</span></div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min((s.totalPaid / s.totalRevenue) * 100, 100)}%`, backgroundColor: "#059669" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Projects Tab =====
function ProjectsTab({ projects }: { projects: ProjectItem[] }) {
  if (projects.length === 0) return <EmptyState icon={FolderKanban} text="لا توجد مشاريع لهذا العميل" />;
  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const st = projectStatusConfig[p.status] || projectStatusConfig.DRAFT;
        const invoiceTotal = p.invoices.reduce((s, inv) => s + inv.totalAmount, 0);
        return (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="bg-white rounded-2xl p-5 block hover:shadow-md transition-all" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3"><h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>{p.name}</h3><span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></div>
              {p.manager && <span className="text-xs" style={{ color: "#94A3B8" }}>المدير: {p.manager.name}</span>}
            </div>
            <div className="flex items-center gap-6 text-sm" style={{ color: "#2D3748" }}>
              <span>المهام: {p.completedTasks}/{p.totalTasks}</span>
              {invoiceTotal > 0 && <span style={{ color: "#059669" }}>الفواتير: {invoiceTotal.toLocaleString("en-US")} <SarSymbol size={14} /></span>}
            </div>
            {p.totalTasks > 0 && <div className="mt-3"><div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F3F4F6" }}><div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: "#C9A84C" }} /></div><p className="text-[10px] mt-1 text-left" style={{ color: "#94A3B8" }}>{p.progress}%</p></div>}
          </Link>
        );
      })}
    </div>
  );
}

// ===== Services Tab =====
function ServicesTab({ services, onDelete }: { services: ServiceItem[]; onDelete: (id: string) => void }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/services/${id}`, { method: "DELETE" });
      onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  if (services.length === 0) return <EmptyState icon={Briefcase} text="لا توجد خدمات مفردة لهذا العميل" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {services.map((svc) => {
        const st = serviceStatusConfig[svc.status || "PENDING"] || serviceStatusConfig.PENDING;
        const doneTasks = svc.tasks.filter((t) => t.status === "DONE").length;
        return (
          <div key={svc.id} className="relative group bg-white rounded-2xl p-5" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-3"><h3 className="text-base font-bold" style={{ color: "#1C1B2E" }}>{svc.name}</h3><span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></div>
            <div className="flex items-center gap-4 text-sm">
              {svc.category && <span className="px-2 py-0.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>{svc.category}</span>}
              {svc.price && <span style={{ color: "#059669" }}>{svc.price.toLocaleString("en-US")} <SarSymbol size={14} /></span>}
              <span style={{ color: "#94A3B8" }}>المهام: {doneTasks}/{svc.tasks.length}</span>
            </div>
            {confirmId === svc.id ? (
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-lg z-10" style={{ border: "1px solid #FCA5A5" }}>
                <span className="text-xs font-medium" style={{ color: "#DC2626" }}>تأكيد الحذف؟</span>
                <button onClick={() => handleDelete(svc.id)} disabled={deletingId === svc.id}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: "#DC2626" }}>
                  {deletingId === svc.id ? "..." : "نعم"}
                </button>
                <button onClick={() => setConfirmId(null)} className="px-2 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                  لا
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmId(svc.id)}
                className="absolute top-3 left-3 w-8 h-8 rounded-lg items-center justify-center hidden group-hover:flex"
                style={{ backgroundColor: "rgba(220,38,38,0.08)", color: "#DC2626" }}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ===== Tasks Tab =====
function TasksTab({ tasks }: { tasks: TaskItem[] }) {
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  if (tasks.length === 0) return <EmptyState icon={CheckSquare} text="لا توجد مهام لهذا العميل" />;

  const columns = ["TODO", "WAITING", "IN_PROGRESS", "IN_REVIEW", "DONE"];
  const columnLabels: Record<string, string> = { TODO: "للتنفيذ", WAITING: "في الانتظار", IN_PROGRESS: "قيد التنفيذ", IN_REVIEW: "مراجعة", DONE: "مكتمل" };
  const columnColors: Record<string, string> = { TODO: "#6B7280", WAITING: "#EA580C", IN_PROGRESS: "#2563EB", IN_REVIEW: "#EA580C", DONE: "#059669" };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setViewMode("kanban")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={viewMode === "kanban" ? { backgroundColor: "#5E5495", color: "white" } : { color: "#94A3B8", border: "1px solid #E2E0D8" }}>Kanban</button>
        <button onClick={() => setViewMode("table")} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={viewMode === "table" ? { backgroundColor: "#5E5495", color: "white" } : { color: "#94A3B8", border: "1px solid #E2E0D8" }}>جدول</button>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="rounded-2xl p-3" style={{ backgroundColor: "rgba(27,42,74,0.03)" }}>
                <div className="flex items-center gap-2 mb-3 px-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: columnColors[col] }} /><span className="text-xs font-bold" style={{ color: "#1C1B2E" }}>{columnLabels[col]}</span><span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#E8E6F0", color: "#2D3748" }}>{colTasks.length}</span></div>
                <div className="space-y-2">
                  {colTasks.map((task) => {
                    const pr = priorityConfig[task.priority] || priorityConfig.MEDIUM;
                    return (
                      <div key={task.id} className="bg-white rounded-xl p-3" style={{ border: "1px solid #E2E0D8" }}>
                        <p className="text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>{task.title}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}>{task.project.name}</span>
                          <span className="text-[10px]" style={{ color: pr.color }}>{pr.label}</span>
                          {task.assignee && <span className="text-[10px]" style={{ color: "#94A3B8" }}>{task.assignee.name}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
          <table className="w-full">
            <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>{["المهمة", "المشروع", "الحالة", "الأولوية", "المسؤول"].map((h, i) => (<th key={i} className="text-right px-4 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>))}</tr></thead>
            <tbody>{tasks.map((task) => { const st = taskStatusConfig[task.status] || taskStatusConfig.TODO; const pr = priorityConfig[task.priority] || priorityConfig.MEDIUM; return (<tr key={task.id} className="hover:bg-gray-50/50" style={{ borderBottom: "1px solid #F0EDE6" }}><td className="px-4 py-3 text-sm font-medium" style={{ color: "#1C1B2E" }}>{task.title}</td><td className="px-4 py-3 text-xs" style={{ color: "#C9A84C" }}>{task.project.name}</td><td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td><td className="px-4 py-3 text-xs" style={{ color: pr.color }}>{pr.label}</td><td className="px-4 py-3 text-xs" style={{ color: "#94A3B8" }}>{task.assignee?.name || "—"}</td></tr>); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ===== Documents Tab =====
function DocumentsTab({ documents, clientId, companyId, onRefresh }: { documents: DocumentItem[]; clientId: string; companyId?: string; onRefresh: () => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", type: "COMMERCIAL_REGISTER" as string, customTypeName: "", documentNumber: "",
    issueDate: "", expiryDate: "", notes: "", reminderDays: "30", isLinkedToCompany: false,
  });

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const validCount = documents.filter((d) => !d.expiryDate || new Date(d.expiryDate) > thirtyDays).length;
  const expiringCount = documents.filter((d) => d.expiryDate && new Date(d.expiryDate) >= now && new Date(d.expiryDate) <= thirtyDays).length;
  const expiredCount = documents.filter((d) => d.expiryDate && new Date(d.expiryDate) < now).length;

  const filtered = documents.filter((d) => {
    if (filterType && d.type !== filterType) return false;
    if (filterStatus) {
      const expiry = d.expiryDate ? new Date(d.expiryDate) : null;
      if (filterStatus === "VALID" && expiry && expiry <= thirtyDays) return false;
      if (filterStatus === "EXPIRING_SOON" && (!expiry || expiry < now || expiry > thirtyDays)) return false;
      if (filterStatus === "EXPIRED" && (!expiry || expiry >= now)) return false;
    }
    return true;
  });

  const openAdd = () => {
    setEditDoc(null);
    setForm({ title: "", type: "COMMERCIAL_REGISTER", customTypeName: "", documentNumber: "", issueDate: "", expiryDate: "", notes: "", reminderDays: "30", isLinkedToCompany: false });
    setShowModal(true);
  };

  const openEdit = (doc: DocumentItem) => {
    setEditDoc(doc);
    setForm({
      title: doc.title, type: doc.type, customTypeName: doc.customTypeName || "",
      documentNumber: doc.documentNumber || "",
      issueDate: doc.issueDate ? doc.issueDate.split("T")[0] : "",
      expiryDate: doc.expiryDate ? doc.expiryDate.split("T")[0] : "",
      notes: doc.notes || "", reminderDays: String(doc.reminderDays),
      isLinkedToCompany: doc.isLinkedToCompany,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = editDoc ? `/api/documents/${editDoc.id}` : `/api/clients/${clientId}/documents`;
    const method = editDoc ? "PATCH" : "POST";
    try {
      await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId: companyId || null }),
      });
      setShowModal(false);
      onRefresh();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوثيقة؟")) return;
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    onRefresh();
  };

  const docStats = [
    { label: "إجمالي الوثائق", value: documents.length, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "سارية", value: validCount, color: "#059669", bg: "rgba(5,150,105,0.08)" },
    { label: "تنتهي قريباً", value: expiringCount, color: "#EA580C", bg: "rgba(234,88,12,0.08)" },
    { label: "منتهية", value: expiredCount, color: "#DC2626", bg: "rgba(220,38,38,0.08)" },
  ];

  return (
    <div className="space-y-6">
      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {docStats.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E2E0D8" }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* فلاتر وزر إضافة */}
      <div className="bg-white rounded-2xl p-4 flex items-center gap-3 flex-wrap" style={{ border: "1px solid #E2E0D8" }}>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الأنواع</option>
          {Object.entries(docTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
          <option value="">كل الحالات</option>
          <option value="VALID">سارية</option>
          <option value="EXPIRING_SOON">تنتهي قريباً</option>
          <option value="EXPIRED">منتهية</option>
        </select>
        <button onClick={openAdd} className="mr-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all" style={{ backgroundColor: "#5E5495" }}>
          <FilePlus size={16} /> إضافة وثيقة
        </button>
      </div>

      {/* بطاقات الوثائق */}
      {filtered.length === 0 ? (
        <EmptyState icon={FileCheck} text="لا توجد وثائق" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => {
            const days = doc.expiryDate ? daysUntil(doc.expiryDate) : null;
            const computedStatus = !doc.expiryDate ? "VALID" : days !== null && days < 0 ? "EXPIRED" : days !== null && days <= 30 ? "EXPIRING_SOON" : "VALID";
            const ds = docStatusConfig[computedStatus] || docStatusConfig.VALID;
            return (
              <div key={doc.id} className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5" style={{ border: `1px solid ${ds.border}20`, borderRight: `4px solid ${ds.border}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-lg" style={{ backgroundColor: ds.bg, color: ds.text }}>{ds.label}</span>
                    <h4 className="text-sm font-bold mt-2" style={{ color: "#1C1B2E" }}>{doc.type === "CUSTOM" ? (doc.customTypeName || doc.title) : docTypeLabels[doc.type]}</h4>
                    {doc.type !== "CUSTOM" && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{doc.title}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(doc)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><Pencil size={13} style={{ color: "#94A3B8" }} /></button>
                    <button onClick={() => handleDelete(doc.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50"><Trash2 size={13} style={{ color: "#DC2626" }} /></button>
                  </div>
                </div>

                {doc.documentNumber && <p className="text-xs font-mono mb-2" style={{ color: "#2D3748" }}>رقم: {doc.documentNumber}</p>}

                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  {doc.issueDate && <div><span style={{ color: "#94A3B8" }}>الإصدار: </span><span style={{ color: "#2D3748" }}>{fmt(doc.issueDate)}</span></div>}
                  {doc.expiryDate && <div><span style={{ color: "#94A3B8" }}>الانتهاء: </span><span style={{ color: "#2D3748" }}>{fmt(doc.expiryDate)}</span></div>}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {days !== null && (
                    <span className="text-xs font-bold" style={{ color: days < 0 ? "#DC2626" : days <= 30 ? "#EA580C" : "#059669" }}>
                      {days < 0 ? `منتهية منذ ${Math.abs(days)} يوم` : days === 0 ? "تنتهي اليوم" : `${days} يوم متبقي`}
                    </span>
                  )}
                  {doc.fileUrl && <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#2563EB" }}><Paperclip size={10} /> مرفق</span>}
                  {doc.isLinkedToCompany && <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}><Link2 size={10} /> مرتبط بالشركة</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* نافذة إضافة/تعديل */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5" style={{ color: "#1C1B2E" }}>{editDoc ? "تعديل الوثيقة" : "إضافة وثيقة جديدة"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>نوع الوثيقة *</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white" style={{ borderColor: "#E8E6F0" }}>
                  {Object.entries(docTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              {form.type === "CUSTOM" && (
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>اسم النوع المخصص</label>
                  <input type="text" value={form.customTypeName} onChange={(e) => setForm({ ...form, customTypeName: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>عنوان الوثيقة *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>رقم الوثيقة</label>
                <input type="text" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الإصدار</label>
                  <input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الانتهاء</label>
                  <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>أيام التنبيه المسبق</label>
                <input type="number" value={form.reminderDays} onChange={(e) => setForm({ ...form, reminderDays: e.target.value })} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>ملاحظات</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "#E8E6F0" }} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isLinkedToCompany} onChange={(e) => setForm({ ...form, isLinkedToCompany: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: "#2D3748" }}>ربط بالشركة لتنفيذ الخدمات</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 rounded-xl text-sm font-medium" style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}>إلغاء</button>
                <button type="submit" disabled={saving} className="flex-1 px-4 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#5E5495" }}>{saving ? "جارٍ الحفظ..." : editDoc ? "حفظ التعديلات" : "إضافة الوثيقة"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Employees Tab =====
function EmployeesTab({ employees, error, clientId, authType, onVerified }: {
  employees: EmployeeItem[]; error: { requiresAuth?: boolean; requiresOtp?: boolean; message?: string } | null;
  clientId: string; authType: string; onVerified: () => void;
}) {
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  // بدون تفويض
  if (error?.requiresAuth || authType === "NONE") {
    return (
      <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
        <Lock size={48} className="mx-auto mb-4" style={{ color: "#94A3B8", opacity: 0.4 }} />
        <p className="text-lg font-medium mb-2" style={{ color: "#2D3748" }}>لم يتم التفويض</p>
        <p className="text-sm mb-4" style={{ color: "#94A3B8" }}>لا يمكن عرض بيانات الموظفين — يحتاج العميل لمنح التفويض أولاً</p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm" style={{ backgroundColor: "rgba(148,163,184,0.1)", color: "#94A3B8" }}>
          <ShieldOff size={16} /> التفويض غير متاح
        </div>
      </div>
    );
  }

  // تفويض لكل خدمة - يحتاج OTP
  if ((error?.requiresOtp || authType === "PER_SERVICE") && !verified) {
    const handleVerify = async () => {
      setVerifying(true);
      setOtpError("");
      try {
        const res = await fetch(`/api/clients/${clientId}/otp`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ otp }),
        });
        const data = await res.json();
        if (data.verified) { setVerified(true); onVerified(); }
        else setOtpError("رمز التحقق غير صحيح");
      } catch { setOtpError("حدث خطأ"); }
      setVerifying(false);
    };

    return (
      <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
        <KeyRound size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.5 }} />
        <p className="text-lg font-medium mb-2" style={{ color: "#2D3748" }}>مطلوب موافقة العميل</p>
        <p className="text-sm mb-6" style={{ color: "#94A3B8" }}>أدخل رمز التحقق OTP المرسل للعميل</p>
        <div className="flex items-center justify-center gap-3 max-w-xs mx-auto">
          <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="w-32 px-4 py-3 rounded-xl border text-center text-lg font-mono tracking-widest outline-none" style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }} />
          <button onClick={handleVerify} disabled={verifying || otp.length < 6} className="px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: "#C9A84C" }}>
            {verifying ? "..." : "تحقق"}
          </button>
        </div>
        {otpError && <p className="text-sm mt-3" style={{ color: "#DC2626" }}>{otpError}</p>}
        <p className="text-xs mt-4" style={{ color: "#94A3B8" }}>رمز المحاكاة: 123456</p>
      </div>
    );
  }

  // تفويض شامل أو تم التحقق
  if (employees.length === 0) return <EmptyState icon={Users} text="لا يوجد موظفين مسجلين لشركة العميل" />;

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
      <table className="w-full">
        <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>
          {["الاسم", "الوظيفة", "القسم", "الجوال", "الحالة", "انتهاء الإقامة"].map((h, i) => (
            <th key={i} className="text-right px-4 py-3.5 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {employees.map((emp) => {
            const st = employeeStatusConfig[emp.status] || employeeStatusConfig.ACTIVE;
            const resDays = emp.residencyExpiry ? daysUntil(emp.residencyExpiry) : null;
            return (
              <tr key={emp.id} className="hover:bg-gray-50/50" style={{ borderBottom: "1px solid #F0EDE6" }}>
                <td className="px-4 py-3.5 text-sm font-medium" style={{ color: "#1C1B2E" }}>{emp.name}</td>
                <td className="px-4 py-3.5 text-sm" style={{ color: "#2D3748" }}>{emp.jobTitle || "—"}</td>
                <td className="px-4 py-3.5 text-sm" style={{ color: "#2D3748" }}>{emp.department || "—"}</td>
                <td className="px-4 py-3.5 text-sm font-mono" style={{ color: "#94A3B8" }}>{emp.phone || "—"}</td>
                <td className="px-4 py-3.5"><span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                <td className="px-4 py-3.5 text-xs" style={{ color: resDays !== null && resDays < 30 ? "#DC2626" : "#94A3B8" }}>
                  {emp.residencyExpiry ? fmt(emp.residencyExpiry) : "—"}
                  {resDays !== null && resDays < 30 && <span className="mr-1 text-[10px] font-bold">({resDays} يوم)</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ===== Invoices Tab =====
function InvoicesTab({ invoices }: { invoices: InvoiceItem[] }) {
  if (invoices.length === 0) return <EmptyState icon={FileText} text="لا توجد فواتير لهذا العميل" />;
  const totalAmount = invoices.reduce((s, inv) => s + inv.totalAmount, 0);
  const totalPaid = invoices.reduce((s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E2E0D8" }}><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>إجمالي الفواتير</p><p className="text-xl font-bold" style={{ color: "#1C1B2E" }}>{totalAmount.toLocaleString("en-US")} <SarSymbol size={10} /></p></div>
        <div className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E2E0D8" }}><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>المحصل</p><p className="text-xl font-bold" style={{ color: "#059669" }}>{totalPaid.toLocaleString("en-US")} <SarSymbol size={10} /></p></div>
        <div className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #E2E0D8" }}><p className="text-xs mb-1" style={{ color: "#94A3B8" }}>المتبقي</p><p className="text-xl font-bold" style={{ color: "#DC2626" }}>{(totalAmount - totalPaid).toLocaleString("en-US")} <SarSymbol size={10} /></p></div>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
        <table className="w-full">
          <thead><tr style={{ backgroundColor: "rgba(27,42,74,0.03)", borderBottom: "1px solid #E2E0D8" }}>{["رقم الفاتورة", "العنوان", "المبلغ", "المدفوع", "الحالة", "الاستحقاق", ""].map((h, i) => (<th key={i} className="text-right px-4 py-3 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.6 }}>{h}</th>))}</tr></thead>
          <tbody>{invoices.map((inv) => { const st = invoiceStatusConfig[inv.status] || invoiceStatusConfig.DRAFT; const paid = inv.payments.reduce((s, p) => s + p.amount, 0); return (<tr key={inv.id} className="hover:bg-gray-50/50" style={{ borderBottom: "1px solid #F0EDE6" }}><td className="px-4 py-3"><span className="text-sm font-mono font-bold" style={{ color: "#C9A84C" }}>{inv.invoiceNumber}</span></td><td className="px-4 py-3 text-sm" style={{ color: "#1C1B2E" }}>{inv.title}</td><td className="px-4 py-3 text-sm font-bold" style={{ color: "#1C1B2E" }}>{inv.totalAmount.toLocaleString("en-US")} <SarSymbol size={14} /></td><td className="px-4 py-3 text-sm" style={{ color: "#059669" }}>{paid.toLocaleString("en-US")} <SarSymbol size={14} /></td><td className="px-4 py-3"><span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td><td className="px-4 py-3 text-xs" style={{ color: "#94A3B8" }}>{fmt(inv.dueDate)}</td><td className="px-4 py-3"><Link href={`/dashboard/finance/invoices/${inv.id}`} className="text-xs font-medium hover:underline" style={{ color: "#C9A84C" }}>عرض</Link></td></tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}

// ===== Reminders Tab =====
function RemindersTab({ reminders }: { reminders: ReminderItem[] }) {
  if (reminders.length === 0) return <EmptyState icon={Bell} text="لا توجد تذكيرات لهذا العميل" />;
  const reminderStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
    PENDING: { label: "معلق", bg: "#FFF7ED", text: "#EA580C" }, NOTIFIED: { label: "تم التنبيه", bg: "#EFF6FF", text: "#2563EB" },
    COMPLETED: { label: "مكتمل", bg: "#ECFDF5", text: "#059669" }, OVERDUE: { label: "متأخر", bg: "#FEF2F2", text: "#DC2626" },
  };

  return (
    <div className="space-y-3">
      {reminders.map((r) => {
        const st = reminderStatusConfig[r.status] || reminderStatusConfig.PENDING;
        const pr = priorityConfig[r.priority] || priorityConfig.MEDIUM;
        const days = daysUntil(r.dueDate);
        return (
          <div key={r.id} className="bg-white rounded-2xl p-5 flex items-center justify-between" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: st.bg }}>
                {days < 0 ? <AlertTriangle size={18} style={{ color: "#DC2626" }} /> : days <= 7 ? <Clock size={18} style={{ color: "#EA580C" }} /> : <CheckCircle2 size={18} style={{ color: st.text }} />}
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>{r.title}</h4>
                <div className="flex items-center gap-3 mt-1"><span className="text-xs" style={{ color: "#94A3B8" }}>{reminderTypeLabels[r.type] || r.type}</span><span className="text-xs" style={{ color: pr.color }}>{pr.label}</span><span className="text-xs" style={{ color: "#94A3B8" }}>{fmt(r.dueDate)}</span></div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold" style={{ color: days < 0 ? "#DC2626" : days <= 7 ? "#EA580C" : "#059669" }}>{days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? "اليوم" : `${days} يوم`}</span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===== Empty State =====
function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ size: number; className?: string; style?: React.CSSProperties }>; text: string }) {
  return (
    <div className="text-center py-16 bg-white rounded-2xl" style={{ border: "1px solid #E2E0D8" }}>
      <Icon size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.3 }} />
      <p className="text-base font-medium" style={{ color: "#2D3748" }}>{text}</p>
    </div>
  );
}
