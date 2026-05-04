"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowLeftRight,
  Search,
  User,
  FolderKanban,
  FileText,
  Plus,
  Trash2,
  GripVertical,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  ListChecks,
  Layers,
  ChevronDown,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Package,
  BookTemplate,
  CreditCard,
  Edit3,
  Building2,
  Briefcase,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { UploadButton } from "@/lib/uploadthing";
import { addWorkingDays, countWorkingDays } from "@/lib/working-days";

// ─── Types ───────────────────────────────────────────────────────

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  ownedCompanies?: { id: string; name: string }[];
}

interface ServiceTemplate {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number | null;
  defaultDuration: number | null;
  workflowType: string;
  isActive: boolean;
  sortOrder: number;
  category?: Category;
  _count: { taskTemplates: number; qualifiedEmployees: number };
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { templates: number };
}

interface SelectedService {
  serviceTemplateId: string;
  name: string;
  categoryColor: string | null;
  categoryName: string;
  price: number;
  duration: number | null;
  taskCount: number;
  sortOrder: number;
  // Execution mode for the tasks within this service.
  //   SEQUENTIAL → tasks run one after the other (default)
  //   PARALLEL   → tasks may run simultaneously, but the service still
  //                waits for the previous service to finish
  //   INDEPENDENT → tasks bypass every order/service-boundary check
  executionMode: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
  isBackground: boolean;
}

interface TaskTemplateDetail {
  id: string;
  name: string;
  description: string | null;
  defaultDuration: number;
  sortOrder: number;
  isRequired: boolean;
}

interface ServiceDetail {
  id: string;
  name: string;
  taskTemplates: TaskTemplateDetail[];
  category?: Category;
}

interface TemplateMilestone {
  id: string;
  title: string;
  amount: number;
  afterServiceIndex: number;
  order: number;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string | null;
  workflowType: string;
  isActive: boolean;
  _count: { services: number; projects: number };
  services?: {
    serviceTemplateId: string;
    sortOrder: number;
    executionMode?: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
    serviceTemplate: ServiceTemplate;
  }[];
  milestones?: TemplateMilestone[];
  createdBy?: { name: string };
}

interface PaymentMilestone {
  id: string;
  title: string;
  amount: number;
  afterServiceIndex: number;
}

interface ContractInstallment {
  id: string;
  title: string;
  amount: number;
  percentage: number | null;
  dueAfterDays: number | null;
  order: number;
}

interface ContractOption {
  id: string;
  contractNumber: number | null;
  templateTitle: string;
  clientName: string;
  variables: string;
  status: string;
  installments?: ContractInstallment[];
}

interface ManagerOption {
  id: string;
  name: string;
  role: string;
}

// ─── Component ───────────────────────────────────────────────────

export default function NewProjectPage() {
  const { t } = useLang();
  const router = useRouter();

  // ─── Step management ───
  const [currentStep, setCurrentStep] = useState(1);

  // ─── Step 1 state ───
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<ClientUser[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientUser | null>(null);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientSearchTimeout = useRef<NodeJS.Timeout | null>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Inline add client
  const [showInlineAddClient, setShowInlineAddClient] = useState(false);
  const [inlineClient, setInlineClient] = useState({ name: "", email: "", phone: "", company: "" });
  const [inlineClientSaving, setInlineClientSaving] = useState(false);
  const [inlineClientError, setInlineClientError] = useState("");

  // Project name is computed automatically from template + client and is
  // not directly editable on the create page (the user can rename the
  // project later from the project detail page). The state still backs
  // the step-7 preview and is what gets sent to the API.
  const [projectName, setProjectName] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  // Project partners (multi-party deals). Step 3 starts with a single
  // implicit "project owner" partner; the user can bump the count up to
  // 10 and name each one. Persisted to ProjectPartner on submit.
  const [partnersCount, setPartnersCount] = useState<number>(1);
  const [partnerNames, setPartnerNames] = useState<string[]>([""]);

  // Sync the first partner name with the selected client so it's
  // pre-filled automatically when the user picks a client.
  useEffect(() => {
    setPartnerNames((prev) => {
      const next = [...prev];
      next[0] = selectedClient?.name || "";
      return next;
    });
  }, [selectedClient]);

  const [departments, setDepartments] = useState<{id:string;name:string;nameEn:string|null;color:string|null}[]>([]);
  const [workflowType, setWorkflowType] = useState<"SEQUENTIAL" | "INDEPENDENT">("SEQUENTIAL");

  // SLA Timeline

  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);

  // ─── Contract selection ───
  const [clientContracts, setClientContracts] = useState<ContractOption[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [contractAmount, setContractAmount] = useState<number | null>(null);
  const [contractInstallments, setContractInstallments] = useState<ContractInstallment[]>([]);

  // ─── Inline contract form (created together with the project) ───
  // mode: "" = no choice yet, "existing" = upload signed PDF, "new" = create new
  const [contractMode, setContractMode] = useState<"" | "existing" | "new">("");
  const [contractForm, setContractForm] = useState({
    contractNumber: "",
    startDate: "",
    endDate: "",
    durationDays: "",
    contractValue: "",
    uploadedFileUrl: "",
  });
  const [contractError, setContractError] = useState("");
  const handleContractFormChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const field = e.target.name;
    const next = { ...contractForm, [field]: e.target.value };

    // Two-way relationship between startDate, durationDays, and endDate,
    // all measured in WORKING days (Sat is the only weekend day):
    //
    //   - startDate or durationDays change → recompute endDate forward
    //   - endDate changes → recompute durationDays from the start
    //
    // The user can still edit endDate manually; that just feeds the
    // duration calculation in reverse instead of being overwritten.
    if (field === "startDate" || field === "durationDays") {
      const days = parseInt(next.durationDays);
      if (next.startDate && Number.isFinite(days) && days > 0) {
        const start = new Date(next.startDate);
        const end = addWorkingDays(start, days);
        next.endDate = end.toISOString().slice(0, 10);
      }
    } else if (field === "endDate") {
      if (next.startDate && next.endDate) {
        const start = new Date(next.startDate);
        const end = new Date(next.endDate);
        if (end > start) {
          next.durationDays = String(countWorkingDays(start, end));
        }
      }
    }

    setContractForm(next);
  };

  // ─── Step 2 state ───
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTemplatesMap, setCategoryTemplatesMap] = useState<Record<string, ServiceTemplate[]>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // ─── Payment milestones — defined inline within the services step ───
  // The wizard collapsed the old standalone "جدول الدفعات" step into this
  // single source. Each milestone has { title, amount, afterServiceIndex }
  // and the server materializes them as ContractPaymentInstallment rows
  // that lock the next service's first task.
  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestone[]>([]);

  // ─── Step 3 — optional company branches (Investment department only) ───
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchesExpanded, setBranchesExpanded] = useState(false);

  // ─── Step 4 state — assign project manager (optional) ───
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [selectedManagerId, setSelectedManagerId] = useState("");
  // Executor override — admin/manager can pick ANY active executor.
  // Pool restriction was removed: previously this dropdown only showed
  // members of the chosen department's assignment-pool, which forced
  // creators to add the executor to a department first. Now the full
  // active EXECUTOR list is shown; auto-distribution remains the default
  // when no override is selected.
  const [poolMembers, setPoolMembers] = useState<{ userId: string; user: { id: string; name: string; role: string } }[]>([]);
  const [allExecutors, setAllExecutors] = useState<{ id: string; name: string; specialization: string | null }[]>([]);
  const [selectedExecutorId, setSelectedExecutorId] = useState("");

  // ─── Step 5 (review) state ───
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);

  // Rotate loading messages while submitting
  useEffect(() => {
    if (!submitting) { setLoadingMsg(0); return; }
    const interval = setInterval(() => {
      setLoadingMsg((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, [submitting]);

  // ─── Click outside to close dropdown ───
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Fetch departments on mount ───
  useEffect(() => {
    fetch("/api/departments").then(r => r.json()).then(d => { if (Array.isArray(d)) setDepartments(d); });
  }, []);

  // ─── Fetch managers when entering the manager step ───
  useEffect(() => {
    if (currentStep !== 4 || managers.length > 0) return;
    setLoadingManagers(true);
    fetch("/api/users?transferTargets=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Only ADMIN/MANAGER are eligible to be project managers
          setManagers(data.filter((u: ManagerOption) => ["ADMIN", "MANAGER"].includes(u.role)));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingManagers(false));
  }, [currentStep, managers.length]);

  // ─── Fetch department pool members (still used for default routing
  //     hints and backward compat) ───
  useEffect(() => {
    if (!departmentId) { setPoolMembers([]); setSelectedExecutorId(""); return; }
    fetch(`/api/departments/${departmentId}/assignment-pool`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPoolMembers(data); })
      .catch(() => setPoolMembers([]));
  }, [departmentId]);

  // ─── Fetch ALL active executors for the override picker (no pool gate) ───
  useEffect(() => {
    fetch("/api/users?role=EXECUTOR&isActive=true&take=500")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setAllExecutors(
          list.map((u: { id: string; name: string; specialization?: string | null }) => ({
            id: u.id,
            name: u.name,
            specialization: u.specialization ?? null,
          }))
        );
      })
      .catch(() => setAllExecutors([]));
  }, []);

  // ─── Fetch project templates on mount ───
  useEffect(() => {
    setLoadingTemplates(true);
    fetch("/api/project-templates?active=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjectTemplates(data);
      })
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  // ─── Auto-compute project name from "{template name} - {client name}" ───
  // The user no longer types the name on this page — it's derived from
  // the picked template and client and refreshes whenever either changes.
  // Falls back to the client name alone if no template is picked.
  useEffect(() => {
    if (!selectedClient) {
      setProjectName("");
      return;
    }
    if (selectedTemplateId) {
      const tpl = projectTemplates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        setProjectName(`${tpl.name} - ${selectedClient.name}`);
        return;
      }
    }
    setProjectName(selectedClient.name);
  }, [selectedTemplateId, selectedClient, projectTemplates]);

  // ─── Fetch signed contracts when client is selected ───
  useEffect(() => {
    if (!selectedClient) {
      setClientContracts([]);
      setSelectedContractId("");
      setContractAmount(null);
      return;
    }
    setLoadingContracts(true);
    fetch(`/api/contracts?clientId=${selectedClient.id}&status=SIGNED,ACTIVE`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClientContracts(
            data.map((c: { id: string; contractNumber?: number | null; template: { title: string }; client: { name: string }; variables: string; status: string; installments?: ContractInstallment[] }) => ({
              id: c.id,
              contractNumber: c.contractNumber ?? null,
              templateTitle: c.template?.title || "عقد",
              clientName: c.client?.name || "",
              variables: c.variables,
              status: c.status,
              installments: c.installments || [],
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingContracts(false));
  }, [selectedClient]);

  // ─── Client search with debounce ───
  const handleClientSearch = (q: string) => {
    setClientSearch(q);
    if (clientSearchTimeout.current) clearTimeout(clientSearchTimeout.current);
    if (q.length < 2) {
      setClientResults([]);
      setShowClientDropdown(false);
      return;
    }
    setSearchingClients(true);
    clientSearchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&roles=CLIENT`);
        if (res.ok) {
          const data = await res.json();
          setClientResults(data);
          setShowClientDropdown(true);
        }
      } catch {}
      setSearchingClients(false);
    }, 400);
  };

  const handleInlineAddClient = async () => {
    if (!inlineClient.name || !inlineClient.phone) { setInlineClientError("الاسم ورقم الجوال مطلوبان"); return; }
    setInlineClientSaving(true); setInlineClientError("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickAdd: true, role: "CLIENT", ...inlineClient }) });
      if (res.ok) {
        const data = await res.json();
        setSelectedClient({ id: data.id, name: data.name, email: data.email, role: "CLIENT" });
        setShowInlineAddClient(false); setInlineClient({ name: "", email: "", phone: "", company: "" });
        setClientSearch(""); setShowClientDropdown(false);
      } else { const d = await res.json(); setInlineClientError(d.error || "حدث خطأ"); }
    } catch { setInlineClientError("حدث خطأ في الاتصال"); }
    finally { setInlineClientSaving(false); }
  };

  const selectClient = (client: ClientUser) => {
    setSelectedClient(client);
    setClientSearch("");
    setShowClientDropdown(false);
    setClientResults([]);
    // Reset contract when client changes
    setSelectedContractId("");
    setContractAmount(null);
    setContractInstallments([]);
    setContractMode("");
    setContractForm({
      contractNumber: "",
      startDate: "",
      endDate: "",
      durationDays: "",
      contractValue: "",
      uploadedFileUrl: "",
    });
    setContractError("");
  };

  // ─── Contract selection handler ───
  const handleContractSelect = (contractId: string) => {
    setSelectedContractId(contractId);
    if (!contractId) {
      setContractAmount(null);
      setContractInstallments([]);
      return;
    }
    const contract = clientContracts.find((c) => c.id === contractId);
    if (contract?.variables) {
      try {
        const vars = JSON.parse(contract.variables);
        const amount = parseFloat(vars.totalAmount || vars.المبلغ_الإجمالي || vars.amount || vars.قيمة_العقد || "0");
        setContractAmount(amount > 0 ? amount : null);
      } catch {
        setContractAmount(null);
      }
    }
    // Load installments from contract
    if (contract?.installments && contract.installments.length > 0) {
      setContractInstallments(contract.installments);
      // Replace payment milestones with contract installments (read-only)
      setPaymentMilestones([]);
    } else {
      setContractInstallments([]);
    }
  };

  // ─── Get contract display amount ───
  const getContractDisplayAmount = (contract: ContractOption): string => {
    try {
      const vars = JSON.parse(contract.variables);
      const amount = parseFloat(vars.totalAmount || vars.المبلغ_الإجمالي || vars.amount || vars.قيمة_العقد || "0");
      return amount > 0 ? `${amount.toLocaleString("en-US")} ر.س` : "";
    } catch {
      return "";
    }
  };

  // ─── Apply project template ───
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) {
      if (templateApplied) {
        setSelectedServices([]);
        setTemplateApplied(false);
      }
      return;
    }
    const tpl = projectTemplates.find((t) => t.id === templateId);
    if (tpl && tpl.services && tpl.services.length > 0) {
      setWorkflowType(tpl.workflowType as "SEQUENTIAL" | "INDEPENDENT");
      const mapped: SelectedService[] = tpl.services.map((s, i) => ({
        serviceTemplateId: s.serviceTemplateId,
        name: s.serviceTemplate.name,
        categoryColor: s.serviceTemplate.category?.color || null,
        categoryName: s.serviceTemplate.category?.name || "",
        price: s.serviceTemplate.defaultPrice || 0,
        duration: s.serviceTemplate.defaultDuration || null,
        taskCount: s.serviceTemplate._count?.taskTemplates || 0,
        sortOrder: s.sortOrder ?? i,
        // Honor the per-service mode saved in the template instead of
        // resetting everything to SEQUENTIAL.
        executionMode: s.executionMode || "SEQUENTIAL",
        isBackground: !!(s as Record<string, unknown>).isBackground,
      }));
      setSelectedServices(mapped);
      // Load milestones from template
      if (tpl.milestones && tpl.milestones.length > 0) {
        setPaymentMilestones(
          tpl.milestones.map((m) => ({
            id: `tpl-${m.id}`,
            title: m.title,
            amount: m.amount,
            afterServiceIndex: m.afterServiceIndex,
          }))
        );
      }
      setTemplateApplied(true);
    } else {
      try {
        const res = await fetch(`/api/project-templates`);
        if (res.ok) {
          const all = await res.json();
          const found = all.find((t: ProjectTemplate) => t.id === templateId);
          if (found?.services) {
            setWorkflowType(found.workflowType as "SEQUENTIAL" | "INDEPENDENT");
            const mapped: SelectedService[] = found.services.map(
              (
                s: {
                  serviceTemplateId: string;
                  sortOrder: number;
                  executionMode?: "SEQUENTIAL" | "PARALLEL" | "INDEPENDENT";
                  isBackground?: boolean;
                  serviceTemplate: ServiceTemplate;
                },
                i: number
              ) => ({
                serviceTemplateId: s.serviceTemplateId,
                name: s.serviceTemplate.name,
                categoryColor: s.serviceTemplate.category?.color || null,
                categoryName: s.serviceTemplate.category?.name || "",
                price: s.serviceTemplate.defaultPrice || 0,
                duration: s.serviceTemplate.defaultDuration || null,
                taskCount: s.serviceTemplate._count?.taskTemplates || 0,
                sortOrder: s.sortOrder ?? i,
                executionMode: s.executionMode || "SEQUENTIAL",
                isBackground: !!s.isBackground,
              })
            );
            setSelectedServices(mapped);
            // Load milestones from fetched template
            if (found.milestones && found.milestones.length > 0) {
              setPaymentMilestones(
                found.milestones.map((m: TemplateMilestone) => ({
                  id: `tpl-${m.id}`,
                  title: m.title,
                  amount: m.amount,
                  afterServiceIndex: m.afterServiceIndex,
                }))
              );
            }
            setTemplateApplied(true);
          }
        }
      } catch {}
    }
  };

  // ─── Fetch service catalog (step 2) ───
  const fetchCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const res = await fetch("/api/service-catalog/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch {}
    setLoadingCatalog(false);
  }, []);

  useEffect(() => {
    if (currentStep === 3 && categories.length === 0) {
      fetchCatalog();
    }
  }, [currentStep, categories.length, fetchCatalog]);

  const toggleCategory = async (catId: string) => {
    if (expandedCategory === catId) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(catId);
    if (!categoryTemplatesMap[catId]) {
      try {
        const res = await fetch(`/api/service-catalog/templates?categoryId=${catId}`);
        if (res.ok) {
          const data = await res.json();
          setCategoryTemplatesMap((prev) => ({ ...prev, [catId]: data }));
        }
      } catch {}
    }
  };

  const addService = (tpl: ServiceTemplate) => {
    if (selectedServices.some((s) => s.serviceTemplateId === tpl.id)) return;
    const cat = categories.find((c) =>
      categoryTemplatesMap[c.id]?.some((t) => t.id === tpl.id)
    );
    setSelectedServices((prev) => [
      ...prev,
      {
        serviceTemplateId: tpl.id,
        name: tpl.name,
        categoryColor: cat?.color || tpl.category?.color || null,
        categoryName: cat?.name || tpl.category?.name || "",
        price: tpl.defaultPrice || 0,
        duration: tpl.defaultDuration || null,
        taskCount: tpl._count.taskTemplates,
        sortOrder: prev.length,
        executionMode: "SEQUENTIAL",
        isBackground: false,
      },
    ]);
    setTemplateApplied(false);
  };

  // Toggle a single selected service between SEQUENTIAL and PARALLEL.
  // INDEPENDENT exists in the type union for completeness but isn't
  // exposed in the wizard UI today.
  const toggleServiceMode = (index: number) => {
    setSelectedServices((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, executionMode: s.executionMode === "PARALLEL" ? "SEQUENTIAL" : "PARALLEL" }
          : s
      )
    );
  };

  const removeService = (index: number) => {
    setSelectedServices((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i })));
    setPaymentMilestones((prev) =>
      prev
        .filter((p) => p.afterServiceIndex < selectedServices.length - 1)
        .map((p) => (p.afterServiceIndex >= index ? { ...p, afterServiceIndex: Math.max(0, p.afterServiceIndex - 1) } : p))
    );
    setTemplateApplied(false);
  };

  // ─── Payment Milestone helpers ───
  const addPaymentMilestone = (afterIndex: number) => {
    setPaymentMilestones((prev) => [
      ...prev,
      {
        id: `pm-${Date.now()}`,
        title:
          afterIndex === -1
            ? "دفعة قبل بدء المشروع"
            : `دفعة بعد ${selectedServices[afterIndex]?.name || "الخدمة"}`,
        amount: 0,
        afterServiceIndex: afterIndex,
      },
    ]);
  };

  const removePaymentMilestone = (id: string) => {
    setPaymentMilestones((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePaymentMilestone = (id: string, field: "title" | "amount", value: string | number) => {
    setPaymentMilestones((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // ─── Drag & drop reorder ───
  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setSelectedServices((prev) => {
      const items = [...prev];
      const [moved] = items.splice(dragIndex, 1);
      items.splice(index, 0, moved);
      return items.map((s, i) => ({ ...s, sortOrder: i }));
    });
    setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  // Project price is now driven entirely by inter-service payment
  // milestones — individual services no longer carry a price. The total
  // is the sum of all milestones, unless a contract pins a different
  // amount (priceFromContract) in which case that wins.
  const paymentMilestonesTotal = paymentMilestones.reduce((sum, p) => sum + p.amount, 0);
  const finalTotal = contractAmount || paymentMilestonesTotal;
  const priceFromContract = !!contractAmount;

  // ─── Fetch service details for the review step ───
  useEffect(() => {
    if (currentStep === 5) {
      setLoadingDetails(true);
      const idsToFetch = selectedServices
        .map((s) => s.serviceTemplateId)
        .filter((id) => !serviceDetails[id]);

      if (idsToFetch.length === 0) {
        setLoadingDetails(false);
        return;
      }

      Promise.all(
        idsToFetch.map((id) =>
          fetch(`/api/service-catalog/templates/${id}`)
            .then((r) => r.json())
            .then((data) => ({ id, data }))
            .catch(() => ({ id, data: null }))
        )
      ).then((results) => {
        const details: Record<string, ServiceDetail> = { ...serviceDetails };
        results.forEach(({ id, data }) => {
          if (data && !data.error) {
            details[id] = data;
          }
        });
        setServiceDetails(details);
        setLoadingDetails(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ─── Submit ───
  const handleSubmit = async () => {
    setSubmitting(true);
    setContractError("");
    try {
      // Step 0 — if no existing contract picked, create one inline now
      let contractIdToUse = selectedContractId;
      if (!contractIdToUse && contractMode !== "" && selectedClient) {
        if (!contractForm.startDate || !contractForm.endDate) {
          setContractError("تواريخ العقد مطلوبة");
          setSubmitting(false);
          return;
        }
        if (contractMode === "existing" && !contractForm.uploadedFileUrl.trim()) {
          setContractError("رابط ملف العقد مطلوب");
          setSubmitting(false);
          return;
        }
        const cRes = await fetch("/api/contracts/standalone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClient.id,
            startDate: contractForm.startDate,
            endDate: contractForm.endDate,
            durationDays: contractForm.durationDays ? parseInt(contractForm.durationDays) : undefined,
            contractValue: contractForm.contractValue ? parseFloat(contractForm.contractValue) : undefined,
            contractNumber: contractForm.contractNumber ? parseInt(contractForm.contractNumber) : undefined,
            uploadedFileUrl: contractForm.uploadedFileUrl || undefined,
          }),
        });
        if (!cRes.ok) {
          const err = await cRes.json().catch(() => ({}));
          setContractError(err.error || "تعذر إنشاء العقد");
          setSubmitting(false);
          return;
        }
        const cData = await cRes.json();
        contractIdToUse = cData.id;
        setSelectedContractId(cData.id);
        if (cData.contractValue) setContractAmount(cData.contractValue);
      }

      const useTemplateGenerate = selectedTemplateId && templateApplied;

      let projectId: string | null = null;

      // Payment milestones come from the inline blocks between services on
      // the services step — they're the single source of truth now that the
      // standalone "جدول الدفعات" step has been removed.
      const allPaymentMilestones = paymentMilestones.map((p) => ({
        title: p.title,
        amount: p.amount,
        afterServiceIndex: p.afterServiceIndex,
      }));

      let creationWarnings: string[] = [];

      if (useTemplateGenerate) {
        const res = await fetch("/api/projects/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            clientId: selectedClient!.id,
            name: projectName,
            departmentId: departmentId || undefined,
            contractId: contractIdToUse || undefined,
            contractStartDate: contractForm.startDate || undefined,
            contractDurationDays: contractForm.durationDays ? parseInt(contractForm.durationDays) : undefined,
            contractEndDate: contractForm.endDate || undefined,
            managerId: selectedManagerId || undefined,
            executorId: selectedExecutorId || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          projectId = data.id;
          if (Array.isArray(data.warnings)) {
            creationWarnings = data.warnings;
          }
        } else {
          const err = await res.json();
          alert(err.error || "حدث خطأ أثناء إنشاء المشروع");
          setSubmitting(false);
          return;
        }
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClient!.id,
            name: projectName,
            workflowType,
            totalPrice: finalTotal,
            departmentId: departmentId || undefined,
            contractId: contractIdToUse || undefined,
            contractStartDate: contractForm.startDate || undefined,
            contractDurationDays: contractForm.durationDays ? parseInt(contractForm.durationDays) : undefined,
            contractEndDate: contractForm.endDate || undefined,
            managerId: selectedManagerId || undefined,
            executorId: selectedExecutorId || undefined,
            services: selectedServices.map((s) => ({
              serviceTemplateId: s.serviceTemplateId,
              // Services no longer carry a price — the project total
              // comes from the inter-service payment milestones. The
              // server schema still requires this field, so we send 0.
              price: 0,
              sortOrder: s.sortOrder,
              executionMode: s.executionMode,
              isBackground: s.isBackground || false,
            })),
            paymentMilestones: allPaymentMilestones,
            partners:
              partnersCount > 1
                ? partnerNames
                    .slice(0, partnersCount)
                    .map((n, i) => ({ name: (n || "").trim() || `الشريك ${i + 1}`, order: i }))
                : undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          projectId = data.id;
        } else {
          const err = await res.json();
          alert(err.error || "حدث خطأ أثناء إنشاء المشروع");
          setSubmitting(false);
          return;
        }
      }

      // After project creation — instantiate company branch services if any.
      // (The old "upload pending project documents" block was removed when
      // the documents step came out of the wizard. Document collection now
      // happens per-task via TaskRequirement FILE requirements.)
      if (projectId) {
        const branchNames = branches.map((b) => b.name.trim()).filter(Boolean);
        if (branchNames.length > 0) {
          try {
            await fetch(`/api/projects/${projectId}/branches`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ branches: branchNames }),
            });
          } catch {
            // Non-fatal — admin can re-add branches later
          }
        }
      }

      // Save as template if checked
      if (saveAsTemplate && templateName.trim()) {
        try {
          await fetch("/api/project-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: templateName,
              workflowType,
              services: selectedServices.map((s) => ({
                serviceTemplateId: s.serviceTemplateId,
                sortOrder: s.sortOrder,
              })),
              milestones: paymentMilestones.map((p) => ({
                title: p.title,
                amount: p.amount,
                afterServiceIndex: p.afterServiceIndex,
              })),
            }),
          });
        } catch {}
      }

      if (projectId) {
        const needsSetup = creationWarnings.includes("installments_setup_required");
        const url = needsSetup
          ? `/dashboard/projects/${projectId}?welcome=needs-setup`
          : `/dashboard/projects/${projectId}`;
        router.push(url);
      }
    } catch {
      alert("حدث خطأ غير متوقع");
    }
    setSubmitting(false);
  };

  // ─── Navigation ───
  const handleNext = () => setCurrentStep((s) => Math.min(5, s + 1));
  const handlePrev = () => setCurrentStep((s) => Math.max(1, s - 1));

  // ─── Validation ───
  // Step 1 — basic info: client + department. The project name is
  // computed automatically from the picked template + client (or just
  // the client name when no template is selected) and is no longer
  // user-entered, so it doesn't gate this step.
  const step1Valid = !!selectedClient && !!departmentId;
  // Step 2 — contract: existing picked OR inline form complete for chosen mode
  const inlineContractValid =
    contractMode !== "" &&
    !!contractForm.startDate &&
    !!contractForm.endDate &&
    (contractMode === "new" || !!contractForm.uploadedFileUrl.trim());
  // Contract is fully optional — the wizard used to stall silently when
  // the user skipped picking a contract AND skipped the inline form
  // (contractMode stayed "" which made inlineContractValid false).
  // inlineContractValid is still computed for future UI hints.
  void inlineContractValid;
  const step2Valid = true;
  // Step 3 — at least one service (template or manual). Services no
  // longer carry a price; the project total comes from the inter-service
  // payment milestones, which are optional and validated separately.
  const step3Valid = selectedServices.length >= 1 || (templateApplied && !!selectedTemplateId);
  // Step 4 — manager is optional
  const step4Valid = true;
  // Step 5 (review) — save-as-template name if checked
  const step5Valid = !saveAsTemplate || templateName.trim().length > 0;

  const canGoNext = () => {
    if (currentStep === 1) return step1Valid;
    if (currentStep === 2) return step2Valid;
    if (currentStep === 3) return step3Valid;
    if (currentStep === 4) return step4Valid;
    return false;
  };

  // ─── Step labels ───
  // The old standalone "جدول الدفعات" step was folded into step 4
  // (الخدمات) — payment milestones are added inline between services.
  const steps = [
    { num: 1, label: "البيانات الأساسية" },
    { num: 2, label: "العقد" },
    { num: 3, label: "الخدمات" },
    { num: 4, label: "مدير المشروع" },
    { num: 5, label: "مراجعة وتأكيد" },
  ];

  // ─── Branch helpers ───
  const addBranch = () => {
    setBranches((prev) => [...prev, { id: `branch-${Date.now()}-${Math.random()}`, name: "" }]);
    setBranchesExpanded(true);
  };
  const updateBranchName = (id: string, name: string) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)));
  };
  const removeBranch = (id: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  // Show the branches section only for Investment-department projects
  const selectedDept = departments.find((d) => d.id === departmentId);
  const isInvestmentDept = !!selectedDept?.name?.includes("الاستثمار");

  // ─── Render ───
  return (
    <div className="p-8 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <MarsaButton href="/dashboard/projects" variant="ghost" size="lg" iconOnly icon={<ArrowRight size={20} />} style={{ backgroundColor: "rgba(27,42,74,0.06)" }} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            {t.projects.newProject}
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            إنشاء مشروع جديد خطوة بخطوة
          </p>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-0 mb-10">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <button
              onClick={() => {
                if (step.num < currentStep) setCurrentStep(step.num);
              }}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all ${
                step.num < currentStep ? "cursor-pointer" : step.num === currentStep ? "" : "cursor-default"
              }`}
              style={
                step.num === currentStep
                  ? { backgroundColor: "#5E5495", color: "#fff" }
                  : step.num < currentStep
                  ? { backgroundColor: "rgba(201, 168, 76, 0.12)", color: "#1C1B2E" }
                  : { backgroundColor: "#F3F4F6", color: "#9CA3AF" }
              }
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={
                  step.num < currentStep
                    ? { backgroundColor: "#C9A84C", color: "#fff" }
                    : step.num === currentStep
                    ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                    : { backgroundColor: "#E5E7EB", color: "#9CA3AF" }
                }
              >
                {step.num < currentStep ? <Check size={14} /> : step.num}
              </div>
              <span className="text-sm font-medium">{step.label}</span>
            </button>
            {idx < steps.length - 1 && (
              <div
                className="w-12 h-0.5 mx-1"
                style={{
                  backgroundColor: step.num < currentStep ? "#C9A84C" : "#E5E7EB",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════ STEPS 1-6 (max-w-3xl wrapper) ══════════════════════════════════════════════ */}
      {[1, 2, 3, 4, 5].includes(currentStep) && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Client Selection — STEP 1 */}
          {currentStep === 1 && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <User size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                اختيار العميل
              </h2>
            </div>

            {selectedClient ? (
              <div
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ backgroundColor: "rgba(201, 168, 76, 0.06)", border: "1px solid rgba(201, 168, 76, 0.2)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: "#5E5495" }}
                  >
                    {selectedClient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                      {selectedClient.name}
                    </p>
                    <p className="text-xs text-gray-400">{selectedClient.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setSelectedContractId("");
                    setContractAmount(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <div className="relative" ref={clientDropdownRef}>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    placeholder={`${t.common.search}...`}
                    className="w-full pr-10 pl-4 py-3 rounded-xl border text-sm outline-none transition-all"
                    style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                    onFocus={() => {
                      if (clientResults.length > 0) setShowClientDropdown(true);
                    }}
                  />
                  {searchingClients && (
                    <Loader2
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                    />
                  )}
                </div>
                {showClientDropdown && clientResults.length > 0 && (
                  <div
                    className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl overflow-hidden"
                    style={{ border: "1px solid #E2E0D8" }}
                  >
                    {clientResults.map((client) => {
                      const company = client.ownedCompanies?.[0];
                      const subtitle = [client.phone, company?.name, client.email]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <button
                          key={client.id}
                          onClick={() => selectClient(client)}
                          className="flex items-center gap-3 w-full px-4 py-3 text-right hover:bg-gray-50 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: "#5E5495" }}
                          >
                            {client.name.charAt(0)}
                          </div>
                          <div className="flex-1 text-right min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>
                              {client.name}
                            </p>
                            {subtitle && (
                              <p className="text-xs text-gray-400 truncate">{subtitle}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {showClientDropdown && clientResults.length === 0 && clientSearch.length >= 2 && !searchingClients && (
                  <div
                    className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-xl p-4 text-center"
                    style={{ border: "1px solid #E2E0D8" }}
                  >
                    <p className="text-sm mb-2 text-gray-400">لا توجد نتائج</p>
                    <MarsaButton variant="primary" size="xs" icon={<Plus size={13} />} className="mx-auto"
                      onClick={() => { setShowInlineAddClient(true); setShowClientDropdown(false); setInlineClient({ ...inlineClient, name: clientSearch }); }}>
                      إضافة عميل جديد
                    </MarsaButton>
                  </div>
                )}
                {showInlineAddClient && (
                  <div className="mt-3 p-4 rounded-xl space-y-2" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E2E0D8" }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>إضافة عميل جديد</p>
                    {inlineClientError && <p className="text-xs text-red-600 bg-red-50 p-1.5 rounded-lg">{inlineClientError}</p>}
                    <input placeholder="اسم العميل *" value={inlineClient.name} onChange={(e) => setInlineClient({ ...inlineClient, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                    <input placeholder="رقم الجوال *" dir="ltr" value={inlineClient.phone} onChange={(e) => setInlineClient({ ...inlineClient, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                    <input placeholder="البريد الإلكتروني (اختياري)" type="email" dir="ltr" value={inlineClient.email} onChange={(e) => setInlineClient({ ...inlineClient, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                    <input placeholder="اسم الشركة (اختياري)" value={inlineClient.company} onChange={(e) => setInlineClient({ ...inlineClient, company: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                    <div className="flex gap-2 pt-1">
                      <MarsaButton variant="primary" size="sm" className="flex-1" onClick={handleInlineAddClient} loading={inlineClientSaving}>
                        {inlineClientSaving ? "جاري الحفظ..." : "حفظ"}
                      </MarsaButton>
                      <MarsaButton variant="secondary" size="sm" onClick={() => setShowInlineAddClient(false)}>
                        {t.common.cancel}
                      </MarsaButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          {/* Contract — STEP 2 */}
          {currentStep === 2 && selectedClient && (
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <div className="flex items-center gap-2 mb-2">
                <FileText size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>عقد المشروع *</h2>
              </div>
              <p className="text-xs mb-5" style={{ color: "#6B7280" }}>
                سيتم إنشاء العقد وربطه بالمشروع تلقائياً عند الحفظ
              </p>

              {/* If user already picked an existing signed contract from the list, show it */}
              {selectedContractId && clientContracts.find((c) => c.id === selectedContractId) && (
                <div className="mb-4 p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} style={{ color: "#059669" }} />
                    <span className="text-sm font-semibold" style={{ color: "#059669" }}>
                      عقد موقع مرتبط
                      {contractAmount ? ` — ${contractAmount.toLocaleString("en-US")} ر.س` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedContractId(""); setContractAmount(null); setContractInstallments([]); }}
                    className="text-xs"
                    style={{ color: "#6B7280" }}
                  >
                    تغيير
                  </button>
                </div>
              )}

              {/* Mode selector */}
              {!selectedContractId && contractMode === "" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setContractMode("existing")}
                    className="p-4 rounded-xl text-right transition-all hover:shadow-md"
                    style={{ border: "2px solid #E2E0D8" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E0D8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(5,150,105,0.1)" }}>
                        <FileText size={20} style={{ color: "#059669" }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>رفع عقد قائم</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>ارفع PDF + حدد التواريخ</p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContractMode("new")}
                    className="p-4 rounded-xl text-right transition-all hover:shadow-md"
                    style={{ border: "2px solid #E2E0D8" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.backgroundColor = "rgba(201,168,76,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E0D8"; e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(94,84,149,0.1)" }}>
                        <Plus size={20} style={{ color: "#5E5495" }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>إنشاء عقد جديد</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>رقم + تواريخ + قيمة</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Inline form */}
              {!selectedContractId && contractMode !== "" && (
                <>
                  <div className="mb-4 flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: "rgba(201,168,76,0.06)" }}>
                    <p className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
                      {contractMode === "existing" ? "رفع عقد قائم" : "إنشاء عقد جديد"}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setContractMode(""); setContractError(""); }}
                      className="text-xs"
                      style={{ color: "#6B7280" }}
                    >
                      تغيير الخيار
                    </button>
                  </div>

                  {contractError && (
                    <div className="mb-3 p-2.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(220,38,38,0.06)", color: "#DC2626" }}>
                      {contractError}
                    </div>
                  )}

                  <div className="space-y-3">
                    {contractMode === "new" && (
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>رقم العقد</label>
                        <input
                          type="number" name="contractNumber" value={contractForm.contractNumber}
                          onChange={handleContractFormChange}
                          placeholder="مثال: 1001" dir="ltr"
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: "1px solid #E2E0D8" }}
                        />
                      </div>
                    )}

                    {/* Row 1: start date + working-days duration. The two
                        feed each other forward — entering both fills row 2. */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ البداية *</label>
                        <input
                          type="date" name="startDate" value={contractForm.startDate}
                          onChange={handleContractFormChange}
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: "1px solid #E2E0D8" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>مدة المشروع (أيام عمل)</label>
                        <input
                          type="number" name="durationDays" value={contractForm.durationDays}
                          onChange={handleContractFormChange}
                          placeholder="مثال: 30" dir="ltr" min="1"
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: "1px solid #E2E0D8" }}
                        />
                        <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>السبت عطلة أسبوعية</p>
                      </div>
                    </div>

                    {/* Row 2: end date — auto-computed from start + duration,
                        but still editable. Editing it back-fills the duration
                        via countWorkingDays. */}
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>تاريخ الانتهاء *</label>
                      <input
                        type="date" name="endDate" value={contractForm.endDate}
                        onChange={handleContractFormChange}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ border: "1px solid #E2E0D8" }}
                      />
                      <p className="text-[10px] mt-1" style={{ color: "#9CA3AF" }}>يُحسب تلقائياً من البداية + المدة، ويمكن تعديله يدوياً</p>
                    </div>

                    {contractMode === "new" && (
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>قيمة العقد (ر.س)</label>
                        <input
                          type="number" name="contractValue" value={contractForm.contractValue}
                          onChange={handleContractFormChange}
                          placeholder="0.00" dir="ltr"
                          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                          style={{ border: "1px solid #E2E0D8" }}
                        />
                      </div>
                    )}

                    {contractMode === "existing" && (
                      <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#2D3748" }}>ملف العقد (PDF) *</label>
                        {contractForm.uploadedFileUrl ? (
                          <div className="flex items-center justify-between gap-2 p-3 rounded-lg" style={{ backgroundColor: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)" }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <CheckCircle2 size={16} style={{ color: "#059669" }} />
                              <a
                                href={contractForm.uploadedFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold truncate hover:underline"
                                style={{ color: "#059669" }}
                              >
                                تم رفع الملف — معاينة
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => setContractForm((prev) => ({ ...prev, uploadedFileUrl: "" }))}
                              className="text-xs shrink-0"
                              style={{ color: "#DC2626" }}
                            >
                              حذف
                            </button>
                          </div>
                        ) : (
                          <UploadButton
                            endpoint="documentUploader"
                            onClientUploadComplete={(res) => {
                              if (res?.[0]) {
                                setContractForm((prev) => ({ ...prev, uploadedFileUrl: res[0].ufsUrl }));
                                setContractError("");
                              }
                            }}
                            onUploadError={(error) => setContractError("فشل رفع الملف: " + error.message)}
                            appearance={{
                              button: { backgroundColor: "#C9A84C", color: "white", borderRadius: "0.75rem", fontSize: "0.75rem", padding: "0.5rem 1rem" },
                              allowedContent: { color: "#9CA3AF", fontSize: "0.625rem" },
                            }}
                            content={{
                              button: ({ ready, isUploading }) => isUploading ? "جاري الرفع..." : ready ? "اختر ملف العقد" : "تجهيز...",
                              allowedContent: () => "PDF (حتى 16MB)",
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Existing signed contracts shortcut (only if any exist) */}
              {!selectedContractId && contractMode === "" && clientContracts.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px dashed #E2E0D8" }}>
                  <p className="text-xs mb-2" style={{ color: "#6B7280" }}>
                    أو اختر عقداً موقعاً موجوداً مسبقاً للعميل:
                  </p>
                  <select
                    value={selectedContractId}
                    onChange={(e) => handleContractSelect(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none bg-white"
                    style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                  >
                    <option value="">— اختر عقداً موقعاً —</option>
                    {clientContracts.map((c) => {
                      const amount = getContractDisplayAmount(c);
                      const num = c.contractNumber ? `#${c.contractNumber}` : "";
                      return (
                        <option key={c.id} value={c.id}>
                          {num ? `${num} — ` : ""}{c.templateTitle}{amount ? ` — ${amount}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {loadingContracts && (
                <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: "#9CA3AF" }}>
                  <Loader2 size={12} className="animate-spin" />
                  جاري التحقق من العقود الموجودة...
                </div>
              )}
            </div>
          )}

          {/* Project Info — STEP 1 */}
          {currentStep === 1 && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <FolderKanban size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                بيانات المشروع
              </h2>
            </div>
            <div className="space-y-4">
              {/* Auto-computed project name preview — display only.
                  Renames happen later from the project detail page. */}
              {projectName && (
                <div
                  className="p-3 rounded-xl flex items-center gap-2"
                  style={{ backgroundColor: "rgba(94,84,149,0.05)", border: "1px dashed rgba(94,84,149,0.25)" }}
                >
                  <FolderKanban size={16} style={{ color: "#5E5495" }} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#6B7280" }}>
                      اسم المشروع (يُحتسب تلقائياً من القالب + العميل)
                    </p>
                    <p className="text-sm font-bold truncate" style={{ color: "#1C1B2E" }}>{projectName}</p>
                  </div>
                </div>
              )}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#2D3748" }}>
                  <Building2 size={14} style={{ color: "#C9A84C" }} />
                  القسم
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none cursor-pointer"
                  style={{ border: "1px solid #E2E0D8", backgroundColor: "#FAFAFE", color: "#2D3748" }}
                >
                  <option value="">جميع الأقسام</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Project partners — relocated here after the documents
                  step was removed from the wizard. The count drives a
                  list of named sections; each maps 1:1 to a
                  ProjectPartner row on submit. */}
              <div
                className="p-4 rounded-xl"
                style={{ backgroundColor: "rgba(94,84,149,0.04)", border: "1px solid rgba(94,84,149,0.12)" }}
              >
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      كم عدد الشركاء في هذا المشروع؟
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>
                      اترك الرقم 1 إذا لم يكن هناك شركاء
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={partnersCount}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                      setPartnersCount(n);
                      setPartnerNames((prev) => {
                        const next = [...prev];
                        while (next.length < n) next.push("");
                        next.length = n;
                        return next;
                      });
                    }}
                    className="w-20 px-3 py-2 rounded-lg text-sm text-center outline-none bg-white"
                    style={{ border: "1px solid #E2E0D8" }}
                  />
                </div>

                {partnersCount > 1 && (
                  <div className="space-y-2 mt-3">
                    {Array.from({ length: partnersCount }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="text-xs font-bold shrink-0"
                          style={{ color: "#5E5495", minWidth: i === 0 ? 100 : 64 }}
                        >
                          {i === 0 ? "الشريك 1 (العميل):" : `الشريك ${i + 1}:`}
                        </span>
                        <input
                          type="text"
                          value={partnerNames[i] || ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPartnerNames((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          placeholder={`اسم الشريك ${i + 1}`}
                          className="flex-1 px-3 py-2 rounded-lg text-xs outline-none bg-white"
                          style={{ border: "1px solid #E2E0D8" }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Workflow Type card removed — the per-service execution mode
              chip on each row replaces the project-wide picker. The state
              variable `workflowType` stays pinned at SEQUENTIAL on mount
              and is still sent in the submit payload for backend compat. */}

          {/* Use Template — STEP 3 (الخدمات) */}
          {currentStep === 3 && (
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <BookTemplate size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                استخدام قالب موجود
              </h2>
              <span className="text-xs text-gray-400 mr-2">(اختياري)</span>
            </div>
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
              </div>
            ) : (
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white transition-all"
                style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
              >
                <option value="">بدون قالب - اختيار الخدمات يدوياً</option>
                {projectTemplates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl._count.services} خدمة)
                  </option>
                ))}
              </select>
            )}
            {templateApplied && (
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#059669" }}>
                <CheckCircle2 size={14} />
                تم تطبيق القالب — سيتم استخدام خدماته
              </p>
            )}
          </div>
          )}


          {/* ─── STEP 4: Assign Project Manager (optional) ─── */}
          {currentStep === 4 && (
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>تعيين مدير المشروع</h2>
                <span className="text-xs" style={{ color: "#9CA3AF" }}>(اختياري)</span>
              </div>
              <p className="text-xs mb-5" style={{ color: "#6B7280" }}>
                اختر مدير المشروع من قائمة المسؤولين والمدراء — إذا تركتها فارغة، ستكون أنت المدير الافتراضي
              </p>

              {loadingManagers ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedManagerId("")}
                    className="w-full p-3 rounded-xl flex items-center gap-3 text-right transition-all"
                    style={
                      selectedManagerId === ""
                        ? { backgroundColor: "rgba(201,168,76,0.06)", border: "2px solid #C9A84C" }
                        : { backgroundColor: "white", border: "1px solid #E2E0D8" }
                    }
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(94,84,149,0.1)" }}>
                      <User size={16} style={{ color: "#5E5495" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>أنا (المنشئ)</p>
                      <p className="text-[11px]" style={{ color: "#9CA3AF" }}>سأتولى إدارة هذا المشروع</p>
                    </div>
                    {selectedManagerId === "" && <Check size={18} style={{ color: "#C9A84C" }} />}
                  </button>

                  {managers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedManagerId(m.id)}
                      className="w-full p-3 rounded-xl flex items-center gap-3 text-right transition-all"
                      style={
                        selectedManagerId === m.id
                          ? { backgroundColor: "rgba(201,168,76,0.06)", border: "2px solid #C9A84C" }
                          : { backgroundColor: "white", border: "1px solid #E2E0D8" }
                      }
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: "#5E5495" }}>
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{m.name}</p>
                        <p className="text-[11px]" style={{ color: "#9CA3AF" }}>{m.role === "ADMIN" ? "مسؤول" : "مدير"}</p>
                      </div>
                      {selectedManagerId === m.id && <Check size={18} style={{ color: "#C9A84C" }} />}
                    </button>
                  ))}

                  {managers.length === 0 && (
                    <p className="text-center text-xs py-4" style={{ color: "#9CA3AF" }}>
                      لا يوجد مدراء آخرون متاحون
                    </p>
                  )}
                </div>
              )}

              {/* Executor picker — choose ANY active executor (no pool
                  restriction). When left empty, auto-distribution keeps
                  using the department pool / round-robin path. */}
              {allExecutors.length > 0 && (
                <div className="mt-6 pt-5" style={{ borderTop: "1px solid #F0EDE6" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <ListChecks size={16} style={{ color: "#059669" }} />
                    <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      المنفذ المسؤول
                    </h3>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>(اختياري — أي منفّذ نشط)</span>
                  </div>
                  <p className="text-xs mb-4" style={{ color: "#6B7280" }}>
                    إذا تركته فارغاً سيُختار تلقائياً من فريق القسم الافتراضي بالتناوب
                  </p>
                  <select
                    value={selectedExecutorId}
                    onChange={(e) => setSelectedExecutorId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm transition-all outline-none cursor-pointer"
                    style={{ border: "1px solid #E2E0D8", backgroundColor: "#FAFAFE", color: "#2D3748" }}
                  >
                    <option value="">-- اختيار تلقائي من فريق القسم --</option>
                    {allExecutors.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}{u.specialization ? ` — ${u.specialization}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════ STEP 3 — Services Catalog ══════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="flex gap-6">
          {/* Left: Service Catalog */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <div className="flex items-center gap-2 mb-5">
                <Package size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                  {t.projects.services}
                </h2>
              </div>

              {loadingCatalog ? (
                <div className="flex items-center justify-center py-12">
                  <div
                    className="w-8 h-8 border-4 rounded-full animate-spin"
                    style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }}
                  />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-12">
                  <Layers size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-400 text-sm">لا توجد فئات خدمات</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: "1px solid #E2E0D8" }}
                    >
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className="flex items-center gap-3 w-full p-4 text-right hover:bg-gray-50 transition-colors"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: cat.color || "#3B82F6" }}
                        >
                          {cat.name.charAt(0)}
                        </div>
                        <div className="flex-1 text-right">
                          <p className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                            {cat.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cat._count.templates} خدمة
                          </p>
                        </div>
                        <ChevronDown
                          size={18}
                          className={`text-gray-400 transition-transform duration-200 ${
                            expandedCategory === cat.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {expandedCategory === cat.id && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                          {!categoryTemplatesMap[cat.id] ? (
                            <div className="flex justify-center py-4">
                              <div
                                className="w-5 h-5 border-2 rounded-full animate-spin"
                                style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }}
                              />
                            </div>
                          ) : categoryTemplatesMap[cat.id].length === 0 ? (
                            <p className="text-center text-gray-400 py-3 text-sm">
                              لا توجد خدمات في هذه الفئة
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {categoryTemplatesMap[cat.id]
                                .filter((t) => t.isActive)
                                .map((tpl) => {
                                  const isAdded = selectedServices.some(
                                    (s) => s.serviceTemplateId === tpl.id
                                  );
                                  return (
                                    <div
                                      key={tpl.id}
                                      className="flex items-center gap-3 p-3 rounded-lg bg-white transition-all"
                                      style={{
                                        border: isAdded
                                          ? "1px solid rgba(201, 168, 76, 0.3)"
                                          : "1px solid #F3F4F6",
                                        opacity: isAdded ? 0.6 : 1,
                                      }}
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>
                                          {tpl.name}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                          <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <DollarSign size={12} />
                                            {tpl.defaultPrice ? <>{tpl.defaultPrice.toLocaleString("en-US")} <SarSymbol size={12} /></> : "—"}
                                          </span>
                                          <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock size={12} />
                                            {tpl.defaultDuration ? `${tpl.defaultDuration} يوم` : "—"}
                                          </span>
                                          <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <ListChecks size={12} />
                                            {tpl._count.taskTemplates} مهمة
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => addService(tpl)}
                                        disabled={isAdded}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
                                        style={
                                          isAdded
                                            ? { backgroundColor: "#F3F4F6", color: "#9CA3AF" }
                                            : { backgroundColor: "rgba(201, 168, 76, 0.12)", color: "#C9A84C" }
                                        }
                                      >
                                        {isAdded ? <Check size={16} /> : <Plus size={16} />}
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Selected Services + Payment Milestones */}
          <div className="w-96 flex-shrink-0">
            <div
              className="bg-white rounded-2xl p-6 sticky top-6"
              style={{ border: "1px solid #E2E0D8" }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <ListChecks size={20} style={{ color: "#C9A84C" }} />
                  <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                    الخدمات المختارة
                  </h2>
                </div>
              </div>

              {/* Counter / Warning */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm"
                style={
                  selectedServices.length < 2
                    ? { backgroundColor: "#FEF3C7", color: "#92400E" }
                    : { backgroundColor: "rgba(201, 168, 76, 0.08)", color: "#1C1B2E" }
                }
              >
                {selectedServices.length < 2 && <AlertCircle size={16} />}
                {selectedServices.length < 2 ? (
                  <span>يجب اختيار خدمتين على الأقل ({selectedServices.length} من 2)</span>
                ) : (
                  <span>
                    تم اختيار {selectedServices.length} خدمة
                  </span>
                )}
              </div>


              {/* Contract amount notice */}
              {priceFromContract && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm"
                  style={{ backgroundColor: "rgba(5, 150, 105, 0.06)", color: "#059669" }}
                >
                  <DollarSign size={14} />
                  <span>المبلغ محدد من العقد: {contractAmount?.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                </div>
              )}

              {selectedServices.length === 0 ? (
                <div className="text-center py-8">
                  <Package size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">
                    لم يتم اختيار أي خدمة بعد
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    أضف خدمات من الكتالوج على اليمين
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {/* Payment milestone slot BEFORE the first service.
                      Uses afterServiceIndex = -1 — the server interprets
                      that as "lock the first task of the first service". */}
                  {!priceFromContract && contractInstallments.length === 0 && (
                    <div className="my-1.5">
                      {paymentMilestones
                        .filter((p) => p.afterServiceIndex === -1)
                        .map((pm) => (
                          <div
                            key={pm.id}
                            className="p-3 rounded-xl mb-1.5"
                            style={{ backgroundColor: "rgba(5, 150, 105, 0.06)", border: "1px dashed rgba(5, 150, 105, 0.35)" }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: "rgba(5, 150, 105, 0.15)" }}
                              >
                                <DollarSign size={13} style={{ color: "#059669" }} />
                              </div>
                              <input
                                type="text"
                                value={pm.title}
                                onChange={(e) => updatePaymentMilestone(pm.id, "title", e.target.value)}
                                className="flex-1 text-sm bg-transparent outline-none font-bold"
                                style={{ color: "#059669" }}
                                placeholder="عنوان الدفعة..."
                              />
                              <button
                                onClick={() => removePaymentMilestone(pm.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mr-8">
                              <DollarSign size={12} style={{ color: "#059669" }} />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pm.amount || ""}
                                onChange={(e) => updatePaymentMilestone(pm.id, "amount", parseFloat(e.target.value) || 0)}
                                placeholder="أدخل المبلغ"
                                className="w-28 px-2.5 py-1.5 text-xs rounded-lg border outline-none text-left font-medium"
                                style={{ borderColor: "rgba(5, 150, 105, 0.3)", color: "#059669", backgroundColor: "rgba(255,255,255,0.7)" }}
                              />
                              <SarSymbol size={12} />
                            </div>
                          </div>
                        ))}

                      <button
                        onClick={() => addPaymentMilestone(-1)}
                        className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium transition-all border border-dashed"
                        style={{ color: "#059669", borderColor: "rgba(5, 150, 105, 0.25)", backgroundColor: "transparent" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(5, 150, 105, 0.04)";
                          e.currentTarget.style.borderColor = "rgba(5, 150, 105, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.borderColor = "rgba(5, 150, 105, 0.25)";
                        }}
                      >
                        <Plus size={14} />
                        <span>إضافة دفعة قبل بدء المشروع</span>
                      </button>
                    </div>
                  )}

                  {selectedServices.map((service, idx) => (
                    <div key={service.serviceTemplateId}>
                      {/* Service Card */}
                      <div
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        className="p-3 rounded-xl transition-all"
                        style={{
                          border: dragIndex === idx ? "1px dashed #C9A84C" : "1px solid #F3F4F6",
                          backgroundColor: dragIndex === idx ? "rgba(201, 168, 76, 0.04)" : "#FAFAFA",
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="cursor-grab mt-1 text-gray-300 hover:text-gray-500 transition-colors">
                            <GripVertical size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: service.categoryColor || "#3B82F6" }}
                              />
                              <span className="text-sm font-medium truncate" style={{ color: "#1C1B2E" }}>
                                {service.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {service.duration ? `${service.duration} يوم` : "—"}
                              </span>
                              <span className="flex items-center gap-1">
                                <ListChecks size={11} />
                                {service.taskCount} مهمة
                              </span>
                              {/* Per-service execution mode toggle. Click to
                                  flip between SEQUENTIAL ↕ and PARALLEL ⇄. */}
                              <button
                                type="button"
                                onClick={() => toggleServiceMode(idx)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold transition-all"
                                style={
                                  service.executionMode === "PARALLEL"
                                    ? { backgroundColor: "rgba(37,99,235,0.1)", color: "#2563EB", border: "1px solid rgba(37,99,235,0.25)" }
                                    : { backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }
                                }
                                title={service.executionMode === "PARALLEL"
                                  ? "المهام تعمل بالتوازي — اضغط للتسلسل"
                                  : "المهام تعمل بالتسلسل — اضغط للتوازي"}
                              >
                                {service.executionMode === "PARALLEL" ? "⇄ توازي" : "↕ تسلسلي"}
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeService(idx)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-gray-300 hover:text-red-500 flex-shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Payment milestone slots between services */}
                      {!priceFromContract && contractInstallments.length === 0 && (
                        <div className="my-1.5">
                          {paymentMilestones
                            .filter((p) => p.afterServiceIndex === idx)
                            .map((pm) => (
                              <div
                                key={pm.id}
                                className="p-3 rounded-xl mb-1.5"
                                style={{ backgroundColor: "rgba(5, 150, 105, 0.06)", border: "1px dashed rgba(5, 150, 105, 0.35)" }}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div
                                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: "rgba(5, 150, 105, 0.15)" }}
                                  >
                                    <DollarSign size={13} style={{ color: "#059669" }} />
                                  </div>
                                  <input
                                    type="text"
                                    value={pm.title}
                                    onChange={(e) => updatePaymentMilestone(pm.id, "title", e.target.value)}
                                    className="flex-1 text-sm bg-transparent outline-none font-bold"
                                    style={{ color: "#059669" }}
                                    placeholder="عنوان الدفعة..."
                                  />
                                  <button
                                    onClick={() => removePaymentMilestone(pm.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 mr-8">
                                  <DollarSign size={12} style={{ color: "#059669" }} />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={pm.amount || ""}
                                    onChange={(e) => updatePaymentMilestone(pm.id, "amount", parseFloat(e.target.value) || 0)}
                                    placeholder="أدخل المبلغ"
                                    className="w-28 px-2.5 py-1.5 text-xs rounded-lg border outline-none text-left font-medium"
                                    style={{ borderColor: "rgba(5, 150, 105, 0.3)", color: "#059669", backgroundColor: "rgba(255,255,255,0.7)" }}
                                  />
                                  <SarSymbol size={12} />
                                </div>
                              </div>
                            ))}

                          <button
                            onClick={() => addPaymentMilestone(idx)}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium transition-all border border-dashed"
                            style={{ color: "#059669", borderColor: "rgba(5, 150, 105, 0.25)", backgroundColor: "transparent" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "rgba(5, 150, 105, 0.04)";
                              e.currentTarget.style.borderColor = "rgba(5, 150, 105, 0.5)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.borderColor = "rgba(5, 150, 105, 0.25)";
                            }}
                          >
                            <Plus size={14} />
                            <span>إضافة دفعة بين الخدمتين</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {selectedServices.length > 0 && (
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid #E2E0D8" }}>
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "2px solid #C9A84C" }}>
                    <label className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      السعر الإجمالي
                    </label>
                    <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                      {finalTotal.toLocaleString("en-US")} <SarSymbol size={16} />
                    </span>
                  </div>
                  {!priceFromContract && (
                    <p className="text-[11px] mt-1.5 text-left" style={{ color: "#9CA3AF" }}>
                      السعر الإجمالي هو مجموع الدفعات البينية
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ─── Optional Company Branches (Investment department only) ─── */}
            {isInvestmentDept && (
              <div className="bg-white rounded-2xl mt-4" style={{ border: "1px solid #E2E0D8" }}>
                <button
                  type="button"
                  onClick={() => setBranchesExpanded((v) => !v)}
                  className="w-full flex items-center justify-between p-5 text-right"
                >
                  <div className="flex items-center gap-2">
                    <Building2 size={18} style={{ color: "#C9A84C" }} />
                    <h3 className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      فتح فروع الشركة
                    </h3>
                    <span className="text-[10px]" style={{ color: "#9CA3AF" }}>(اختياري)</span>
                    {branches.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}>
                        {branches.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${branchesExpanded ? "rotate-180" : ""}`}
                    style={{ color: "#9CA3AF" }}
                  />
                </button>

                {branchesExpanded && (
                  <div className="px-5 pb-5">
                    <p className="text-[11px] mb-3" style={{ color: "#6B7280" }}>
                      أضف فرعاً واحداً لكل دولة. سيتم إنشاء خدمة منفصلة بـ 12 مهمة لكل فرع تلقائياً.
                    </p>

                    {branches.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {branches.map((b, idx) => (
                          <div key={b.id} className="flex items-center gap-2">
                            <span
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: "rgba(94,84,149,0.1)", color: "#5E5495" }}
                            >
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={b.name}
                              onChange={(e) => updateBranchName(b.id, e.target.value)}
                              placeholder="اسم الفرع (مثل: كندا، بريطانيا)"
                              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
                              style={{ border: "1px solid #E2E0D8" }}
                            />
                            <button
                              type="button"
                              onClick={() => removeBranch(b.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                              aria-label="حذف الفرع"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={addBranch}
                      className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-medium border border-dashed transition-all"
                      style={{ color: "#5E5495", borderColor: "rgba(94,84,149,0.3)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(94,84,149,0.04)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <Plus size={12} />
                      إضافة فرع جديد
                    </button>

                    {branches.length === 0 && (
                      <p className="text-[10px] mt-3 text-center" style={{ color: "#9CA3AF" }}>
                        لم تُضَف فروع — سيتم تخطي هذه الخدمة عند إنشاء المشروع
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ STEP 5 — Review & Confirm ══════════════════════════════════════════════ */}
      {currentStep === 5 && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <FileText size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                ملخص المشروع
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}>
                <p className="text-xs text-gray-400 mb-1">{t.projects.client}</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: "#5E5495" }}
                  >
                    {selectedClient?.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      {selectedClient?.name}
                    </p>
                    <p className="text-xs text-gray-400">{selectedClient?.email}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}>
                <p className="text-xs text-gray-400 mb-1">{t.projects.projectName}</p>
                <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                  {projectName}
                </p>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}>
                <p className="text-xs text-gray-400 mb-1">نوع سير العمل</p>
                <div className="flex items-center gap-2">
                  {workflowType === "SEQUENTIAL" ? (
                    <ArrowDown size={16} style={{ color: "#C9A84C" }} />
                  ) : (
                    <ArrowLeftRight size={16} style={{ color: "#C9A84C" }} />
                  )}
                  <span className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                    {workflowType === "SEQUENTIAL" ? "تسلسلي" : "مستقل"}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}>
                <p className="text-xs text-gray-400 mb-1">السعر الإجمالي</p>
                <p className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                  {finalTotal.toLocaleString("en-US")} <SarSymbol size={16} />
                </p>
                {priceFromContract && (
                  <p className="text-xs mt-1" style={{ color: "#059669" }}>محدد من العقد</p>
                )}
              </div>
              {selectedContractId && (
                <div className="p-4 rounded-xl md:col-span-2" style={{ backgroundColor: "rgba(5, 150, 105, 0.04)" }}>
                  <p className="text-xs text-gray-400 mb-1">{t.projects.linkedContract}</p>
                  <p className="text-sm font-bold" style={{ color: "#059669" }}>
                    {clientContracts.find((c) => c.id === selectedContractId)?.templateTitle || "عقد موقع"}
                    {contractAmount ? <>{" — "}{contractAmount.toLocaleString("en-US")} <SarSymbol size={14} /></> : ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Visual Timeline ═══ */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ListChecks size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                  المسار الزمني للمشروع
                </h2>
              </div>
              {/* Edit services button — jump back to services step */}
              <MarsaButton variant="secondary" icon={<Edit3 size={14} />}
                onClick={() => {
                  setTemplateApplied(false);
                  setCurrentStep(3);
                }}
              >
                تعديل الخدمات
              </MarsaButton>
            </div>

            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div
                    className="w-8 h-8 border-4 rounded-full animate-spin mx-auto mb-3"
                    style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }}
                  />
                  <p className="text-sm text-gray-400">جارٍ تحميل تفاصيل المهام...</p>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div
                  className="absolute right-[19px] top-0 bottom-0 w-0.5"
                  style={{ backgroundColor: "#E8E6F0" }}
                />

                {/* ── BEFORE-FIRST-SERVICE payment milestones ── */}
                {paymentMilestones
                  .filter((p) => p.afterServiceIndex === -1)
                  .map((pm) => (
                    <div key={pm.id} className="relative flex gap-4 mb-0">
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center z-10"
                          style={{ backgroundColor: "#059669", color: "#fff" }}
                        >
                          <DollarSign size={14} />
                        </div>
                        <div className="flex-1 w-0.5 my-1" style={{ backgroundColor: "#E8E6F0" }}>
                          <div className="w-full h-full min-h-[8px]" />
                        </div>
                      </div>
                      <div
                        className="flex-1 rounded-xl p-3 mb-3"
                        style={{
                          backgroundColor: "rgba(5, 150, 105, 0.04)",
                          border: "1px solid rgba(5, 150, 105, 0.2)",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CreditCard size={14} style={{ color: "#059669" }} />
                            <span className="text-sm font-medium" style={{ color: "#059669" }}>
                              {pm.title}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}
                            >
                              قبل بدء المشروع
                            </span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: "#059669" }}>
                            {pm.amount.toLocaleString("en-US")} <SarSymbol size={14} />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* ── SERVICES & PAYMENT MILESTONES ── */}
                {selectedServices.map((service, idx) => {
                  const detail = serviceDetails[service.serviceTemplateId];
                  const milestonesAfter = paymentMilestones.filter((p) => p.afterServiceIndex === idx);

                  return (
                    <div key={service.serviceTemplateId}>
                      {/* Service */}
                      <div className="relative flex gap-4 mb-0">
                        <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
                            style={{ backgroundColor: service.categoryColor || "#1C1B2E" }}
                          >
                            {idx + 1}
                          </div>
                          {(idx < selectedServices.length - 1 || milestonesAfter.length > 0) && (
                            <div className="flex-1 w-0.5 my-1" style={{ backgroundColor: "#E8E6F0" }}>
                              <div className="w-full h-full min-h-[8px]" />
                            </div>
                          )}
                        </div>
                        <div
                          className="flex-1 rounded-xl p-4 mb-3"
                          style={{ border: "1px solid #E2E0D8" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: service.categoryColor || "#3B82F6" }}
                              />
                              <h4 className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                                {service.name}
                              </h4>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400">
                              <span>{service.duration ? `${service.duration} يوم` : "—"}</span>
                            </div>
                          </div>
                          {detail?.taskTemplates && detail.taskTemplates.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {detail.taskTemplates.map((task, tIdx) => (
                                <div
                                  key={task.id}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
                                  style={{ backgroundColor: "rgba(27, 42, 74, 0.03)" }}
                                >
                                  <span className="text-gray-300 font-mono w-5">{tIdx + 1}.</span>
                                  <span style={{ color: "#2D3748" }}>{task.name}</span>
                                  {task.isRequired && (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                      style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
                                    >
                                      مطلوبة
                                    </span>
                                  )}
                                  <span className="mr-auto text-gray-300">
                                    {task.defaultDuration} يوم
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {!detail && (
                            <p className="text-xs text-gray-300 mt-1">لا تتوفر تفاصيل المهام</p>
                          )}
                        </div>
                      </div>

                      {/* Payment milestones after this service */}
                      {milestonesAfter.map((pm) => (
                        <div key={pm.id} className="relative flex gap-4 mb-0">
                          <div className="flex flex-col items-center flex-shrink-0" style={{ width: 40 }}>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center z-10"
                              style={{ backgroundColor: "#059669", color: "#fff" }}
                            >
                              <DollarSign size={14} />
                            </div>
                            <div className="flex-1 w-0.5 my-1" style={{ backgroundColor: "#E8E6F0" }}>
                              <div className="w-full h-full min-h-[8px]" />
                            </div>
                          </div>
                          <div
                            className="flex-1 rounded-xl p-3 mb-3"
                            style={{ backgroundColor: "rgba(5, 150, 105, 0.04)", border: "1px solid rgba(5, 150, 105, 0.2)" }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CreditCard size={14} style={{ color: "#059669" }} />
                                <span className="text-sm font-medium" style={{ color: "#059669" }}>
                                  {pm.title}
                                </span>
                              </div>
                              <span className="text-sm font-bold" style={{ color: "#059669" }}>
                                {pm.amount.toLocaleString("en-US")} <SarSymbol size={14} />
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ Financial Summary ═══ */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <DollarSign size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                الملخص المالي
              </h2>
            </div>

            <div className="space-y-3">
              {priceFromContract ? (
                <>
                  <div className="flex items-center justify-between py-2 text-sm" style={{ color: "#059669" }}>
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} />
                      المبلغ محدد من العقد
                    </span>
                    <span className="font-bold text-lg" style={{ color: "#C9A84C" }}>
                      {finalTotal.toLocaleString("en-US")} <SarSymbol size={16} />
                    </span>
                  </div>
                  {contractInstallments.length > 0 && (
                    <div className="pt-3" style={{ borderTop: "1px solid #F3F4F6" }}>
                      <p className="text-xs font-semibold mb-2" style={{ color: "#059669" }}>الدفعات محددة من العقد:</p>
                      <div className="space-y-1.5">
                        {contractInstallments.map((inst, i) => (
                          <div key={inst.id} className="flex items-center justify-between py-2 px-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(5,150,105,0.04)" }}>
                            <span className="flex items-center gap-2" style={{ color: "#2D3748" }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}>{i + 1}</span>
                              {inst.title}
                            </span>
                            <div className="flex items-center gap-3">
                              {inst.dueAfterDays && <span className="text-xs" style={{ color: "#94A3B8" }}>بعد {inst.dueAfterDays} يوم</span>}
                              <span className="font-semibold" style={{ color: "#059669" }}>{inst.amount.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {paymentMilestones.length > 0 && (
                    <div className="pb-2">
                      <p className="text-xs text-gray-400 mb-2">الدفعات:</p>
                      {/* Sort -1 first, then by afterServiceIndex ascending so
                          "before start" always leads the list. */}
                      {[...paymentMilestones]
                        .sort((a, b) => a.afterServiceIndex - b.afterServiceIndex)
                        .map((pm) => (
                          <div
                            key={pm.id}
                            className="flex items-center justify-between py-1 text-sm"
                            style={{ color: "#059669" }}
                          >
                            <span className="flex items-center gap-1.5">
                              <CreditCard size={12} />
                              {pm.title}
                              {pm.afterServiceIndex === -1 && (
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}
                                >
                                  قبل البدء
                                </span>
                              )}
                            </span>
                            <span className="font-medium">
                              {pm.amount.toLocaleString("en-US")} <SarSymbol size={14} />
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 text-lg font-bold" style={{ borderTop: "2px solid #C9A84C", color: "#C9A84C" }}>
                    <span>الإجمالي النهائي</span>
                    <span>{finalTotal.toLocaleString("en-US")} <SarSymbol size={16} /></span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Save as Template */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                style={
                  saveAsTemplate
                    ? { borderColor: "#C9A84C", backgroundColor: "#C9A84C" }
                    : { borderColor: "#D1D5DB" }
                }
                onClick={() => setSaveAsTemplate(!saveAsTemplate)}
              >
                {saveAsTemplate && <Check size={13} className="text-white" />}
              </div>
              <span className="text-sm font-medium" style={{ color: "#1C1B2E" }}>
                حفظ كقالب لاستخدامه لاحقاً
              </span>
            </label>
            {saveAsTemplate && (
              <div className="mt-4 mr-8">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  اسم القالب *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="مثال: قالب تأسيس الشركات"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ Navigation ══════════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto mt-8 flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <MarsaButton variant="secondary" size="lg" icon={<ArrowLeft size={16} />} onClick={handlePrev}>
              السابق
            </MarsaButton>
          )}
        </div>

        <div>
          {currentStep < 5 ? (
            <MarsaButton variant="primary" size="lg" onClick={handleNext} disabled={!canGoNext()}>
              التالي
              <ChevronLeft size={16} />
            </MarsaButton>
          ) : (
            <MarsaButton variant="gold" size="lg" onClick={handleSubmit} disabled={submitting || !step5Valid} loading={submitting}
              icon={!submitting ? <FolderKanban size={16} /> : undefined}
            >
              {submitting ? t.common.loading : t.common.create}
            </MarsaButton>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(28,27,46,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl max-w-sm mx-4" style={{ border: "1px solid #E2E0D8" }}>
            <div className="relative w-16 h-16">
              <svg className="animate-spin w-16 h-16" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" stroke="#E2E0D8" strokeWidth="4" />
                <circle cx="25" cy="25" r="20" fill="none" stroke="url(#spinner-gradient)" strokeWidth="4" strokeLinecap="round" strokeDasharray="80 120" />
                <defs>
                  <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#C9A84C" />
                    <stop offset="100%" stopColor="#5E5495" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p className="text-base font-bold text-center" style={{ color: "#1C1B2E" }}>
              {[
                "جاري إنشاء المشروع...",
                "إضافة الخدمات والمهام...",
                "ربط المنفذين...",
                "شبه انتهى...",
              ][loadingMsg]}
            </p>
            <p className="text-xs text-center" style={{ color: "#6B7280" }}>
              يرجى الانتظار وعدم إغلاق الصفحة
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
