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
    phoneSessionCode?: string | null;
    phoneNumber?: string | null;
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
    const isCallEnded = error.includes('call has ended') || error.includes('no longer active');
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className={isCallEnded ? 'text-slate-700 mb-4' : 'text-red-600 mb-4'}>{error}</p>
        <div className="flex gap-4 justify-center">
          <a href={`/interpreter/call/${jobId}/summary`} className="text-brand-600 hover:underline">
            View session summary
          </a>
          <a href="/interpreter" className="text-brand-600 hover:underline">Back to dashboard</a>
        </div>
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
        phoneSessionCode={data.phoneSessionCode}
        phoneNumber={data.phoneNumber}
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
      phoneSessionCode={data.phoneSessionCode}
      phoneNumber={data.phoneNumber}
    />
  );
}
