"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Target, TrendingUp, DollarSign, BarChart3,
  ChevronLeft, ChevronRight, Plus, Filter,
  Phone, User, Building2, Percent,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { useLang } from "@/contexts/LanguageContext";

// ─── Types ───────────────────────────────────────

interface Opportunity {
  id: string;
  title: string;
  type: string;
  stage: string;
  value: number | null;
  probability: number;
  contactName: string | null;
  contactPhone: string | null;
  assignee: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  department: { id: string; name: string; color: string | null } | null;
  updatedAt: string;
}

interface StageStats {
  stage: string;
  count: number;
  totalValue: number;
}

interface Stats {
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
  totalValue: number;
  wonValue: number;
  byStage: StageStats[];
}

interface Department {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

// ─── Constants ───────────────────────────────────

const STAGES = [
  { key: "CONTACT", label: "تواصل", color: "#6B7280" },
  { key: "INTEREST", label: "اهتمام", color: "#2563EB" },
  { key: "NEGOTIATION", label: "تفاوض", color: "#C9A84C" },
  { key: "CLOSED_WON", label: "فوز", color: "#059669" },
  { key: "CLOSED_LOST", label: "خسارة", color: "#DC2626" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "جميع الأنواع" },
  { value: "NEW_BUSINESS", label: "عمل جديد" },
  { value: "UPSELL", label: "بيع إضافي" },
  { value: "RENEWAL", label: "تجديد" },
  { value: "REFERRAL", label: "إحالة" },
];

// ─── Component ───────────────────────────────────

export default function OpportunitiesPage() {
  const { isRTL } = useLang();

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  useEffect(() => {
    document.title = "إدارة الفرص | مرسى";
  }, []);

  // Fetch filter options on mount
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setDepartments(d); })
      .catch(() => {});

    fetch("/api/users/search?roles=ADMIN,MANAGER,EXECUTOR")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setUsers(d); })
      .catch(() => {});
  }, []);

  // Fetch stats
  useEffect(() => {
    fetch("/api/opportunities/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, [opportunities]);

  // Fetch opportunities with filters
  const fetchOpportunities = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (deptFilter) params.set("departmentId", deptFilter);
    if (assigneeFilter) params.set("assigneeId", assigneeFilter);

    fetch(`/api/opportunities?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setOpportunities(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [typeFilter, deptFilter, assigneeFilter]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Move opportunity to a different stage
  const moveStage = async (opp: Opportunity, direction: "prev" | "next") => {
    const stageKeys = STAGES.map((s) => s.key);
    const idx = stageKeys.indexOf(opp.stage as typeof stageKeys[number]);
    if (idx === -1) return;

    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= stageKeys.length) return;

    const newStage = stageKeys[newIdx];
    setMovingId(opp.id);

    try {
      const res = await fetch(`/api/opportunities/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, stage: newStage } : o))
        );
      }
    } catch {
      // silently fail
    } finally {
      setMovingId(null);
    }
  };

  // Group opportunities by stage
  const grouped = STAGES.map((stage) => ({
    ...stage,
    items: opportunities.filter((o) => o.stage === stage.key),
    totalValue: opportunities
      .filter((o) => o.stage === stage.key)
      .reduce((sum, o) => sum + (o.value || 0), 0),
  }));

  const formatValue = (v: number) => v.toLocaleString("en-US");

  // ─── Stats cards ───────────────────────────────

  const statCards = stats
    ? [
        {
          label: "إجمالي الفرص",
          value: stats.total.toString(),
          icon: Target,
          color: "#1C1B2E",
          bg: "rgba(27,42,74,0.06)",
          isCurrency: false,
        },
        {
          label: "القيمة الإجمالية",
          value: formatValue(stats.totalValue),
          icon: DollarSign,
          color: "#2563EB",
          bg: "rgba(37,99,235,0.08)",
          isCurrency: true,
        },
        {
          label: "قيمة المكتسبة",
          value: formatValue(stats.wonValue),
          icon: TrendingUp,
          color: "#059669",
          bg: "rgba(5,150,105,0.08)",
          isCurrency: true,
        },
        {
          label: "معدل التحويل",
          value: `${stats.conversionRate}%`,
          icon: BarChart3,
          color: "#C9A84C",
          bg: "rgba(201,168,76,0.1)",
          isCurrency: false,
        },
      ]
    : [];

  // ─── Render ────────────────────────────────────

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#1C1B2E" }}>
            إدارة الفرص
          </h1>
          <p className="text-sm mt-1" style={{ color: "#2D3748", opacity: 0.6 }}>
            متابعة وإدارة فرص المبيعات عبر مراحل التأهيل
          </p>
        </div>
        <MarsaButton
          href="/dashboard/opportunities/new"
          variant="primary"
          size="lg"
          icon={<Plus size={18} />}
        >
          فرصة جديدة
        </MarsaButton>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-5 transition-all hover:-translate-y-0.5"
              style={{ border: "1px solid #E2E0D8" }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-xs font-medium"
                  style={{ color: "#2D3748", opacity: 0.6 }}
                >
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
                {s.value}
                {s.isCurrency && (
                  <span className="mr-1">
                    <SarSymbol size={12} />
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl bg-white"
        style={{ border: "1px solid #E2E0D8" }}
      >
        <div
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: "#6B7280" }}
        >
          <Filter size={16} />
          <span>تصفية</span>
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid #E2E0D8",
            color: "#1C1B2E",
            backgroundColor: "#FFFFFF",
            minWidth: 140,
          }}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Department filter */}
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid #E2E0D8",
            color: "#1C1B2E",
            backgroundColor: "#FFFFFF",
            minWidth: 140,
          }}
        >
          <option value="">جميع الأقسام</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Assignee filter */}
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{
            border: "1px solid #E2E0D8",
            color: "#1C1B2E",
            backgroundColor: "#FFFFFF",
            minWidth: 140,
          }}
        >
          <option value="">جميع المسؤولين</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {(typeFilter || deptFilter || assigneeFilter) && (
          <MarsaButton
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("");
              setDeptFilter("");
              setAssigneeFilter("");
            }}
          >
            مسح الفلاتر
          </MarsaButton>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
            style={{ borderColor: "#E2E0D8", borderTopColor: "transparent" }}
          />
        </div>
      ) : (
        <div
          className="flex gap-4 pb-4"
          style={{ overflowX: "auto", minHeight: 500 }}
        >
          {grouped.map((col) => {
            const stageIdx = STAGES.findIndex((s) => s.key === col.key);
            return (
              <div
                key={col.key}
                className="flex-shrink-0 flex flex-col"
                style={{ width: 300, minWidth: 280 }}
              >
                {/* Column header */}
                <div
                  className="rounded-t-2xl p-4"
                  style={{
                    backgroundColor: col.color + "0F",
                    borderTop: `3px solid ${col.color}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      <span
                        className="text-sm font-bold"
                        style={{ color: col.color }}
                      >
                        {col.label}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: col.color + "20",
                        color: col.color,
                      }}
                    >
                      {col.items.length}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    {formatValue(col.totalValue)}{" "}
                    <SarSymbol size={10} />
                  </p>
                </div>

                {/* Column body */}
                <div
                  className="flex-1 rounded-b-2xl p-3 flex flex-col gap-3"
                  style={{
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #E2E0D8",
                    borderTop: "none",
                    overflowY: "auto",
                    maxHeight: 600,
                  }}
                >
                  {col.items.length === 0 && (
                    <div
                      className="flex items-center justify-center py-10 text-xs"
                      style={{ color: "#94A3B8" }}
                    >
                      لا توجد فرص
                    </div>
                  )}

                  {col.items.map((opp) => (
                    <div
                      key={opp.id}
                      className="rounded-2xl p-4 transition-all hover:shadow-md"
                      style={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E2E0D8",
                        cursor: "pointer",
                      }}
                    >
                      {/* Card top — clickable area */}
                      <Link
                        href={`/dashboard/opportunities/${opp.id}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <h3
                          className="text-sm font-bold mb-2 line-clamp-2"
                          style={{ color: "#1C1B2E" }}
                        >
                          {opp.title}
                        </h3>

                        {/* Contact name */}
                        {opp.contactName && (
                          <div
                            className="flex items-center gap-1.5 mb-1.5 text-xs"
                            style={{ color: "#6B7280" }}
                          >
                            <Phone size={12} />
                            <span>{opp.contactName}</span>
                          </div>
                        )}

                        {/* Value */}
                        <div
                          className="flex items-center gap-1.5 mb-1.5 text-xs font-bold"
                          style={{ color: "#1C1B2E" }}
                        >
                          <DollarSign size={12} />
                          <span>
                            {opp.value != null
                              ? formatValue(opp.value)
                              : "—"}
                          </span>
                          {opp.value != null && <SarSymbol size={10} />}
                        </div>

                        {/* Probability */}
                        <div className="mb-2">
                          <div
                            className="flex items-center justify-between text-xs mb-1"
                            style={{ color: "#6B7280" }}
                          >
                            <div className="flex items-center gap-1">
                              <Percent size={11} />
                              <span>احتمالية</span>
                            </div>
                            <span className="font-bold">{opp.probability}%</span>
                          </div>
                          <div
                            className="w-full h-1.5 rounded-full"
                            style={{ backgroundColor: "#E2E0D8" }}
                          >
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${opp.probability}%`,
                                backgroundColor: col.color,
                              }}
                            />
                          </div>
                        </div>

                        {/* Department badge */}
                        {opp.department && (
                          <span
                            className="inline-block text-xs px-2 py-0.5 rounded-full mb-2"
                            style={{
                              backgroundColor:
                                (opp.department.color || "#6B7280") + "15",
                              color: opp.department.color || "#6B7280",
                              fontWeight: 600,
                            }}
                          >
                            {opp.department.name}
                          </span>
                        )}

                        {/* Assignee */}
                        {opp.assignee && (
                          <div
                            className="flex items-center gap-1.5 text-xs"
                            style={{ color: "#6B7280" }}
                          >
                            <User size={12} />
                            <span>{opp.assignee.name}</span>
                          </div>
                        )}
                      </Link>

                      {/* Stage move buttons */}
                      <div
                        className="flex items-center justify-between mt-3 pt-3"
                        style={{ borderTop: "1px solid #F1F0EC" }}
                      >
                        <button
                          onClick={() => moveStage(opp, isRTL ? "next" : "prev")}
                          disabled={
                            movingId === opp.id || stageIdx === 0
                          }
                          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                          style={{
                            backgroundColor:
                              stageIdx === 0
                                ? "#F9FAFB"
                                : "#F1F0EC",
                            color:
                              stageIdx === 0
                                ? "#D1D5DB"
                                : "#6B7280",
                            border: "none",
                            cursor:
                              stageIdx === 0
                                ? "not-allowed"
                                : "pointer",
                            opacity: movingId === opp.id ? 0.5 : 1,
                          }}
                          title="المرحلة السابقة"
                        >
                          <ChevronRight size={16} />
                        </button>

                        <span
                          className="text-xs"
                          style={{ color: "#94A3B8" }}
                        >
                          {col.label}
                        </span>

                        <button
                          onClick={() => moveStage(opp, isRTL ? "prev" : "next")}
                          disabled={
                            movingId === opp.id ||
                            stageIdx === STAGES.length - 1
                          }
                          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                          style={{
                            backgroundColor:
                              stageIdx === STAGES.length - 1
                                ? "#F9FAFB"
                                : "#F1F0EC",
                            color:
                              stageIdx === STAGES.length - 1
                                ? "#D1D5DB"
                                : "#6B7280",
                            border: "none",
                            cursor:
                              stageIdx === STAGES.length - 1
                                ? "not-allowed"
                                : "pointer",
                            opacity: movingId === opp.id ? 0.5 : 1,
                          }}
                          title="المرحلة التالية"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
