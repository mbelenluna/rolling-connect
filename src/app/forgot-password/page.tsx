'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function t(locale: 'en' | 'es' | 'zh', key: TranslationKeys) {
  return getTranslation(locale, key);
}

export default function ForgotPasswordPage() {
  const { locale } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSent(true);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Image
              src="/rolling-translations-logo.png"
              alt="Rolling Translations"
              width={40}
              height={40}
              className="rounded-full"
            />
            <span className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{t(locale, 'siteName')}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <LanguageSwitcher />
            <Link href="/login" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
              {t(locale, 'backToSignIn')}
            </Link>
          </div>
        </div>
      </header>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{t(locale, 'forgotPasswordTitle')}</h1>
            <p className="text-slate-600 text-sm mb-6">{t(locale, 'forgotPasswordSubtitle')}</p>

            {sent ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800">{t(locale, 'forgotPasswordSuccess')}</p>
                <Link href="/login" className="inline-block mt-4 text-brand-600 hover:text-brand-700 font-medium">
                  {t(locale, 'backToSignIn')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                    required
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  {loading ? t(locale, 'pleaseWait') : t(locale, 'sendResetLink')}
                </button>
              </form>
            )}

            <p className="mt-6 text-center text-sm text-slate-600">
              <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
                {t(locale, 'backToSignIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
