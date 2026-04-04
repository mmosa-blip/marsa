"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSidebarCounts } from "@/contexts/SidebarCountsContext";
import {
  MessageSquare,
  Send,
  Paperclip,
  Plus,
  Search,
  X,
  CheckCheck,
  Check,
  Loader2,
  Users,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
} from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";
import { UploadButton } from "@/lib/uploadthing";
import { pusherClient } from "@/lib/pusher-client";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Message {
  id: string;
  body: string;
  senderId: string;
  sender: { id: string; name: string; role?: string };
  createdAt: string;
  seen: { id: string }[];
}

interface Conversation {
  id: string;
  name: string | null;
  isGroup: boolean;
  users: User[];
  messages: Message[];
  unreadCount: number;
  updatedAt: string;
  displayName?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير",
  MANAGER: "مشرف",
  EXECUTOR: "منفذ",
  CLIENT: "عميل",
  EXTERNAL_PROVIDER: "مقدم خدمة",
  FINANCE_MANAGER: "مدير مالي",
  TREASURY_MANAGER: "أمين صندوق",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `قبل ${diffMins} د`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `قبل ${diffHours} س`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `قبل ${diffDays} ي`;
  return new Date(date).toLocaleDateString("ar-SA-u-nu-latn", {
    month: "short",
    day: "numeric",
  });
}

function formatDateDivider(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor(
    (today.getTime() - msgDate.getTime()) / 86400000
  );
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  return d.toLocaleDateString("ar-SA-u-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatMessageTime(date: string): string {
  return new Date(date).toLocaleTimeString("ar-SA-u-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateKey(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function getConversationDisplayName(
  conv: Conversation,
  currentUserId: string
): string {
  if (conv.displayName) return conv.displayName;
  if (conv.isGroup && conv.name) return conv.name;
  const other = conv.users?.find((u) => u.id !== currentUserId);
  return other?.name || "محادثة";
}

function getOtherUser(
  conv: Conversation,
  currentUserId: string
): User | null {
  const other = conv.users?.find((u) => u.id !== currentUserId);
  return other || null;
}

function isImageUrl(text: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(text) ||
    text.includes("utfs.io") ||
    text.includes("uploadthing");
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { data: session } = useSession();
  const { refreshCounts } = useSidebarCounts();
  const currentUserId = (session?.user as User | undefined)?.id || "";

  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [convsError, setConvsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected conversation state
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [msgsError, setMsgsError] = useState<string | null>(null);

  // Input state
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Related users (quick start)
  const [relatedUsers, setRelatedUsers] = useState<User[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // New conversation modal state
  const [showNewConvModal, setShowNewConvModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingConv, setCreatingConv] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollConvsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollMsgsRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { document.title = "المحادثات | مرسى"; }, []);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("فشل تحميل المحادثات");
      const data = await res.json();
      setConversations(data);
      setConvsError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "فشل تحميل المحادثات";
      setConvsError(message);
    } finally {
      setConvsLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(
    async (convId: string) => {
      try {
        const res = await fetch(`/api/conversations/${convId}`);
        if (!res.ok) throw new Error("فشل تحميل الرسائل");
        const data = await res.json();
        // API returns messages in desc order, reverse for display
        const msgs = (data.messages || []).reverse();
        setMessages(msgs);
        setMsgsError(null);

        // Mark unseen messages as seen
        const unseenMessages = msgs.filter(
          (m: Message) =>
            m.senderId !== currentUserId &&
            !m.seen?.some((s: { id: string }) => s.id === currentUserId)
        );
        if (unseenMessages.length > 0) {
          for (const msg of unseenMessages) {
            fetch(`/api/messages/${msg.id}/seen`, { method: "POST" }).catch(
              () => {}
            );
          }
          refreshCounts();
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "فشل تحميل الرسائل";
        setMsgsError(message);
      } finally {
        setMsgsLoading(false);
      }
    },
    [currentUserId]
  );

  // ─── Fetch related users ──────────────────────────────────────────────────

  const fetchRelatedUsers = useCallback(async () => {
    setRelatedLoading(true);
    try {
      const res = await fetch("/api/users/related");
      if (res.ok) {
        const data = await res.json();
        setRelatedUsers(data || []);
      }
    } catch {
      // silent
    } finally {
      setRelatedLoading(false);
    }
  }, []);

  // ─── Initial Load ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetchConversations();
    fetchRelatedUsers();
  }, [fetchConversations, fetchRelatedUsers]);

  // ─── Polling ───────────────────────────────────────────────────────────────

  useEffect(() => {
    pollConvsRef.current = setInterval(fetchConversations, 30000);
    return () => {
      if (pollConvsRef.current) clearInterval(pollConvsRef.current);
    };
  }, [fetchConversations]);

  useEffect(() => {
    if (pollMsgsRef.current) clearInterval(pollMsgsRef.current);

    if (selectedConvId) {
      pollMsgsRef.current = setInterval(() => {
        fetchMessages(selectedConvId);
      }, 30000);
    }

    return () => {
      if (pollMsgsRef.current) clearInterval(pollMsgsRef.current);
    };
  }, [selectedConvId, fetchMessages]);

  // ─── Pusher: Subscribe to conversation channel ─────────────────────────────

  useEffect(() => {
    if (!selectedConvId || !pusherClient) return;

    try {
      const channel = pusherClient.subscribe(
        `private-conversation-${selectedConvId}`
      );

      channel.bind("new-message", (newMessage: Message) => {
        if (newMessage.senderId !== currentUserId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
          fetch(`/api/messages/${newMessage.id}/seen`, { method: "POST" }).catch(
            () => {}
          );
        }
      });

      channel.bind(
        "message-seen",
        (data: { messageId: string; seenBy: string }) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === data.messageId) {
                const alreadySeen = m.seen?.some(
                  (s) => s.id === data.seenBy
                );
                if (alreadySeen) return m;
                return {
                  ...m,
                  seen: [...(m.seen || []), { id: data.seenBy }],
                };
              }
              return m;
            })
          );
        }
      );

      return () => {
        channel.unbind_all();
        pusherClient.unsubscribe(`private-conversation-${selectedConvId}`);
      };
    } catch {
      // Pusher not available
    }
  }, [selectedConvId, currentUserId]);

  // ─── Pusher: Subscribe to user channel for conversation updates ────────────

  useEffect(() => {
    if (!currentUserId || !pusherClient) return;

    try {
      const channel = pusherClient.subscribe(`private-user-${currentUserId}`);

      channel.bind(
        "conversation-update",
        (data: { conversationId: string; lastMessage: Message }) => {
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.id === data.conversationId) {
                return {
                  ...conv,
                  messages: [data.lastMessage],
                  updatedAt: data.lastMessage.createdAt,
                  unreadCount:
                    conv.id === selectedConvId
                      ? conv.unreadCount
                      : conv.unreadCount + 1,
                };
              }
              return conv;
            });
            return updated.sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            );
          });
        }
      );

      return () => {
        channel.unbind("conversation-update");
      };
    } catch {
      // Pusher not available
    }
  }, [currentUserId, selectedConvId]);

  // ─── Select Conversation ──────────────────────────────────────────────────

  const handleSelectConv = useCallback(
    (convId: string) => {
      setSelectedConvId(convId);
      setMessages([]);
      setMsgsLoading(true);
      setMsgsError(null);
      setInputText("");
      fetchMessages(convId);

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === convId ? { ...conv, unreadCount: 0 } : conv
        )
      );
    },
    [fetchMessages]
  );

  // ─── Auto-scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Send Message ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !selectedConvId || sending) return;

    const body = inputText.trim();
    setInputText("");
    setSending(true);

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      body,
      senderId: currentUserId,
      sender: {
        id: currentUserId,
        name: session?.user?.name || "",
        role: (session?.user as User | undefined)?.role || "",
      },
      createdAt: new Date().toISOString(),
      seen: [],
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, body }),
      });
      if (!res.ok) throw new Error("فشل إرسال الرسالة");
      const newMsg = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? newMsg : m))
      );
      fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(body);
    } finally {
      setSending(false);
    }
  }, [
    inputText,
    selectedConvId,
    sending,
    currentUserId,
    session,
    fetchConversations,
  ]);

  // ─── Send Image Message ──────────────────────────────────────────────────

  const sendImageMessage = useCallback(async (imageUrl: string) => {
    if (!selectedConvId || sending) return;

    setSending(true);

    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      body: imageUrl,
      senderId: currentUserId,
      sender: {
        id: currentUserId,
        name: session?.user?.name || "",
        role: (session?.user as User | undefined)?.role || "",
      },
      createdAt: new Date().toISOString(),
      seen: [],
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedConvId, body: imageUrl }),
      });
      if (!res.ok) throw new Error("فشل إرسال الصورة");
      const newMsg = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? newMsg : m))
      );
      fetchConversations();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    } finally {
      setSending(false);
    }
  }, [selectedConvId, sending, currentUserId, session, fetchConversations]);

  // ─── Keyboard Handler ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // ─── Auto-resize textarea ─────────────────────────────────────────────────

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputText]);

  // ─── User Search for New Conversation ──────────────────────────────────────

  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(userSearchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            (data || []).filter((u: User) => u.id !== currentUserId)
          );
        }
      } catch {
        // silent
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [userSearchQuery, currentUserId]);

  // ─── Create Conversation (FIXED) ───────────────────────────────────────────

  const handleCreateConversation = useCallback(async () => {
    if (selectedUsers.length === 0) return;
    if (isGroupMode && !groupName.trim()) return;

    setCreatingConv(true);
    try {
      const requestBody = isGroupMode
        ? {
            userIds: selectedUsers.map((u) => u.id),
            isGroup: true,
            name: groupName.trim(),
          }
        : {
            userId: selectedUsers[0].id,
            isGroup: false,
          };

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error("فشل إنشاء المحادثة");
      const conv = await res.json();
      setShowNewConvModal(false);
      setSelectedUsers([]);
      setGroupName("");
      setIsGroupMode(false);
      setUserSearchQuery("");
      await fetchConversations();
      handleSelectConv(conv.id);
    } catch {
      // silent
    } finally {
      setCreatingConv(false);
    }
  }, [
    selectedUsers,
    isGroupMode,
    groupName,
    fetchConversations,
    handleSelectConv,
  ]);

  // ─── Quick start conversation with a related user ─────────────────────────

  const handleQuickStartConv = useCallback(async (user: User) => {
    // Check if conversation already exists with this user
    const existingConv = conversations.find(
      (c) => !c.isGroup && c.users?.some((u) => u.id === user.id)
    );
    if (existingConv) {
      handleSelectConv(existingConv.id);
      return;
    }
    // Create new 1-on-1 conversation
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isGroup: false }),
      });
      if (!res.ok) throw new Error("فشل إنشاء المحادثة");
      const conv = await res.json();
      await fetchConversations();
      handleSelectConv(conv.id);
    } catch {
      // silent
    }
  }, [conversations, fetchConversations, handleSelectConv]);

  // ─── Filter Conversations ─────────────────────────────────────────────────

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const name = getConversationDisplayName(conv, currentUserId);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // ─── Selected Conversation Data ────────────────────────────────────────────

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex" dir="rtl">
      {/* ── Sidebar: Conversation List (right side in RTL) ───────────────── */}
      <div
        className={`w-full lg:w-[360px] flex-shrink-0 flex-col border-l ${
          selectedConvId ? "hidden lg:flex" : "flex"
        }`}
        style={{
          borderColor: "#E8E6F0",
          backgroundColor: "#FFFFFF",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{
            backgroundColor: "#5E5495",
          }}
        >
          <h1
            className="text-base font-bold"
            style={{ color: "#FFFFFF" }}
          >
            المحادثات
          </h1>
          <button
            onClick={() => setShowNewConvModal(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
          >
            <Plus size={20} style={{ color: "#C9A84C" }} />
          </button>
        </div>

        {/* Search */}
        <div className="p-2" style={{ backgroundColor: "#F0EEF5" }}>
          <div className="relative">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "#94A3B8" }}
            />
            <input
              type="text"
              placeholder="بحث أو ابدأ محادثة جديدة"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "#FFFFFF",
                color: "#2D3748",
              }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <div className="p-3 space-y-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-12 h-12 rounded-full" style={{ backgroundColor: "#E8E6F0" }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded w-3/4" style={{ backgroundColor: "#E8E6F0" }} />
                    <div className="h-3 rounded w-1/2" style={{ backgroundColor: "#E8E6F0" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : convsError ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: "#DC2626" }}>{convsError}</p>
              <button onClick={fetchConversations} className="mt-2 text-sm underline" style={{ color: "#C9A84C" }}>
                إعادة المحاولة
              </button>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <MessageSquare size={48} style={{ color: "#E8E6F0" }} />
              <p className="text-sm" style={{ color: "#2D3748", opacity: 0.5 }}>لا توجد محادثات بعد</p>
              <button
                onClick={() => setShowNewConvModal(true)}
                className="text-sm px-4 py-2 rounded-xl font-medium"
                style={{ backgroundColor: "#C9A84C", color: "#FFFFFF" }}
              >
                ابدأ محادثة جديدة
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const displayName = getConversationDisplayName(conv, currentUserId);
              const lastMessage = conv.messages?.[conv.messages.length - 1] || null;
              const isSelected = conv.id === selectedConvId;
              const firstLetter = displayName.charAt(0);

              let lastMsgPreview = "لا توجد رسائل";
              if (lastMessage) {
                if (isImageUrl(lastMessage.body)) {
                  lastMsgPreview = "📷 صورة";
                } else {
                  lastMsgPreview = lastMessage.body.length > 40
                    ? lastMessage.body.substring(0, 40) + "..."
                    : lastMessage.body;
                }
              }

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConv(conv.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 transition-all duration-100 text-right"
                  style={{
                    backgroundColor: isSelected ? "#F0EEF5" : undefined,
                    borderBottom: "1px solid #F0EDE6",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "#F8F9FA";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = "";
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                    style={{
                      backgroundColor: conv.isGroup ? "#C9A84C" : "#1C1B2E",
                      color: "#FFFFFF",
                    }}
                  >
                    {conv.isGroup ? <Users size={20} /> : firstLetter}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold truncate" style={{ color: "#2D3748" }}>
                        {displayName}
                      </p>
                      {lastMessage && (
                        <span className="text-xs flex-shrink-0 mr-2" style={{ color: "#94A3B8" }}>
                          {timeAgo(lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                        {lastMsgPreview}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mr-2"
                          style={{ backgroundColor: "#25D366", color: "#FFFFFF" }}
                        >
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Related Users - Quick Start */}
        {relatedUsers.length > 0 && !convsLoading && (
          <div style={{ borderTop: "1px solid #E2E0D8" }}>
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold" style={{ color: "#94A3B8" }}>ابدأ محادثة</p>
            </div>
            <div className="flex gap-1 px-3 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {relatedUsers.slice(0, 8).map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleQuickStartConv(user)}
                  className="flex flex-col items-center gap-1 min-w-[56px] p-1.5 rounded-xl transition-all hover:bg-gray-50"
                  title={`${user.name} - ${ROLE_LABELS[user.role] || user.role}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: "#5E5495", color: "#FFFFFF" }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <span className="text-[10px] truncate w-full text-center" style={{ color: "#2D3748" }}>
                    {user.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main: Messages Area (left side in RTL) ────────────────────────── */}
      <div
        className={`flex-1 flex-col ${!selectedConvId ? "hidden lg:flex" : "flex"}`}
      >
        {!selectedConvId ? (
          /* Empty state */
          <div
            className="flex-1 flex flex-col items-center justify-center gap-4"
            style={{
              backgroundColor: "#F0EEF5",
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d5d0c4' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "rgba(201, 168, 76, 0.1)" }}
            >
              <MessageSquare size={44} style={{ color: "#C9A84C" }} />
            </div>
            <p className="text-xl font-medium" style={{ color: "#2D3748", opacity: 0.6 }}>
              مرسى للمحادثات
            </p>
            <p className="text-sm" style={{ color: "#94A3B8" }}>
              اختر محادثة من القائمة أو ابدأ محادثة جديدة
            </p>
          </div>
        ) : (
          <>
            {/* Message Header */}
            <div
              className="px-4 py-2.5 flex items-center gap-3"
              style={{
                backgroundColor: "#5E5495",
              }}
            >
              {/* Back button - mobile only */}
              <button
                onClick={() => setSelectedConvId(null)}
                className="lg:hidden flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 hover:bg-white/10 transition-colors"
              >
                <ArrowRight size={20} style={{ color: "#FFFFFF" }} />
              </button>

              {selectedConv && (
                <>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: selectedConv.isGroup ? "#C9A84C" : "rgba(255,255,255,0.2)",
                      color: "#FFFFFF",
                    }}
                  >
                    {selectedConv.isGroup
                      ? <Users size={18} />
                      : getConversationDisplayName(selectedConv, currentUserId).charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {getConversationDisplayName(selectedConv, currentUserId)}
                    </p>
                    {selectedConv.isGroup ? (
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {selectedConv.users?.length || 0} مشاركين
                      </p>
                    ) : (
                      (() => {
                        const other = getOtherUser(selectedConv, currentUserId);
                        return other ? (
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
                            {ROLE_LABELS[other.role] || other.role}
                          </p>
                        ) : null;
                      })()
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Messages Area */}
            <div
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{
                backgroundColor: "#F0EEF5",
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d5d0c4' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
              }}
            >
              {msgsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={32} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : msgsError ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-sm" style={{ color: "#DC2626" }}>{msgsError}</p>
                  <button
                    onClick={() => { setMsgsLoading(true); fetchMessages(selectedConvId!); }}
                    className="text-sm underline"
                    style={{ color: "#C9A84C" }}
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm px-4 py-2 rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.8)", color: "#94A3B8" }}>
                    ابدأ المحادثة بإرسال رسالة
                  </p>
                </div>
              ) : (
                (() => {
                  let lastDateKey = "";
                  const totalUsers = selectedConv?.users?.length || 0;

                  return messages.map((msg) => {
                    const dateKey = getDateKey(msg.createdAt);
                    const showDateDivider = dateKey !== lastDateKey;
                    lastDateKey = dateKey;

                    const isOwn = msg.senderId === currentUserId;
                    const allSeen =
                      totalUsers > 0 &&
                      (msg.seen?.length || 0) >= totalUsers - 1;

                    return (
                      <div key={msg.id}>
                        {/* Date Divider */}
                        {showDateDivider && (
                          <div className="flex items-center justify-center my-3">
                            <span
                              className="text-xs px-4 py-1.5 rounded-lg shadow-sm"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.9)",
                                color: "#2D3748",
                              }}
                            >
                              {formatDateDivider(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className={`flex mb-1.5 ${isOwn ? "justify-start" : "justify-end"}`}>
                          <div className="max-w-[75%] lg:max-w-[60%]">
                            {/* Sender name for groups */}
                            {selectedConv?.isGroup && !isOwn && (
                              <p className="text-xs mb-0.5 px-2 font-semibold" style={{ color: "#C9A84C" }}>
                                {msg.sender?.name || "مستخدم"}
                              </p>
                            )}

                            <div
                              className="relative px-3 py-1.5 shadow-sm"
                              style={
                                isOwn
                                  ? {
                                      backgroundColor: "#5E5495",
                                      color: "#FFFFFF",
                                      borderRadius: "8px 0 8px 8px",
                                    }
                                  : {
                                      backgroundColor: "#FFFFFF",
                                      color: "#2D3748",
                                      borderRadius: "0 8px 8px 8px",
                                    }
                              }
                            >
                              {/* Image message */}
                              {isImageUrl(msg.body) ? (
                                <div className="my-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.body}
                                    alt="صورة"
                                    className="rounded-lg max-w-full max-h-64 object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                  {msg.body}
                                </p>
                              )}

                              {/* Time & read status */}
                              <div className={`flex items-center gap-1 ${isOwn ? "justify-start" : "justify-end"} -mb-0.5`}>
                                <span
                                  className="text-[10px]"
                                  style={{
                                    opacity: 0.6,
                                    color: isOwn ? "#FFFFFF" : "#94A3B8",
                                  }}
                                >
                                  {formatMessageTime(msg.createdAt)}
                                </span>
                                {isOwn && (
                                  <span>
                                    {allSeen ? (
                                      <CheckCheck size={14} style={{ color: "#34D399" }} />
                                    ) : (
                                      <Check size={14} style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "#94A3B8" }} />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
              className="px-3 py-2 flex items-end gap-2"
              style={{
                backgroundColor: "#F0EEF5",
              }}
            >
              {/* Attach Button */}
              <div className="relative">
                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-gray-200"
                  style={{
                    backgroundColor: showUpload ? "rgba(201, 168, 76, 0.15)" : "transparent",
                    color: "#54656F",
                  }}
                >
                  <Paperclip size={22} />
                </button>

                {showUpload && (
                  <div
                    className="absolute bottom-full mb-2 right-0 bg-white rounded-xl shadow-lg p-3"
                    style={{ borderColor: "#E8E6F0", border: "1px solid #E2E0D8", zIndex: 10 }}
                  >
                    <UploadButton
                      endpoint="chatImage"
                      onClientUploadComplete={(res) => {
                        if (res?.[0]) {
                          sendImageMessage(res[0].ufsUrl);
                          setShowUpload(false);
                        }
                      }}
                      onUploadError={(error) => alert("خطأ: " + error.message)}
                      appearance={{
                        button: { backgroundColor: "#C9A84C", color: "white", borderRadius: "0.75rem" },
                      }}
                      content={{ button: () => "رفع صورة" }}
                    />
                  </div>
                )}
              </div>

              {/* Text Input */}
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالة..."
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{
                    backgroundColor: "#FFFFFF",
                    color: "#2D3748",
                    maxHeight: "120px",
                  }}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                style={{
                  backgroundColor: "#C9A84C",
                  color: "#FFFFFF",
                }}
              >
                {sending ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── New Conversation Modal ────────────────────────────────────────── */}
      {showNewConvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowNewConvModal(false);
              setSelectedUsers([]);
              setUserSearchQuery("");
              setIsGroupMode(false);
              setGroupName("");
            }
          }}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            style={{ border: "1px solid #E2E0D8" }}
            dir="rtl"
          >
            {/* Modal Header */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid #E2E0D8" }}
            >
              <h2 className="text-base font-bold" style={{ color: "#1C1B2E" }}>
                محادثة جديدة
              </h2>
              <button
                onClick={() => {
                  setShowNewConvModal(false);
                  setSelectedUsers([]);
                  setUserSearchQuery("");
                  setIsGroupMode(false);
                  setGroupName("");
                }}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={20} style={{ color: "#2D3748" }} />
              </button>
            </div>

            {/* Group Toggle */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid #E2E0D8" }}
            >
              <span className="text-sm" style={{ color: "#2D3748" }}>محادثة جماعية</span>
              <button
                onClick={() => {
                  setIsGroupMode(!isGroupMode);
                  if (isGroupMode) {
                    setSelectedUsers(selectedUsers.slice(0, 1));
                    setGroupName("");
                  }
                }}
              >
                {isGroupMode ? (
                  <ToggleRight size={28} style={{ color: "#C9A84C" }} />
                ) : (
                  <ToggleLeft size={28} style={{ color: "#E8E6F0" }} />
                )}
              </button>
            </div>

            {/* Group Name Input */}
            {isGroupMode && (
              <div className="px-4 pt-3">
                <input
                  type="text"
                  placeholder="اسم المجموعة..."
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "#F8F9FA", border: "1px solid #E2E0D8", color: "#2D3748" }}
                />
              </div>
            )}

            {/* Selected Users */}
            {selectedUsers.length > 0 && (
              <div className="px-4 pt-3 flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: "rgba(201, 168, 76, 0.1)", color: "#C9A84C" }}
                  >
                    {user.name}
                    <button onClick={() => setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id))} className="hover:opacity-70">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* User Search */}
            <div className="p-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#94A3B8" }}
                />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو البريد..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "#F8F9FA", border: "1px solid #E2E0D8", color: "#2D3748" }}
                />
              </div>
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 max-h-60">
              {searchingUsers ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#C9A84C" }} />
                </div>
              ) : (
                searchResults.map((user) => {
                  const isSelected = selectedUsers.some((u) => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
                        } else {
                          if (isGroupMode) {
                            setSelectedUsers([...selectedUsers, user]);
                          } else {
                            setSelectedUsers([user]);
                          }
                        }
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-gray-50 mb-1"
                      style={isSelected ? { backgroundColor: "rgba(201, 168, 76, 0.08)" } : undefined}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: "#5E5495", color: "#FFFFFF" }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-sm font-medium truncate" style={{ color: "#2D3748" }}>
                          {user.name}
                        </p>
                        <p className="text-xs truncate" style={{ color: "#94A3B8" }}>
                          {user.email} · {ROLE_LABELS[user.role] || user.role}
                        </p>
                      </div>
                      {isSelected && <Check size={16} style={{ color: "#C9A84C" }} />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create Button */}
            <div className="p-4" style={{ borderTop: "1px solid #E2E0D8" }}>
              <button
                onClick={handleCreateConversation}
                disabled={
                  selectedUsers.length === 0 ||
                  (isGroupMode && !groupName.trim()) ||
                  creatingConv
                }
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: "#C9A84C", color: "#FFFFFF" }}
              >
                {creatingConv ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    جارٍ الإنشاء...
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} />
                    {isGroupMode ? "إنشاء مجموعة" : "بدء المحادثة"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
