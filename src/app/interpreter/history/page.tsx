'use client';

import { useState, useEffect } from 'react';
import { interpreterPayCents, formatCents } from '@/lib/billing';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

type Job = {
  id: string;
  requestId: string;
  request: {
    sourceLanguage: string;
    targetLanguage: string;
    serviceType: string;
    specialty: string;
    createdAt: string;
  };
  call: { durationSeconds?: number } | null;
};

export default function InterpreterHistoryPage() {
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/interpreter/history')
      .then((r) => r.json())
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-600">Loading…</div>;

  const totalPay = jobs.reduce((sum, j) => {
    const d = j.call?.durationSeconds ?? 0;
    return sum + (d ? interpreterPayCents(d, j.request.targetLanguage) : 0);
  }, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">{t('billingPageTitle')}</h1>
      <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200">
        <p className="text-sm text-slate-500">Total earnings</p>
        <p className="text-2xl font-bold text-slate-900">{formatCents(totalPay)}</p>
      </div>
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <p className="text-slate-500">No completed calls yet.</p>
        ) : (
          jobs.map((j) => {
            const duration = j.call?.durationSeconds ?? 0;
            const mins = duration ? Math.ceil(duration / 60) : 0;
            const pay = duration ? interpreterPayCents(duration, j.request.targetLanguage) : 0;
            return (
              <div key={j.id} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {j.request.serviceType} — {j.request.sourceLanguage} → {j.request.targetLanguage} ({j.request.specialty})
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {mins} min • {new Date(j.request.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{formatCents(pay)}</p>
                    <p className="text-xs text-slate-500">Earnings</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
