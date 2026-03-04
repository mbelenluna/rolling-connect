'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const email = searchParams.get('email') || '';
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');

  const handleResend = async () => {
    if (resendStatus === 'loading') return;
    setResendStatus('loading');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: email ? JSON.stringify({ email }) : '{}',
      });
      setResendStatus(res.ok ? 'sent' : 'error');
    } catch {
      setResendStatus('error');
    }
  };

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
          <h1 className="text-2xl font-bold text-slate-900">{t('verifyEmailTitle')}</h1>
          <p className="text-slate-600 mt-2">{t('verifyEmailSubtitle')}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-slate-600 mb-4">{t('verifyEmailMessage')}</p>
          {email && (
            <p className="text-slate-700 font-medium mb-4 break-all">{email}</p>
          )}
          <p className="text-sm text-slate-500 mb-4">{t('verifyEmailCheckSpam')}</p>
          <p className="mb-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendStatus === 'loading'}
              className="text-brand-600 hover:text-brand-700 font-medium text-sm disabled:opacity-50"
            >
              {resendStatus === 'loading' ? '…' : t('resendVerificationEmail')}
            </button>
            {resendStatus === 'sent' && (
              <span className="ml-2 text-sm text-green-600">{t('resendVerificationSent')}</span>
            )}
            {resendStatus === 'error' && (
              <span className="ml-2 text-sm text-red-600">{t('resendVerificationError')}</span>
            )}
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 text-center bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition"
          >
            {t('backToSignIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
