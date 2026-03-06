import Link from 'next/link';
import Image from 'next/image';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import PricingContent from './PricingContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Transparent Pricing | Rolling Connect',
  description: 'View our interpretation rates for OPI and VRI. Per-minute pricing for human and AI interpretation.',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Connect"
              width={40}
              height={40}
              className="rounded-full shrink-0"
            />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">Rolling Connect</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <div className="flex gap-2 sm:gap-3">
              <Link
                href="/login"
                className="px-3 sm:px-4 py-2 text-slate-700 font-medium hover:text-slate-900 transition text-sm sm:text-base"
              >
                Sign In
              </Link>
              <Link
                href="/login?register=1"
                className="px-3 sm:px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition text-sm sm:text-base"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </header>

      <PricingContent />
    </div>
  );
}
