'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import CallRoom from '@/app/components/CallRoom';
import TwilioCallRoom from '@/app/components/TwilioCallRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

export default function InterpreterCallClient() {
  const params = useParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const jobId = params.jobId as string;
  const [data, setData] = useState<{
    callId?: string;
    dailyUrl: string | null;
    dailyError?: string;
    serviceType: string;
    isPhoneOriginated?: boolean;
    twilioToken?: string;
    conferenceName?: string;
  } | null>(null);
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

  if (data.isPhoneOriginated && data.twilioToken && data.conferenceName && data.callId) {
    return (
      <TwilioCallRoom
        twilioToken={data.twilioToken}
        conferenceName={data.conferenceName}
        callId={data.callId}
        backHref="/interpreter"
        backLabel="Back to Dashboard"
        summaryHref={`/interpreter/call/${jobId}/summary`}
        leaveEndpoint={`/api/calls/${data.callId}/leave`}
        endForEveryoneEndpoint={`/api/calls/${data.callId}/end-for-everyone`}
      />
    );
  }

  return (
    <CallRoom
      tokenUrl={data.dailyUrl}
      serviceType={data.serviceType}
      backHref="/interpreter"
      backLabel="Back to Dashboard"
      summaryHref={`/interpreter/call/${jobId}/summary`}
      dailyError={data.dailyError}
      cancelEndpoint={`/api/jobs/${jobId}/cancel`}
      leaveEndpoint={data.callId ? `/api/calls/${data.callId}/leave` : null}
      endForEveryoneEndpoint={data.callId ? `/api/calls/${data.callId}/end-for-everyone` : null}
      inviteLinkEndpoint={data.callId ? `/api/calls/${data.callId}/invite-link` : null}
      role="interpreter"
    />
  );
}
