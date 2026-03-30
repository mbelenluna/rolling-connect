import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">🔍</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page not found</h1>
        <p className="text-slate-600 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition mb-8"
        >
          Go to Home
        </Link>
        <div className="border-t border-slate-100 pt-6 mt-2">
          <p className="text-sm font-semibold text-slate-700 mb-3">Need urgent interpretation support?</p>
          <p className="text-sm text-slate-600 mb-1">
            📞 <a href="tel:+18663196739" className="text-brand-600 hover:underline font-medium">(866) 319-6739</a>
          </p>
          <p className="text-sm text-slate-600">
            ✉️ <a href="mailto:info@rolling-translations.com" className="text-brand-600 hover:underline">info@rolling-translations.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
