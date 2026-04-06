"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ClipboardList,
  RefreshCw,
  FolderKanban,
  Receipt,
  CheckCircle2,
  Clock,
  FileWarning,
  MessageSquare,
  CreditCard,
  Loader2,
  Inbox,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface Notification {
  id: string;
  type: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  NEW_TASK: { icon: ClipboardList, color: "#2563EB" },
  TASK_UPDATE: { icon: RefreshCw, color: "#22C55E" },
  PROJECT_STATUS_CHANGE: { icon: FolderKanban, color: "#C9A84C" },
  INVOICE_DUE: { icon: Receipt, color: "#EA580C" },
  INVOICE_PAID: { icon: CheckCircle2, color: "#22C55E" },
  REMINDER_UPCOMING: { icon: Clock, color: "#8B5CF6" },
  DOCUMENT_EXPIRING: { icon: FileWarning, color: "#DC2626" },
  NEW_MESSAGE: { icon: MessageSquare, color: "#2563EB" },
  PAYMENT_REQUEST_UPDATE: { icon: CreditCard, color: "#C9A84C" },
};

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `قبل ${diffMins} دقيقة`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `قبل ${diffDays} يوم`;
  return new Date(date).toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "short",
    day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type TabFilter = "all" | "unread";

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const LIMIT = 20;

  useEffect(() => { document.title = "الإشعارات | مرسى"; }, []);

  const fetchNotifications = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(LIMIT),
        });
        if (activeTab === "unread") {
          params.set("unread", "true");
        }

        const res = await fetch(`/api/notifications?${params.toString()}`);
        if (!res.ok) throw new Error("فشل في تحميل الإشعارات");

        const data = await res.json();
        const fetched: Notification[] = data.notifications || [];

        if (append) {
          setNotifications((prev) => [...prev, ...fetched]);
        } else {
          setNotifications(fetched);
        }

        setHasMore(fetched.length >= LIMIT);
      } catch {
        setError("فشل في تحميل الإشعارات. يرجى المحاولة مرة أخرى.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab]
  );

  // Reset and fetch when tab changes
  useEffect(() => {
    setPage(1);
    setNotifications([]);
    fetchNotifications(1);
  }, [activeTab, fetchNotifications]);

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  };

  // Mark single as read + navigate
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
      } catch {
        // Navigate anyway
      }
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
      }
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  };

  const getTypeConfig = (type: string) => {
    return (
      NOTIFICATION_TYPE_CONFIG[type] || {
        icon: Bell,
        color: "#6B7280",
      }
    );
  };

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "#1C1B2E" }}
            >
              الإشعارات
            </h1>
            <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
              تابع آخر التحديثات والتنبيهات
            </p>
          </div>
          {(activeTab === "unread" || hasUnread) && (
            <MarsaButton
              onClick={handleMarkAllRead}
              disabled={markingAll}
              variant="ghost"
              size="sm"
              loading={markingAll}
              icon={!markingAll ? <Check size={16} /> : undefined}
              style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              تحديد الكل كمقروء
            </MarsaButton>
          )}
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 mt-6 p-1 rounded-xl w-fit"
          style={{ backgroundColor: "#F0EEF5" }}
        >
          <button
            onClick={() => setActiveTab("all")}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={
              activeTab === "all"
                ? {
                    backgroundColor: "#FFFFFF",
                    color: "#1C1B2E",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }
                : { color: "#6B7280" }
            }
          >
            الكل
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={
              activeTab === "unread"
                ? {
                    backgroundColor: "#FFFFFF",
                    color: "#1C1B2E",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  }
                : { color: "#6B7280" }
            }
          >
            غير مقروء
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E2E0D8",
        }}
      >
        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-8 h-8 border-2 rounded-full animate-spin mb-3"
              style={{
                borderColor: "#E8E6F0",
                borderTopColor: "#C9A84C",
              }}
            />
            <p className="text-sm" style={{ color: "#6B7280" }}>
              جاري تحميل الإشعارات...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm mb-3" style={{ color: "#DC2626" }}>
              {error}
            </p>
            <MarsaButton
              onClick={() => fetchNotifications(1)}
              variant="link"
            >
              إعادة المحاولة
            </MarsaButton>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "#F0EEF5" }}
            >
              <Inbox size={28} style={{ color: "#C9A84C" }} />
            </div>
            <p
              className="text-base font-medium mb-1"
              style={{ color: "#2D3748" }}
            >
              {activeTab === "unread"
                ? "لا توجد إشعارات غير مقروءة"
                : "لا توجد إشعارات"}
            </p>
            <p className="text-sm" style={{ color: "#9CA3AF" }}>
              {activeTab === "unread"
                ? "لقد قرأت جميع الإشعارات"
                : "ستظهر الإشعارات الجديدة هنا"}
            </p>
          </div>
        )}

        {/* Notifications */}
        {!loading &&
          !error &&
          notifications.map((notification, index) => {
            const config = getTypeConfig(notification.type);
            const IconComponent = config.icon;
            const isLast = index === notifications.length - 1;

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="flex items-start gap-4 w-full px-6 py-4 text-right transition-colors duration-150 hover:bg-gray-50"
                style={{
                  backgroundColor: !notification.isRead
                    ? "rgba(201,168,76,0.04)"
                    : "transparent",
                  borderRight: !notification.isRead
                    ? "3px solid #C9A84C"
                    : "3px solid transparent",
                  borderBottom: !isLast ? "1px solid #F3F2EE" : "none",
                }}
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5"
                  style={{
                    backgroundColor: `${config.color}15`,
                  }}
                >
                  <IconComponent
                    size={18}
                    style={{ color: config.color }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm leading-relaxed"
                    style={{
                      color: "#2D3748",
                      fontWeight: !notification.isRead ? 600 : 400,
                    }}
                  >
                    {notification.message}
                  </p>
                  <p
                    className="text-xs mt-1.5"
                    style={{ color: "#9CA3AF" }}
                  >
                    {timeAgo(notification.createdAt)}
                  </p>
                </div>

                {/* Unread dot */}
                {!notification.isRead && (
                  <div
                    className="flex-shrink-0 w-2.5 h-2.5 rounded-full mt-2"
                    style={{ backgroundColor: "#2563EB" }}
                  />
                )}
              </button>
            );
          })}

        {/* Load More */}
        {!loading && !error && hasMore && notifications.length > 0 && (
          <div
            className="px-6 py-4 text-center"
            style={{ borderTop: "1px solid #F3F2EE" }}
          >
            <MarsaButton
              onClick={handleLoadMore}
              disabled={loadingMore}
              variant="ghost"
              loading={loadingMore}
              style={{ backgroundColor: "rgba(201,168,76,0.1)", color: "#C9A84C" }}
            >
              {loadingMore ? "جاري التحميل..." : "تحميل المزيد"}
            </MarsaButton>
          </div>
        )}
      </div>
    </div>
  );
}
