"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";

interface SidebarCounts {
  chat: number;
  reminders: number;
  serviceRequests: number;
  taskTransfers: number;
  expenseRequests: number;
  invoices: number;
  contracts: number;
}

interface SidebarCountsContextType {
  counts: SidebarCounts;
  refreshCounts: () => void;
}

const defaultCounts: SidebarCounts = {
  chat: 0,
  reminders: 0,
  serviceRequests: 0,
  taskTransfers: 0,
  expenseRequests: 0,
  invoices: 0,
  contracts: 0,
};

const SidebarCountsContext = createContext<SidebarCountsContextType>({
  counts: defaultCounts,
  refreshCounts: () => {},
});

export function SidebarCountsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [counts, setCounts] = useState<SidebarCounts>(defaultCounts);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCounts = useCallback(() => {
    if (!session?.user?.id) return;
    // Check expired transfers then fetch counts
    fetch("/api/task-transfers/check-expired").catch(() => {}).finally(() => {
      fetch("/api/sidebar/counts")
        .then((r) => r.json())
        .then((d) => setCounts(d))
        .catch(() => {});
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) return;
    refreshCounts();
    intervalRef.current = setInterval(refreshCounts, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user?.id, refreshCounts]);

  return (
    <SidebarCountsContext.Provider value={{ counts, refreshCounts }}>
      {children}
    </SidebarCountsContext.Provider>
  );
}

export function useSidebarCounts() {
  return useContext(SidebarCountsContext);
}
