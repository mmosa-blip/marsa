"use client";

import { useState, useEffect } from "react";
import {
  Link2, Filter, Plus, Layers, CheckCircle2, Users2, LayoutGrid,
  Trash2, Loader2, X,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface ServiceTemplate {
  id: string;
  name: string;
  category: Category | null;
}

interface Provider {
  id: string;
  name: string;
  role: string;
  specialization: string | null;
}

interface Mapping {
  id: string;
  serviceTemplateId: string;
  providerId: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  serviceTemplate: ServiceTemplate;
  provider: Provider;
}

const roleConfig: Record<string, { label: string; bg: string; text: string }> = {
  EXECUTOR: { label: "منفذ", bg: "#FFF7ED", text: "#EA580C" },
  EXTERNAL_PROVIDER: { label: "مقدم خدمة خارجي", bg: "#FDF2F8", text: "#DB2777" },
};

export default function ServiceProviderMappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [filterTemplate, setFilterTemplate] = useState("");
  const [filterProvider, setFilterProvider] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formProviderId, setFormProviderId] = useState("");
  const [formPriority, setFormPriority] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Dropdown data
  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  // Inline editing priority
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [editPriorityValue, setEditPriorityValue] = useState(0);

  const fetchMappings = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterTemplate) params.set("serviceTemplateId", filterTemplate);
    if (filterProvider) params.set("providerId", filterProvider);

    fetch(`/api/service-provider-mappings?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setMappings(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const fetchDropdowns = () => {
    fetch("/api/service-provider-mappings/service-templates")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTemplates(d);
      })
      .catch(() => {});

    fetch("/api/service-provider-mappings/providers")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setProviders(d);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchMappings();
  }, [filterTemplate, filterProvider]);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  // Stats
  const totalMappings = mappings.length;
  const activeMappings = mappings.filter((m) => m.isActive).length;
  const uniqueProviders = new Set(mappings.map((m) => m.providerId)).size;
  const uniqueTemplates = new Set(mappings.map((m) => m.serviceTemplateId)).size;

  const stats = [
    { label: "إجمالي الربط", value: totalMappings, icon: Link2, color: "#1C1B2E", bg: "rgba(27,42,74,0.06)" },
    { label: "الربط النشط", value: activeMappings, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.06)" },
    { label: "مقدمو الخدمات", value: uniqueProviders, icon: Users2, color: "#DB2777", bg: "rgba(219,39,119,0.06)" },
    { label: "الخدمات المربوطة", value: uniqueTemplates, icon: LayoutGrid, color: "#EA580C", bg: "rgba(234,88,12,0.06)" },
  ];

  const handleToggleActive = async (mapping: Mapping) => {
    if (actionLoading) return;
    setActionLoading(mapping.id);
    try {
      const res = await fetch(`/api/service-provider-mappings/${mapping.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !mapping.isActive }),
      });
      if (res.ok) fetchMappings();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (mapping: Mapping) => {
    if (actionLoading) return;
    if (
      !confirm(
        `هل أنت متأكد من حذف ربط "${mapping.serviceTemplate.name}" مع "${mapping.provider.name}"؟`
      )
    )
      return;
    setActionLoading(mapping.id);
    try {
      const res = await fetch(`/api/service-provider-mappings/${mapping.id}`, {
        method: "DELETE",
      });
      if (res.ok) fetchMappings();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrioritySave = async (mappingId: string) => {
    if (actionLoading) return;
    setActionLoading(mappingId);
    try {
      const res = await fetch(`/api/service-provider-mappings/${mappingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: editPriorityValue }),
      });
      if (res.ok) fetchMappings();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
      setEditingPriority(null);
    }
  };

  const handleCreate = async () => {
    setFormError("");
    if (!formTemplateId || !formProviderId) {
      setFormError("يرجى اختيار الخدمة ومقدم الخدمة");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/service-provider-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceTemplateId: formTemplateId,
          providerId: formProviderId,
          priority: formPriority,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setFormTemplateId("");
        setFormProviderId("");
        setFormPriority(0);
        fetchMappings();
      } else {
        const data = await res.json();
        setFormError(data.error || "حدث خطأ");
      }
    } catch {
      setFormError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8" dir="rtl" style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            ربط مقدمي الخدمات بالخدمات
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            إدارة ربط مقدمي الخدمات بقوالب الخدمات المتاحة
          </p>
        </div>
        <button
          onClick={() => {
            setFormError("");
            setFormTemplateId("");
            setFormProviderId("");
            setFormPriority(0);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all"
          style={{ backgroundColor: "#C9A84C", boxShadow: "0 4px 12px rgba(201,168,76,0.25)" }}
        >
          <Plus size={18} />
          إضافة ربط جديد
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>
                {s.label}
              </span>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: s.bg }}
              >
                <s.icon size={20} style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.value.toLocaleString("en-US")}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
      >
        <Filter size={16} style={{ color: "#94A3B8" }} />
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">كل الخدمات</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.category ? `(${t.category.name})` : ""}
            </option>
          ))}
        </select>
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
          style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
        >
          <option value="">كل المزودين</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({roleConfig[p.role]?.label || p.role})
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin" style={{ color: "#1C1B2E" }} />
        </div>
      ) : mappings.length === 0 ? (
        <div
          className="text-center py-20 bg-white rounded-2xl"
          style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <Link2 size={48} className="mx-auto mb-4" style={{ color: "#C9A84C", opacity: 0.4 }} />
          <p className="text-lg font-medium" style={{ color: "#2D3748" }}>
            لا يوجد ربط حالياً
          </p>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.5 }}>
            قم بإضافة ربط جديد لمقدمي الخدمات بالخدمات
          </p>
        </div>
      ) : (
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid #E2E0D8", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#FAFAFE", borderBottom: "1px solid #E2E0D8" }}>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الخدمة
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    المزود
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الأولوية
                  </th>
                  <th className="text-right px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الحالة
                  </th>
                  <th className="text-center px-5 py-4 text-xs font-semibold" style={{ color: "#2D3748", opacity: 0.7 }}>
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((mapping) => {
                  const role = roleConfig[mapping.provider.role] || {
                    label: mapping.provider.role,
                    bg: "#F3F4F6",
                    text: "#6B7280",
                  };
                  return (
                    <tr
                      key={mapping.id}
                      className="transition-colors hover:bg-[#FAFAF8]"
                      style={{ borderBottom: "1px solid #F0EDE6" }}
                    >
                      {/* Service Template */}
                      <td className="px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
                            {mapping.serviceTemplate.name}
                          </p>
                          {mapping.serviceTemplate.category && (
                            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
                              {mapping.serviceTemplate.category.name}
                            </p>
                          )}
                        </div>
                      </td>
                      {/* Provider */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#1C1B2E" }}>
                              {mapping.provider.name}
                            </p>
                            <span
                              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold inline-block mt-1"
                              style={{ backgroundColor: role.bg, color: role.text }}
                            >
                              {role.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Priority */}
                      <td className="px-5 py-4">
                        {editingPriority === mapping.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={editPriorityValue}
                              onChange={(e) => setEditPriorityValue(Number(e.target.value))}
                              className="w-16 px-2 py-1 rounded-lg text-sm text-center outline-none"
                              style={{ border: "1px solid #C9A84C", color: "#1C1B2E" }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handlePrioritySave(mapping.id);
                                if (e.key === "Escape") setEditingPriority(null);
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handlePrioritySave(mapping.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[#ECFDF5]"
                              disabled={actionLoading === mapping.id}
                            >
                              <CheckCircle2 size={14} style={{ color: "#059669" }} />
                            </button>
                            <button
                              onClick={() => setEditingPriority(null)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-[#FEF2F2]"
                            >
                              <X size={14} style={{ color: "#DC2626" }} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPriority(mapping.id);
                              setEditPriorityValue(mapping.priority);
                            }}
                            className="px-3 py-1 rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-[#F8F6F0]"
                            style={{ color: "#1C1B2E" }}
                            title="انقر للتعديل"
                          >
                            {mapping.priority.toLocaleString("en-US")}
                          </button>
                        )}
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(mapping)}
                          disabled={actionLoading === mapping.id}
                          className="relative inline-flex items-center h-7 w-12 rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50"
                          style={{
                            backgroundColor: mapping.isActive ? "#059669" : "#D1D5DB",
                          }}
                          title={mapping.isActive ? "نشط - انقر للتعطيل" : "معطل - انقر للتفعيل"}
                        >
                          <span
                            className="inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200"
                            style={{
                              transform: mapping.isActive ? "translateX(-6px)" : "translateX(-26px)",
                            }}
                          />
                        </button>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDelete(mapping)}
                            disabled={actionLoading === mapping.id}
                            className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:bg-[#FEF2F2] disabled:opacity-50"
                            title="حذف"
                          >
                            <Trash2 size={16} style={{ color: "#DC2626" }} />
                          </button>
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

      {/* Add Mapping Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(27,42,74,0.5)" }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-4 p-6"
            style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "#1C1B2E" }}>
                إضافة ربط جديد
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[#F8F6F0]"
              >
                <X size={18} style={{ color: "#94A3B8" }} />
              </button>
            </div>

            {formError && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
              >
                {formError}
              </div>
            )}

            <div className="space-y-4">
              {/* Service Template */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>
                  الخدمة
                </label>
                <select
                  value={formTemplateId}
                  onChange={(e) => setFormTemplateId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                >
                  <option value="">اختر الخدمة...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category.name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>
                  مقدم الخدمة
                </label>
                <select
                  value={formProviderId}
                  onChange={(e) => setFormProviderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none bg-white cursor-pointer"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                >
                  <option value="">اختر مقدم الخدمة...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({roleConfig[p.role]?.label || p.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#1C1B2E" }}>
                  الأولوية
                </label>
                <input
                  type="number"
                  min={0}
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: "#C9A84C", boxShadow: "0 4px 12px rgba(201,168,76,0.25)" }}
              >
                {submitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                إضافة الربط
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-[#F0EDE6]"
                style={{ color: "#2D3748", border: "1px solid #E2E0D8" }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
