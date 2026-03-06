'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConfirm = async () => {
    if (!token || status === 'loading') return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const res = await fetch('/api/auth/confirm-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.redirectUrl) {
        setStatus('success');
        window.location.href = data.redirectUrl;
        return;
      }
      setStatus('error');
      setErrorMessage(data.error || t('expiredTokenMessage'));
    } catch {
      setStatus('error');
      setErrorMessage(t('somethingWentWrong'));
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
          <p className="text-slate-600 mb-4">{t('expiredTokenMessage')}</p>
          <Link
            href="/verify-email"
            className="inline-block w-full py-3 text-center bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition"
          >
            {t('resendVerificationLink')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/rolling-translations-logo.png"
            alt="Rolling Connect"
            width={64}
            height={64}
            className="rounded-full mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-slate-900">{t('confirmEmailTitle')}</h1>
          <p className="text-slate-600 mt-2">{t('confirmEmailMessage')}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          {status === 'error' && (
            <p className="text-amber-800 font-medium mb-4">{errorMessage}</p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={status === 'loading'}
            className="w-full py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? t('pleaseWait') : t('confirmEmailButton')}
          </button>
          <Link
            href="/login"
            className="block mt-4 text-center text-slate-600 hover:text-slate-800 text-sm"
          >
            {t('backToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
