'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AICallRoom from '@/app/components/AICallRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

/**
 * Public guest join page for AI calls.
 * Invite link format: /join-invite?u=<encoded_daily_url>&callId=<id>
 * Guests see the same translation UI as the host.
 */
function JoinInviteContent() {
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const u = searchParams.get('u');
  const callId = searchParams.get('callId');
  const requestId = searchParams.get('requestId');
  const inviteToken = searchParams.get('inviteToken');

  const [data, setData] = useState<{
    dailyUrl: string | null;
    dailyError?: string;
    serviceType: string;
    sourceLanguage: string;
    targetLanguage: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!u || !callId || !inviteToken) {
      setError('Invalid invite link. Missing parameters.');
      return;
    }

    let dailyUrl: string;
    try {
      dailyUrl = decodeURIComponent(u);
    } catch {
      setError('Invalid invite link.');
      return;
    }
    if (!dailyUrl.startsWith('http')) {
      setError('Invalid invite link.');
      return;
    }

    // Fetch call info for display (source/target language)
    fetch(`/api/calls/${callId}/guest-info`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Call unavailable'); });
        return r.json();
      })
      .then((d) => {
        setData({
          dailyUrl,
          dailyError: d.dailyError,
          serviceType: d.serviceType ?? 'OPI',
          sourceLanguage: d.sourceLanguage ?? 'en',
          targetLanguage: d.targetLanguage ?? 'es',
        });
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Call unavailable');
      });
  }, [u, callId, inviteToken]);

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/" className="text-brand-600 hover:underline">Go home</Link>
      </div>
    );
  }

  if (!data) return <div className="text-slate-600">{t('loading')}</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-slate-900">{t('joinAiCallTitle')}</h1>
          <p className="text-slate-600 text-sm mt-1">{t('inviteToCallSubtitle')}</p>
        </div>
        <AICallRoom
          tokenUrl={data.dailyUrl}
          serviceType={data.serviceType}
          sourceLanguage={data.sourceLanguage}
          targetLanguage={data.targetLanguage}
          backHref="/"
          backLabel="Leave"
          summaryHref={requestId ? `/client/call/${requestId}/summary` : '/'}
          dailyError={data.dailyError}
          cancelEndpoint={null}
          endCallEndpoint={null}
          inviteLinkEndpoint={null}
          inviteToken={inviteToken}
          callId={callId}
        />
      </div>
    </div>
  );
}

function LoadingFallback() {
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">
      {t('loading')}
    </div>
  );
}

export default function JoinInvitePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <JoinInviteContent />
    </Suspense>
  );
}
