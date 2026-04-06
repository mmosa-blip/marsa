"use client";

import { useState, useEffect, use, useCallback } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Pencil,
  DollarSign,
  TrendingUp,
  Calendar,
  Building2,
  Users,
  Phone,
  Mail,
  User,
  Send,
  CheckCircle2,
  Clock,
  StickyNote,
  Briefcase,
  Trophy,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

// ===== Types =====
interface Activity {
  id: string;
  userName: string;
  action: string;
  details: string;
  createdAt: string;
}

interface OpportunityData {
  id: string;
  title: string;
  type: string;
  stage: string;
  description: string | null;
  value: number | null;
  probability: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string; phone: string | null } | null;
  client: { id: string; name: string; phone: string | null } | null;
  department: { id: string; name: string; color: string | null } | null;
  activities: Activity[];
}

// ===== Config =====
const STAGES = ["CONTACT", "INTEREST", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"] as const;

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  CONTACT: { label: "تواصل", color: "#6B7280" },
  INTEREST: { label: "اهتمام", color: "#2563EB" },
  NEGOTIATION: { label: "تفاوض", color: "#C9A84C" },
  CLOSED_WON: { label: "فوز", color: "#059669" },
  CLOSED_LOST: { label: "خسارة", color: "#DC2626" },
};

const TYPE_LABELS: Record<string, string> = {
  INVESTMENT: "استثمار",
  REAL_ESTATE: "عقار",
  PREMIUM_RESIDENCY: "إقامة مميزة",
  SERVICES: "خدمات",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "إنشاء",
  STAGE_CHANGE: "تغيير المرحلة",
  NOTE: "ملاحظة",
  UPDATE: "تحديث",
};

// Pipeline stages for progression (excluding CLOSED_LOST)
const PIPELINE_STAGES = ["CONTACT", "INTEREST", "NEGOTIATION", "CLOSED_WON"];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "---";
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "---";
  return amount.toLocaleString("ar-SA") + " ر.س";
}

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<OpportunityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stageChanging, setStageChanging] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSending, setNoteSending] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/opportunities/${id}`);
      if (!res.ok) {
        setError("لم يتم العثور على الفرصة");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("حدث خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changeStage = async (newStage: string) => {
    if (!data || stageChanging) return;
    setStageChanging(true);
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // silent
    } finally {
      setStageChanging(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || noteSending) return;
    setNoteSending(true);
    try {
      const res = await fetch(`/api/opportunities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityNote: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        await fetchData();
      }
    } catch {
      // silent
    } finally {
      setNoteSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]" dir="rtl">
        <div className="text-center">
          <div
            className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto mb-3"
            style={{ borderColor: "#E2E0D8", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#6B7280" }}>
            جارٍ التحميل...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8" dir="rtl">
        <div
          className="p-6 rounded-2xl text-center"
          style={{ backgroundColor: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}
        >
          <p className="text-red-600 font-medium">{error || "حدث خطأ"}</p>
          <MarsaButton
            href="/dashboard/opportunities"
            variant="secondary"
            size="md"
            className="mt-4"
            icon={<ArrowRight size={16} />}
          >
            العودة للفرص
          </MarsaButton>
        </div>
      </div>
    );
  }

  const stageConf = STAGE_CONFIG[data.stage] || STAGE_CONFIG.CONTACT;
  const currentPipelineIdx = PIPELINE_STAGES.indexOf(data.stage);
  const isClosed = data.stage === "CLOSED_WON" || data.stage === "CLOSED_LOST";

  // Next/prev stage logic (only within pipeline stages, not including CLOSED_LOST)
  const canGoNext =
    !isClosed && currentPipelineIdx >= 0 && currentPipelineIdx < PIPELINE_STAGES.length - 1;
  const canGoPrev = !isClosed && currentPipelineIdx > 0;
  const nextStage = canGoNext ? PIPELINE_STAGES[currentPipelineIdx + 1] : null;
  const prevStage = canGoPrev ? PIPELINE_STAGES[currentPipelineIdx - 1] : null;

  return (
    <div className="p-8 max-w-5xl" dir="rtl">
      {/* ===== Header ===== */}
      <div className="flex items-start gap-4 mb-8">
        <MarsaButton
          href="/dashboard/opportunities"
          variant="ghost"
          size="md"
          iconOnly
          icon={<ArrowRight size={20} />}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1
              className="text-2xl font-bold truncate"
              style={{ color: "#1C1B2E" }}
            >
              {data.title}
            </h1>
            {/* Stage badge */}
            <span
              className="px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: stageConf.color }}
            >
              {stageConf.label}
            </span>
            {/* Type badge */}
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: "rgba(94,84,149,0.08)",
                color: "#5E5495",
              }}
            >
              {TYPE_LABELS[data.type] || data.type}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            تم الإنشاء {formatDate(data.createdAt)}
            {data.closedAt && ` | تم الإغلاق ${formatDate(data.closedAt)}`}
          </p>
        </div>
        <MarsaButton
          href={`/dashboard/opportunities`}
          variant="ghost"
          size="sm"
          icon={<Pencil size={14} />}
        >
          تعديل
        </MarsaButton>
      </div>

      {/* ===== Info Grid ===== */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid #E2E0D8" }}
      >
        <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
          تفاصيل الفرصة
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {/* القيمة */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
            >
              <DollarSign size={18} style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                القيمة المتوقعة
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {formatCurrency(data.value)}
              </p>
            </div>
          </div>

          {/* الاحتمالية */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(37,99,235,0.08)" }}
            >
              <TrendingUp size={18} style={{ color: "#2563EB" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                احتمالية الإغلاق
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {data.probability}%
              </p>
            </div>
          </div>

          {/* تاريخ الإغلاق المتوقع */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(94,84,149,0.08)" }}
            >
              <Calendar size={18} style={{ color: "#5E5495" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                تاريخ الإغلاق المتوقع
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {formatDate(data.expectedCloseDate)}
              </p>
            </div>
          </div>

          {/* القسم */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(201,168,76,0.12)" }}
            >
              <Building2 size={18} style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                القسم
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {data.department?.name || "---"}
              </p>
            </div>
          </div>

          {/* المسؤول */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(5,150,105,0.08)" }}
            >
              <Users size={18} style={{ color: "#059669" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                المسؤول
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {data.assignee?.name || "---"}
              </p>
            </div>
          </div>

          {/* جهة الاتصال */}
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(107,114,128,0.08)" }}
            >
              <User size={18} style={{ color: "#6B7280" }} />
            </div>
            <div>
              <p className="text-xs mb-0.5" style={{ color: "#9CA3AF" }}>
                جهة الاتصال
              </p>
              <p className="text-sm font-bold" style={{ color: "#1C1B2E" }}>
                {data.contactName || "---"}
              </p>
              {data.contactPhone && (
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#6B7280" }}>
                  <Phone size={10} /> {data.contactPhone}
                </p>
              )}
              {data.contactEmail && (
                <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#6B7280" }}>
                  <Mail size={10} /> {data.contactEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* الوصف */}
        {data.description && (
          <div className="mt-6 pt-5" style={{ borderTop: "1px solid #E2E0D8" }}>
            <p className="text-xs mb-1.5" style={{ color: "#9CA3AF" }}>
              الوصف
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#2D3748" }}>
              {data.description}
            </p>
          </div>
        )}

        {/* ملاحظات */}
        {data.notes && (
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid #E2E0D8" }}>
            <p className="text-xs mb-1.5" style={{ color: "#9CA3AF" }}>
              ملاحظات
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#2D3748" }}>
              {data.notes}
            </p>
          </div>
        )}
      </div>

      {/* ===== Stage Progression ===== */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid #E2E0D8" }}
      >
        <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
          مسار الفرصة
        </h2>

        {/* Visual pipeline */}
        <div className="flex items-center gap-0 mb-6">
          {PIPELINE_STAGES.map((stage, idx) => {
            const conf = STAGE_CONFIG[stage];
            const isCurrent = data.stage === stage;
            const isPast =
              currentPipelineIdx >= 0 && idx < currentPipelineIdx;
            const isLost = data.stage === "CLOSED_LOST";

            return (
              <div key={stage} className="flex-1 flex flex-col items-center relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    className="absolute top-4 right-1/2 w-full h-0.5"
                    style={{
                      backgroundColor:
                        isPast || isCurrent ? conf.color : "#E2E0D8",
                      opacity: isPast || isCurrent ? 1 : 0.4,
                      transform: "translateX(50%)",
                      zIndex: 0,
                    }}
                  />
                )}
                {/* Circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center relative z-10 text-xs font-bold"
                  style={{
                    backgroundColor: isCurrent
                      ? conf.color
                      : isPast
                      ? conf.color
                      : isLost
                      ? "#F3F4F6"
                      : "#F3F4F6",
                    color: isCurrent || isPast ? "#FFFFFF" : "#9CA3AF",
                    border: isCurrent ? `3px solid ${conf.color}` : "none",
                    boxShadow: isCurrent
                      ? `0 0 0 4px ${conf.color}22`
                      : "none",
                  }}
                >
                  {isPast ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    idx + 1
                  )}
                </div>
                {/* Label */}
                <p
                  className="text-xs mt-2 font-medium text-center"
                  style={{
                    color: isCurrent
                      ? conf.color
                      : isPast
                      ? conf.color
                      : "#9CA3AF",
                  }}
                >
                  {conf.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* CLOSED_LOST indicator */}
        {data.stage === "CLOSED_LOST" && (
          <div
            className="p-3 rounded-xl text-center mb-4"
            style={{
              backgroundColor: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.15)",
            }}
          >
            <p className="text-sm font-bold" style={{ color: "#DC2626" }}>
              تم إغلاق هذه الفرصة كخسارة
            </p>
          </div>
        )}

        {/* Stage change buttons */}
        {!isClosed && (
          <div className="flex items-center gap-3 flex-wrap">
            {canGoPrev && prevStage && (
              <MarsaButton
                variant="secondary"
                size="sm"
                onClick={() => changeStage(prevStage)}
                loading={stageChanging}
                icon={<ArrowLeft size={14} />}
              >
                رجوع إلى {STAGE_CONFIG[prevStage].label}
              </MarsaButton>
            )}
            {canGoNext && nextStage && (
              <MarsaButton
                variant="gold"
                size="sm"
                onClick={() => changeStage(nextStage)}
                loading={stageChanging}
                icon={<ArrowRight size={14} />}
              >
                نقل إلى {STAGE_CONFIG[nextStage].label}
              </MarsaButton>
            )}
            <MarsaButton
              variant="dangerSoft"
              size="sm"
              onClick={() => changeStage("CLOSED_LOST")}
              loading={stageChanging}
            >
              تسجيل خسارة
            </MarsaButton>
          </div>
        )}
      </div>

      {/* ===== Convert to Project (CLOSED_WON only) ===== */}
      {data.stage === "CLOSED_WON" && (
        <div
          className="bg-white rounded-2xl p-6 mb-6"
          style={{ border: "1px solid #059669", backgroundColor: "rgba(5,150,105,0.03)" }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(5,150,105,0.12)" }}
            >
              <Trophy size={24} style={{ color: "#059669" }} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold" style={{ color: "#059669" }}>
                تم الفوز بهذه الفرصة!
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>
                يمكنك تحويلها إلى مشروع لبدء التنفيذ
              </p>
            </div>
            <MarsaButton
              href={`/dashboard/projects/new?opportunityId=${data.id}`}
              variant="gold"
              size="md"
              icon={<Briefcase size={16} />}
            >
              تحويل إلى مشروع
            </MarsaButton>
          </div>
        </div>
      )}

      {/* ===== Add Note ===== */}
      <div
        className="bg-white rounded-2xl p-6 mb-6"
        style={{ border: "1px solid #E2E0D8" }}
      >
        <h2 className="text-base font-bold mb-4" style={{ color: "#1C1B2E" }}>
          إضافة ملاحظة
        </h2>
        <div className="flex gap-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="اكتب ملاحظة أو تحديث..."
            rows={2}
            className="flex-1 px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all resize-none"
            style={{ borderColor: "#E8E6F0", color: "#2D3748" }}
            onFocus={(e) => (e.target.style.borderColor = "#C9A84C")}
            onBlur={(e) => (e.target.style.borderColor = "#E8E6F0")}
          />
          <MarsaButton
            variant="gold"
            size="md"
            onClick={addNote}
            loading={noteSending}
            disabled={!noteText.trim()}
            icon={<Send size={16} />}
            className="self-end"
          >
            إرسال
          </MarsaButton>
        </div>
      </div>

      {/* ===== Activity Log ===== */}
      <div
        className="bg-white rounded-2xl p-6"
        style={{ border: "1px solid #E2E0D8" }}
      >
        <h2 className="text-base font-bold mb-5" style={{ color: "#1C1B2E" }}>
          سجل النشاط
        </h2>

        {data.activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={32} style={{ color: "#E2E0D8" }} className="mx-auto mb-2" />
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              لا يوجد نشاط بعد
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {data.activities.map((activity, idx) => {
              const isLast = idx === data.activities.length - 1;
              const actionLabel = ACTION_LABELS[activity.action] || activity.action;

              let iconBg = "rgba(107,114,128,0.08)";
              let iconColor = "#6B7280";
              let ActivityIcon = Clock;

              if (activity.action === "CREATE") {
                iconBg = "rgba(5,150,105,0.08)";
                iconColor = "#059669";
                ActivityIcon = CheckCircle2;
              } else if (activity.action === "STAGE_CHANGE") {
                iconBg = "rgba(201,168,76,0.12)";
                iconColor = "#C9A84C";
                ActivityIcon = TrendingUp;
              } else if (activity.action === "NOTE") {
                iconBg = "rgba(37,99,235,0.08)";
                iconColor = "#2563EB";
                ActivityIcon = StickyNote;
              }

              return (
                <div key={activity.id} className="flex gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: iconBg }}
                    >
                      <ActivityIcon size={14} style={{ color: iconColor }} />
                    </div>
                    {!isLast && (
                      <div
                        className="w-0.5 flex-1 my-1"
                        style={{ backgroundColor: "#E2E0D8" }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-4 ${isLast ? "" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "#1C1B2E" }}
                      >
                        {activity.userName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: iconBg,
                          color: iconColor,
                        }}
                      >
                        {actionLabel}
                      </span>
                    </div>
                    <p
                      className="text-sm mt-1 leading-relaxed"
                      style={{ color: "#2D3748" }}
                    >
                      {activity.details}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                      {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
