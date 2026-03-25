'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CallRoom from '@/app/components/CallRoom';
import AICallRoom from '@/app/components/AICallRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function ClientCallClient() {
  const params = useParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const requestId = params.id as string;
  const [data, setData] = useState<{
    callId?: string;
    dailyUrl: string | null;
    dailyError?: string;
    serviceType: string;
    interpretationType?: 'human' | 'ai';
    sourceLanguage?: string;
    targetLanguage?: string;
    phoneSessionCode?: string | null;
    phoneNumber?: string | null;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/requests/${requestId}/call-token`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok && (d.code === 'BILLING_REAUTH_REQUIRED' || r.status === 402)) {
          setError('BILLING_REAUTH');
          return;
        }
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [requestId]);

  if (error) {
    if (error === 'BILLING_REAUTH') {
      return (
        <div className="max-w-md mx-auto text-center py-16">
          <p className="text-amber-900 font-medium mb-2">{t('billingReauthMessage')}</p>
          <p className="text-slate-600 mb-6">{t('billingReauthDescription')}</p>
          <Link href="/billing/reauthorize" className="inline-block px-6 py-2 bg-brand-600 text-white rounded-lg">{t('billingReauthButton')}</Link>
          <span className="mx-2">{t('or')}</span>
          <Link href="/client/requests" className="text-brand-600 hover:underline">Back to requests</Link>
        </div>
      );
    }
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/client/requests" className="text-brand-600 hover:underline">Back to requests</Link>
      </div>
    );
  }

  if (!data) return <div className="text-slate-600">{t('loadingCall')}</div>;

  const isAI = data.interpretationType === 'ai';

  if (isAI) {
    return (
      <AICallRoom
        tokenUrl={data.dailyUrl}
        serviceType={data.serviceType}
        sourceLanguage={data.sourceLanguage ?? 'en'}
        targetLanguage={data.targetLanguage ?? 'es'}
        backHref="/client/requests"
        backLabel="Back to Requests"
        summaryHref={`/client/call/${requestId}/summary`}
        dailyError={data.dailyError}
        cancelEndpoint={`/api/requests/${requestId}/cancel`}
        endCallEndpoint={data.callId ? `/api/calls/${data.callId}/end` : null}
        inviteLinkEndpoint={data.callId ? `/api/calls/${data.callId}/invite-link` : null}
      />
    );
  }

  return (
    <CallRoom
      tokenUrl={data.dailyUrl}
      serviceType={data.serviceType}
      backHref="/client/requests"
      backLabel="Back to Requests"
      summaryHref={`/client/call/${requestId}/summary`}
      dailyError={data.dailyError}
      cancelEndpoint={`/api/requests/${requestId}/cancel`}
      endCallEndpoint={data.callId ? `/api/calls/${data.callId}/end` : null}
      inviteLinkEndpoint={data.callId ? `/api/calls/${data.callId}/invite-link` : null}
      role="client"
      phoneSessionCode={data.phoneSessionCode}
      phoneNumber={data.phoneNumber}
    />
  );
}
