'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function AdminNav() {
  const pathname = usePathname();
  const { locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const linkClass = (path: string, exact?: boolean) => {
    const isActive = exact ? pathname === path : pathname.startsWith(path);
    return `block px-3 py-2 rounded-lg font-medium transition ${
      isActive
        ? 'text-brand-600 bg-brand-50'
        : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
    }`;
  };

  return (
    <nav className="flex items-center gap-1">
      <div className="hidden md:flex items-center gap-1">
        <Link href="/admin" className={linkClass('/admin', true)}>{t('dashboard')}</Link>
        <Link href="/admin/jobs" className={linkClass('/admin/jobs')}>{t('jobs')}</Link>
        <Link href="/admin/users" className={linkClass('/admin/users')}>{t('users')}</Link>
        <Link href="/admin/reports" className={linkClass('/admin/reports')}>{t('reports')}</Link>
        <div className="w-px h-6 bg-slate-200 mx-2" aria-hidden />
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="px-4 py-2 rounded-lg font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition"
        >
          {t('signOut')}
        </button>
      </div>
      <div className="md:hidden relative">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setMobileOpen(false)} />
            <div className="absolute right-0 top-full mt-1 py-2 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-50">
              <div className="flex flex-col gap-0.5 px-2">
                <Link href="/admin" className={linkClass('/admin', true)} onClick={() => setMobileOpen(false)}>{t('dashboard')}</Link>
                <Link href="/admin/jobs" className={linkClass('/admin/jobs')} onClick={() => setMobileOpen(false)}>{t('jobs')}</Link>
                <Link href="/admin/users" className={linkClass('/admin/users')} onClick={() => setMobileOpen(false)}>{t('users')}</Link>
                <Link href="/admin/reports" className={linkClass('/admin/reports')} onClick={() => setMobileOpen(false)}>{t('reports')}</Link>
                <div className="border-t border-slate-100 my-2" />
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="px-4 py-2 rounded-lg font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition text-left"
                >
                  {t('signOut')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
