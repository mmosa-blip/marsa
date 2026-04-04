"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Ticket,
  Plus,
  Search,
  X,
  MessageSquare,
  Send,
  Loader2,
  User,
  Clock,
  Tag,
  FileText,
  Lock,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";
import { useLang } from "@/contexts/LanguageContext";
import SarSymbol from "@/components/SarSymbol";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface TicketData {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  clientId: string;
  client: { id: string; name: string; email: string };
  agentId: string | null;
  agent: { id: string; name: string } | null;
  contractId: string | null;
  contract: { id: string; template: { title: string } } | null;
  installmentId: string | null;
  installment: { id: string; title: string; amount: number; paymentStatus: string } | null;
  _count: { messages: number };
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketMessage {
  id: string;
  body: string;
  senderId: string;
  sender: { id: string; name: string; role: string };
  isInternal: boolean;
  attachments: { id: string; url: string; filename: string }[];
  createdAt: string;
}

interface ContractOption {
  id: string;
  template: { title: string };
  installments?: { id: string; title: string; amount: number; paymentStatus: string }[];
}

interface AgentOption {
  id: string;
  name: string;
  role: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير",
  MANAGER: "مشرف",
  EXECUTOR: "منفذ",
  CLIENT: "عميل",
  EXTERNAL_PROVIDER: "مقدم خدمة",
  FINANCE_MANAGER: "مدير مالي",
  TREASURY_MANAGER: "أمين صندوق",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW: { label: "جديدة", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  OPEN: { label: "مفتوحة", color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  IN_PROGRESS: { label: "قيد المعالجة", color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  PENDING_CLIENT: { label: "بانتظار العميل", color: "#EA580C", bg: "rgba(234,88,12,0.1)" },
  RESOLVED: { label: "تم الحل", color: "#059669", bg: "rgba(5,150,105,0.1)" },
  CLOSED: { label: "مغلقة", color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: "منخفضة", color: "#94A3B8" },
  MEDIUM: { label: "متوسطة", color: "#C9A84C" },
  HIGH: { label: "عالية", color: "#EA580C" },
  URGENT: { label: "عاجلة", color: "#DC2626" },
};

const CATEGORIES = [
  "استفسار عام",
  "مشكلة تقنية",
  "طلب تعديل",
  "شكوى",
  "دفعات ومالية",
  "أخرى",
];

const STATUS_FILTERS = [
  { value: "", label: "الكل" },
  { value: "NEW", label: "جديدة" },
  { value: "OPEN", label: "مفتوحة" },
  { value: "IN_PROGRESS", label: "قيد المعالجة" },
  { value: "PENDING_CLIENT", label: "بانتظار العميل" },
  { value: "RESOLVED", label: "تم الحل" },
  { value: "CLOSED", label: "مغلقة" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `قبل ${diffMins} د`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `قبل ${diffHours} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `قبل ${diffDays} ي`;
  return new Date(date).toLocaleDateString("ar-SA-u-nu-latn", {
    month: "short",
    day: "numeric",
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { t } = useLang();
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const userId = session?.user?.id || "";
  const isStaff = ["ADMIN", "MANAGER", "EXECUTOR"].includes(role);
  const isAdminOrManager = ["ADMIN", "MANAGER"].includes(role);

  // List state
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");

  // Detail state
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<{ url: string; filename: string }[]>([]);

  // Assign state
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [assigningAgent, setAssigningAgent] = useState(false);

  // New ticket modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: "",
    category: CATEGORIES[0],
    priority: "MEDIUM",
    description: "",
    contractId: "",
    installmentId: "",
  });
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [creating, setCreating] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "التذاكر | مرسى";
  }, []);

  // ─── Fetch tickets ──────────────────────────────────────────────────────────

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    fetch(`/api/tickets?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTickets(d);
        else if (d.tickets) setTickets(d.tickets);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    if (session) fetchTickets();
  }, [session, fetchTickets]);

  // ─── Fetch ticket detail ────────────────────────────────────────────────────

  const openTicket = async (ticket: TicketData) => {
    setSelectedTicket(ticket);
    setLoadingMessages(true);
    setMessages([]);
    setReplyText("");
    setIsInternalNote(false);
    setAttachments([]);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.messages) setMessages(data.messages);
        if (data.ticket) setSelectedTicket(data.ticket);
        else setSelectedTicket(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ─── Fetch agents for assign ────────────────────────────────────────────────

  useEffect(() => {
    if (isAdminOrManager) {
      fetch("/api/users/search?q=&roles=EXECUTOR,ADMIN,MANAGER")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setAgents(d);
          else if (d.users) setAgents(d.users);
        })
        .catch(() => {});
    }
  }, [isAdminOrManager]);

  // ─── Fetch contracts for new ticket ─────────────────────────────────────────

  useEffect(() => {
    if (showNewModal) {
      const url = role === "CLIENT"
        ? "/api/contracts?status=SIGNED"
        : "/api/contracts";
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setContracts(d);
          else if (d.contracts) setContracts(d.contracts);
        })
        .catch(() => {});
    }
  }, [showNewModal, role]);

  // ─── Send reply ─────────────────────────────────────────────────────────────

  const handleSendReply = async () => {
    if (!selectedTicket || (!replyText.trim() && attachments.length === 0)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: replyText,
          isInternal: isInternalNote,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        setReplyText("");
        setAttachments([]);
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  // ─── Create ticket ─────────────────────────────────────────────────────────

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim() || !newTicket.description.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        subject: newTicket.subject,
        category: newTicket.category,
        priority: newTicket.priority,
        description: newTicket.description,
      };
      if (newTicket.contractId) body.contractId = newTicket.contractId;
      if (newTicket.installmentId) body.installmentId = newTicket.installmentId;

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowNewModal(false);
        setNewTicket({ subject: "", category: CATEGORIES[0], priority: "MEDIUM", description: "", contractId: "", installmentId: "" });
        fetchTickets();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  // ─── Update ticket ─────────────────────────────────────────────────────────

  const updateTicket = async (updates: Record<string, unknown>) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedTicket((prev) => (prev ? { ...prev, ...updated } : prev));
        setTickets((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      }
    } catch {
      // ignore
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    setAssigningAgent(true);
    await updateTicket({ agentId: agentId || null });
    setAssigningAgent(false);
  };

  // ─── Filtered tickets ──────────────────────────────────────────────────────

  const filteredTickets = tickets.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.ticketNumber.toLowerCase().includes(q) &&
        !t.subject.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  // ─── Selected contract installments ─────────────────────────────────────────

  const selectedContract = contracts.find((c) => c.id === newTicket.contractId);
  const contractInstallments = selectedContract?.installments || [];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#F8F9FA", padding: "2rem" }}>
      {/* ══════════════ HEADER ══════════════ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Ticket size={28} style={{ color: "#C9A84C" }} />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1C1B2E", margin: 0 }}>
              {t.tickets.title}
              <span
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 400,
                  color: "#6B7280",
                  marginRight: "0.5rem",
                }}
              >
                ({filteredTickets.length})
              </span>
            </h1>
          </div>
          <p style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>
            إدارة تذاكر الدعم والاستفسارات
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            background: "#C9A84C",
            color: "white",
            border: "none",
            borderRadius: "0.75rem",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#B8972F")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#C9A84C")}
        >
          <Plus size={18} />
          {t.tickets.newTicket}
        </button>
      </div>

      {/* ══════════════ FILTERS ══════════════ */}
      <div
        style={{
          background: "white",
          borderRadius: "1rem",
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          border: "1px solid #E2E0D8",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        {/* Status filter buttons */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStatusFilter(sf.value)}
              style={{
                padding: "0.375rem 0.875rem",
                borderRadius: "1rem",
                border: "1px solid",
                borderColor: statusFilter === sf.value ? "#C9A84C" : "#E8E6F0",
                background: statusFilter === sf.value ? "rgba(201,168,76,0.1)" : "white",
                color: statusFilter === sf.value ? "#C9A84C" : "#6B7280",
                fontSize: "0.8125rem",
                fontWeight: statusFilter === sf.value ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {sf.label}
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div style={{ borderRight: "1px solid #E2E0D8", paddingRight: "0.75rem", marginRight: "0.25rem" }}>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid #E2E0D8",
              background: "white",
              fontSize: "0.8125rem",
              color: "#2D3748",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">كل الأولويات</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: 1,
            minWidth: "200px",
            borderRight: "1px solid #E2E0D8",
            paddingRight: "0.75rem",
            marginRight: "0.25rem",
          }}
        >
          <Search size={16} style={{ color: "#94A3B8", flexShrink: 0 }} />
          <input
            type="text"
            placeholder={`${t.common.search}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: "0.8125rem",
              color: "#2D3748",
              background: "transparent",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <X size={14} style={{ color: "#94A3B8" }} />
            </button>
          )}
        </div>
      </div>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
        {/* ─── Tickets List ─── */}
        <div style={{ flex: selectedTicket ? "0 0 400px" : "1", transition: "all 0.3s", minWidth: 0 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "5rem 0" }}>
              <Loader2 size={36} style={{ color: "#C9A84C", animation: "spin 1s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "5rem 0",
                background: "white",
                borderRadius: "1rem",
                border: "1px solid #E2E0D8",
              }}
            >
              <Ticket size={48} style={{ color: "#C9A84C", opacity: 0.4, margin: "0 auto 1rem" }} />
              <p style={{ fontSize: "1.125rem", fontWeight: 500, color: "#2D3748" }}>{t.tickets.noTickets}</p>
              <p style={{ fontSize: "0.875rem", color: "#6B7280", marginTop: "0.25rem" }}>
                يمكنك إنشاء تذكرة جديدة باستخدام الزر أعلاه
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {filteredTickets.map((tk) => {
                const st = STATUS_CONFIG[tk.status] || STATUS_CONFIG.NEW;
                const pr = PRIORITY_CONFIG[tk.priority] || PRIORITY_CONFIG.MEDIUM;
                const isSelected = selectedTicket?.id === tk.id;
                return (
                  <div
                    key={tk.id}
                    onClick={() => openTicket(tk)}
                    style={{
                      background: isSelected ? "rgba(201,168,76,0.05)" : "white",
                      borderRadius: "1rem",
                      padding: "1rem 1.25rem",
                      border: `1px solid ${isSelected ? "#C9A84C" : "#E8E6F0"}`,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "none";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    {/* Row 1: number, priority dot, subject */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: pr.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontFamily: "monospace" }}>
                        {tk.ticketNumber}
                      </span>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#1C1B2E",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tk.subject}
                      </span>
                      <ChevronRight size={16} style={{ color: "#94A3B8", flexShrink: 0, transform: "scaleX(-1)" }} />
                    </div>

                    {/* Row 2: badges */}
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.125rem 0.5rem",
                          borderRadius: "1rem",
                          background: st.bg,
                          color: st.color,
                          fontWeight: 600,
                        }}
                      >
                        {(t.tickets.status as Record<string, string>)[tk.status] || st.label}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.125rem 0.5rem",
                          borderRadius: "1rem",
                          background: "rgba(27,42,74,0.06)",
                          color: "#1C1B2E",
                        }}
                      >
                        {tk.category}
                      </span>
                    </div>

                    {/* Row 3: meta info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "#94A3B8" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <User size={12} />
                        {tk.client.name}
                      </span>
                      {isStaff && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <Tag size={12} />
                          {tk.agent?.name || "غير محدد"}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <MessageSquare size={12} />
                        {tk._count?.messages || 0}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginRight: "auto" }}>
                        <Clock size={12} />
                        {timeAgo(tk.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Ticket Detail View ─── */}
        {selectedTicket && (
          <div
            style={{
              flex: 1,
              background: "white",
              borderRadius: "1rem",
              border: "1px solid #E2E0D8",
              minHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transition: "all 0.3s",
            }}
          >
            {/* Detail Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid #E2E0D8",
                background: "rgba(27,42,74,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontFamily: "monospace" }}>
                      {selectedTicket.ticketNumber}
                    </span>
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: (PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.MEDIUM).color,
                      }}
                    />
                    <span style={{ fontSize: "0.75rem", color: (PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.MEDIUM).color, fontWeight: 600 }}>
                      {(t.tickets.priorities as Record<string, string>)[selectedTicket.priority] || (PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.MEDIUM).label}
                    </span>
                  </div>
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#1C1B2E", margin: 0 }}>
                    {selectedTicket.subject}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.25rem",
                    borderRadius: "0.375rem",
                  }}
                >
                  <X size={20} style={{ color: "#94A3B8" }} />
                </button>
              </div>

              {/* Status + Category */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "1rem",
                    background: (STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.NEW).bg,
                    color: (STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.NEW).color,
                    fontWeight: 600,
                  }}
                >
                  {(t.tickets.status as Record<string, string>)[selectedTicket.status] || (STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.NEW).label}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "1rem",
                    background: "rgba(27,42,74,0.06)",
                    color: "#1C1B2E",
                  }}
                >
                  {selectedTicket.category}
                </span>
              </div>

              {/* Client info */}
              <div style={{ fontSize: "0.8125rem", color: "#6B7280", display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <User size={14} />
                  {selectedTicket.client.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Clock size={14} />
                  {new Date(selectedTicket.createdAt).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Contract / Installment info */}
              {selectedTicket.contract && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    background: "rgba(201,168,76,0.06)",
                    fontSize: "0.8125rem",
                    color: "#2D3748",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <FileText size={14} style={{ color: "#C9A84C" }} />
                  <span>العقد: {selectedTicket.contract.template.title}</span>
                  {selectedTicket.installment && (
                    <span style={{ color: "#6B7280" }}>
                      &bull; القسط: {selectedTicket.installment.title} ({selectedTicket.installment.amount.toLocaleString()} <SarSymbol size={14} />)
                    </span>
                  )}
                </div>
              )}

              {/* Assign agent (ADMIN/MANAGER only) */}
              {isAdminOrManager && (
                <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.8125rem", color: "#6B7280" }}>المسؤول:</span>
                  <select
                    value={selectedTicket.agentId || ""}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    disabled={assigningAgent}
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #E2E0D8",
                      fontSize: "0.8125rem",
                      color: "#2D3748",
                      background: "white",
                      outline: "none",
                      cursor: "pointer",
                      opacity: assigningAgent ? 0.6 : 1,
                    }}
                  >
                    <option value="">غير محدد</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({ROLE_LABELS[a.role] || a.role})
                      </option>
                    ))}
                  </select>
                  {assigningAgent && <Loader2 size={14} style={{ color: "#C9A84C", animation: "spin 1s linear infinite" }} />}
                </div>
              )}

              {/* Status action buttons */}
              <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {/* CLIENT actions */}
                {role === "CLIENT" && selectedTicket.status === "RESOLVED" && (
                  <>
                    <StatusActionButton label="إغلاق التذكرة" color="#059669" onClick={() => updateTicket({ status: "CLOSED" })} />
                    <StatusActionButton label="إعادة فتح" color="#8B5CF6" onClick={() => updateTicket({ status: "OPEN" })} />
                  </>
                )}
                {role === "CLIENT" && selectedTicket.status === "CLOSED" && (
                  <StatusActionButton label="إعادة فتح" color="#8B5CF6" onClick={() => updateTicket({ status: "OPEN" })} />
                )}

                {/* EXECUTOR actions */}
                {role === "EXECUTOR" && selectedTicket.status === "OPEN" && (
                  <StatusActionButton label="بدء المعالجة" color="#C9A84C" onClick={() => updateTicket({ status: "IN_PROGRESS" })} />
                )}
                {role === "EXECUTOR" && selectedTicket.status === "IN_PROGRESS" && (
                  <>
                    <StatusActionButton label="بانتظار العميل" color="#EA580C" onClick={() => updateTicket({ status: "PENDING_CLIENT" })} />
                    <StatusActionButton label="تم الحل" color="#059669" onClick={() => updateTicket({ status: "RESOLVED" })} />
                  </>
                )}
                {role === "EXECUTOR" && selectedTicket.status === "PENDING_CLIENT" && (
                  <StatusActionButton label="متابعة المعالجة" color="#C9A84C" onClick={() => updateTicket({ status: "IN_PROGRESS" })} />
                )}

                {/* ADMIN/MANAGER actions */}
                {isAdminOrManager && selectedTicket.status !== "CLOSED" && (
                  <>
                    {selectedTicket.status === "NEW" && (
                      <StatusActionButton label="فتح" color="#8B5CF6" onClick={() => updateTicket({ status: "OPEN" })} />
                    )}
                    {["NEW", "OPEN", "IN_PROGRESS", "PENDING_CLIENT"].includes(selectedTicket.status) && (
                      <StatusActionButton label="تم الحل" color="#059669" onClick={() => updateTicket({ status: "RESOLVED" })} />
                    )}
                    <StatusActionButton label={t.common.close} color="#6B7280" onClick={() => updateTicket({ status: "CLOSED" })} />
                  </>
                )}
                {isAdminOrManager && selectedTicket.status === "CLOSED" && (
                  <StatusActionButton label="إعادة فتح" color="#8B5CF6" onClick={() => updateTicket({ status: "OPEN" })} />
                )}
              </div>
            </div>

            {/* Description */}
            {selectedTicket.description && (
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderBottom: "1px solid #E2E0D8",
                  fontSize: "0.875rem",
                  color: "#2D3748",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {selectedTicket.description}
              </div>
            )}

            {/* Messages Thread */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.5rem" }}>
              {loadingMessages ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
                  <Loader2 size={28} style={{ color: "#C9A84C", animation: "spin 1s linear infinite" }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "#94A3B8" }}>
                  <MessageSquare size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.4 }} />
                  <p style={{ fontSize: "0.875rem" }}>لا توجد رسائل بعد</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {messages.map((msg) => {
                    const isMine = msg.senderId === userId;
                    const isInternal = msg.isInternal;

                    // Hide internal messages from non-staff
                    if (isInternal && !isStaff) return null;

                    return (
                      <div
                        key={msg.id}
                        style={{
                          maxWidth: "85%",
                          alignSelf: isMine ? "flex-start" : "flex-end",
                        }}
                      >
                        <div
                          style={{
                            padding: "0.75rem 1rem",
                            borderRadius: "1rem",
                            background: isInternal
                              ? "rgba(234,179,8,0.08)"
                              : isMine
                              ? "rgba(201,168,76,0.08)"
                              : "#F3F4F6",
                            border: isInternal ? "1px dashed #CA8A04" : "none",
                            position: "relative",
                          }}
                        >
                          {/* Sender info */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.375rem" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#1C1B2E" }}>
                              {msg.sender.name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.625rem",
                                padding: "0.0625rem 0.375rem",
                                borderRadius: "0.25rem",
                                background: "rgba(27,42,74,0.08)",
                                color: "#6B7280",
                              }}
                            >
                              {ROLE_LABELS[msg.sender.role] || msg.sender.role}
                            </span>
                            {isInternal && (
                              <span
                                style={{
                                  fontSize: "0.625rem",
                                  padding: "0.0625rem 0.375rem",
                                  borderRadius: "0.25rem",
                                  background: "rgba(202,138,4,0.15)",
                                  color: "#CA8A04",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.125rem",
                                }}
                              >
                                <Lock size={9} />
                                ملاحظة داخلية
                              </span>
                            )}
                            <span style={{ fontSize: "0.6875rem", color: "#94A3B8", marginRight: "auto" }}>
                              {timeAgo(msg.createdAt)}
                            </span>
                          </div>

                          {/* Message body */}
                          <p style={{ fontSize: "0.875rem", color: "#2D3748", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
                            {msg.body}
                          </p>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                              {msg.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    fontSize: "0.75rem",
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "0.375rem",
                                    background: "rgba(27,42,74,0.06)",
                                    color: "#3B82F6",
                                    textDecoration: "none",
                                  }}
                                >
                                  <FileText size={12} />
                                  {att.filename}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Reply Area */}
            {selectedTicket.status !== "CLOSED" && (
              <div
                style={{
                  padding: "1rem 1.5rem",
                  borderTop: "1px solid #E2E0D8",
                  background: "rgba(27,42,74,0.01)",
                }}
              >
                {/* Internal note toggle for staff */}
                {isStaff && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <button
                      onClick={() => setIsInternalNote(!isInternalNote)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.25rem 0.625rem",
                        borderRadius: "0.5rem",
                        border: "1px solid",
                        borderColor: isInternalNote ? "#CA8A04" : "#E8E6F0",
                        background: isInternalNote ? "rgba(202,138,4,0.08)" : "white",
                        color: isInternalNote ? "#CA8A04" : "#6B7280",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {isInternalNote ? <EyeOff size={12} /> : <Eye size={12} />}
                      {isInternalNote ? "ملاحظة داخلية" : "رد عام"}
                    </button>
                    {isInternalNote && (
                      <span style={{ fontSize: "0.6875rem", color: "#CA8A04" }}>
                        هذه الملاحظة لن تظهر للعميل
                      </span>
                    )}
                  </div>
                )}

                {/* Attachment chips */}
                {attachments.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.5rem" }}>
                    {attachments.map((att, i) => (
                      <span
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.375rem",
                          background: "rgba(59,130,246,0.08)",
                          color: "#3B82F6",
                        }}
                      >
                        <FileText size={12} />
                        {att.filename}
                        <button
                          onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginRight: "0.125rem" }}
                        >
                          <X size={11} style={{ color: "#94A3B8" }} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder={isInternalNote ? "اكتب ملاحظة داخلية..." : "اكتب ردك..."}
                    rows={2}
                    style={{
                      flex: 1,
                      resize: "vertical",
                      padding: "0.625rem 0.75rem",
                      borderRadius: "0.75rem",
                      border: `1px solid ${isInternalNote ? "#CA8A04" : "#E8E6F0"}`,
                      background: isInternalNote ? "rgba(202,138,4,0.04)" : "white",
                      fontSize: "0.875rem",
                      color: "#2D3748",
                      outline: "none",
                      fontFamily: "inherit",
                      lineHeight: 1.6,
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <UploadButton
                      endpoint="documentUploader"
                      onClientUploadComplete={(res) => {
                        if (res) {
                          setAttachments((prev) => [
                            ...prev,
                            ...res.map((f) => ({ url: f.url, filename: f.name })),
                          ]);
                        }
                      }}
                      onUploadError={() => {}}
                      appearance={{
                        button: {
                          width: "36px",
                          height: "36px",
                          borderRadius: "0.5rem",
                          background: "white",
                          border: "1px solid #E2E0D8",
                          padding: 0,
                          fontSize: "0",
                        },
                        allowedContent: { display: "none" },
                      }}
                      content={{
                        button: () => <FileText size={16} style={{ color: "#6B7280" }} />,
                      }}
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={sending || (!replyText.trim() && attachments.length === 0)}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "0.5rem",
                        background: sending || (!replyText.trim() && attachments.length === 0) ? "#E8E6F0" : "#C9A84C",
                        border: "none",
                        cursor: sending ? "wait" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s",
                      }}
                    >
                      {sending ? (
                        <Loader2 size={16} style={{ color: "white", animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Send size={16} style={{ color: "white", transform: "scaleX(-1)" }} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════ NEW TICKET MODAL ══════════════ */}
      {showNewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewModal(false);
          }}
        >
          <div
            dir="rtl"
            style={{
              background: "white",
              borderRadius: "1.5rem",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "2rem",
              boxShadow: "0 24px 48px rgba(0,0,0,0.15)",
            }}
          >
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1C1B2E", margin: 0 }}>{t.tickets.newTicket}</h2>
              <button
                onClick={() => setShowNewModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem" }}
              >
                <X size={20} style={{ color: "#94A3B8" }} />
              </button>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                {t.tickets.subject} <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={newTicket.subject}
                onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))}
                placeholder="اكتب موضوع التذكرة..."
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #E2E0D8",
                  fontSize: "0.875rem",
                  color: "#2D3748",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category + Priority row */}
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                  {t.tickets.category}
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket((p) => ({ ...p, category: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #E2E0D8",
                    fontSize: "0.875rem",
                    color: "#2D3748",
                    background: "white",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                  {t.tickets.priority}
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket((p) => ({ ...p, priority: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #E2E0D8",
                    fontSize: "0.875rem",
                    color: "#2D3748",
                    background: "white",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                {t.tickets.description} <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket((p) => ({ ...p, description: e.target.value }))}
                placeholder="اشرح المشكلة أو الاستفسار بالتفصيل..."
                rows={5}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #E2E0D8",
                  fontSize: "0.875rem",
                  color: "#2D3748",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  lineHeight: 1.7,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Contract selector */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                ربط بعقد <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 400 }}>(اختياري)</span>
              </label>
              <select
                value={newTicket.contractId}
                onChange={(e) => setNewTicket((p) => ({ ...p, contractId: e.target.value, installmentId: "" }))}
                style={{
                  width: "100%",
                  padding: "0.625rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #E2E0D8",
                  fontSize: "0.875rem",
                  color: "#2D3748",
                  background: "white",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">بدون عقد</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.template?.title || c.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Installment selector (if contract selected) */}
            {newTicket.contractId && contractInstallments.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#2D3748", marginBottom: "0.375rem" }}>
                  ربط بقسط <span style={{ fontSize: "0.75rem", color: "#94A3B8", fontWeight: 400 }}>(اختياري)</span>
                </label>
                <select
                  value={newTicket.installmentId}
                  onChange={(e) => setNewTicket((p) => ({ ...p, installmentId: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.75rem",
                    border: "1px solid #E2E0D8",
                    fontSize: "0.875rem",
                    color: "#2D3748",
                    background: "white",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">بدون قسط</option>
                  {contractInstallments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {`${inst.title} - ${inst.amount.toLocaleString()} ر.س (${inst.paymentStatus})`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleCreateTicket}
              disabled={creating || !newTicket.subject.trim() || !newTicket.description.trim()}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: creating || !newTicket.subject.trim() || !newTicket.description.trim() ? "#E8E6F0" : "#C9A84C",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: creating ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                transition: "all 0.2s",
              }}
            >
              {creating ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  {t.common.loading}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {t.common.send}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusActionButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.25rem 0.75rem",
        borderRadius: "0.5rem",
        border: `1px solid ${color}`,
        background: "white",
        color,
        fontSize: "0.75rem",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = "white";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "white";
        e.currentTarget.style.color = color;
      }}
    >
      {label}
    </button>
  );
}
