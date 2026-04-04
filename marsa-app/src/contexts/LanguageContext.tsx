"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { ar } from "@/i18n/ar";
import { en } from "@/i18n/en";

type Lang = "ar" | "en";
type Translations = typeof ar;

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ar",
  t: ar,
  toggleLang: () => {},
  isRTL: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    const saved = localStorage.getItem("marsa_lang") as Lang;
    if (saved === "ar" || saved === "en") setLang(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    localStorage.setItem("marsa_lang", lang);
  }, [lang]);

  const toggleLang = () =>
    setLang((prev) => (prev === "ar" ? "en" : "ar"));
  const t: Translations = lang === "ar" ? ar : en;
  const isRTL = lang === "ar";

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
