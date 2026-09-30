"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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
  localOnly?: boolean;
}

export function LanguageProvider({ children, initialLang, localOnly = false }: LanguageProviderProps) {
  const [lang, setLang] = useState<Language>(initialLang);

  const [dir, setDir] = useState<Direction>(initialLang === "en" ? "ltr" : "rtl");

  useEffect(() => {
    const cookieLanguage = localOnly ? undefined : document.cookie
      .split("; ")
      .find((item) => item.startsWith("lang="))
      ?.split("=")[1];
    if (cookieLanguage === "en") {
      const timer = window.setTimeout(() => {
        setLang("en");
        setDir("ltr");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [localOnly]);

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (!localOnly) {
      document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    }
  }, [dir, lang, localOnly]);

  const applyLanguage = (next: Language) => {
    if (!localOnly) {
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    setLang(next);
    setDir(next === "en" ? "ltr" : "rtl");
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
