"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Target } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { pusherClient } from "@/lib/pusher-client";

/**
 * Mandatory-acknowledgement modal.
 *
 * Walks the queue of `requiresAck=true && acknowledgedAt=null`
 * notifications for the current user and forces them to click "استلمت"
 * before the rest of the dashboard becomes interactive. Used for
 * onboarding-style notifications (currently PROJECT_ASSIGNED) where the
 * recipient needs to actively confirm they read the briefing.
 *
 * Behaviour:
 *   - On mount: fetch the queue, render the first item as a blocking
 *     overlay, queue the rest. After ack, advance to the next or hide.
 *   - Subscribes to Pusher event `requires-ack` so notifications created
 *     while the user is already on the dashboard pop up immediately.
 *   - Cannot be dismissed by Esc or clicking outside — the only exits
 *     are the two buttons (ack-only OR ack-and-navigate).
 *   - Roles: ADMIN/MANAGER never see the modal (they originate the
 *     notifications). Everyone else does.
 *   - Fail-soft: any fetch error silently hides the modal so a flaky
 *     network can't lock the dashboard.
 */
interface PendingNotification {
  id: string;
  type: string;
  message: string;
  link: string;
  createdAt: string;
}

const ROLES_THAT_SEE_MODAL = new Set([
  "EXECUTOR",
  "EXTERNAL_PROVIDER",
  "CLIENT",
  "FINANCE_MANAGER",
  "TREASURY_MANAGER",
]);

export default function PendingAcknowledgeModal() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [queue, setQueue] = useState<PendingNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const ackButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const userRole =
    (session?.user as { role?: string } | undefined)?.role ?? "";
  const isEligible = ROLES_THAT_SEE_MODAL.has(userRole);

  const fetchQueue = useCallback(async () => {
    if (!isEligible) return;
    try {
      const res = await fetch(
        "/api/notifications?requiresAck=true&acknowledged=false&limit=50",
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      const list: PendingNotification[] = data.notifications || [];
      setQueue(list);
    } catch {
      // Silent fail — never block the dashboard on a flaky network.
    }
  }, [isEligible]);

  // Initial fetch once the session lands.
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchQueue();
  }, [status, fetchQueue]);

  // Live updates: a notification with `requiresAck` arriving while the
  // user is on the dashboard pops the modal up immediately instead of
  // waiting for the next page load.
  useEffect(() => {
    if (!isEligible || !userId || !pusherClient) return;
    try {
      const channel = pusherClient.subscribe(`private-user-${userId}`);
      const handler = (data: PendingNotification & { id?: string }) => {
        // Pusher payload may not include `id` (createNotifications path);
        // re-fetch the queue to make sure we have the row id needed for
        // the acknowledge call.
        if (data?.id) {
          setQueue((prev) =>
            prev.find((n) => n.id === data.id) ? prev : [...prev, data]
          );
        } else {
          fetchQueue();
        }
      };
      channel.bind("requires-ack", handler);
      return () => {
        channel.unbind("requires-ack", handler);
      };
    } catch {
      // Pusher not configured — initial fetch is the fallback.
    }
  }, [isEligible, userId, fetchQueue]);

  // Focus trap: keep keyboard focus inside the modal so the only path
  // forward is one of the two action buttons.
  useEffect(() => {
    if (queue.length === 0) return;
    ackButtonRef.current?.focus();

    function trap(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Mandatory modal — Esc is intentionally swallowed.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const root = overlayRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap, true);
    return () => document.removeEventListener("keydown", trap, true);
  }, [queue.length]);

  const current = queue[0];

  const acknowledge = useCallback(
    async (alsoNavigate: boolean) => {
      if (!current || busy) return;
      setBusy(true);
      try {
        await fetch(`/api/notifications/${current.id}/acknowledge`, {
          method: "POST",
        });
        const navigateTo = alsoNavigate ? current.link : null;
        // Drop the head of the queue first so the next item shows even
        // if the user navigates.
        setQueue((prev) => prev.slice(1));
        if (navigateTo) router.push(navigateTo);
      } catch {
        // Network blip — leave the queue alone so the user can retry.
      } finally {
        setBusy(false);
      }
    },
    [current, busy, router]
  );

  if (!isEligible || !current) return null;

  // Title: pick the first non-empty line of the message as the heading.
  const lines = current.message.split("\n");
  const heading = lines[0] || "إشعار جديد";
  const body = lines.slice(1).join("\n").trim();

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-ack-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,253,247,1) 0%, rgba(248,245,255,1) 100%)",
          border: "1px solid rgba(201,168,76,0.25)",
        }}
      >
        {/* Header band — gradient stripe + icon */}
        <div
          className="flex items-center gap-4 px-8 py-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(201,168,76,0.18) 0%, rgba(139,92,246,0.18) 100%)",
            borderBottom: "1px solid rgba(201,168,76,0.18)",
          }}
        >
          <div
            className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #C9A84C 0%, #8B5CF6 100%)",
              boxShadow: "0 8px 24px rgba(139,92,246,0.25)",
            }}
          >
            <Target size={28} style={{ color: "#FFFFFF" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2
              id="pending-ack-title"
              className="text-lg font-bold leading-snug"
              style={{ color: "#1C1B2E" }}
            >
              {heading}
            </h2>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
              يجب الضغط على "استلمت" قبل المتابعة
            </p>
          </div>
          {queue.length > 1 && (
            <span
              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: "#5E5495" }}
            >
              {queue.length}
            </span>
          )}
        </div>

        {/* Body — preserves the multi-line message verbatim */}
        <div className="px-8 py-6">
          <p
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: "#2D3748" }}
          >
            {body || current.message}
          </p>
        </div>

        {/* Footer — two actions, primary is the ack itself */}
        <div
          className="flex flex-col sm:flex-row gap-3 px-8 py-5"
          style={{
            background: "rgba(248,245,255,0.5)",
            borderTop: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          <MarsaButton
            ref={ackButtonRef}
            onClick={() => acknowledge(false)}
            disabled={busy}
            loading={busy}
            variant="gold"
            className="flex-1"
          >
            استلمت ✓
          </MarsaButton>
          {current.link ? (
            <MarsaButton
              onClick={() => acknowledge(true)}
              disabled={busy}
              variant="outline"
              className="flex-1"
            >
              اذهب للمشروع
            </MarsaButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
