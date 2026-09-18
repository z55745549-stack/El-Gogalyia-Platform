import React, { createContext, useContext, useEffect } from 'react';
import { translations } from './translations';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

interface LanguageContextType {
  language: Language;
  direction: Direction;
  isRTL: boolean;
  toggleLanguage: () => void;
  setLanguage: (lang: any) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', 'rtl');
    root.setAttribute('lang', 'ar');
    root.style.direction = 'rtl';
    try {
      localStorage.setItem('elgogalyia_lang', 'ar');
    } catch {}
  }, []);

  const toggleLanguage = () => {};
  const setLanguage = () => {};

  const t = (key: string, fallback?: string): string => {
    const dict = translations.ar;
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      return dict[key];
    }
    if (fallback !== undefined && fallback !== null && fallback !== '') {
      return fallback;
    }
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language: 'ar',
        direction: 'rtl',
        isRTL: true,
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
