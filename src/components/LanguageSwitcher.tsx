'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_NAMES } from '@/lib/translations';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white/80 p-1">
      {(['en', 'es', 'zh'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => setLocale(loc)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            locale === loc
              ? 'bg-brand-600 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={`Switch to ${LOCALE_NAMES[loc]}`}
        >
          {loc === 'en' ? 'EN' : loc === 'es' ? 'ES' : '中文'}
        </button>
      ))}
    </div>
  );
}
