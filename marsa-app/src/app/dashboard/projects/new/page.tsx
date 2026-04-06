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
  Save,
  Loader2,
  AlertCircle,
  Package,
  BookTemplate,
  Grid3X3,
  CreditCard,
  Edit3,
  Building2,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import ContractPromptDialog from "@/components/ContractPromptDialog";

// ─── Types ───────────────────────────────────────────────────────

interface ClientUser {
  id: string;
  name: string;
  email: string;
  role: string;
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
  services?: { serviceTemplateId: string; sortOrder: number; serviceTemplate: ServiceTemplate }[];
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

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<{id:string;name:string;nameEn:string|null;color:string|null}[]>([]);
  const [workflowType, setWorkflowType] = useState<"SEQUENTIAL" | "INDEPENDENT">("SEQUENTIAL");

  // SLA Timeline
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractDurationDays, setContractDurationDays] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");

  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);

  // ─── Contract selection ───
  const [clientContracts, setClientContracts] = useState<ContractOption[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [showContractPrompt, setShowContractPrompt] = useState(false);
  const [contractAmount, setContractAmount] = useState<number | null>(null);
  const [contractInstallments, setContractInstallments] = useState<ContractInstallment[]>([]);

  // ─── Step 2 state ───
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTemplatesMap, setCategoryTemplatesMap] = useState<Record<string, ServiceTemplate[]>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [totalPriceOverride, setTotalPriceOverride] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // ─── Payment Milestones (Step 2) ───
  const [paymentMilestones, setPaymentMilestones] = useState<PaymentMilestone[]>([]);

  // ─── Step 3 state ───
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
              (s: { serviceTemplateId: string; sortOrder: number; serviceTemplate: ServiceTemplate }, i: number) => ({
                serviceTemplateId: s.serviceTemplateId,
                name: s.serviceTemplate.name,
                categoryColor: s.serviceTemplate.category?.color || null,
                categoryName: s.serviceTemplate.category?.name || "",
                price: s.serviceTemplate.defaultPrice || 0,
                duration: s.serviceTemplate.defaultDuration || null,
                taskCount: s.serviceTemplate._count?.taskTemplates || 0,
                sortOrder: s.sortOrder ?? i,
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
    if (currentStep === 2 && categories.length === 0) {
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
      },
    ]);
    setTemplateApplied(false);
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

  const updateServicePrice = (index: number, price: number) => {
    setSelectedServices((prev) =>
      prev.map((s, i) => (i === index ? { ...s, price } : s))
    );
    setTemplateApplied(false);
  };

  // ─── Payment Milestone helpers ───
  const addPaymentMilestone = (afterIndex: number) => {
    setPaymentMilestones((prev) => [
      ...prev,
      {
        id: `pm-${Date.now()}`,
        title: `دفعة بعد ${selectedServices[afterIndex]?.name || "الخدمة"}`,
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

  const calculatedTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const paymentMilestonesTotal = paymentMilestones.reduce((sum, p) => sum + p.amount, 0);
  const finalTotal = contractAmount || (totalPriceOverride ? parseFloat(totalPriceOverride) : calculatedTotal);
  const priceFromContract = !!contractAmount;

  // ─── Fetch service details for step 3 ───
  useEffect(() => {
    if (currentStep === 3) {
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
    // Every project must have a contract — prompt if none selected
    if (!selectedContractId && selectedClient) {
      setShowContractPrompt(true);
      return;
    }
    setSubmitting(true);
    try {
      const useTemplateGenerate = selectedTemplateId && templateApplied;

      let projectId: string | null = null;

      if (useTemplateGenerate) {
        const res = await fetch("/api/projects/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            clientId: selectedClient!.id,
            name: projectName,
            departmentId: departmentId || undefined,
            contractId: selectedContractId || undefined,
            contractStartDate: contractStartDate || undefined,
            contractDurationDays: contractDurationDays ? parseInt(contractDurationDays) : undefined,
            contractEndDate: contractEndDate || undefined,
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
      } else {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClient!.id,
            name: projectName,
            description: description || null,
            workflowType,
            totalPrice: finalTotal,
            departmentId: departmentId || undefined,
            contractId: selectedContractId || undefined,
            contractStartDate: contractStartDate || undefined,
            contractDurationDays: contractDurationDays ? parseInt(contractDurationDays) : undefined,
            contractEndDate: contractEndDate || undefined,
            services: selectedServices.map((s) => ({
              serviceTemplateId: s.serviceTemplateId,
              price: s.price,
              sortOrder: s.sortOrder,
            })),
            paymentMilestones: paymentMilestones.map((p) => ({
              title: p.title,
              amount: p.amount,
              afterServiceIndex: p.afterServiceIndex,
            })),
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
        router.push(`/dashboard/projects/${projectId}`);
      }
    } catch {
      alert("حدث خطأ غير متوقع");
    }
    setSubmitting(false);
  };

  // ─── Navigation: template selected → skip step 2 ───
  const handleNext = () => {
    if (currentStep === 1) {
      if (templateApplied && selectedTemplateId) {
        // Skip step 2, go directly to step 3
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
      }
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    if (currentStep === 3 && templateApplied && selectedTemplateId) {
      // If we skipped step 2, go back to step 1
      setCurrentStep(1);
    } else {
      setCurrentStep((s) => s - 1);
    }
  };

  // ─── Validation ───
  const step1Valid = !!selectedClient && !!projectName.trim() && !!selectedContractId;
  const step2Valid = selectedServices.length >= 2;
  const step3Valid = !saveAsTemplate || templateName.trim().length > 0;

  const canGoNext = () => {
    if (currentStep === 1) return step1Valid;
    if (currentStep === 2) return step2Valid;
    return false;
  };

  // ─── Step labels ───
  const steps = [
    { num: 1, label: "البيانات والمتطلبات" },
    { num: 2, label: "الخدمات والدفعات" },
    { num: 3, label: "مراجعة وتأكيد" },
  ];

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

      {/* ══════════════════════════════════════════════ STEP 1 ══════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Client Selection */}
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
                    {clientResults.map((client) => (
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
                        <div className="flex-1 text-right">
                          <p className="text-sm font-medium" style={{ color: "#1C1B2E" }}>
                            {client.name}
                          </p>
                          <p className="text-xs text-gray-400">{client.email}</p>
                        </div>
                      </button>
                    ))}
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

          {/* Contract Selection - shown after client is selected */}
          {selectedClient && (
            <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
              <div className="flex items-center gap-2 mb-5">
                <FileText size={20} style={{ color: "#C9A84C" }} />
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                  {t.projects.linkedContract} *
                </h2>
              </div>

              {loadingContracts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : clientContracts.length === 0 ? (
                <div className="text-center py-6">
                  <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">
                    لا توجد عقود موقعة لهذا العميل
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    يجب وجود عقد موقع لإنشاء المشروع
                  </p>
                </div>
              ) : (
                <>
                  <select
                    value={selectedContractId}
                    onChange={(e) => handleContractSelect(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none bg-white transition-all"
                    style={{ borderColor: selectedContractId ? "#C9A84C" : "#E8E6F0", color: "#1C1B2E" }}
                  >
                    <option value="">{t.projects.selectContract}...</option>
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
                  {selectedContractId && contractAmount && (
                    <div
                      className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl"
                      style={{ backgroundColor: "rgba(5, 150, 105, 0.06)", border: "1px solid rgba(5, 150, 105, 0.2)" }}
                    >
                      <DollarSign size={16} style={{ color: "#059669" }} />
                      <span className="text-sm font-semibold" style={{ color: "#059669" }}>
                        قيمة العقد: {contractAmount.toLocaleString("en-US")} <SarSymbol size={14} />
                      </span>
                    </div>
                  )}
                  {!selectedContractId && (
                    <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#DC2626" }}>
                      <AlertCircle size={14} />
                      يجب اختيار عقد موقع للمتابعة
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Project Info */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <FolderKanban size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                بيانات المشروع
              </h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  {t.projects.projectName} *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="أدخل اسم المشروع"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:ring-2"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  وصف المشروع
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="وصف مختصر للمشروع..."
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:ring-2 resize-none"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                  onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
                  onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
                />
              </div>
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
            </div>
          </div>

          {/* Workflow Type */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <Layers size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                نوع سير العمل بين الخدمات
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setWorkflowType("SEQUENTIAL")}
                className="p-5 rounded-xl border-2 text-right transition-all"
                style={
                  workflowType === "SEQUENTIAL"
                    ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                    : { borderColor: "#E5E7EB" }
                }
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor:
                        workflowType === "SEQUENTIAL" ? "rgba(201, 168, 76, 0.15)" : "#F3F4F6",
                    }}
                  >
                    <ArrowDown
                      size={20}
                      style={{ color: workflowType === "SEQUENTIAL" ? "#C9A84C" : "#9CA3AF" }}
                    />
                  </div>
                  <span
                    className="font-bold"
                    style={{ color: workflowType === "SEQUENTIAL" ? "#1C1B2E" : "#6B7280" }}
                  >
                    تسلسلي
                  </span>
                </div>
                <p className="text-xs text-gray-400 mr-13">
                  الخدمات تُنفذ واحدة تلو الأخرى بالترتيب المحدد. كل خدمة تبدأ بعد انتهاء السابقة.
                </p>
              </button>
              <button
                onClick={() => setWorkflowType("INDEPENDENT")}
                className="p-5 rounded-xl border-2 text-right transition-all"
                style={
                  workflowType === "INDEPENDENT"
                    ? { borderColor: "#C9A84C", backgroundColor: "rgba(201, 168, 76, 0.05)" }
                    : { borderColor: "#E5E7EB" }
                }
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor:
                        workflowType === "INDEPENDENT" ? "rgba(201, 168, 76, 0.15)" : "#F3F4F6",
                    }}
                  >
                    <ArrowLeftRight
                      size={20}
                      style={{ color: workflowType === "INDEPENDENT" ? "#C9A84C" : "#9CA3AF" }}
                    />
                  </div>
                  <span
                    className="font-bold"
                    style={{ color: workflowType === "INDEPENDENT" ? "#1C1B2E" : "#6B7280" }}
                  >
                    مستقل
                  </span>
                </div>
                <p className="text-xs text-gray-400 mr-13">
                  الخدمات تُنفذ بشكل متوازي ومستقل. يمكن البدء بأي خدمة في أي وقت.
                </p>
              </button>
            </div>
          </div>

          {/* SLA Timeline */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center gap-2 mb-5">
              <Clock size={20} style={{ color: "#C9A84C" }} />
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                مدة العقد (SLA)
              </h2>
              <span className="text-xs text-gray-400 mr-2">(اختياري)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  تاريخ بداية العقد
                </label>
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => {
                    setContractStartDate(e.target.value);
                    if (e.target.value && contractDurationDays) {
                      const start = new Date(e.target.value);
                      start.setDate(start.getDate() + parseInt(contractDurationDays));
                      setContractEndDate(start.toISOString().split("T")[0]);
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  مدة العقد (بالأيام)
                </label>
                <input
                  type="number"
                  min="1"
                  value={contractDurationDays}
                  onChange={(e) => {
                    setContractDurationDays(e.target.value);
                    if (contractStartDate && e.target.value) {
                      const start = new Date(contractStartDate);
                      start.setDate(start.getDate() + parseInt(e.target.value));
                      setContractEndDate(start.toISOString().split("T")[0]);
                    }
                  }}
                  placeholder="مثال: 90"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#2D3748" }}>
                  تاريخ نهاية العقد
                </label>
                <input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => {
                    setContractEndDate(e.target.value);
                    if (contractStartDate && e.target.value) {
                      const days = Math.floor((new Date(e.target.value).getTime() - new Date(contractStartDate).getTime()) / (1000 * 60 * 60 * 24));
                      if (days > 0) setContractDurationDays(String(days));
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all"
                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                />
              </div>
            </div>
          </div>

          {/* Use Template */}
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
                تم تطبيق القالب - سيتم تجاوز خطوة الخدمات والانتقال مباشرة للمراجعة
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ STEP 2 ══════════════════════════════════════════════ */}
      {currentStep === 2 && (
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
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {service.duration ? `${service.duration} يوم` : "—"}
                              </span>
                              <span className="flex items-center gap-1">
                                <ListChecks size={11} />
                                {service.taskCount} مهمة
                              </span>
                            </div>
                            {/* Editable price - disabled if from contract */}
                            {!priceFromContract && (
                              <div className="flex items-center gap-1.5">
                                <DollarSign size={12} className="text-gray-400" />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={service.price || ""}
                                  onChange={(e) =>
                                    updateServicePrice(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 px-2 py-1 text-xs rounded-lg border outline-none"
                                  style={{ borderColor: "#E8E6F0", color: "#1C1B2E" }}
                                />
                                <SarSymbol size={12} />
                              </div>
                            )}
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
                  {!priceFromContract && (
                    <>
                      <div className="flex items-center justify-between text-sm mb-2" style={{ color: "#2D3748" }}>
                        <span>مجموع الخدمات</span>
                        <span className="font-medium">{calculatedTotal.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                      </div>
                      {paymentMilestonesTotal > 0 && (
                        <div className="flex items-center justify-between text-sm mb-2" style={{ color: "#059669" }}>
                          <span>مجموع الدفعات البينية</span>
                          <span className="font-medium">{paymentMilestonesTotal.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "2px solid #C9A84C" }}>
                    <label className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                      السعر الإجمالي
                    </label>
                    {priceFromContract ? (
                      <span className="text-lg font-bold" style={{ color: "#C9A84C" }}>
                        {finalTotal.toLocaleString("en-US")} <SarSymbol size={16} />
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={totalPriceOverride}
                          onChange={(e) => setTotalPriceOverride(e.target.value)}
                          placeholder={calculatedTotal.toLocaleString("en-US")}
                          className="w-28 px-3 py-1.5 text-sm rounded-lg border outline-none text-left font-bold"
                          style={{ borderColor: "#E8E6F0", color: "#C9A84C" }}
                        />
                        <SarSymbol size={14} />
                      </div>
                    )}
                  </div>
                  {!priceFromContract && totalPriceOverride && parseFloat(totalPriceOverride) !== calculatedTotal && (
                    <p className="text-xs text-gray-400 mt-1 text-left">
                      تم تعديل السعر يدوياً (الأصلي: {calculatedTotal.toLocaleString("en-US")} <SarSymbol size={12} />)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ STEP 3 ══════════════════════════════════════════════ */}
      {currentStep === 3 && (
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
                {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
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
              {/* Edit services button - allows going to step 2 to customize */}
              <MarsaButton variant="secondary" icon={<Edit3 size={14} />}
                onClick={() => {
                  setTemplateApplied(false);
                  setCurrentStep(2);
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
                              {!priceFromContract && <span>{service.price.toLocaleString("en-US")} <SarSymbol size={12} /></span>}
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
                  <div className="flex items-center justify-between py-2 text-sm" style={{ color: "#2D3748" }}>
                    <span>مجموع أسعار الخدمات</span>
                    <span className="font-medium">{calculatedTotal.toLocaleString("en-US")} <SarSymbol size={14} /></span>
                  </div>
                  {paymentMilestones.length > 0 && (
                    <div className="pt-2" style={{ borderTop: "1px solid #F3F4F6" }}>
                      <p className="text-xs text-gray-400 mb-2">الدفعات البينية:</p>
                      {paymentMilestones.map((pm) => (
                        <div key={pm.id} className="flex items-center justify-between py-1 text-sm" style={{ color: "#059669" }}>
                          <span className="flex items-center gap-1.5">
                            <CreditCard size={12} />
                            {pm.title}
                          </span>
                          <span className="font-medium">{pm.amount.toLocaleString("en-US")} <SarSymbol size={14} /></span>
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
          {currentStep < 3 ? (
            <MarsaButton variant="primary" size="lg" onClick={handleNext} disabled={!canGoNext()}>
              التالي
              <ChevronLeft size={16} />
            </MarsaButton>
          ) : (
            <MarsaButton variant="gold" size="lg" onClick={handleSubmit} disabled={submitting || !step3Valid} loading={submitting}
              icon={!submitting ? <FolderKanban size={16} /> : undefined}
            >
              {submitting ? t.common.loading : t.common.create}
            </MarsaButton>
          )}
        </div>
      </div>

      {/* Contract prompt dialog — required for every project */}
      {showContractPrompt && selectedClient && (
        <ContractPromptDialog
          clientId={selectedClient.id}
          onSuccess={(contractId) => {
            setSelectedContractId(contractId);
            setShowContractPrompt(false);
            // Auto-submit after contract is created
            setTimeout(() => handleSubmit(), 100);
          }}
          onCancel={() => setShowContractPrompt(false)}
        />
      )}
    </div>
  );
}
