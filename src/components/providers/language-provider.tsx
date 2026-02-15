"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Direction = "rtl" | "ltr";
type Language = "ar" | "en";

interface LanguageContextType {
  dir: Direction;
  lang: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLang: Language;
}

export function LanguageProvider({ children, initialLang }: LanguageProviderProps) {
  const router = useRouter();

  const [lang, setLang] = useState<Language>(initialLang);

  const [dir, setDir] = useState<Direction>(initialLang === "en" ? "ltr" : "rtl");

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
  }, [dir, lang]);

  const applyLanguage = (next: Language) => {
    setLang(next);
    setDir(next === "en" ? "ltr" : "rtl");
    router.refresh();
  };

  const toggleLanguage = () => {
    applyLanguage(lang === "ar" ? "en" : "ar");
  };

  const setLanguage = (next: Language) => {
    if (next !== lang) {
      applyLanguage(next);
    }
  };

  return (
    <LanguageContext.Provider value={{ dir, lang, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
