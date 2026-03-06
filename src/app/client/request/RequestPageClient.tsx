'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { subscribeToRequest } from '@/lib/realtime/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, getTranslatedLanguageName, getTranslatedSpecialtyName, type TranslationKeys } from '@/lib/translations';

export default function RequestPageClient() {
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [step, setStep] = useState<'form' | 'matching' | 'assigned' | 'error' | 'no_match'>('form');
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [specialties, setSpecialties] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<{ approved: boolean; pending: boolean; rejected: boolean } | null>(null);

  const [form, setForm] = useState({
    organizationId: '',
    interpretationType: null as 'human' | 'ai' | null,
    serviceType: 'OPI' as 'OPI' | 'VRI',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    specialty: '',
    industry: '',
    costCenter: '',
    notes: '',
    estimatedDurationMinutes: 15,
    urgency: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    scheduleType: 'now' as 'now' | 'scheduled',
  });

  useEffect(() => {
    fetch('/api/client/approval-status')
      .then((r) => r.json())
      .then(setApprovalStatus)
      .catch(() => setApprovalStatus({ approved: false, pending: true, rejected: false }));
  }, []);

  useEffect(() => {
    fetch('/api/organizations').then((r) => r.json()).then(setOrgs).catch(console.error);
    fetch('/api/languages').then((r) => r.json()).then(setLanguages).catch(console.error);
    fetch('/api/specialties').then((r) => r.json()).then(setSpecialties).catch(console.error);
  }, []);

  useEffect(() => {
    if (orgs.length && !form.organizationId) setForm((f) => ({ ...f, organizationId: orgs[0].id }));
  }, [orgs]);

  // Restore matching state on refresh (URL has ?matching=requestId)
  const matchingRequestId = searchParams.get('matching');
  useEffect(() => {
    if (!matchingRequestId || status !== 'authenticated' || !session?.user) return;
    setStep('matching');

    const timers = { timeout: null as ReturnType<typeof setTimeout> | null, poll: null as ReturnType<typeof setInterval> | null, slowDown: null as ReturnType<typeof setTimeout> | null };
    let unsubAbly: (() => void) | null = null;
    const requestId = matchingRequestId;

    const redirectToCall = () => {
      if (timers.timeout) clearTimeout(timers.timeout);
      if (timers.poll) clearInterval(timers.poll);
      if (timers.slowDown) clearTimeout(timers.slowDown);
      unsubAbly?.();
      router.replace(`/client/call/${requestId}`);
    };

    try {
      unsubAbly = subscribeToRequest(requestId, async () => {
        try {
          const r = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' });
          const req = await r.json();
          if (req?.status === 'assigned' || req?.status === 'in_call') redirectToCall();
        } catch {
          // ignore
        }
      });
    } catch {
      // Ably not configured
    }

    const poll = async () => {
      try {
        const r = await fetch(`/api/requests/${requestId}`, { cache: 'no-store' });
        const req = await r.json();
        if (req?.status === 'assigned' || req?.status === 'in_call') redirectToCall();
        else if (req?.status === 'canceled' || req?.status === 'completed') setStep('no_match');
      } catch {
        // ignore
      }
    };
    poll();
    timers.poll = setInterval(poll, 1000);
    timers.slowDown = setTimeout(() => {
      if (timers.poll) clearInterval(timers.poll);
      timers.poll = setInterval(poll, 2500);
    }, 15000);

    timers.timeout = setTimeout(() => {
      if (timers.slowDown) clearTimeout(timers.slowDown);
      if (timers.poll) clearInterval(timers.poll);
      unsubAbly?.();
      try {
        fetch(`/api/requests/${requestId}/cancel`, { method: 'POST' }).catch(() => {});
      } catch {
        // ignore
      }
      setStep('no_match');
    }, 60 * 1000);

    return () => {
      if (timers.timeout) clearTimeout(timers.timeout);
      if (timers.poll) clearInterval(timers.poll);
      if (timers.slowDown) clearTimeout(timers.slowDown);
      unsubAbly?.();
    };
  }, [matchingRequestId, status, session?.user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = form.organizationId || orgs[0]?.id;
    if (!orgId) {
      setError(t('noOrganizationError'));
      return;
    }
    if (!form.interpretationType) {
      setError(t('selectInterpretationType'));
      return;
    }
    if (form.interpretationType === 'human' && !form.specialty) {
      setError(t('specialtyRequired'));
      return;
    }
    setLoading(true);
    setError('');
    setStep('matching');

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          interpretationType: form.interpretationType,
          organizationId: orgId,
          scheduleType: form.scheduleType,
          specialty: form.interpretationType === 'ai' ? 'other' : form.specialty,
          estimatedDurationMinutes: form.interpretationType === 'ai' ? 15 : form.estimatedDurationMinutes,
          urgency: form.interpretationType === 'ai' ? 'normal' : form.urgency,
          notes: form.interpretationType === 'ai' ? '' : form.notes,
          recordingConsent: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'CLIENT_PENDING_APPROVAL') {
          setApprovalStatus({ approved: false, pending: true, rejected: false });
          setStep('form');
          setLoading(false);
          return;
        }
        throw new Error(data.error || t('failedToCreateRequest'));
      }

      if (data.interpretationType === 'ai' || data.status === 'assigned') {
        router.replace(`/client/call/${data.id}`);
        return;
      }

      if (data.status === 'no_match' || data.interpretersMatched === 0) {
        setStep('error');
        setError(
          'No interpreters available. Open /api/debug/match-status in your browser to see why each interpreter was excluded.'
        );
        return;
      }

      // Stay on matching screen; URL update triggers useEffect for Ably + polling (refresh-safe)
      const userId = (session?.user as { id?: string })?.id;
      const requestId = data.id;
      if (userId) {
        router.replace(`/client/request?matching=${requestId}`);
      } else {
        router.push(`/client/requests?highlight=${data.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  if (approvalStatus && (approvalStatus.pending || approvalStatus.rejected)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('requestInterpreter')}</h1>
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
          <h2 className="font-semibold text-amber-900 mb-2">{t('accountPendingApproval')}</h2>
          <p className="text-amber-800">{t('accountPendingMessage')}</p>
        </div>
        <Link href="/client" className="inline-block mt-6 text-brand-600 hover:underline">{t('backToDashboard')}</Link>
      </div>
    );
  }

  if (step === 'matching') {
    const isAi = form.interpretationType === 'ai';
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="animate-pulse w-16 h-16 rounded-full bg-brand-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          {isAi ? t('loadingAiCall') : t('matchingInterpreters')}
        </h2>
        <p className="text-slate-600">
          {isAi ? t('settingUpCall') : t('interpretersNotified')}
        </p>
        <Link href="/client/requests" className="mt-6 inline-block text-brand-600 hover:underline">{t('viewRequests')}</Link>
      </div>
    );
  }

  if (step === 'no_match') {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4 flex items-center justify-center text-amber-600 text-2xl">!</div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">{t('noInterpreterAvailable')}</h2>
        <p className="text-slate-600 mb-6">
          {t('noInterpreterMessage')}{' '}
          <a href="mailto:info@rolling-translations.com" className="text-brand-600 hover:underline">info@rolling-translations.com</a>
        </p>
        <Link href="/client/request" className="inline-block px-6 py-2 bg-brand-600 text-white rounded-lg">{t('tryAgain')}</Link>
        <span className="mx-2">{t('or')}</span>
        <Link href="/client/requests" className="inline-block text-brand-600 hover:underline">{t('viewRequests')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('requestInterpreter')}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">{t('interpretationType')} *</label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, interpretationType: 'human' }))}
              className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition text-left ${
                form.interpretationType === 'human'
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-semibold text-slate-900">{t('humanInterpreter')}</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, interpretationType: 'ai' }))}
              className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition text-left ${
                form.interpretationType === 'ai'
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-semibold text-slate-900">{t('aiInterpretation')}</span>
            </button>
          </div>
          {form.interpretationType === 'ai' && (
            <p className="text-xs text-slate-500 mt-2">{t('aiInterpretationNote')}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{t('serviceType')}</label>
          <select
            value={form.serviceType}
            onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value as 'OPI' | 'VRI' }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          >
            <option value="OPI">{t('opiAudio')}</option>
            <option value="VRI">{t('vriVideo')}</option>
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('sourceLanguage')}</label>
            <select
              value={form.sourceLanguage}
              onChange={(e) => setForm((f) => ({ ...f, sourceLanguage: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{getTranslatedLanguageName(locale, l.code, l.name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('targetLanguage')}</label>
            <select
              value={form.targetLanguage}
              onChange={(e) => setForm((f) => ({ ...f, targetLanguage: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>{getTranslatedLanguageName(locale, l.code, l.name)}</option>
              ))}
            </select>
          </div>
        </div>

        {form.interpretationType === 'human' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('specialty')} *</label>
              <select
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              >
                <option value="">{t('selectSpecialty')}</option>
                {specialties.map((s) => (
                  <option key={s.code} value={s.code}>{getTranslatedSpecialtyName(locale, s.code, s.name)}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('estimatedDuration')}</label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.estimatedDurationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, estimatedDurationMinutes: parseInt(e.target.value) || 15 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('urgency')}</label>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as typeof form.urgency }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                >
                  <option value="low">{t('low')}</option>
                  <option value="normal">{t('normal')}</option>
                  <option value="high">{t('high')}</option>
                  <option value="urgent">{t('urgent')}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
                placeholder={t('notesPlaceholder')}
              />
            </div>
          </>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50 transition"
        >
          {t('requestInterpreter')}
        </button>
      </form>
    </div>
  );
}
