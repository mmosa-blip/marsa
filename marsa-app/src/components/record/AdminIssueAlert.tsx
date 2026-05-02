"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { pusherClient } from "@/lib/pusher-client";

// ═══════════════════════════════════════════════════════════════════════
// AdminIssueAlert — realtime mandatory popup for HIGH/CRITICAL issues
// ═══════════════════════════════════════════════════════════════════════
// Mounts in the dashboard layout for ADMIN/MANAGER. Subscribes to the
// public "admin-issues" channel and pops a non-dismissable banner the
// moment an executor raises a HIGH/CRITICAL issue. The user must click
// "عرض المشكلة" or "تجاهل" — outside-click does nothing.

interface IssueAlert {
  issueRecordItemId: string;
  projectId: string;
  severity: "HIGH" | "CRITICAL";
  title: string;
  receivedAt: number;
}

export default function AdminIssueAlert() {
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<IssueAlert[]>([]);

  useEffect(() => {
    if (!session) return;
    if (!["ADMIN", "MANAGER"].includes(session.user.role)) return;
    if (!pusherClient) return;

    const channel = pusherClient.subscribe("admin-issues");
    const handler = (data: Omit<IssueAlert, "receivedAt">) => {
      setAlerts((prev) => [
        { ...data, receivedAt: Date.now() },
        ...prev.filter((a) => a.issueRecordItemId !== data.issueRecordItemId),
      ]);
    };
    channel.bind("issue-raised", handler);

    return () => {
      channel.unbind("issue-raised", handler);
      pusherClient.unsubscribe("admin-issues");
    };
  }, [session]);

  if (alerts.length === 0) return null;
  const top = alerts[0];

  return (
    <div className="fixed bottom-6 left-6 z-[100] w-[min(420px,90vw)]" dir="rtl">
      <div
        className="rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        style={{
          backgroundColor: "white",
          border: `2px solid ${top.severity === "CRITICAL" ? "#7F1D1D" : "#DC2626"}`,
        }}
      >
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{
            backgroundColor: top.severity === "CRITICAL" ? "#7F1D1D" : "#DC2626",
            color: "white",
          }}
        >
          <AlertTriangle size={18} />
          <span className="text-sm font-bold flex-1">
            بلاغ مشكلة {top.severity === "CRITICAL" ? "حرجة" : "عالية"}
          </span>
          {alerts.length > 1 && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              +{alerts.length - 1}
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="text-sm font-bold mb-3" style={{ color: "#1C1B2E" }}>
            {top.title}
          </p>
          <div className="flex gap-2">
            <Link
              href="/dashboard/issues"
              onClick={() => setAlerts([])}
              className="flex-1 text-center px-3 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-105"
              style={{
                backgroundColor: top.severity === "CRITICAL" ? "#7F1D1D" : "#DC2626",
                color: "white",
              }}
            >
              عرض المشاكل
            </Link>
            <button
              type="button"
              onClick={() =>
                setAlerts((prev) =>
                  prev.filter((a) => a.issueRecordItemId !== top.issueRecordItemId)
                )
              }
              className="px-3 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1"
              style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
            >
              <X size={13} />
              تجاهل
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
