'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/lib/translations';

const STORAGE_KEY = 'rolling-connect-locale';

function detectSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('zh')) return 'zh';
  return 'en';
}

function loadStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es' || stored === 'zh') return stored;
  } catch {}
  return null;
}

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = loadStoredLocale();
    const initial = stored ?? detectSystemLocale();
    setLocaleState(initial);
    if (!stored) {
      try {
        localStorage.setItem(STORAGE_KEY, initial);
      } catch {}
    }
  }, []);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      if (typeof document !== 'undefined') document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
    } catch {}
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale === 'zh' ? 'zh-CN' : locale;
    }
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
