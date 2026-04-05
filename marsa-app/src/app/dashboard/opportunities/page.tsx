"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import {
  Target, TrendingUp, DollarSign, BarChart3,
  Plus, Phone, User, Building2, Trash2, X,
  Loader2,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

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
  department: { id: string; name: string; color: string | null } | null;
  updatedAt: string;
}

interface Stats {
  total: number;
  won: number;
  lost: number;
  conversionRate: number;
  totalValue: number;
  wonValue: number;
  byStage: { stage: string; count: number; totalValue: number }[];
}

// ─── Constants ───────────────────────────────────

const STAGES = [
  { key: "CONTACT", label: "تواصل", color: "#6B7280" },
  { key: "INTEREST", label: "اهتمام", color: "#2563EB" },
  { key: "NEGOTIATION", label: "تفاوض", color: "#C9A84C" },
  { key: "CLOSED_WON", label: "فوز", color: "#059669" },
  { key: "CLOSED_LOST", label: "خسارة", color: "#DC2626" },
];

// ─── Draggable Card ──────────────────────────────

function OpportunityCard({
  opp,
  onDelete,
  isDragging,
}: {
  opp: Opportunity;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: opp.id, data: { stage: opp.stage } });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="rounded-xl p-4 mb-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg"
      dir="rtl"
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
      aria-label={opp.title}
    >
      <div style={{ backgroundColor: "#2A2542", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16 }}>
        {/* Title + Delete */}
        <div className="flex items-start justify-between mb-2">
          <Link href={`/dashboard/opportunities/${opp.id}`} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold truncate" style={{ color: "#FFFFFF" }}>{opp.title}</p>
          </Link>
          {confirmDelete ? (
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <button onClick={() => { onDelete(opp.id); setConfirmDelete(false); }} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: "#DC2626", color: "#fff" }}>
                حذف
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-0.5 rounded text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 rounded-lg transition-colors shrink-0"
              style={{ color: "rgba(255,255,255,0.2)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.backgroundColor = "rgba(220,38,38,0.1)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.2)"; e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>

        {/* Contact */}
        {opp.contactName && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <User size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{opp.contactName}</span>
          </div>
        )}
        {opp.contactPhone && (
          <div className="flex items-center gap-1.5 mb-2">
            <Phone size={11} style={{ color: "rgba(255,255,255,0.3)" }} />
            <span className="text-[11px] tabular-nums" dir="ltr" style={{ color: "rgba(255,255,255,0.5)" }}>{opp.contactPhone}</span>
          </div>
        )}

        {/* Value + Probability */}
        <div className="flex items-center justify-between">
          {opp.value ? (
            <span className="text-xs font-bold" style={{ color: "#C9A84C" }}>
              {opp.value.toLocaleString()} ر.س
            </span>
          ) : (
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}>
            {opp.probability}%
          </span>
        </div>

        {/* Department badge */}
        {opp.department && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ backgroundColor: `${opp.department.color}20`, color: opp.department.color || "#5E5495" }}>
              <Building2 size={9} />
              {opp.department.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Droppable Column ────────────────────────────

function StageColumn({
  stage,
  opportunities,
  stageStats,
  onDelete,
  draggedId,
}: {
  stage: { key: string; label: string; color: string };
  opportunities: Opportunity[];
  stageStats: { count: number; totalValue: number } | undefined;
  onDelete: (id: string) => void;
  draggedId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-[280px] lg:w-auto lg:flex-1 flex flex-col rounded-2xl transition-all"
      style={{
        backgroundColor: isOver ? "rgba(201,168,76,0.06)" : "rgba(255,255,255,0.02)",
        border: isOver ? "2px dashed rgba(201,168,76,0.4)" : "2px solid transparent",
        minHeight: 400,
      }}
    >
      {/* Column header */}
      <div className="px-4 pt-4 pb-2" dir="rtl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="text-sm font-bold" style={{ color: "#FFFFFF" }}>{stage.label}</span>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${stage.color}25`, color: stage.color }}>
            {stageStats?.count || 0}
          </span>
        </div>
        {stageStats && stageStats.totalValue > 0 && (
          <p className="text-[10px] tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
            {stageStats.totalValue.toLocaleString()} ر.س
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 pb-3 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {opportunities.map((opp) => (
          <OpportunityCard key={opp.id} opp={opp} onDelete={onDelete} isDragging={draggedId === opp.id} />
        ))}
        {opportunities.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>لا توجد فرص</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const fetchData = useCallback(() => {
    Promise.all([
      fetch("/api/opportunities").then((r) => r.json()),
      fetch("/api/opportunities/stats").then((r) => r.json()),
    ]).then(([opps, st]) => {
      if (Array.isArray(opps)) setOpportunities(opps);
      if (st.total !== undefined) setStats(st);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = event;
    if (!over) return;

    const oppId = active.id as string;
    const newStage = over.id as string;

    // Find the opportunity
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage === newStage) return;

    // Optimistic update
    setOpportunities((prev) => prev.map((o) => o.id === oppId ? { ...o, stage: newStage } : o));

    try {
      const res = await fetch(`/api/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        // Revert on failure
        setOpportunities((prev) => prev.map((o) => o.id === oppId ? { ...o, stage: opp.stage } : o));
      } else {
        // Refresh stats
        fetch("/api/opportunities/stats").then((r) => r.json()).then((st) => { if (st.total !== undefined) setStats(st); });
      }
    } catch {
      setOpportunities((prev) => prev.map((o) => o.id === oppId ? { ...o, stage: opp.stage } : o));
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic remove
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    try {
      await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
      fetch("/api/opportunities/stats").then((r) => r.json()).then((st) => { if (st.total !== undefined) setStats(st); });
    } catch {
      fetchData(); // Revert by refetching
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={40} className="animate-spin" style={{ color: "#C9A84C" }} />
      </div>
    );
  }

  const draggedOpp = draggedId ? opportunities.find((o) => o.id === draggedId) : null;

  return (
    <div className="p-6" style={{ backgroundColor: "#1C1B2E", minHeight: "100vh" }} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(201,168,76,0.15)" }}>
            <Target size={22} style={{ color: "#C9A84C" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#FFFFFF" }}>إدارة الفرص</h1>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>اسحب البطاقات بين المراحل</p>
          </div>
        </div>
        <MarsaButton href="/dashboard/opportunities/new" variant="gold" size="md" icon={<Plus size={16} />}>
          فرصة جديدة
        </MarsaButton>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "الإجمالي", value: stats.total, icon: Target, color: "#5E5495" },
            { label: "القيمة الكلية", value: `${(stats.totalValue / 1000).toFixed(0)}K`, icon: DollarSign, color: "#C9A84C" },
            { label: "الفوز", value: stats.won, icon: TrendingUp, color: "#059669" },
            { label: "نسبة التحويل", value: `${stats.conversionRate}%`, icon: BarChart3, color: "#2563EB" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Icon size={16} className="mb-2" style={{ color: s.color }} />
                <p className="text-lg font-bold" style={{ color: "#FFFFFF" }}>{s.value}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
          {STAGES.map((stage) => {
            const stageOpps = opportunities.filter((o) => o.stage === stage.key);
            const stageStats = stats?.byStage.find((s) => s.stage === stage.key);
            return (
              <StageColumn
                key={stage.key}
                stage={stage}
                opportunities={stageOpps}
                stageStats={stageStats}
                onDelete={handleDelete}
                draggedId={draggedId}
              />
            );
          })}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedOpp && (
            <div className="rounded-xl p-4 w-[260px]" style={{ backgroundColor: "#2A2542", border: "2px solid #C9A84C", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", opacity: 0.95 }}>
              <p className="text-sm font-bold truncate" style={{ color: "#FFFFFF" }}>{draggedOpp.title}</p>
              {draggedOpp.value && <p className="text-xs mt-1" style={{ color: "#C9A84C" }}>{draggedOpp.value.toLocaleString()} ر.س</p>}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
