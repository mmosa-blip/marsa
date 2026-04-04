"use client";

import { useLang } from "@/contexts/LanguageContext";

export function LanguageToggle({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { lang, toggleLang } = useLang();
  const isDark = variant === "dark";
  return (
    <button
      onClick={toggleLang}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
        isDark
          ? "border-white/20 text-white/80 hover:bg-white/10"
          : "border-gray-200 text-gray-600 hover:bg-gray-50"
      }`}
      title={lang === "ar" ? "Switch to English" : "\u0627\u0644\u062A\u0628\u062F\u064A\u0644 \u0644\u0644\u0639\u0631\u0628\u064A\u0629"}
    >
      <span className="text-base">{lang === "ar" ? "\uD83C\uDDEC\uD83C\uDDE7" : "\uD83C\uDDF8\uD83C\uDDE6"}</span>
      <span>{lang === "ar" ? "EN" : "\u0639\u0631"}</span>
    </button>
  );
}
