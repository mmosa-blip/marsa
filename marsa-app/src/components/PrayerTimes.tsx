"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { X } from "lucide-react";

// ═══════════════════════════════════════════════════
// Prayer Times Widget — Aladhan API + Geolocation
// ═══════════════════════════════════════════════════

interface PrayerTimesData {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface Prayer {
  key: string;
  name: string;
  time: string;
  date: Date;
}

const PRAYER_NAMES: Record<string, string> = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

const PRAYER_ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

// Medina fallback coordinates
const DEFAULT_LAT = 24.4672;
const DEFAULT_LNG = 39.6024;

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hours: h, minutes: m };
}

function to12Hour(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? "م" : "ص";
  const h12 = hours % 12 || 12;
  return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "الآن";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h} س ${m} د`;
  return `${m} د`;
}

export default function PrayerTimes() {
  const { data: session } = useSession();
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [currentPrayer, setCurrentPrayer] = useState<Prayer | null>(null);
  const [nextPrayer, setNextPrayer] = useState<Prayer | null>(null);
  const [countdown, setCountdown] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [notificationPrayer, setNotificationPrayer] = useState("");
  const [expanded, setExpanded] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Don't show for clients
  const isClient = session?.user?.role === "CLIENT";

  const fetchPrayerTimes = useCallback(async (lat: number, lng: number) => {
    try {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const yyyy = today.getFullYear();
      const res = await fetch(
        `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lng}&method=4`
      );
      const data = await res.json();
      if (data.code === 200) {
        const timings: PrayerTimesData = data.data.timings;
        const prayerList: Prayer[] = PRAYER_ORDER.map((key) => {
          const timeStr = timings[key as keyof PrayerTimesData];
          const { hours, minutes } = parseTime(timeStr);
          const d = new Date(today);
          d.setHours(hours, minutes, 0, 0);
          return { key, name: PRAYER_NAMES[key], time: timeStr, date: d };
        });
        setPrayers(prayerList);
      }
    } catch {
      // Silently fail — widget just won't show
    }
  }, []);

  // Get location and fetch prayer times
  useEffect(() => {
    if (isClient || !session) return;

    const getLocation = () => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchPrayerTimes(pos.coords.latitude, pos.coords.longitude),
          () => fetchPrayerTimes(DEFAULT_LAT, DEFAULT_LNG),
          { timeout: 5000 }
        );
      } else {
        fetchPrayerTimes(DEFAULT_LAT, DEFAULT_LNG);
      }
    };

    getLocation();

    // Refresh daily at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 30, 0);
    const msToMidnight = tomorrow.getTime() - now.getTime();
    const timer = setTimeout(getLocation, msToMidnight);
    return () => clearTimeout(timer);
  }, [isClient, session, fetchPrayerTimes]);

  // Update current/next prayer and countdown every 10 seconds
  useEffect(() => {
    if (prayers.length === 0) return;

    const update = () => {
      const now = new Date();
      let current: Prayer | null = null;
      let next: Prayer | null = null;

      for (let i = prayers.length - 1; i >= 0; i--) {
        if (now >= prayers[i].date) {
          current = prayers[i];
          next = i < prayers.length - 1 ? prayers[i + 1] : null;
          break;
        }
      }

      // Before first prayer
      if (!current) {
        next = prayers[0];
      }

      setCurrentPrayer(current);
      setNextPrayer(next);

      if (next) {
        setCountdown(formatCountdown(next.date.getTime() - now.getTime()));
      } else {
        setCountdown("");
      }

      // Check if any prayer time just arrived (within 60 seconds)
      for (const p of prayers) {
        const diff = now.getTime() - p.date.getTime();
        if (diff >= 0 && diff < 60000 && !notifiedRef.current.has(p.key)) {
          notifiedRef.current.add(p.key);
          triggerNotification(p.name);
        }
      }
    };

    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [prayers]);

  const triggerNotification = (prayerName: string) => {
    setNotificationPrayer(prayerName);
    setShowNotification(true);

    // Play subtle alert sound
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(
          "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGf9AAAIgxAM/8kYBAAAANIAAAAAP////////////////////////////////8AAAA0TEFNRTMuMTAwAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYAAAAAAAAAAAAAAAAAAAAA//tQxAAAAAADSAAAAAAAAANIAAAAAP////////////////////////////////8AAAA0TEFNRTMuMTAwAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYAAAAAAAAAAAAAAAAAAAAA"
        );
      }
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    } catch {}

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`حان وقت صلاة ${prayerName}`, {
        body: "أقم الصلاة",
        icon: "/images/marsa-logo.png",
        dir: "rtl",
        lang: "ar",
      });
    } else if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  if (isClient || !session || prayers.length === 0) return null;

  return (
    <>
      {/* Compact widget in header */}
      <div className="relative">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
          style={{
            backgroundColor: expanded ? "rgba(201,168,76,0.15)" : "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          {/* Mosque icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C8 6 4 8 4 12v8h16v-8c0-4-4-6-8-10z" />
            <path d="M4 20h16" />
            <path d="M12 12v4" />
            <circle cx="12" cy="5" r="1" fill="#C9A84C" stroke="none" />
          </svg>

          <div className="text-right" dir="rtl">
            {nextPrayer ? (
              <>
                <span className="text-[10px] font-medium block leading-tight" style={{ color: "#C9A84C" }}>
                  {nextPrayer.name}
                </span>
                <span className="text-[9px] block leading-tight" style={{ color: "rgba(201,168,76,0.7)" }}>
                  {countdown}
                </span>
              </>
            ) : currentPrayer ? (
              <span className="text-[10px] font-medium" style={{ color: "#C9A84C" }}>
                {currentPrayer.name}
              </span>
            ) : null}
          </div>
        </button>

        {/* Expanded dropdown */}
        {expanded && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <div
              className="absolute top-full mt-2 left-0 w-64 rounded-2xl overflow-hidden z-50"
              style={{
                backgroundColor: "#2A2542",
                border: "1px solid rgba(201,168,76,0.2)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              }}
              dir="rtl"
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C8 6 4 8 4 12v8h16v-8c0-4-4-6-8-10z" />
                    <path d="M4 20h16" />
                    <path d="M12 12v4" />
                    <circle cx="12" cy="5" r="1" fill="#C9A84C" stroke="none" />
                  </svg>
                  <span className="text-sm font-bold" style={{ color: "#C9A84C" }}>مواقيت الصلاة</span>
                </div>
              </div>

              {/* Prayer list */}
              <div className="p-2">
                {prayers.map((p) => {
                  const isCurrent = currentPrayer?.key === p.key;
                  const isNext = nextPrayer?.key === p.key;
                  const isPast = new Date() > p.date && !isCurrent;

                  return (
                    <div
                      key={p.key}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-0.5"
                      style={{
                        backgroundColor: isNext
                          ? "rgba(201,168,76,0.12)"
                          : isCurrent
                          ? "rgba(94,84,149,0.15)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: isNext ? "#C9A84C" : isCurrent ? "#5E5495" : isPast ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.3)",
                          }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: isPast ? "rgba(255,255,255,0.3)" : isNext ? "#C9A84C" : "#FFFFFF",
                          }}
                        >
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm tabular-nums"
                          style={{
                            color: isPast ? "rgba(255,255,255,0.3)" : isNext ? "#C9A84C" : "rgba(255,255,255,0.7)",
                          }}
                          dir="ltr"
                        >
                          {to12Hour(p.time)}
                        </span>
                        {isNext && countdown && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "rgba(201,168,76,0.2)", color: "#C9A84C" }}>
                            {countdown}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prayer notification popup */}
      {showNotification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div
            className="w-full max-w-sm rounded-3xl p-8 text-center relative overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #2A2542, #1C1B2E)",
              border: "1px solid rgba(201,168,76,0.3)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
            dir="rtl"
          >
            {/* Decorative */}
            <div className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-10" style={{ backgroundColor: "#C9A84C", transform: "translate(-50%,-50%)" }} />
            <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ backgroundColor: "#5E5495", transform: "translate(50%,50%)" }} />

            {/* Close */}
            <button
              onClick={() => setShowNotification(false)}
              className="absolute top-4 left-4 p-1.5 rounded-lg transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <X size={18} />
            </button>

            {/* Content */}
            <div className="relative z-10">
              {/* Mosque icon large */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: "rgba(201,168,76,0.15)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2C8 6 4 8 4 12v8h16v-8c0-4-4-6-8-10z" />
                  <path d="M4 20h16" />
                  <path d="M12 12v4" />
                  <circle cx="12" cy="5" r="1.5" fill="#C9A84C" stroke="none" />
                </svg>
              </div>

              <p className="text-lg font-bold mb-2" style={{ color: "#C9A84C" }}>
                حان وقت صلاة {notificationPrayer}
              </p>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
                أقم الصلاة
              </p>

              <button
                onClick={() => setShowNotification(false)}
                className="px-8 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: "#5E5495", color: "#FFFFFF" }}
              >
                جزاك الله خيراً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
