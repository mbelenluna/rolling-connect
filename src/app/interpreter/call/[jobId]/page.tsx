'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CallRoom from '@/app/components/CallRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function InterpreterCallPage() {
  const params = useParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const jobId = params.jobId as string;
  const [data, setData] = useState<{ callId?: string; dailyUrl: string | null; dailyError?: string; serviceType: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/jobs/${jobId}/call-token`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [jobId]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <a href="/interpreter" className="text-brand-600 hover:underline">Back to dashboard</a>
      </div>
    );
  }

  if (!data) return <div className="text-slate-600">{t('loadingCall')}</div>;

  return (
    <CallRoom
      tokenUrl={data.dailyUrl}
      serviceType={data.serviceType}
      backHref="/interpreter"
      backLabel="Back to Dashboard"
      summaryHref={`/interpreter/call/${jobId}/summary`}
      dailyError={data.dailyError}
      cancelEndpoint={`/api/jobs/${jobId}/cancel`}
      endCallEndpoint={data.callId ? `/api/calls/${data.callId}/end` : null}
      inviteLinkEndpoint={data.callId ? `/api/calls/${data.callId}/invite-link` : null}
      role="interpreter"
    />
  );
}
