'use client';

import Link from 'next/link';
import Image from 'next/image';
import ClientNav from './ClientNav';
import ClientSocketListener from './ClientSocketListener';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ClientCallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <ClientSocketListener />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="h-1 bg-brand-600" />
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/client" className="flex items-center gap-3 hover:opacity-90 transition">
            <Image src="/rolling-translations-logo.png" alt="Rolling Translations" width={40} height={40} className="rounded-full" />
            <span className="text-xl font-semibold text-slate-900">Rolling Connect</span>
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <ClientNav />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
