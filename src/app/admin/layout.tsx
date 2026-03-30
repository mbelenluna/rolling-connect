import { requireRole } from '@/lib/rbac';
import Link from 'next/link';
import Image from 'next/image';
import AdminNav from './AdminNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SystemBanner } from '@/app/components/SystemBanner';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: { children: React.ReactNode }) {
  await requireRole('admin');

  return (
    <div className="min-h-screen bg-slate-50">
      <SystemBanner />
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="h-1 bg-brand-600" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/admin" className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-90 transition">
            <Image src="/rolling-translations-logo.png" alt="Rolling Translations" width={40} height={40} className="rounded-full shrink-0 w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">Rolling Connect</span>
            <span className="text-sm text-slate-500 font-normal hidden sm:inline">— Admin</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <AdminNav />
          </div>
        </div>
      </header>
      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">{children}</main>
    </div>
  );
}
