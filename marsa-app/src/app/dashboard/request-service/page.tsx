"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Plus, Minus, Send, CheckCircle, Tag, Clock } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import SarSymbol from "@/components/SarSymbol";

interface Category {
  id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number | null;
  defaultDuration: number | null;
  categoryId: string;
}

export default function RequestServicePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    document.title = "طلب خدمة | مرسى";
    Promise.all([
      fetch("/api/service-catalog/categories").then((r) => r.json()),
      fetch("/api/service-catalog/templates").then((r) => r.json()),
    ]).then(([cats, tmps]) => {
      if (Array.isArray(cats)) setCategories(cats);
      if (Array.isArray(tmps)) setTemplates(tmps);
    }).finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filtered = activeCategory === "all"
    ? templates
    : templates.filter((t) => t.categoryId === activeCategory);

  const selectedTemplates = templates.filter((t) => selected.includes(t.id));
  const total = selectedTemplates.reduce((sum, t) => sum + (t.defaultPrice || 0), 0);

  const handleSubmit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceTemplateIds: selected, notes }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
      setTimeout(() => router.push("/dashboard/my-service-requests"), 2000);
    } catch {
      alert("حدث خطأ أثناء إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]" dir="rtl">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(5,150,105,0.1)" }}>
            <CheckCircle size={40} style={{ color: "#059669" }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#1C1B2E" }}>تم إرسال طلبك!</h2>
          <p className="text-sm" style={{ color: "#6B7280" }}>سيتم مراجعته من قبل الإدارة قريباً</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>طلب خدمة جديدة</h1>
        <p className="text-sm mt-1 text-gray-500">اختر الخدمات التي تحتاجها وسنتواصل معك</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: "#C9A84C", borderTopColor: "transparent" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Services */}
          <div className="lg:col-span-2 space-y-4">
            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory("all")}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={activeCategory === "all"
                  ? { backgroundColor: "#5E5495", color: "white" }
                  : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E2E0D8" }}>
                الكل
              </button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={activeCategory === cat.id
                    ? { backgroundColor: "#5E5495", color: "white" }
                    : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E2E0D8" }}>
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Templates grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((t) => {
                const isSelected = selected.includes(t.id);
                return (
                  <div key={t.id} onClick={() => toggle(t.id)}
                    className="bg-white rounded-2xl p-5 cursor-pointer transition-all"
                    style={{
                      border: isSelected ? "2px solid #C9A84C" : "1px solid #E2E0D8",
                      backgroundColor: isSelected ? "rgba(201,168,76,0.04)" : "white",
                    }}>
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>{t.name}</h3>
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mr-2"
                        style={{ borderColor: isSelected ? "#C9A84C" : "#E8E6F0",
                          backgroundColor: isSelected ? "#C9A84C" : "transparent" }}>
                        {isSelected && <CheckCircle size={14} color="white" />}
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>{t.description}</p>
                    )}
                    <div className="flex items-center gap-3">
                      {t.defaultPrice && (
                        <span className="flex items-center gap-1 text-xs font-semibold"
                          style={{ color: "#C9A84C" }}>
                          <Tag size={12} />
                          {t.defaultPrice.toLocaleString("en-US")} <SarSymbol size={12} />
                        </span>
                      )}
                      {t.defaultDuration && (
                        <span className="flex items-center gap-1 text-xs"
                          style={{ color: "#94A3B8" }}>
                          <Clock size={12} />
                          {t.defaultDuration} يوم
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 sticky top-6"
              style={{ border: "1px solid #E2E0D8" }}>
              <h2 className="font-bold mb-4" style={{ color: "#1C1B2E" }}>ملخص الطلب</h2>

              {selected.length === 0 ? (
                <div className="text-center py-6">
                  <ShoppingBag size={32} className="mx-auto mb-2" style={{ color: "#E8E6F0" }} />
                  <p className="text-sm" style={{ color: "#94A3B8" }}>لم تختر أي خدمة بعد</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {selectedTemplates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "#2D3748" }}>{t.name}</span>
                      <div className="flex items-center gap-2">
                        {t.defaultPrice && (
                          <span className="text-xs font-semibold" style={{ color: "#C9A84C" }}>
                            {t.defaultPrice.toLocaleString("en-US")} <SarSymbol size={12} />
                          </span>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#FEF2F2" }}>
                          <Minus size={10} style={{ color: "#DC2626" }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {total > 0 && (
                <div className="flex justify-between py-3 mb-4"
                  style={{ borderTop: "1px solid #E2E0D8" }}>
                  <span className="font-semibold text-sm" style={{ color: "#1C1B2E" }}>الإجمالي</span>
                  <span className="font-bold" style={{ color: "#C9A84C" }}>
                    {total.toLocaleString("en-US")} <SarSymbol size={14} />
                  </span>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6B7280" }}>
                  ملاحظات إضافية
                </label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={3} placeholder="أي تفاصيل إضافية..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: "1px solid #E2E0D8", color: "#2D3748" }} />
              </div>

              <MarsaButton onClick={handleSubmit}
                disabled={selected.length === 0 || submitting}
                variant="primary"
                loading={submitting}
                icon={!submitting ? <Send size={16} /> : undefined}
                className="w-full"
              >
                {submitting ? "جاري الإرسال..." : "إرسال الطلب"}
              </MarsaButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
