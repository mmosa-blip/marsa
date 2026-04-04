"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ addToast: (type: ToastType, message: string) => void }>({
  addToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts(prev => prev.slice(1));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toasts]);

  const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle };
  const colors = { success: "#22C55E", error: "#DC2626", warning: "#F59E0B" };
  const bgs = { success: "#F0FDF4", error: "#FEF2F2", warning: "#FFFBEB" };
  const borders = { success: "#BBF7D0", error: "#FECACA", warning: "#FDE68A" };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2" dir="rtl">
        {toasts.map(toast => {
          const Icon = icons[toast.type];
          return (
            <div key={toast.id} className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-[300px] animate-[slideIn_0.3s_ease-out]" style={{ backgroundColor: bgs[toast.type], border: `1px solid ${borders[toast.type]}` }}>
              <Icon size={18} style={{ color: colors[toast.type] }} />
              <p className="flex-1 text-sm font-medium" style={{ color: "#1C1B2E" }}>{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
