import Link from 'next/link';
import Image from 'next/image';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/rolling-translations-logo.png" alt="Rolling Translations" width={36} height={36} className="rounded-full" />
            <span className="text-xl font-semibold text-slate-900">Rolling Connect</span>
          </Link>
        </div>
      </header>
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">You don't have permission to view this page.</p>
          <Link href="/" className="inline-block px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
