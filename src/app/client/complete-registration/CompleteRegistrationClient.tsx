'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

const GOCARDLESS_URL = 'https://pay.gocardless.com/BRT0002QRVBRXRG';

export default function CompleteRegistrationClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);

  const [step, setStep] = useState<'question' | 'contract_form' | 'pending' | 'redirecting'>('question');
  const [contractDetails, setContractDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'client') {
      router.replace('/');
      return;
    }
  }, [status, session, router]);

  const handleHasContract = () => setStep('contract_form');
  const handleNoContract = async () => {
    setStep('redirecting');
    setLoading(true);
    try {
      await fetch('/api/client/set-registration-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'gocardless' }),
      });
      window.location.href = GOCARDLESS_URL;
    } catch {
      setError(t('somethingWentWrong'));
      setStep('question');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractDetails.trim()) {
      setError(t('contractDetailsRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/client/submit-contract-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractDetails: contractDetails.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setStep('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && (session?.user as { role?: string })?.role !== 'client')) {
    return <div className="text-slate-600">{t('loading')}</div>;
  }

  if (step === 'pending') {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('accountPendingApproval')}</h1>
        <p className="text-slate-600 mb-6">{t('contractSubmittedMessage')}</p>
        <Link
          href="/client"
          className="inline-block px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700"
        >
          {t('backToDashboard')}
        </Link>
      </div>
    );
  }

  if (step === 'redirecting') {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200 text-center">
        <div className="animate-pulse w-12 h-12 rounded-full bg-brand-200 mx-auto mb-4" />
        <p className="text-slate-600">{t('redirectingToGoCardless')}</p>
        <p className="text-sm text-slate-500 mt-2">{t('redirectingGoCardlessNote')}</p>
      </div>
    );
  }

  if (step === 'contract_form') {
    return (
      <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('contractDetailsTitle')}</h1>
        <p className="text-slate-600 mb-6">{t('contractDetailsSubtitle')}</p>
        <form onSubmit={handleSubmitContract} className="space-y-4">
          <div>
            <label htmlFor="contractDetails" className="block text-sm font-medium text-slate-700 mb-1">
              {t('contractDetailsLabel')}
            </label>
            <textarea
              id="contractDetails"
              value={contractDetails}
              onChange={(e) => setContractDetails(e.target.value)}
              rows={4}
              placeholder={t('contractDetailsPlaceholder')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? t('pleaseWait') : t('submit')}
            </button>
            <button
              type="button"
              onClick={() => setStep('question')}
              className="px-6 py-2 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('emailConfirmedTitle')}</h1>
      <p className="text-slate-600 mb-6">{t('contractQuestion')}</p>

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleHasContract}
          className="w-full p-4 text-left border border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/50 transition font-medium text-slate-900"
        >
          {t('contractOptionYes')}
        </button>
        <button
          type="button"
          onClick={handleNoContract}
          disabled={loading}
          className="w-full p-4 text-left border border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/50 transition font-medium text-slate-900 disabled:opacity-50"
        >
          {t('contractOptionNo')}
        </button>
      </div>

      {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
    </div>
  );
}
