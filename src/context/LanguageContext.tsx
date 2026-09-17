import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  isRTL: boolean;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

import { translations } from './translations';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('elgogalyia_lang');
      return saved === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = direction === 'rtl';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', direction);
    root.setAttribute('lang', language);
    root.style.direction = direction;
    try {
      localStorage.setItem('elgogalyia_lang', language);
    } catch {
      // The platform remains usable when browser storage is unavailable.
    }
  }, [language, direction]);

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language];
    if (Object.prototype.hasOwnProperty.call(langDict, key)) {
      return langDict[key];
    }

    const alternateLanguage: Language = language === 'ar' ? 'en' : 'ar';
    const alternateDict = translations[alternateLanguage];
    if (Object.prototype.hasOwnProperty.call(alternateDict, key)) {
      return alternateDict[key];
    }

    return fallback ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        direction,
        isRTL,
        toggleLanguage,
        setLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
