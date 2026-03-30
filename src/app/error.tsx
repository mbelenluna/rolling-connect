'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">⚠️</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
        <p className="text-slate-600 mb-6">
          An unexpected error occurred. Your session data is safe. Please try again or contact support if the problem persists.
        </p>
        <div className="flex gap-3 justify-center mb-8">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 transition"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition"
          >
            Go to Home
          </Link>
        </div>
        <div className="border-t border-slate-100 pt-6">
          <p className="text-sm font-semibold text-slate-700 mb-3">Need immediate interpretation support?</p>
          <p className="text-sm text-slate-600 mb-1">
            📞 <a href="tel:+18663196739" className="text-brand-600 hover:underline font-medium">(866) 319-6739</a>
          </p>
          <p className="text-sm text-slate-600">
            ✉️ <a href="mailto:info@rolling-translations.com" className="text-brand-600 hover:underline">info@rolling-translations.com</a>
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 mt-3">Error ID: {error.digest}</p>
          )}
        </div>
      </div>
    </div>
  );
}
