import { requireBilling } from '@/lib/rbac';
import Link from 'next/link';
import Image from 'next/image';
import InterpreterNav from './InterpreterNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const dynamic = 'force-dynamic';

export default async function InterpreterLayout({
  children,
}: { children: React.ReactNode }) {
  await requireBilling('interpreter');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="h-1 bg-brand-600" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/interpreter" className="flex items-center gap-2 sm:gap-3 hover:opacity-90 transition min-w-0">
            <Image src="/rolling-translations-logo.png" alt="Rolling Translations" width={40} height={40} className="rounded-full shrink-0 w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">Rolling Connect</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <InterpreterNav />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">{children}</main>
    </div>
  );
}
