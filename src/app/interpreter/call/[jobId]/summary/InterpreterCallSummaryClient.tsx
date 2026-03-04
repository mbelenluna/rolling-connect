'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

type CallData = {
  callId: string;
  durationSeconds: number;
  interpreterNotes?: string | null;
};

export default function InterpreterCallSummaryClient() {
  const params = useParams();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const jobId = params.jobId as string;
  const [data, setData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        if (!d.callId) throw new Error('No call');
        setData({
          callId: d.callId,
          durationSeconds: d.durationSeconds ?? 0,
          interpreterNotes: d.interpreterNotes,
        });
        if (d.interpreterNotes) {
          setNotes(d.interpreterNotes);
          setSubmitted(true);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleSubmit = async () => {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/calls/${data.callId}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interpreterNotes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSubmitted(true);
    } catch {
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
        <Link href="/interpreter" className="text-brand-600 hover:underline">{t('backToDashboard')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-8 bg-white rounded-xl border border-slate-200">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('callSummaryTitle')}</h1>

      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-500">{t('duration')}</p>
          <p className="text-xl font-semibold text-slate-900">{formatDuration(data.durationSeconds)}</p>
        </div>

        {!submitted ? (
          <>
            <div>
              <label htmlFor="notes" className="block text-sm text-slate-500 mb-2">{t('notesOptional')}</label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('addNotesPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? t('saving') : t('saveNotes')}
              </button>
            </div>
          </>
        ) : (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            {t('notesSaved')}
          </div>
        )}

        <Link
          href="/interpreter"
          className="inline-block px-6 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
        >
          {t('returnToDashboard')}
        </Link>
      </div>
    </div>
  );
}
