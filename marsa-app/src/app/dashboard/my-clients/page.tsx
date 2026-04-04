"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users2, Loader2, FolderKanban, Briefcase, Search, Mail, Phone, Building2, FileText, Plus, X } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  companyName: string | null;
  projectCount: number;
  activeProjects: number;
  serviceCount: number;
  totalRevenue: number;
  isActive: boolean;
}

export default function MyClientsPage() {
  const { t } = useLang();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add client modal
  const [showAddClient, setShowAddClient] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", company: "" });
  const [addError, setAddError] = useState("");

  useEffect(() => { document.title = "العملاء | مرسى"; }, []);

  const fetchClients = () => {
    setLoading(true);
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchClients(); }, []);

  const handleAddClient = async () => {
    if (!newClient.name || !newClient.phone) { setAddError(t.clients.nameAndPhoneRequired); return; }
    setAddingClient(true);
    setAddError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quickAdd: true, role: "CLIENT", ...newClient }),
      });
      if (res.ok) {
        setShowAddClient(false);
        setNewClient({ name: "", email: "", phone: "", company: "" });
        fetchClients();
      } else {
        const data = await res.json();
        setAddError(data.error || t.common.error);
      }
    } catch { setAddError(t.common.connectionError); }
    finally { setAddingClient(false); }
  };

  const filtered = search.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          (c.companyName && c.companyName.toLowerCase().includes(search.toLowerCase()))
      )
    : clients;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={36} style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "#1C1B2E" }}>{t.clients.title}</h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>{t.clients.subtitle} ({clients.length})</p>
        </div>
        <button
          onClick={() => { setShowAddClient(true); setAddError(""); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#5E5495" }}
        >
          <Plus size={16} />
          {t.clients.new}
        </button>
      </div>

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 mx-4" style={{ border: "1px solid #E2E0D8" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{t.clients.newClient}</h2>
              <button onClick={() => setShowAddClient(false)} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            {addError && <p className="text-sm text-red-600 mb-3 bg-red-50 p-2 rounded-lg">{addError}</p>}
            <div className="space-y-3">
              <input placeholder={t.clients.clientName} value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
              <input placeholder={t.clients.phone} value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr" />
              <input placeholder={t.clients.email} type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} dir="ltr" />
              <input placeholder={t.clients.company} value={newClient.company} onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={{ border: "1px solid #E2E0D8" }} />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleAddClient} disabled={addingClient}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: "#5E5495" }}>
                {addingClient ? t.clients.adding : t.common.add}
              </button>
              <button onClick={() => setShowAddClient(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium" style={{ border: "1px solid #E2E0D8", color: "#6B7280" }}>
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#94A3B8" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t.common.search}...`}
            className="w-full pr-10 pl-4 py-3 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #E2E0D8", color: "#1C1B2E" }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "white", border: "1px solid #E2E0D8" }}>
          <Users2 size={32} className="mx-auto mb-4" style={{ color: "#C9A84C" }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: "#2D3748" }}>
            {search ? t.clients.noResults : t.clients.noClients}
          </h3>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            {search ? t.clients.noResultsDesc : t.clients.noClientsDesc}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((client) => (
            <div
              key={client.id}
              className="rounded-2xl p-6"
              style={{ backgroundColor: "white", border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
            >
              {/* Client header */}
              <div className="flex items-center gap-3 mb-4">
                {client.avatar ? (
                  <img
                    src={client.avatar}
                    alt={client.name}
                    className="w-11 h-11 rounded-xl object-cover"
                    style={{ border: "2px solid #E2E0D8" }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: "rgba(27,42,74,0.08)", color: "#1C1B2E" }}
                  >
                    {client.name.split(" ").map((w) => w.charAt(0)).slice(0, 2).join("")}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold truncate" style={{ color: "#1C1B2E" }}>{client.name}</h3>
                  {client.companyName && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 size={12} style={{ color: "#94A3B8" }} />
                      <p className="text-xs truncate" style={{ color: "#6B7280" }}>{client.companyName}</p>
                    </div>
                  )}
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0"
                  style={{
                    backgroundColor: client.isActive ? "rgba(5,150,105,0.08)" : "rgba(107,114,128,0.08)",
                    color: client.isActive ? "#059669" : "#6B7280",
                  }}
                >
                  {client.isActive ? t.common.active : t.common.inactive}
                </span>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                  <Mail size={12} style={{ color: "#94A3B8" }} />
                  <span className="truncate" dir="ltr">{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                    <Phone size={12} style={{ color: "#94A3B8" }} />
                    <span dir="ltr">{client.phone}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                  <FolderKanban size={14} className="mx-auto mb-1" style={{ color: "#C9A84C" }} />
                  <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{client.projectCount}</p>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>{t.clients.activeProjects}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                  <Briefcase size={14} className="mx-auto mb-1" style={{ color: "#C9A84C" }} />
                  <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>{client.serviceCount}</p>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>{t.clients.service}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#FAFAFE", border: "1px solid #F0EDE6" }}>
                  <span className="block text-xs mb-1" style={{ color: "#C9A84C" }}>{t.common.currency}</span>
                  <p className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                    {client.totalRevenue > 0 ? (client.totalRevenue >= 1000 ? `${(client.totalRevenue / 1000).toFixed(0)}K` : client.totalRevenue) : "0"}
                  </p>
                  <p className="text-[10px]" style={{ color: "#94A3B8" }}>{t.clients.totalRevenue}</p>
                </div>
              </div>

              {/* Documents link */}
              <Link
                href={`/dashboard/my-clients/${client.id}/documents`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: "rgba(201,168,76,0.08)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}
              >
                <FileText size={15} />
                {t.clients.documents}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
