'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CallRoom from '@/app/components/CallRoom';
import AICallRoom from '@/app/components/AICallRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function ClientCallPage() {
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
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/requests/${requestId}/call-token`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [requestId]);

  if (error) {
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
    />
  );
}
