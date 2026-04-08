"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import SignaturePad from "signature_pad";
import { useSession } from "next-auth/react";
import { useLang } from "@/contexts/LanguageContext";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import {
  FileText,
  Loader2,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Users2,
  FolderKanban,
  Tag,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  DollarSign,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface ContractTemplate {
  id: string;
  title: string;
  content: string;
  description: string | null;
}

interface Contract {
  id: string;
  contractNumber: number | null;
  status: string;
  finalContent: string;
  managerNote: string | null;
  clientNote: string | null;
  template: { id: string; title: string };
  client: { id: string; name: string };
  issuedBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  approvedAt: string | null;
  sentAt: string | null;
  signedAt: string | null;
  managerSignatureImage: string | null;
  managerStampImage: string | null;
  managerSignedAt: string | null;
  managerName: string | null;
  clientSignature: string | null;
  clientSignedAt: string | null;
  installments: ContractInstallment[];
  createdAt: string;
}

interface ContractInstallment {
  id: string;
  title: string;
  amount: number;
  percentage: number | null;
  dueAfterDays: number | null;
  order: number;
}

interface Client {
  id: string;
  name: string;
}

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim()))];
}

function mergeVariables(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    content
  );
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: "مسودة", bg: "#F3F4F6", text: "#6B7280" },
  PENDING_APPROVAL: { label: "بانتظار الاعتماد", bg: "#FEF9C3", text: "#CA8A04" },
  SENT_TO_CLIENT: { label: "أُرسل للعميل", bg: "#DBEAFE", text: "#2563EB" },
  CONTRACT_REVISION: { label: "يحتاج تعديل", bg: "#FFF7ED", text: "#EA580C" },
  SIGNED: { label: "موقّع", bg: "#DCFCE7", text: "#16A34A" },
  ACTIVE: { label: "نشط", bg: "#ECFDF5", text: "#059669" },
  REJECTED: { label: "مرفوض", bg: "#FEF2F2", text: "#DC2626" },
  CANCELLED: { label: "ملغي", bg: "#FEF2F2", text: "#DC2626" },
};

// formatDate is defined inside the component to access lang

export default function ContractsPage() {
  const { data: session } = useSession();
  const { t, lang, isRTL } = useLang();
  const { refreshCounts } = useSidebarCounts();
  const role = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isAdmin = ["ADMIN", "MANAGER"].includes(role);
  const isClientRole = role === "CLIENT";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Inline edit for contractNumber — admins/managers can click the
  // number cell to set it. After save, the server cascades the new
  // number into every linked project's projectCode.
  const [editingNumberId, setEditingNumberId] = useState<string | null>(null);
  const [editingNumberInput, setEditingNumberInput] = useState("");
  const [editingNumberSaving, setEditingNumberSaving] = useState(false);
  const saveContractNumber = async (contractId: string) => {
    if (editingNumberSaving) return;
    setEditingNumberSaving(true);
    try {
      const parsed = editingNumberInput.trim() === "" ? null : Number(editingNumberInput);
      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
        alert("أدخل عدداً صحيحاً موجباً");
        setEditingNumberSaving(false);
        return;
      }
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_contract_number", contractNumber: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "تعذّر تحديث رقم العقد");
        setEditingNumberSaving(false);
        return;
      }
      setContracts((prev) =>
        prev.map((c) => (c.id === contractId ? { ...c, contractNumber: parsed } : c))
      );
      setEditingNumberId(null);
      setEditingNumberInput("");
    } catch {
      alert("حدث خطأ");
    } finally {
      setEditingNumberSaving(false);
    }
  };

  // Client search for issue modal
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [clientSearchResults, setClientSearchResults] = useState<Client[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [showClientResults, setShowClientResults] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const clientSearchTimer = useRef<NodeJS.Timeout | null>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Inline add client
  const [showInlineAddClient, setShowInlineAddClient] = useState(false);
  const [inlineClient, setInlineClient] = useState({ name: "", email: "", phone: "", company: "" });
  const [inlineClientSaving, setInlineClientSaving] = useState(false);
  const [inlineClientError, setInlineClientError] = useState("");

  // Issue modal
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Preview modal
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<Contract | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  // Edit modal
  const [editTarget, setEditTarget] = useState<Contract | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Client revision modal
  const [revisionTarget, setRevisionTarget] = useState<Contract | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

  // Signature modal
  const [signTarget, setSignTarget] = useState<string | null>(null);
  const signCanvasRef = useRef<HTMLCanvasElement>(null);
  const signPadRef = useRef<SignaturePad | null>(null);

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);

  // Form
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Installments
  const [installments, setInstallments] = useState<{ id: string; title: string; amount: number; percentage: number | null; dueAfterDays: number | null; usePercentage: boolean }[]>([]);
  const [installmentMode, setInstallmentMode] = useState<"amount" | "percentage">("amount");
  const [toastMsg, setToastMsg] = useState("");

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const locale = lang === "ar" ? "ar-SA-u-nu-latn" : "en-US";
    return new Date(d).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  useEffect(() => { document.title = `${t.contracts.title} | ${t.brand.name}`; }, [t]);
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Signature pad initialization
  useEffect(() => {
    if (signTarget && signCanvasRef.current) {
      const canvas = signCanvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      const pad = new SignaturePad(canvas, {
        penColor: "#1C1B2E",
        backgroundColor: "rgba(255, 255, 255, 0)",
      });
      signPadRef.current = pad;

      return () => { pad.off(); };
    }
  }, [signTarget]);

  const handleSignSubmit = async () => {
    if (!signTarget || !signPadRef.current) return;
    if (signPadRef.current.isEmpty()) {
      setToastMsg("يرجى رسم التوقيع أولاً");
      return;
    }

    setActionLoading(signTarget);
    try {
      const signatureData = signPadRef.current.toDataURL("image/png");
      const res = await fetch(`/api/contracts/${signTarget}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sign", clientSignature: signatureData }),
      });
      if (res.ok) {
        fetchContracts();
        refreshCounts();
        setSignTarget(null);
        setToastMsg("تم توقيع العقد بنجاح");
      } else {
        const data = await res.json();
        setToastMsg(data.error || "حدث خطأ");
      }
    } catch {
      setToastMsg("حدث خطأ في الاتصال");
    } finally {
      setActionLoading(null);
    }
  };

  const fetchContracts = () => {
    fetch("/api/contracts")
      .then((r) => r.json())
      .then((data) => setContracts(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/contracts").then((r) => r.json()),
      fetch("/api/contract-templates").then((r) => r.json()),
    ])
      .then(([contractsData, templatesData]) => {
        setContracts(Array.isArray(contractsData) ? contractsData : []);
        setTemplates(Array.isArray(templatesData) ? templatesData : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Click outside to close client search
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Client search with debounce
  const handleClientSearchInput = useCallback((q: string) => {
    setClientSearchQuery(q);
    if (clientSearchTimer.current) clearTimeout(clientSearchTimer.current);
    if (q.length < 2) {
      setClientSearchResults([]);
      setShowClientResults(false);
      return;
    }
    setSearchingClients(true);
    clientSearchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&roles=CLIENT`);
        if (res.ok) {
          const data = await res.json();
          setClientSearchResults(data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
          setShowClientResults(true);
        }
      } catch {}
      setSearchingClients(false);
    }, 300);
  }, []);

  const handleInlineAddClient = async () => {
    if (!inlineClient.name || !inlineClient.phone) { setInlineClientError(t.clients.nameAndPhoneRequired); return; }
    setInlineClientSaving(true); setInlineClientError("");
    try {
      const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickAdd: true, role: "CLIENT", ...inlineClient }) });
      if (res.ok) {
        const data = await res.json();
        setSelectedClientId(data.id); setSelectedClientName(data.name);
        setShowInlineAddClient(false); setInlineClient({ name: "", email: "", phone: "", company: "" });
      } else { const d = await res.json(); setInlineClientError(d.error || t.common.error); }
    } catch { setInlineClientError(t.common.connectionError); }
    finally { setInlineClientSaving(false); }
  };

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId]);
  const templateVars = useMemo(() => (selectedTemplate ? extractVariables(selectedTemplate.content) : []), [selectedTemplate]);
  const previewContent = useMemo(() => {
    if (!selectedTemplate) return "";
    return mergeVariables(selectedTemplate.content, variables);
  }, [selectedTemplate, variables]);

  const openNew = () => {
    setSelectedTemplateId(""); setSelectedClientId(""); setVariables({});
    setClientSearchQuery(""); setSelectedClientName(""); setClientSearchResults([]); setShowClientResults(false);
    setInstallments([]); setInstallmentMode("amount");
    setStep(1); setShowModal(true);
  };

  // Extract contract total from variables
  const contractTotal = useMemo(() => {
    const amount = parseFloat(variables.totalAmount || variables.المبلغ_الإجمالي || variables.amount || variables.قيمة_العقد || "0");
    return amount > 0 ? amount : 0;
  }, [variables]);

  const installmentsTotal = useMemo(() => installments.reduce((s, i) => s + i.amount, 0), [installments]);

  const addInstallment = () => {
    setInstallments((prev) => [
      ...prev,
      { id: `inst-${Date.now()}`, title: `${t.contracts.installments} ${prev.length + 1}`, amount: 0, percentage: null, dueAfterDays: null, usePercentage: false },
    ]);
  };

  const removeInstallment = (id: string) => {
    setInstallments((prev) => prev.filter((i) => i.id !== id));
  };

  const updateInstallment = (id: string, field: string, value: string | number | null) => {
    setInstallments((prev) =>
      prev.map((inst) => {
        if (inst.id !== id) return inst;
        const updated = { ...inst, [field]: value };
        // Auto-calculate amount from percentage
        if (field === "percentage" && contractTotal > 0 && value !== null) {
          updated.amount = Math.round((contractTotal * (value as number)) / 100 * 100) / 100;
        }
        // Auto-calculate percentage from amount
        if (field === "amount" && contractTotal > 0) {
          updated.percentage = Math.round(((value as number) / contractTotal) * 10000) / 100;
        }
        return updated;
      })
    );
  };

  const handleVarChange = (key: string, value: string) => setVariables((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!selectedTemplateId || !selectedClientId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        templateId: selectedTemplateId,
        clientId: selectedClientId,
        variables,
      };
      if (installments.length > 0) {
        payload.installments = installments.map((inst) => ({
          title: inst.title,
          amount: inst.amount,
          percentage: inst.percentage,
          dueAfterDays: inst.dueAfterDays,
        }));
      }
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setToastMsg(data.error || data.details || t.common.error);
        return;
      }
      setShowModal(false); fetchContracts(); refreshCounts();
      setToastMsg(t.common.success);
    } catch {
      setToastMsg(t.common.connectionError);
    } finally { setSaving(false); }
  };

  const handleAction = async (contractId: string, action: string, extra?: Record<string, string | undefined>) => {
    setActionLoading(contractId);
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        fetchContracts();
        refreshCounts();
        setRejectTarget(null); setRejectNote("");
        setRevisionTarget(null); setRevisionNote("");
        setPreviewContract(null);
      }
    } catch { /* ignore */ } finally { setActionLoading(null); }
  };

  const handleEditSave = async (andSubmit?: boolean) => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      // Save content
      await fetch(`/api/contracts/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalContent: editContent }),
      });
      // Optionally submit/resubmit
      if (andSubmit) {
        const action = editTarget.status === "CONTRACT_REVISION" ? "resubmit" : "submit";
        await fetch(`/api/contracts/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, finalContent: editContent }),
        });
      }
      setEditTarget(null);
      fetchContracts();
    } catch { /* ignore */ } finally { setEditSaving(false); }
  };

  const handlePrint = async () => {
    const c = previewContract;
    if (!c) return;

    // Use the PDF API for print-ready HTML with letterhead and margins
    const win = window.open("", "_blank");
    if (!win) return;

    try {
      const res = await fetch(`/api/contracts/${c.id}/pdf`);
      if (res.ok) {
        const html = await res.text();
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 400);
      } else {
        win.close();
      }
    } catch {
      win.close();
    }
  };

  const getActionButtons = (c: Contract) => {
    if (actionLoading === c.id) return <Loader2 size={16} className="animate-spin" style={{ color: "#1C1B2E" }} />;
    const buttons: React.ReactElement[] = [];

    // DRAFT → issuer can edit + submit
    if (c.status === "DRAFT" && (c.issuedBy.id === userId || isAdmin)) {
      buttons.push(
        <MarsaButton key="edit" onClick={() => { setEditTarget(c); setEditContent(c.finalContent); }}
          variant="ghost" size="xs" icon={<Pencil size={13} />}
          style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }} title={t.contracts.editContract}>
          {t.common.edit}
        </MarsaButton>,
        <MarsaButton key="submit" onClick={() => handleAction(c.id, "submit")}
          variant="gold" size="xs" icon={<Send size={13} />}
          style={{ backgroundColor: "#CA8A04" }} title={t.contracts.submitForApproval}>
          {t.contracts.submitForApproval}
        </MarsaButton>
      );
    }

    // CONTRACT_REVISION → issuer can edit + resubmit
    if (c.status === "CONTRACT_REVISION" && (c.issuedBy.id === userId || isAdmin)) {
      buttons.push(
        <MarsaButton key="edit-rev" onClick={() => { setEditTarget(c); setEditContent(c.finalContent); }}
          variant="gold" size="xs" icon={<RotateCcw size={13} />}
          style={{ backgroundColor: "#EA580C" }} title={t.contracts.editAndResubmit}>
          {t.common.edit}
        </MarsaButton>
      );
    }

    // PENDING_APPROVAL → admin/manager can edit, approve, reject
    if (c.status === "PENDING_APPROVAL" && isAdmin) {
      buttons.push(
        <MarsaButton key="edit-mgr" onClick={() => { setEditTarget(c); setEditContent(c.finalContent); }}
          variant="ghost" size="xs" icon={<Pencil size={13} />}
          style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }} title={t.common.edit}>
          {t.common.edit}
        </MarsaButton>,
        <MarsaButton key="approve" onClick={() => handleAction(c.id, "approve")}
          variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
          style={{ backgroundColor: "#059669" }} title={t.common.approve}>
          {t.common.approve}
        </MarsaButton>,
        <MarsaButton key="reject" onClick={() => { setRejectTarget(c); setRejectNote(""); }}
          variant="danger" size="xs" icon={<XCircle size={13} />}
          title={t.common.reject}>
          {t.common.reject}
        </MarsaButton>
      );
    }

    // SENT_TO_CLIENT → client can sign or request revision
    if (c.status === "SENT_TO_CLIENT" && c.client.id === userId) {
      buttons.push(
        <MarsaButton key="sign" onClick={() => setSignTarget(c.id)}
          variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
          style={{ backgroundColor: "#16A34A" }} title={t.contracts.sign}>
          {t.contracts.sign}
        </MarsaButton>,
        <MarsaButton key="revision" onClick={() => { setRevisionTarget(c); setRevisionNote(""); }}
          variant="ghost" size="xs" icon={<RotateCcw size={13} />}
          style={{ backgroundColor: "#FFF7ED", color: "#EA580C" }} title={t.contracts.requestRevision}>
          {t.contracts.requestRevision}
        </MarsaButton>
      );
    }

    // SIGNED → admin can activate
    if (c.status === "SIGNED" && isAdmin) {
      buttons.push(
        <MarsaButton key="activate" onClick={() => handleAction(c.id, "activate")}
          variant="primary" size="xs" icon={<CheckCircle2 size={13} />}
          style={{ backgroundColor: "#059669" }} title={t.contracts.activate}>
          {t.contracts.activate}
        </MarsaButton>
      );
    }

    return buttons.length > 0 ? <div className="flex items-center gap-1.5 flex-wrap">{buttons}</div> : null;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} /></div>;
  }

  return (
    <div className="p-8" dir={isRTL ? "rtl" : "ltr"} style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>{t.contracts.title}</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>{t.contracts.subtitle}</p>
        </div>
        {!isClientRole && (
          <MarsaButton onClick={openNew} variant="primary" icon={<Plus size={18} />}>
            {t.contracts.newContract}
          </MarsaButton>
        )}
      </div>

      {/* Contracts list */}
      {contracts.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
          <FileText size={40} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.5 }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>{t.contracts.noContracts}</h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>{isClientRole ? t.contracts.noContractsClient : t.contracts.noContractsDesc}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.contracts.contractNumber}</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.contracts.template}</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.contracts.client}</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.contracts.project}</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.common.status}</th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.common.date}</th>
                  <th className="text-center px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const st = statusConfig[c.status] || statusConfig.DRAFT;
                  return (
                    <tr key={c.id} className="hover:bg-[#FAFAF8] transition-colors" style={{ borderBottom: "1px solid #F0EDE6" }}>
                      <td className="px-5 py-4">
                        {isAdmin && editingNumberId === c.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={editingNumberInput}
                              onChange={(e) => setEditingNumberInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveContractNumber(c.id);
                                if (e.key === "Escape") { setEditingNumberId(null); setEditingNumberInput(""); }
                              }}
                              disabled={editingNumberSaving}
                              className="w-20 px-2 py-1 rounded-md border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-200"
                              style={{ borderColor: "#E2E0D8" }}
                              placeholder="—"
                            />
                            <button
                              type="button"
                              onClick={() => saveContractNumber(c.id)}
                              disabled={editingNumberSaving}
                              className="text-[10px] font-bold px-2 py-1 rounded-md"
                              style={{ backgroundColor: "#22C55E", color: "white" }}
                              title="حفظ"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditingNumberId(null); setEditingNumberInput(""); }}
                              disabled={editingNumberSaving}
                              className="text-[10px] font-bold px-2 py-1 rounded-md"
                              style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                              title="إلغاء"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!isAdmin) return;
                              setEditingNumberId(c.id);
                              setEditingNumberInput(c.contractNumber != null ? String(c.contractNumber) : "");
                            }}
                            disabled={!isAdmin}
                            className="text-sm font-bold transition-colors"
                            style={{ color: "#5E5495", cursor: isAdmin ? "pointer" : "default" }}
                            title={isAdmin ? "اضغط للتعديل" : undefined}
                          >
                            {c.contractNumber ? `#${c.contractNumber}` : "—"}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText size={16} style={{ color: "#C9A84C" }} />
                          <span className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{c.template.title}</span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{t.contracts.issuedBy}: {c.issuedBy.name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: "#2D3748" }}>
                          <Users2 size={14} style={{ color: "#94A3B8" }} />{c.client.name}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.project ? (
                          <div className="flex items-center gap-1.5 text-sm" style={{ color: "#2D3748" }}>
                            <FolderKanban size={14} style={{ color: "#94A3B8" }} />{c.project.name}
                          </div>
                        ) : <span className="text-sm" style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{(t.contracts.status as Record<string, string>)[c.status] || st.label}</span>
                        {c.clientNote && c.status === "CONTRACT_REVISION" && (
                          <p className="text-xs mt-1 max-w-[150px] truncate" style={{ color: "#EA580C" }} title={c.clientNote}>{c.clientNote}</p>
                        )}
                        {c.managerNote && c.status === "REJECTED" && (
                          <p className="text-xs mt-1 max-w-[150px] truncate" style={{ color: "#DC2626" }} title={c.managerNote}>{c.managerNote}</p>
                        )}
                        {c.signedAt && <p className="text-xs mt-0.5" style={{ color: "#16A34A" }}>{t.contracts.signed}: {formatDate(c.signedAt)}</p>}
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: "#6B7280" }}>{formatDate(c.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <MarsaButton onClick={() => setPreviewContract(c)} variant="ghost" size="xs" iconOnly icon={<Eye size={16} />} title={t.common.view} />
                          {getActionButtons(c)}
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

      {/* ═══ Issue Contract Modal ═══ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{t.contracts.newContract}</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">{[1,2,3,4].map((s) => (<div key={s} className="w-8 h-1 rounded-full" style={{ backgroundColor: s <= step ? "#C9A84C" : "#E8E6F0" }} />))}</div>
                <MarsaButton onClick={() => setShowModal(false)} variant="ghost" size="xs" iconOnly icon={<X size={20} />} />
              </div>
            </div>
            <div className="p-6" dir="rtl">
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>{t.contracts.selectTemplateLabel}</label>
                    <select value={selectedTemplateId} onChange={(e) => { setSelectedTemplateId(e.target.value); setVariables({}); }}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none bg-white" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}>
                      <option value="">{t.contracts.selectTemplate}</option>
                      {templates.filter((t) => (t as unknown as Record<string, unknown>).isActive !== false).map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                    </select>
                    {selectedTemplate?.description && <p className="text-xs mt-2 p-3 rounded-lg" style={{ backgroundColor: "#FAFAFE", color: "#6B7280" }}>{selectedTemplate.description}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>{t.contracts.clientLabel}</label>
                    {selectedClientId ? (
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl"
                        style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)" }}>
                        <div className="flex items-center gap-2">
                          <Users2 size={16} style={{ color: "#C9A84C" }} />
                          <span className="text-sm font-medium" style={{ color: "#1C1B2E" }}>{selectedClientName}</span>
                        </div>
                        <button onClick={() => { setSelectedClientId(""); setSelectedClientName(""); setClientSearchQuery(""); }}
                          className="p-1 rounded-lg hover:bg-white transition-colors text-gray-400 hover:text-red-500">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="relative" ref={clientSearchRef}>
                        <div className="relative">
                          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
                          <input
                            type="text"
                            value={clientSearchQuery}
                            onChange={(e) => handleClientSearchInput(e.target.value)}
                            placeholder={t.contracts.searchClient}
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none bg-white"
                            style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                            onFocus={() => { if (clientSearchResults.length > 0) setShowClientResults(true); }}
                          />
                          {searchingClients && <Loader2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: "#94A3B8" }} />}
                        </div>
                        {showClientResults && clientSearchResults.length > 0 && (
                          <div className="absolute z-30 w-full mt-1 bg-white rounded-xl shadow-xl overflow-hidden" style={{ border: "1px solid #E2E0D8" }}>
                            {clientSearchResults.map((c) => (
                              <button key={c.id}
                                onClick={() => { setSelectedClientId(c.id); setSelectedClientName(c.name); setShowClientResults(false); setClientSearchQuery(""); }}
                                className="flex items-center gap-2 w-full px-4 py-2.5 text-right hover:bg-gray-50 transition-colors">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: "#5E5495" }}>
                                  {c.name.charAt(0)}
                                </div>
                                <span className="text-sm" style={{ color: "#1C1B2E" }}>{c.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {showClientResults && clientSearchResults.length === 0 && clientSearchQuery.length >= 2 && !searchingClients && (
                          <div className="absolute z-30 w-full mt-1 bg-white rounded-xl shadow-xl p-3 text-center" style={{ border: "1px solid #E2E0D8" }}>
                            <p className="text-sm mb-2" style={{ color: "#94A3B8" }}>{t.common.noResults}</p>
                            <MarsaButton onClick={() => { setShowInlineAddClient(true); setShowClientResults(false); setInlineClient({ ...inlineClient, name: clientSearchQuery }); }}
                              variant="primary" size="sm" icon={<Plus size={13} />} className="mx-auto">
                              {t.contracts.addClientNote}
                            </MarsaButton>
                          </div>
                        )}
                        {showInlineAddClient && (
                          <div className="mt-3 p-4 rounded-xl space-y-2" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E2E0D8" }}>
                            <p className="text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>{t.contracts.addClientNote}</p>
                            {inlineClientError && <p className="text-xs text-red-600 bg-red-50 p-1.5 rounded-lg">{inlineClientError}</p>}
                            <input placeholder={t.clients.clientName} value={inlineClient.name} onChange={(e) => setInlineClient({ ...inlineClient, name: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                            <input placeholder={t.clients.phone} dir="ltr" value={inlineClient.phone} onChange={(e) => setInlineClient({ ...inlineClient, phone: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                            <input placeholder={t.clients.email} type="email" dir="ltr" value={inlineClient.email} onChange={(e) => setInlineClient({ ...inlineClient, email: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                            <input placeholder={t.clients.company} value={inlineClient.company} onChange={(e) => setInlineClient({ ...inlineClient, company: e.target.value })}
                              className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
                            <div className="flex gap-2 pt-1">
                              <MarsaButton onClick={handleInlineAddClient} disabled={inlineClientSaving} variant="primary" size="sm" loading={inlineClientSaving} className="flex-1">
                                {inlineClientSaving ? t.common.loading : t.common.save}
                              </MarsaButton>
                              <MarsaButton onClick={() => setShowInlineAddClient(false)} variant="secondary" size="sm">{t.common.cancel}</MarsaButton>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-4">
                  {templateVars.length === 0 ? (
                    <div className="text-center py-8"><Tag size={32} className="mx-auto mb-3" style={{ color: "#94A3B8" }} /><p className="text-sm" style={{ color: "#6B7280" }}>{t.contracts.noVariables}</p></div>
                  ) : (
                    <>{templateVars.map((v) => (
                      <div key={v}><label className="block text-sm font-semibold mb-1" style={{ color: "#1C1B2E" }}>{v}</label>
                        <input type="text" value={variables[v] || ""} onChange={(e) => handleVarChange(v, e.target.value)} placeholder={`${v}...`}
                          className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} /></div>
                    ))}</>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>{t.contracts.installments}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{t.contracts.installmentScheduleDesc}</p>
                    </div>
                    <MarsaButton onClick={addInstallment} variant="gold" size="sm" icon={<Plus size={14} />}>
                      {t.contracts.addInstallment}
                    </MarsaButton>
                  </div>

                  {contractTotal > 0 && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm" style={{ backgroundColor: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", color: "#1C1B2E" }}>
                      <DollarSign size={14} style={{ color: "#C9A84C" }} />
                      <span>{t.contracts.totalContract}: <strong>{contractTotal.toLocaleString("en-US")} {t.common.currency}</strong></span>
                    </div>
                  )}

                  {installments.length === 0 ? (
                    <div className="text-center py-8 rounded-xl" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                      <DollarSign size={32} className="mx-auto mb-3" style={{ color: "#94A3B8" }} />
                      <p className="text-sm" style={{ color: "#6B7280" }}>{t.contracts.noInstallments}</p>
                      <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>{t.contracts.noInstallmentsDesc}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {installments.map((inst, idx) => (
                        <div key={inst.id} className="rounded-xl p-4" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: "rgba(5,150,105,0.1)", color: "#059669" }}>{idx + 1}</div>
                            <input type="text" value={inst.title}
                              onChange={(e) => updateInstallment(inst.id, "title", e.target.value)}
                              placeholder={`${t.contracts.installmentTitle}...`}
                              className="flex-1 text-sm font-semibold bg-transparent outline-none" style={{ color: "#1C1B2E" }} />
                            <MarsaButton onClick={() => removeInstallment(inst.id)}
                              variant="dangerSoft" size="xs" iconOnly icon={<Trash2 size={14} />} />
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] mb-1" style={{ color: "#94A3B8" }}>{t.contracts.installmentAmount}</label>
                              <input type="number" min="0" step="0.01" value={inst.amount || ""}
                                onChange={(e) => updateInstallment(inst.id, "amount", parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} />
                            </div>
                            <div>
                              <label className="block text-[11px] mb-1" style={{ color: "#94A3B8" }}>{t.contracts.installmentPercentage}</label>
                              <input type="number" min="0" max="100" step="0.1" value={inst.percentage ?? ""}
                                onChange={(e) => updateInstallment(inst.id, "percentage", e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
                                disabled={contractTotal === 0} />
                            </div>
                            <div>
                              <label className="block text-[11px] mb-1" style={{ color: "#94A3B8" }}>{t.contracts.dueAfterDays}</label>
                              <input type="number" min="0" value={inst.dueAfterDays ?? ""}
                                onChange={(e) => updateInstallment(inst.id, "dueAfterDays", e.target.value ? parseInt(e.target.value) : null)}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} />
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Summary */}
                      <div className="rounded-xl p-4" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
                        <div className="flex items-center justify-between text-sm">
                          <span style={{ color: "#2D3748" }}>{t.contracts.installmentsTotal}</span>
                          <span className="font-bold" style={{ color: installmentsTotal === contractTotal && contractTotal > 0 ? "#059669" : "#1C1B2E" }}>
                            {installmentsTotal.toLocaleString("en-US")} {t.common.currency}
                          </span>
                        </div>
                        {contractTotal > 0 && Math.abs(installmentsTotal - contractTotal) > 0.01 && (
                          <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: "#FEF9C3", color: "#CA8A04" }}>
                            <AlertTriangle size={14} />
                            <span>{t.contracts.installmentsMismatch}</span>
                          </div>
                        )}
                        {contractTotal > 0 && Math.abs(installmentsTotal - contractTotal) <= 0.01 && (
                          <div className="flex items-center gap-2 mt-2 p-2.5 rounded-lg text-xs" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
                            <CheckCircle2 size={14} />
                            <span>{t.contracts.installmentsMatch}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {step === 4 && (
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: "#1C1B2E" }}>{t.contracts.preview}:</p>
                  <div className="rounded-xl p-6 text-sm leading-loose whitespace-pre-wrap font-mono"
                    style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6", color: "#2D3748", maxHeight: "40vh", overflowY: "auto" }}>{previewContent}</div>
                  {installments.length > 0 && (
                    <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: "#1C1B2E" }}>{t.contracts.installmentSchedule} ({installments.length})</p>
                      <div className="space-y-1.5">
                        {installments.map((inst, idx) => (
                          <div key={inst.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style={{ backgroundColor: "white" }}>
                            <span style={{ color: "#2D3748" }}>{idx + 1}. {inst.title}</span>
                            <div className="flex items-center gap-3">
                              {inst.dueAfterDays && <span className="text-xs" style={{ color: "#94A3B8" }}>{t.contracts.afterDays} {inst.dueAfterDays} {t.contracts.day}</span>}
                              <span className="font-semibold" style={{ color: "#059669" }}>{inst.amount.toLocaleString("en-US")} {t.common.currency}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: "1px solid #F0EDE6" }}>
              <div>{step > 1 && (<MarsaButton onClick={() => setStep((s) => s - 1)} variant="secondary" icon={<ChevronRight size={16} />}>{t.common.previous}</MarsaButton>)}</div>
              <div className="flex items-center gap-3">
                <MarsaButton onClick={() => setShowModal(false)} variant="ghost">{t.common.cancel}</MarsaButton>
                {step < 4 ? (
                  <MarsaButton onClick={() => setStep((s) => s + 1)} disabled={step === 1 && (!selectedTemplateId || !selectedClientId)} variant="primary" icon={<ChevronLeft size={16} />}>{t.common.next}</MarsaButton>
                ) : (
                  <MarsaButton onClick={handleSubmit} disabled={saving} variant="primary" loading={saving} style={{ backgroundColor: "#059669" }}>{t.contracts.issue}</MarsaButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Preview Modal ═══ */}
      {previewContract && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                  {previewContract.contractNumber ? `${t.contracts.contractNoLabel} #${previewContract.contractNumber} — ` : ""}{previewContract.template.title}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "#6B7280" }}>
                  <span>{t.contracts.client}: {previewContract.client.name}</span>
                  {previewContract.approvedBy && <span>{t.contracts.approvedBy}: {previewContract.approvedBy.name}</span>}
                  {previewContract.signedAt && <span style={{ color: "#16A34A" }}>{t.contracts.signed}: {formatDate(previewContract.signedAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: (statusConfig[previewContract.status] || statusConfig.DRAFT).bg, color: (statusConfig[previewContract.status] || statusConfig.DRAFT).text }}>
                  {(t.contracts.status as Record<string, string>)[previewContract.status] || (statusConfig[previewContract.status] || statusConfig.DRAFT).label}
                </span>
                <MarsaButton onClick={handlePrint} variant="ghost" size="xs" iconOnly icon={<Printer size={18} />} title={t.contracts.printPdf} />
                <MarsaButton onClick={() => setPreviewContract(null)} variant="ghost" size="xs" iconOnly icon={<X size={20} />} />
              </div>
            </div>
            {/* Notes */}
            {previewContract.clientNote && previewContract.status === "CONTRACT_REVISION" && (
              <div className="mx-6 mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#FFF7ED", color: "#EA580C", border: "1px solid #FDBA74" }}>
                {t.contracts.clientNotes}: {previewContract.clientNote}
              </div>
            )}
            {previewContract.managerNote && previewContract.status === "REJECTED" && (
              <div className="mx-6 mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#FEF2F2", color: "#DC2626", border: "1px solid #FCA5A5" }}>
                {t.contracts.managerNote}: {previewContract.managerNote}
              </div>
            )}
            <div className="p-6">
              <div ref={printRef} className="rounded-xl p-6 text-sm leading-loose whitespace-pre-wrap font-mono"
                style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6", color: "#2D3748" }} dir="rtl">
                {previewContract.finalContent}
              </div>

              {/* Signature Display */}
              {(previewContract.managerSignatureImage || previewContract.signedAt) && (
                <div className="flex justify-between mt-6 pt-6" style={{ borderTop: "1px solid #E2E0D8" }}>
                  {/* Company / Manager */}
                  <div className="text-center" style={{ width: "45%" }}>
                    <p className="text-sm font-bold mb-3" style={{ color: "#1C1B2E" }}>{t.contracts.companyLabel}</p>
                    {previewContract.managerSignatureImage && (
                      <img src={previewContract.managerSignatureImage} alt={t.contracts.signatureCompany} className="mx-auto mb-2" style={{ maxHeight: "70px" }} />
                    )}
                    {previewContract.managerStampImage && (
                      <img src={previewContract.managerStampImage} alt={t.contracts.companyLabel} className="mx-auto mb-2" style={{ maxHeight: "50px" }} />
                    )}
                    {previewContract.managerName && (
                      <p className="text-xs" style={{ color: "#1C1B2E" }}>{previewContract.managerName}</p>
                    )}
                    {previewContract.managerSignedAt && (
                      <p className="text-xs" style={{ color: "#6B7280" }}>{formatDate(previewContract.managerSignedAt)}</p>
                    )}
                  </div>
                  {/* Client */}
                  <div className="text-center" style={{ width: "45%" }}>
                    <p className="text-sm font-bold mb-3" style={{ color: "#1C1B2E" }}>{t.contracts.client}: {previewContract.client.name}</p>
                    {previewContract.clientSignature ? (
                      <img src={previewContract.clientSignature} alt="توقيع العميل" className="mx-auto mb-2" style={{ maxHeight: 60 }} />
                    ) : previewContract.signedAt ? (
                      <div className="mt-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}>
                          {t.contracts.signedOnDate}: {formatDate(previewContract.signedAt)}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "#999" }}>لم يتم التوقيع بعد</span>
                    )}
                    {previewContract.clientSignedAt && (
                      <p className="text-xs" style={{ color: "#6B7280" }}>{formatDate(previewContract.clientSignedAt)}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {getActionButtons(previewContract) && (
              <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-3" style={{ borderTop: "1px solid #F0EDE6" }}>
                {getActionButtons(previewContract)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Edit Modal ═══ */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{t.contracts.editContract}</h2>
              <MarsaButton onClick={() => setEditTarget(null)} variant="ghost" size="xs" iconOnly icon={<X size={20} />} />
            </div>
            {editTarget.clientNote && editTarget.status === "CONTRACT_REVISION" && (
              <div className="mx-6 mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "#FFF7ED", color: "#EA580C", border: "1px solid #FDBA74" }}>
                {t.contracts.clientNotes}: {editTarget.clientNote}
              </div>
            )}
            <div className="p-6" dir="rtl">
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={16}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y font-mono leading-relaxed"
                style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #F0EDE6" }}>
              <MarsaButton onClick={() => setEditTarget(null)} variant="secondary">{t.common.cancel}</MarsaButton>
              <MarsaButton onClick={() => handleEditSave(false)} disabled={editSaving} variant="ghost" loading={editSaving} style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                {t.common.save}
              </MarsaButton>
              {(editTarget.status === "DRAFT" || editTarget.status === "CONTRACT_REVISION") && (
                <MarsaButton onClick={() => handleEditSave(true)} disabled={editSaving} variant="gold" loading={editSaving} style={{ backgroundColor: "#CA8A04" }}>
                  {editTarget.status === "CONTRACT_REVISION" ? t.contracts.saveAndSubmit : t.contracts.saveAndSubmit}
                </MarsaButton>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Reject Modal ═══ */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md" style={{ border: "1px solid #E2E0D8" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <h3 className="text-lg font-bold" style={{ color: "#DC2626" }}>{t.contracts.rejectContract}</h3>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{rejectTarget.template.title}</p>
            </div>
            <div className="p-6" dir="rtl">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>{t.contracts.rejectReason}</label>
              <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} placeholder={t.contracts.rejectReasonPlaceholder}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #F0EDE6" }}>
              <MarsaButton onClick={() => setRejectTarget(null)} variant="secondary">{t.common.cancel}</MarsaButton>
              <MarsaButton onClick={() => handleAction(rejectTarget.id, "reject", { managerNote: rejectNote })} disabled={actionLoading === rejectTarget.id} variant="danger" loading={actionLoading === rejectTarget.id}>
                {t.contracts.confirmReject}</MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Client Revision Modal ═══ */}
      {revisionTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md" style={{ border: "1px solid #E2E0D8" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0EDE6" }}>
              <h3 className="text-lg font-bold" style={{ color: "#EA580C" }}>{t.contracts.requestContractRevision}</h3>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{revisionTarget.template.title}</p>
            </div>
            <div className="p-6" dir="rtl">
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#1C1B2E" }}>{t.contracts.revisionNotes}</label>
              <textarea value={revisionNote} onChange={(e) => setRevisionNote(e.target.value)} rows={3} placeholder={t.contracts.revisionPlaceholder}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }} />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #F0EDE6" }}>
              <MarsaButton onClick={() => setRevisionTarget(null)} variant="secondary">{t.common.cancel}</MarsaButton>
              <MarsaButton onClick={() => handleAction(revisionTarget.id, "request_revision", { clientNote: revisionNote })} disabled={actionLoading === revisionTarget.id} variant="gold" loading={actionLoading === revisionTarget.id} style={{ backgroundColor: "#EA580C" }}>
                {t.contracts.sendRevision}</MarsaButton>
            </div>
          </div>
        </div>
      )}
      {/* ═══ Signature Modal ═══ */}
      {signTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl" style={{ border: "1px solid #E2E0D8" }}>
            <h3 className="text-lg font-bold mb-1" style={{ color: "#1C1B2E" }}>توقيع العقد</h3>
            <p className="text-sm mb-4" style={{ color: "#6B7280" }}>ارسم توقيعك في المساحة أدناه باستخدام الماوس أو اللمس</p>

            <div className="rounded-xl overflow-hidden mb-4" style={{ border: "2px dashed #E8E6F0", backgroundColor: "#FAFAFE" }}>
              <canvas
                ref={signCanvasRef}
                style={{ width: "100%", height: 200, touchAction: "none" }}
              />
            </div>

            <div className="flex gap-3">
              <MarsaButton
                onClick={() => signPadRef.current?.clear()}
                variant="secondary"
              >
                مسح
              </MarsaButton>
              <div className="flex-1" />
              <MarsaButton
                onClick={() => setSignTarget(null)}
                variant="secondary"
              >
                إلغاء
              </MarsaButton>
              <MarsaButton
                onClick={handleSignSubmit}
                disabled={actionLoading !== null}
                loading={actionLoading !== null}
                variant="primary"
                style={{ backgroundColor: "#16A34A" }}
              >
                {actionLoading ? "جاري التوقيع..." : "تأكيد التوقيع"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-xl text-sm font-medium text-white shadow-lg"
          style={{ backgroundColor: "#1C1B2E" }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
