"use client";

import { useState, useEffect, useCallback, useMemo, useRef, use } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import {
  ArrowRight,
  Search,
  Plus,
  FileText,
  Lock,
  KeyRound,
  StickyNote,
  AlertTriangle,
  Link as LinkIcon,
  Users,
  Package,
  Layers,
  Loader2,
  CheckCircle2,
  Clock as ClockIcon,
  XCircle,
  Archive,
  GripVertical,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { MarsaButton } from "@/components/ui/MarsaButton";
import NewRecordItemDialog from "@/components/record/NewRecordItemDialog";

type Kind =
  | "DOCUMENT"
  | "NOTE"
  | "SENSITIVE_DATA"
  | "PLATFORM_ACCOUNT"
  | "PLATFORM_LINK"
  | "ISSUE";

type RecordStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "MISSING"
  | "EXPIRED"
  | "ARCHIVED";

interface Partner {
  id: string;
  partnerNumber: number;
  name: string | null;
}

interface ServiceLite {
  id: string;
  name: string;
}

interface RecordItem {
  id: string;
  kind: Kind;
  status: RecordStatus;
  title: string;
  description: string | null;
  fileUrl: string | null;
  expiryDate: string | null;
  partnerId: string | null;
  serviceId: string | null;
  visibility: string;
  isSharedWithClient: boolean;
  isObsolete: boolean;
  partner: { id: string; partnerNumber: number; name: string | null } | null;
  service: { id: string; name: string } | null;
  documentType: { id: string; name: string } | null;
  uploadedBy: { id: string; name: string } | null;
  platformLink: { platformName: string; url: string } | null;
  platformAccount: { platformName: string; username: string } | null;
  issue: {
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    status: string;
  } | null;
  _count?: { comments: number; taskLinks: number };
  createdAt: string;
}

type IconCmp = React.ComponentType<{ size?: number; style?: React.CSSProperties }>;

const KIND_META: Record<
  Kind,
  { label: string; icon: IconCmp; color: string }
> = {
  DOCUMENT: { label: "مستند", icon: FileText, color: "#5E5495" },
  NOTE: { label: "ملاحظة", icon: StickyNote, color: "#C9A84C" },
  PLATFORM_LINK: { label: "رابط", icon: LinkIcon, color: "#1B2A4A" },
  PLATFORM_ACCOUNT: { label: "حساب", icon: KeyRound, color: "#0EA5E9" },
  SENSITIVE_DATA: { label: "حساس", icon: Lock, color: "#7C3AED" },
  ISSUE: { label: "مشكلة", icon: AlertTriangle, color: "#DC2626" },
};

const STATUS_META: Record<
  RecordStatus,
  { label: string; color: string; icon: IconCmp }
> = {
  MISSING: { label: "مفقود", color: "#DC2626", icon: AlertTriangle },
  DRAFT: { label: "مسودة", color: "#94A3B8", icon: ClockIcon },
  PENDING_REVIEW: { label: "للمراجعة", color: "#EA580C", icon: ClockIcon },
  APPROVED: { label: "معتمد", color: "#16A34A", icon: CheckCircle2 },
  REJECTED: { label: "مرفوض", color: "#DC2626", icon: XCircle },
  EXPIRED: { label: "منتهي", color: "#A16207", icon: AlertTriangle },
  ARCHIVED: { label: "مؤرشف", color: "#6B7280", icon: Archive },
};

const STATUS_COLUMNS: RecordStatus[] = [
  "MISSING",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
];

type Tab = "stages" | "services" | "partners";

export default function ProjectRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("stages");
  const [items, setItems] = useState<RecordItem[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<{
    serviceId?: string | null;
    partnerId?: string | null;
    status?: RecordStatus | null;
  } | null>(null);

  const dragItemId = useRef<string | null>(null);
  const dragOverBucket = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [recordRes, partnersRes, projectRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/record?take=200`),
        fetch(`/api/projects/${projectId}/partners`),
        fetch(`/api/projects/${projectId}`),
      ]);
      if (recordRes.ok) {
        const data = await recordRes.json();
        setItems(data.items || []);
      }
      if (partnersRes.ok) {
        setPartners(await partnersRes.json());
      }
      if (projectRes.ok) {
        const proj = await projectRes.json();
        setProjectName(proj.name || "");
        setServices(
          (proj.services || []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (authStatus === "authenticated") refresh();
  }, [authStatus, refresh]);

  if (authStatus === "loading") return null;
  if (!session) redirect(ROUTES.LOGIN);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (kindFilter && it.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        (it.description?.toLowerCase().includes(q) ?? false) ||
        (it.partner?.name?.toLowerCase().includes(q) ?? false) ||
        (it.service?.name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, kindFilter]);

  // Optimistic patch helper. Server PATCHes status / serviceId / partnerId.
  async function patchItem(itemId: string, body: Record<string, unknown>) {
    const prev = items;
    setItems((curr) =>
      curr.map((it) =>
        it.id === itemId
          ? {
              ...it,
              ...(body.status ? { status: body.status as RecordStatus } : {}),
              ...("serviceId" in body
                ? {
                    serviceId: (body.serviceId as string | null) ?? null,
                    service:
                      body.serviceId
                        ? services.find((s) => s.id === body.serviceId)
                          ? {
                              id: body.serviceId as string,
                              name:
                                services.find((s) => s.id === body.serviceId)!
                                  .name,
                            }
                          : it.service
                        : null,
                  }
                : {}),
              ...("partnerId" in body
                ? {
                    partnerId: (body.partnerId as string | null) ?? null,
                    partner: body.partnerId
                      ? partners.find((p) => p.id === body.partnerId) || it.partner
                      : null,
                  }
                : {}),
            }
          : it
      )
    );
    try {
      const res = await fetch(`/api/record-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setItems(prev);
        alert((data as { error?: string }).error || "تعذّر التحديث");
      }
    } catch {
      setItems(prev);
      alert("حدث خطأ في الاتصال");
    }
  }

  function onDragStart(itemId: string) {
    if (!isAdmin) return;
    dragItemId.current = itemId;
    setDraggingId(itemId);
  }
  function onDragEnd() {
    dragItemId.current = null;
    dragOverBucket.current = null;
    setDraggingId(null);
  }
  function onDragOver(e: React.DragEvent, bucket: string) {
    if (!isAdmin) return;
    e.preventDefault();
    dragOverBucket.current = bucket;
  }
  function onDropStatus(status: RecordStatus) {
    if (!isAdmin || !dragItemId.current) return;
    const itemId = dragItemId.current;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === status) return;
    if (status === "APPROVED") patchItem(itemId, { action: "approve" });
    else if (status === "REJECTED") {
      const reason = prompt("سبب الرفض:");
      if (!reason) return;
      patchItem(itemId, { action: "reject", rejectionReason: reason });
    } else patchItem(itemId, { status });
  }
  function onDropService(serviceId: string | null) {
    if (!isAdmin || !dragItemId.current) return;
    const itemId = dragItemId.current;
    const item = items.find((i) => i.id === itemId);
    if (!item || (item.serviceId || null) === serviceId) return;
    patchItem(itemId, { serviceId });
  }
  function onDropPartner(partnerId: string | null) {
    if (!isAdmin || !dragItemId.current) return;
    const itemId = dragItemId.current;
    const item = items.find((i) => i.id === itemId);
    if (!item || (item.partnerId || null) === partnerId) return;
    patchItem(itemId, { partnerId });
  }

  return (
    <div className="p-6 pb-24" dir="rtl">
      {/* Breadcrumb */}
      <MarsaButton
        variant="ghost"
        size="sm"
        icon={<ArrowRight size={16} />}
        onClick={() => router.push(`/dashboard/projects/${projectId}`)}
        className="mb-4"
      >
        العودة للمشروع
      </MarsaButton>

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "#1C1B2E" }}>
              السجل الموحد
            </h1>
            {projectName && (
              <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
                {projectName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ backgroundColor: "#F8F8F4", border: "1px solid #E5E7EB" }}
            >
              <Search size={14} style={{ color: "#9CA3AF" }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث في السجل…"
                className="bg-transparent outline-none text-sm w-48"
              />
            </div>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as Kind | "")}
              className="px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white"
            >
              <option value="">كل الأنواع</option>
              {(Object.keys(KIND_META) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4">
          <TabButton
            active={tab === "stages"}
            onClick={() => setTab("stages")}
            icon={<Layers size={15} />}
            label="المراحل"
          />
          <TabButton
            active={tab === "services"}
            onClick={() => setTab("services")}
            icon={<Package size={15} />}
            label="الخدمات"
          />
          <TabButton
            active={tab === "partners"}
            onClick={() => setTab("partners")}
            icon={<Users size={15} />}
            label="الشركاء"
          />
          <span className="text-xs ms-auto" style={{ color: "#9CA3AF" }}>
            {filtered.length} / {items.length} عنصر
          </span>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <Loader2
            size={28}
            className="animate-spin mx-auto"
            style={{ color: "#C9A84C" }}
          />
          <p className="text-sm mt-3" style={{ color: "#6B7280" }}>
            جاري التحميل…
          </p>
        </div>
      ) : tab === "stages" ? (
        <StagesView
          items={filtered}
          isAdmin={isAdmin}
          draggingId={draggingId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDropStatus}
          onAddIn={(status) => {
            setCreatePrefill({ status });
            setShowCreate(true);
          }}
        />
      ) : tab === "services" ? (
        <ServicesView
          items={filtered}
          services={services}
          isAdmin={isAdmin}
          draggingId={draggingId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDropService}
          onAddIn={(serviceId) => {
            setCreatePrefill({ serviceId });
            setShowCreate(true);
          }}
        />
      ) : (
        <PartnersView
          items={filtered}
          partners={partners}
          isAdmin={isAdmin}
          draggingId={draggingId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOver={onDragOver}
          onDrop={onDropPartner}
          onAddIn={(partnerId) => {
            setCreatePrefill({ partnerId });
            setShowCreate(true);
          }}
        />
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          setCreatePrefill(null);
          setShowCreate(true);
        }}
        className="fixed bottom-8 left-8 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: "#5E5495", color: "white", zIndex: 40 }}
        title="عنصر جديد"
        aria-label="إضافة عنصر جديد"
      >
        <Plus size={24} />
      </button>

      {showCreate && (
        <NewRecordItemDialog
          projectId={projectId}
          partners={partners}
          services={services}
          initial={createPrefill || undefined}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setCreatePrefill(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={
        active
          ? { backgroundColor: "#5E5495", color: "white" }
          : { backgroundColor: "white", color: "#6B7280", border: "1px solid #E5E7EB" }
      }
    >
      {icon}
      {label}
    </button>
  );
}

interface ViewSharedProps {
  items: RecordItem[];
  isAdmin: boolean;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, bucket: string) => void;
}

function StagesView({
  items,
  isAdmin,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onAddIn,
}: ViewSharedProps & {
  onDrop: (status: RecordStatus) => void;
  onAddIn: (status: RecordStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {STATUS_COLUMNS.map((status) => {
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const colItems = items.filter((it) => it.status === status);
        return (
          <div
            key={status}
            onDragOver={(e) => onDragOver(e, status)}
            onDrop={() => onDrop(status)}
            className="rounded-2xl p-3 min-h-[420px]"
            style={{
              backgroundColor: `${meta.color}08`,
              border: `1px dashed ${meta.color}30`,
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-1.5">
                <Icon size={14} />
                <span
                  className="text-xs font-bold"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </span>
                <span
                  className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
                  style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                >
                  {colItems.length}
                </span>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onAddIn(status)}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white"
                  style={{ color: meta.color }}
                  title="إضافة هنا"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
            <div className="space-y-2">
              {colItems.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  isAdmin={isAdmin}
                  isDragging={draggingId === it.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              ))}
              {colItems.length === 0 && (
                <p className="text-[11px] text-center pt-6" style={{ color: "#9CA3AF" }}>
                  لا توجد عناصر
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServicesView({
  items,
  services,
  isAdmin,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onAddIn,
}: ViewSharedProps & {
  services: ServiceLite[];
  onDrop: (serviceId: string | null) => void;
  onAddIn: (serviceId: string | null) => void;
}) {
  const buckets: { key: string; id: string | null; label: string }[] = [
    ...services.map((s) => ({ key: s.id, id: s.id, label: s.name })),
    { key: "_none", id: null, label: "بدون خدمة" },
  ];
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const bucketItems = items.filter((it) => (it.serviceId || null) === b.id);
        return (
          <div
            key={b.key}
            onDragOver={(e) => onDragOver(e, b.key)}
            onDrop={() => onDrop(b.id)}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 border-b border-gray-50"
              style={{
                backgroundColor: b.id ? "rgba(94,84,149,0.05)" : "rgba(148,163,184,0.05)",
              }}
            >
              <div className="flex items-center gap-2">
                <Package
                  size={16}
                  style={{ color: b.id ? "#5E5495" : "#94A3B8" }}
                />
                <span className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                  {b.label}
                </span>
                <span
                  className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: "rgba(94,84,149,0.1)",
                    color: "#5E5495",
                  }}
                >
                  {bucketItems.length}
                </span>
              </div>
              {isAdmin && (
                <MarsaButton
                  size="xs"
                  variant="ghost"
                  icon={<Plus size={14} />}
                  onClick={() => onAddIn(b.id)}
                >
                  إضافة
                </MarsaButton>
              )}
            </div>
            <div className="p-4">
              {bucketItems.length === 0 ? (
                <p
                  className="text-xs text-center py-4"
                  style={{ color: "#9CA3AF" }}
                >
                  اسحب أي عنصر هنا أو أضف عنصراً جديداً.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bucketItems.map((it) => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      isAdmin={isAdmin}
                      isDragging={draggingId === it.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PartnersView({
  items,
  partners,
  isAdmin,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onAddIn,
}: ViewSharedProps & {
  partners: Partner[];
  onDrop: (partnerId: string | null) => void;
  onAddIn: (partnerId: string | null) => void;
}) {
  const buckets: { key: string; id: string | null; label: string }[] = [
    ...partners.map((p) => ({
      key: p.id,
      id: p.id,
      label: p.name || `الشريك ${p.partnerNumber}`,
    })),
    { key: "_none", id: null, label: "بدون شريك" },
  ];
  return (
    <div className="space-y-3">
      {buckets.map((b) => {
        const bucketItems = items.filter((it) => (it.partnerId || null) === b.id);
        return (
          <div
            key={b.key}
            onDragOver={(e) => onDragOver(e, b.key)}
            onDrop={() => onDrop(b.id)}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          >
            <div
              className="flex items-center justify-between p-4 border-b border-gray-50"
              style={{
                backgroundColor: b.id ? "rgba(201,168,76,0.05)" : "rgba(148,163,184,0.05)",
              }}
            >
              <div className="flex items-center gap-2">
                <Users
                  size={16}
                  style={{ color: b.id ? "#C9A84C" : "#94A3B8" }}
                />
                <span className="font-bold text-sm" style={{ color: "#1C1B2E" }}>
                  {b.label}
                </span>
                <span
                  className="text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: "rgba(201,168,76,0.15)",
                    color: "#C9A84C",
                  }}
                >
                  {bucketItems.length}
                </span>
              </div>
              {isAdmin && (
                <MarsaButton
                  size="xs"
                  variant="ghost"
                  icon={<Plus size={14} />}
                  onClick={() => onAddIn(b.id)}
                >
                  إضافة
                </MarsaButton>
              )}
            </div>
            <div className="p-4">
              {bucketItems.length === 0 ? (
                <p
                  className="text-xs text-center py-4"
                  style={{ color: "#9CA3AF" }}
                >
                  لا توجد عناصر مرتبطة بهذا الشريك.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {bucketItems.map((it) => (
                    <ItemCard
                      key={it.id}
                      item={it}
                      isAdmin={isAdmin}
                      isDragging={draggingId === it.id}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ItemCard({
  item,
  isAdmin,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  item: RecordItem;
  isAdmin: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const kind = KIND_META[item.kind];
  const KindIcon = kind.icon;
  const status = STATUS_META[item.status];
  return (
    <div
      draggable={isAdmin}
      onDragStart={() => onDragStart(item.id)}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-xl p-3 border border-gray-100 shadow-sm transition-all ${
        isAdmin ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "opacity-50" : "hover:-translate-y-0.5"}`}
      style={{ borderRightWidth: 3, borderRightColor: kind.color }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        {isAdmin && (
          <GripVertical size={12} className="text-gray-300 mt-0.5 shrink-0" />
        )}
        <KindIcon size={14} style={{ color: kind.color }} />
        <p
          className="text-xs font-bold flex-1 line-clamp-2"
          style={{ color: "#1C1B2E" }}
        >
          {item.title}
        </p>
      </div>
      {item.description && (
        <p
          className="text-[11px] mb-1.5 line-clamp-2"
          style={{ color: "#6B7280" }}
        >
          {item.description}
        </p>
      )}
      {item.kind === "PLATFORM_LINK" && item.platformLink && (
        <a
          href={item.platformLink.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-[11px] mb-1.5"
          style={{ color: "#0EA5E9" }}
        >
          <ExternalLink size={10} />
          {item.platformLink.platformName}
        </a>
      )}
      {item.kind === "PLATFORM_ACCOUNT" && item.platformAccount && (
        <p className="text-[11px] mb-1.5" style={{ color: "#6B7280" }}>
          {item.platformAccount.platformName} —{" "}
          <span style={{ direction: "ltr" }}>{item.platformAccount.username}</span>
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${status.color}15`,
            color: status.color,
          }}
        >
          {status.label}
        </span>
        {item.partner && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(201,168,76,0.12)",
              color: "#C9A84C",
            }}
          >
            {item.partner.name || `ش${item.partner.partnerNumber}`}
          </span>
        )}
        {item.service && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(94,84,149,0.1)",
              color: "#5E5495",
            }}
          >
            {item.service.name}
          </span>
        )}
        {item._count?.comments != null && item._count.comments > 0 && (
          <span
            className="text-[10px] flex items-center gap-0.5"
            style={{ color: "#6B7280" }}
          >
            <MessageSquare size={10} />
            {item._count.comments}
          </span>
        )}
        {item.isSharedWithClient && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(34,197,94,0.1)",
              color: "#16A34A",
            }}
          >
            عميل
          </span>
        )}
        {item.isObsolete && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(220,38,38,0.1)",
              color: "#DC2626",
            }}
          >
            مهمل
          </span>
        )}
      </div>
    </div>
  );
}
