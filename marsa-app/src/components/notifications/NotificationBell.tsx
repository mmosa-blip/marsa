"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bell,
  Check,
  ChevronLeft,
  ClipboardList,
  RefreshCw,
  FolderKanban,
  Receipt,
  CheckCircle2,
  Clock,
  FileWarning,
  MessageSquare,
  CreditCard,
  Target,
} from "lucide-react";
import Link from "next/link";
import { pusherClient } from "@/lib/pusher-client";

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
  { icon: React.ElementType; color: string; gradient?: string }
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
  // Rich onboarding notification — gold/violet gradient distinguishes it
  // from routine "new task" pings so the recipient notices the welcome.
  PROJECT_ASSIGNED: {
    icon: Target,
    color: "#C9A84C",
    gradient:
      "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(139,92,246,0.10) 100%)",
  },
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

export default function NotificationBell() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail for polling
    }
  }, []);

  // Poll unread count every 60 seconds (fallback, Pusher handles real-time)
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Subscribe to Pusher for real-time notifications
  useEffect(() => {
    if (!pusherClient) return;
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return;

    try {
      const channel = pusherClient.subscribe(`private-user-${userId}`);

      channel.bind("new-notification", (data: Notification) => {
        setUnreadCount((prev) => prev + 1);
        setNotifications((prev) => [data, ...prev].slice(0, 10));

        // Show toast
        setToast(data.message);
        setTimeout(() => setToast(null), 4000);
      });

      return () => {
        channel.unbind_all();
        pusherClient.unsubscribe(`private-user-${userId}`);
      };
    } catch {
      // Pusher not available, fall back to polling
    }
  }, [session]);

  // Fetch recent notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) throw new Error("فشل في تحميل الإشعارات");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setError("فشل في تحميل الإشعارات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Mark single notification as read
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Navigate anyway
      }
    }
    setIsOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch {
      // Silently fail
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toast notification */}
      {toast && (
        <div
          className="fixed top-4 left-4 z-[100] max-w-sm px-4 py-3 rounded-xl shadow-lg animate-slide-in-right"
          style={{
            backgroundColor: "#2A2542",
            color: "#FFFFFF",
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          <div className="flex items-center gap-2">
            <Bell size={16} style={{ color: "#C9A84C" }} />
            <p className="text-sm">{toast}</p>
            <button
              onClick={() => setToast(null)}
              className="mr-2 text-white/60 hover:text-white"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl transition-all duration-200 hover:bg-white/5"
        aria-label="الإشعارات"
      >
        <Bell
          size={20}
          style={{
            color: unreadCount > 0 ? "#C9A84C" : "#9CA3AF",
          }}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-2 w-96 rounded-2xl overflow-hidden z-50"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E2E0D8",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid #E2E0D8" }}
          >
            <div className="flex items-center gap-2">
              <h3
                className="text-sm font-bold"
                style={{ color: "#2D3748" }}
              >
                الإشعارات
              </h3>
              {unreadCount > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: "#C9A84C" }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: "#C9A84C" }}
              >
                <Check size={14} />
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <div
                  className="w-6 h-6 border-2 rounded-full animate-spin"
                  style={{
                    borderColor: "#E8E6F0",
                    borderTopColor: "#C9A84C",
                  }}
                />
              </div>
            )}

            {error && (
              <div className="py-8 text-center">
                <p className="text-sm" style={{ color: "#DC2626" }}>
                  {error}
                </p>
              </div>
            )}

            {!loading && !error && notifications.length === 0 && (
              <div className="py-10 text-center">
                <Bell
                  size={32}
                  className="mx-auto mb-3"
                  style={{ color: "#E8E6F0" }}
                />
                <p className="text-sm" style={{ color: "#6B7280" }}>
                  لا توجد إشعارات
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              notifications.map((notification) => {
                const config = getTypeConfig(notification.type);
                const IconComponent = config.icon;
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="flex items-start gap-3 w-full px-5 py-3.5 text-right transition-colors duration-150 hover:bg-gray-50"
                    style={{
                      background: config.gradient
                        ? config.gradient
                        : !notification.isRead
                          ? "rgba(201,168,76,0.04)"
                          : "transparent",
                      borderRight: !notification.isRead
                        ? "3px solid #C9A84C"
                        : "3px solid transparent",
                      borderBottom: "1px solid #F3F2EE",
                    }}
                  >
                    {/* Icon */}
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                      style={{
                        backgroundColor: `${config.color}15`,
                      }}
                    >
                      <IconComponent size={16} style={{ color: config.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm leading-relaxed whitespace-pre-line"
                        style={{
                          color: "#2D3748",
                          fontWeight: !notification.isRead ? 600 : 400,
                        }}
                      >
                        {notification.message}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "#9CA3AF" }}
                      >
                        {timeAgo(notification.createdAt)}
                      </p>
                    </div>

                    {/* Unread indicator */}
                    {!notification.isRead && (
                      <div
                        className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                        style={{ backgroundColor: "#2563EB" }}
                      />
                    )}
                  </button>
                );
              })}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-3 text-center"
            style={{ borderTop: "1px solid #E2E0D8" }}
          >
            <Link
              href="/dashboard/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1 text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: "#C9A84C" }}
            >
              عرض كل الإشعارات
              <ChevronLeft size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
