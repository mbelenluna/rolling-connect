'use client';

import Link from 'next/link';
import Image from 'next/image';
import ClientNav from './ClientNav';
import ClientSocketListener from './ClientSocketListener';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useEffect, useState } from 'react';

export default function ClientCallLayout({ children }: { children: React.ReactNode }) {
  const [banner, setBanner] = useState('');
  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => setBanner(d.banner ?? '')).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {banner && (
        <div role="alert" aria-live="polite" className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-center text-sm text-amber-800 font-medium">
          <span className="mr-2" aria-hidden="true">⚠️</span>{banner}
        </div>
      )}
      <ClientSocketListener />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="h-1 bg-brand-600" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/client" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition min-w-0">
            <Image src="/rolling-translations-logo.png" alt="Rolling Translations" width={40} height={40} className="rounded-full shrink-0 w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">Rolling Connect</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <ClientNav />
          </div>
        </div>
      </header>
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">{children}</main>
    </div>
  );
}
