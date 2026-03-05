'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { LOCALE_NAMES } from '@/lib/translations';

const LOCALE_LABELS: Record<'en' | 'es' | 'zh', string> = {
  en: 'EN',
  es: 'ES',
  zh: '中文',
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as 'en' | 'es' | 'zh')}
      className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 cursor-pointer min-w-0"
      title="Select language"
      aria-label="Select language"
    >
      {(['en', 'es', 'zh'] as const).map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_LABELS[loc]}
        </option>
      ))}
    </select>
  );
}
