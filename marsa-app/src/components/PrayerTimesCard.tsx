"use client";

import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════
// Prayer Times Card — Full widget for dashboard page
// ═══════════════════════════════════════════════════

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

const DEFAULT_LAT = 24.5247;
const DEFAULT_LNG = 39.5692;

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
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

export default function PrayerTimesCard() {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [currentPrayer, setCurrentPrayer] = useState<Prayer | null>(null);
  const [nextPrayer, setNextPrayer] = useState<Prayer | null>(null);
  const [countdown, setCountdown] = useState("");
  const [locationName, setLocationName] = useState("المدينة المنورة");

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
        const timings = data.data.timings;
        const prayerList: Prayer[] = PRAYER_ORDER.map((key) => {
          const timeStr = timings[key];
          const { hours, minutes } = parseTime(timeStr);
          const d = new Date(today);
          d.setHours(hours, minutes, 0, 0);
          return { key, name: PRAYER_NAMES[key], time: timeStr, date: d };
        });
        setPrayers(prayerList);

        // Try to get city name
        const meta = data.data.meta;
        if (meta?.timezone) {
          const parts = meta.timezone.split("/");
          setLocationName(parts[parts.length - 1].replace(/_/g, " "));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchPrayerTimes(pos.coords.latitude, pos.coords.longitude),
        () => fetchPrayerTimes(DEFAULT_LAT, DEFAULT_LNG),
        { timeout: 5000 }
      );
    } else {
      fetchPrayerTimes(DEFAULT_LAT, DEFAULT_LNG);
    }
  }, [fetchPrayerTimes]);

  useEffect(() => {
    if (prayers.length === 0) return;
    const update = () => {
      const now = new Date();
      let cur: Prayer | null = null;
      let nxt: Prayer | null = null;
      for (let i = prayers.length - 1; i >= 0; i--) {
        if (now >= prayers[i].date) {
          cur = prayers[i];
          nxt = i < prayers.length - 1 ? prayers[i + 1] : null;
          break;
        }
      }
      if (!cur) nxt = prayers[0];
      setCurrentPrayer(cur);
      setNextPrayer(nxt);
      if (nxt) setCountdown(formatCountdown(nxt.date.getTime() - now.getTime()));
      else setCountdown("");
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [prayers]);

  if (prayers.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #2A2542 0%, #1C1B2E 100%)",
        border: "1px solid rgba(201,168,76,0.15)",
      }}
      dir="rtl"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "rgba(201,168,76,0.15)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8 6 4 8 4 12v8h16v-8c0-4-4-6-8-10z" />
              <path d="M4 20h16" />
              <path d="M12 12v4" />
              <circle cx="12" cy="5" r="1.5" fill="#C9A84C" stroke="none" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>مواقيت الصلاة</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{locationName}</p>
          </div>
        </div>
        {/* Next prayer highlight */}
        {nextPrayer && (
          <div className="text-left">
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>القادمة</p>
            <p className="text-sm font-bold" style={{ color: "#C9A84C" }}>{nextPrayer.name}</p>
            <p className="text-[10px]" style={{ color: "rgba(201,168,76,0.7)" }}>{countdown}</p>
          </div>
        )}
      </div>

      {/* Prayer times row */}
      <div className="px-3 pb-4">
        <div className="flex items-stretch gap-1.5">
          {prayers.map((p) => {
            const isCurrent = currentPrayer?.key === p.key;
            const isNext = nextPrayer?.key === p.key;
            const isPast = new Date() > p.date && !isCurrent;

            return (
              <div
                key={p.key}
                className="flex-1 text-center py-3 rounded-xl transition-all"
                style={{
                  backgroundColor: isNext
                    ? "rgba(201,168,76,0.15)"
                    : isCurrent
                    ? "rgba(94,84,149,0.2)"
                    : "rgba(255,255,255,0.03)",
                  border: isNext ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent",
                }}
              >
                <p
                  className="text-[11px] font-bold mb-1"
                  style={{
                    color: isPast
                      ? "rgba(255,255,255,0.25)"
                      : isNext
                      ? "#C9A84C"
                      : isCurrent
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.6)",
                  }}
                >
                  {p.name}
                </p>
                <p
                  className="text-xs tabular-nums"
                  style={{
                    color: isPast
                      ? "rgba(255,255,255,0.2)"
                      : isNext
                      ? "#C9A84C"
                      : "rgba(255,255,255,0.5)",
                  }}
                  dir="ltr"
                >
                  {to12Hour(p.time)}
                </p>
                {isNext && (
                  <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1.5" style={{ backgroundColor: "#C9A84C" }} />
                )}
                {isCurrent && (
                  <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1.5" style={{ backgroundColor: "#5E5495" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
