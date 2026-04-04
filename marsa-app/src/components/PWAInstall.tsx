"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { MarsaButton } from "@/components/ui/MarsaButton";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Check if already installed
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone;
    if (isStandalone) return;

    // Check if dismissed recently (don't show for 7 days)
    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Detect iOS
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: show after 3 seconds
    if (ios) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => { clearTimeout(timer); window.removeEventListener("beforeinstallprompt", handler); };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("pwa_dismissed", String(Date.now()));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div
        className="fixed bottom-4 left-4 right-4 z-[100] rounded-2xl p-4 flex items-center gap-3 max-w-lg mx-auto animate-slide-up"
        style={{
          backgroundColor: "#2A2542",
          border: "1px solid rgba(201,168,76,0.2)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
        dir="rtl"
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(201,168,76,0.15)" }}
        >
          <Smartphone size={24} style={{ color: "#C9A84C" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">تثبيت تطبيق مرسى</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
            {isIOS ? "أضف مرسى للشاشة الرئيسية" : "ثبّت التطبيق للوصول السريع"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <MarsaButton variant="gold" size="sm" icon={<Download size={14} />} onClick={handleInstall}>
            تثبيت
          </MarsaButton>
          <button onClick={handleDismiss} className="p-1.5 rounded-lg" style={{ color: "rgba(255,255,255,0.3)" }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 bg-black/60 z-[101] flex items-end justify-center p-4" onClick={handleDismiss}>
          <div
            className="bg-white rounded-t-2xl rounded-b-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: "#1C1B2E" }}>
              تثبيت مرسى على iPhone
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#5E5495", color: "#fff" }}>1</span>
                <p className="text-sm" style={{ color: "#2D3748" }}>
                  اضغط على زر <strong>المشاركة</strong> (السهم للأعلى) أسفل المتصفح
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#5E5495", color: "#fff" }}>2</span>
                <p className="text-sm" style={{ color: "#2D3748" }}>
                  مرر للأسفل واختر <strong>&quot;إضافة إلى الشاشة الرئيسية&quot;</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#5E5495", color: "#fff" }}>3</span>
                <p className="text-sm" style={{ color: "#2D3748" }}>
                  اضغط <strong>&quot;إضافة&quot;</strong> وسيظهر التطبيق على شاشتك
                </p>
              </div>
            </div>
            <MarsaButton variant="primary" size="lg" className="w-full mt-6" onClick={handleDismiss}>
              فهمت
            </MarsaButton>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </>
  );
}
