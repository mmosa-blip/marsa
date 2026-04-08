"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  X,
  Loader2,
  Users,
  Building2,
  FolderKanban,
  ClipboardList,
  Receipt,
} from "lucide-react";
import SarSymbol from "@/components/SarSymbol";

interface SearchResults {
  users: { id: string; name: string; email: string; role: string; link: string }[];
  clients: { id: string; name: string; commercialRegister: string | null; ownerName: string; link: string }[];
  projects: { id: string; name: string; projectCode: string | null; status: string; clientName: string; link: string }[];
  tasks: { id: string; title: string; status: string; projectName: string; link: string }[];
  invoices: { id: string; invoiceNumber: string; title: string; totalAmount: number; status: string; link: string }[];
}

const categories = [
  {
    key: "users" as const,
    label: "المستخدمون",
    icon: Users,
    color: "#3B82F6",
    getName: (item: SearchResults["users"][0]) => item.name,
    getSubtitle: (item: SearchResults["users"][0]) => item.email,
  },
  {
    key: "clients" as const,
    label: "الشركات",
    icon: Building2,
    color: "#8B5CF6",
    getName: (item: SearchResults["clients"][0]) => item.name,
    getSubtitle: (item: SearchResults["clients"][0]) =>
      item.commercialRegister ? `سجل: ${item.commercialRegister} - ${item.ownerName}` : item.ownerName,
  },
  {
    key: "projects" as const,
    label: "المشاريع",
    icon: FolderKanban,
    color: "#22C55E",
    getName: (item: SearchResults["projects"][0]) =>
      item.projectCode ? `${item.name}  ·  ${item.projectCode}` : item.name,
    getSubtitle: (item: SearchResults["projects"][0]) => `${item.clientName} - ${item.status}`,
  },
  {
    key: "tasks" as const,
    label: "المهام",
    icon: ClipboardList,
    color: "#F59E0B",
    getName: (item: SearchResults["tasks"][0]) => item.title,
    getSubtitle: (item: SearchResults["tasks"][0]) => `${item.projectName} - ${item.status}`,
  },
  {
    key: "invoices" as const,
    label: "الفواتير",
    icon: Receipt,
    color: "#EF4444",
    getName: (item: SearchResults["invoices"][0]) => item.title,
    getSubtitle: (item: SearchResults["invoices"][0]) =>
      <>{item.invoiceNumber} - {item.totalAmount.toLocaleString()} <SarSymbol size={12} /> - {item.status}</>,
  },
];

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const hasResults =
    results &&
    (results.users.length > 0 ||
      results.clients.length > 0 ||
      results.projects.length > 0 ||
      results.tasks.length > 0 ||
      results.invoices.length > 0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:bg-white/10"
        title="بحث (Ctrl+K)"
      >
        <Search size={18} style={{ color: "#C9A84C" }} />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      dir="rtl"
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#fff" }}
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid #E5E7EB" }}
        >
          <Search size={20} style={{ color: "#9CA3AF" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="ابحث في النظام..."
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "#1C1B2E" }}
          />
          {loading && <Loader2 size={18} className="animate-spin" style={{ color: "#C9A84C" }} />}
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={16} style={{ color: "#9CA3AF" }} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {query.length < 2 && (
            <p className="text-center text-sm text-gray-400 py-8">
              اكتب حرفين على الأقل للبحث
            </p>
          )}

          {query.length >= 2 && !loading && !hasResults && (
            <p className="text-center text-sm text-gray-400 py-8">
              لا توجد نتائج
            </p>
          )}

          {hasResults &&
            categories.map((category) => {
              const items = results[category.key];
              if (!items || items.length === 0) return null;

              const CategoryIcon = category.icon;

              return (
                <div key={category.key} className="mb-3">
                  <p
                    className="text-xs font-semibold px-4 py-2"
                    style={{ color: "#9CA3AF" }}
                  >
                    {category.label}
                  </p>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(items as any[]).map((item: any) => (
                    <Link
                      key={item.id}
                      href={item.link}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${category.color}15` }}
                      >
                        <CategoryIcon size={16} style={{ color: category.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "#1C1B2E" }}
                        >
                          {category.getName(item)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {category.getSubtitle(item)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 text-xs text-gray-400"
          style={{ borderTop: "1px solid #E5E7EB" }}
        >
          <span>ESC للإغلاق</span>
          <span>Ctrl+K للبحث السريع</span>
        </div>
      </div>
    </div>
  );
}
