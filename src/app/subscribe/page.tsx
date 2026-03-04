'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const err = searchParams.get('error');
  useEffect(() => {
    if (err === 'missing_flow_id') setError(t('billingErrorMissingFlow'));
    else if (err === 'invalid_flow') setError(t('billingErrorInvalidFlow'));
    else if (err === 'confirm_failed') setError(t('billingErrorConfirmFailed'));
  }, [err, t]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?callbackUrl=/subscribe');
      return;
    }
  }, [status, router]);

  const handleStartBilling = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/start', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('somethingWentWrong'));
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      throw new Error(t('somethingWentWrong'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('somethingWentWrong'));
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t('loading')}</div>
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
          <h1 className="text-2xl font-bold text-slate-900">{t('billingSetupTitle')}</h1>
          <p className="text-slate-600 mt-2">{t('billingSetupSubtitle')}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <p className="text-slate-600 mb-6">{t('billingSetupDescription')}</p>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <button
            onClick={handleStartBilling}
            disabled={loading}
            className="w-full py-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition"
          >
            {loading ? t('pleaseWait') : t('billingSetupButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
