"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap, FileText, Clock, ListChecks } from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Client { id: string; name: string; email: string; }
interface Category { id: string; name: string; }
interface ServiceTemplate {
  id: string; name: string; description: string | null;
  defaultPrice: number | null; defaultDuration: number | null;
  category: Category;
  _count: { taskTemplates: number; qualifiedEmployees: number };
}
interface Contract { id: string; title: string; }

export default function QuickServicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clientId, setClientId] = useState("");
  const [serviceTemplateId, setServiceTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [contractId, setContractId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(d => { if (Array.isArray(d)) setClients(d); });
    fetch("/api/service-catalog/templates").then(r => r.json()).then(d => { if (Array.isArray(d)) setTemplates(d); });
    fetch("/api/contracts?status=ACTIVE").then(r => r.json()).then(d => { if (Array.isArray(d)) setContracts(d); });
  }, []);

  const selected = templates.find(t => t.id === serviceTemplateId);

  // Group templates by category
  const categories = templates.reduce((acc, t) => {
    const cat = t.category?.name || "عام";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {} as Record<string, ServiceTemplate[]>);

  const handleSubmit = async () => {
    if (!clientId || !serviceTemplateId) {
      setError("يرجى اختيار العميل والخدمة");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects/quick-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, serviceTemplateId, notes: notes || undefined, contractId: contractId || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/dashboard/projects/${data.id}`);
      } else {
        setError(data.error || "حدث خطأ");
      }
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.15)" }}>
          <Zap size={24} style={{ color: "#C9A84C" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>طلب خدمة سريع</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>إنشاء مشروع خدمة واحدة بسرعة</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl p-6 space-y-5" style={{ border: "1px solid #E2E0D8" }}>
        {/* Client */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>العميل <span className="text-red-500">*</span></label>
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
            <option value="">اختر العميل...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Service Template */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>الخدمة <span className="text-red-500">*</span></label>
          <select value={serviceTemplateId} onChange={e => setServiceTemplateId(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
            <option value="">اختر الخدمة...</option>
            {Object.entries(categories).map(([cat, tpls]) => (
              <optgroup key={cat} label={cat}>
                {tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Service Preview */}
        {selected && (
          <div className="rounded-xl p-4" style={{ backgroundColor: "#FAFAFE", border: "1px solid #E8E6F0" }}>
            <p className="text-sm font-semibold mb-3" style={{ color: "#1C1B2E" }}>{selected.name}</p>
            {selected.description && <p className="text-xs mb-3" style={{ color: "#6B7280" }}>{selected.description}</p>}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 text-xs" style={{ color: "#2D3748" }}>
                <FileText size={14} style={{ color: "#C9A84C" }} />
                <span>{selected.defaultPrice?.toLocaleString("en-US") || 0} <SarSymbol size={11} /></span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#2D3748" }}>
                <Clock size={14} style={{ color: "#5E5495" }} />
                <span>{selected.defaultDuration || 0} يوم</span>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: "#2D3748" }}>
                <ListChecks size={14} style={{ color: "#059669" }} />
                <span>{selected._count.taskTemplates} مهمة</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>ملاحظات</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="ملاحظات إضافية (اختياري)..." className="w-full px-4 py-3 rounded-xl border text-sm outline-none resize-none" style={{ borderColor: "#E8E6F0", color: "#2D3748" }} />
        </div>

        {/* Contract */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>العقد المرتبط</label>
          <select value={contractId} onChange={e => setContractId(e.target.value)} className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ borderColor: "#E8E6F0", color: "#2D3748" }}>
            <option value="">بدون عقد</option>
            {contracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl">{error}</p>}

        {/* Submit */}
        <MarsaButton variant="primary" size="lg" className="w-full"
          onClick={handleSubmit}
          disabled={loading || !clientId || !serviceTemplateId}
          loading={loading}
          icon={!loading ? <Zap size={18} /> : undefined}
        >
          {loading ? "جاري الإنشاء..." : "إنشاء طلب خدمة"}
        </MarsaButton>
      </div>
    </div>
  );
}
