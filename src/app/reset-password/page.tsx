'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function t(locale: 'en' | 'es' | 'zh', key: TranslationKeys) {
  return getTranslation(locale, key);
}

function ResetPasswordContent() {
  const { locale } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) setError(t(locale, 'invalidOrExpiredToken'));
  }, [token, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t(locale, 'passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t(locale, 'passwordTooWeak'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(true);
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
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{t(locale, 'resetPasswordTitle')}</h1>
            <p className="text-slate-600 text-sm mb-6">{t(locale, 'resetPasswordSubtitle')}</p>

            {success ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800">{t(locale, 'resetPasswordSuccess')}</p>
                <Link href="/login" className="inline-block mt-4 px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700">
                  {t(locale, 'signIn')}
                </Link>
              </div>
            ) : !token ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800">{t(locale, 'invalidOrExpiredToken')}</p>
                <Link href="/forgot-password" className="inline-block mt-4 text-brand-600 hover:text-brand-700 font-medium">
                  {t(locale, 'requestNewLink')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'newPassword')}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                    required
                    minLength={8}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">{t(locale, 'passwordRequirements')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t(locale, 'confirmPassword')}</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                    required
                    minLength={8}
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
                >
                  {loading ? t(locale, 'pleaseWait') : t(locale, 'resetPasswordButton')}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
