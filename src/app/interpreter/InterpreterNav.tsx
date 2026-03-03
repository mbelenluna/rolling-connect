'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function InterpreterNav() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const linkClass = (path: string, exact?: boolean) => {
    const isActive = exact ? pathname === path : pathname.startsWith(path);
    return `px-3 py-2 rounded-lg font-medium transition ${
      isActive
        ? 'text-brand-600 bg-brand-50'
        : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
    }`;
  };
  return (
    <nav className="flex items-center gap-1">
      <Link href="/interpreter" className={linkClass('/interpreter', true)}>{t('dashboard')}</Link>
      <Link href="/interpreter/profile" className={linkClass('/interpreter/profile')}>{t('profile')}</Link>
      <Link href="/interpreter/history" className={linkClass('/interpreter/history')}>{t('billing')}</Link>
      <div className="w-px h-6 bg-slate-200 mx-2" aria-hidden />
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="px-4 py-2 rounded-lg font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition"
      >
        {t('signOut')}
      </button>
    </nav>
  );
}
