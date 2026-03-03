'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function GoCardlessReturnPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?message=gocardless_return');
      return;
    }
    if (status !== 'authenticated') return;

    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;

    fetch('/api/client/approve-after-gocardless', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setApproved(true);
        else setError(data.error || t('somethingWentWrong'));
      })
      .catch(() => setError(t('somethingWentWrong')));
  }, [status, session, router, t]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">{t('loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto p-8 bg-white rounded-xl border border-slate-200 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/client" className="text-brand-600 hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  if (approved) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto p-8 bg-white rounded-xl border border-slate-200 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('gocardlessCompleteTitle')}</h1>
          <p className="text-slate-600 mb-6">{t('gocardlessCompleteMessage')}</p>
          <Link
            href="/client"
            className="inline-block px-6 py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700"
          >
            {t('startRequesting')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-600">{t('loading')}</div>
    </div>
  );
}
