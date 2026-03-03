'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

type CallData = {
  callId: string;
  durationSeconds: number;
  interpreterName: string;
  interpretationType?: 'human' | 'ai';
  clientRating?: number | null;
  clientComments?: string | null;
};

export default function ClientCallSummaryPage() {
  const params = useParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const requestId = params.id as string;
  const [data, setData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/requests/${requestId}`)
      .then((r) => r.json())
      .then((req) => {
        if (req.error) throw new Error(req.error);
        const job = req.jobs?.find((j: { call?: unknown }) => j.call) ?? req.jobs?.[0];
        const call = job?.call;
        if (!call) throw new Error('Call not found');
        setData({
          callId: call.id,
          durationSeconds: call.durationSeconds ?? 0,
          interpreterName: job?.assignedInterpreter?.name ?? '—',
          interpretationType: req.interpretationType ?? 'human',
          clientRating: call.clientRating,
          clientComments: call.clientComments,
        });
        if (call.clientRating) {
          setRating(call.clientRating);
          setSubmitted(true);
        }
        if (call.clientComments) setComments(call.clientComments);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [requestId]);

  const handleSubmit = async () => {
    if (!data || rating < 1) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/calls/${data.callId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comments: comments.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failedToSubmit'));
      setSubmitting(false);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="text-slate-600">{t('loading')}</div>;
  if (!data) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-red-600 mb-4">{t('couldNotLoadSummary')}</p>
        <Link href="/client/requests" className="text-brand-600 hover:underline">{t('backToRequests')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('callSummaryTitle')}</h1>

      <div className="space-y-6">
        {submitted ? (
          <>
            <p className="text-slate-700 font-medium">{t('feedbackSaved')}</p>
            <Link
              href="/client"
              className="inline-block px-6 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
            >
              {t('returnToDashboard')}
            </Link>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm text-slate-500">{t('duration')}</p>
              <p className="text-xl font-semibold text-slate-900">{formatDuration(data.durationSeconds)}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">{t('interpreter')}</p>
              <p className="font-medium text-slate-900">{data.interpreterName}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-2">
                {data.interpretationType === 'ai' ? t('rateAiTranslationLabel') : t('rateInterpreterLabel')}
              </p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`w-10 h-10 rounded-lg text-xl transition-colors ${
                      rating >= n ? 'bg-amber-400 text-amber-900' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="comments" className="block text-sm text-slate-500 mb-2">{t('commentsOptional')}</label>
              <textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={t('shareExperiencePlaceholder')}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting || rating < 1}
                className="px-6 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t('submitting') : t('submitFeedback')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
