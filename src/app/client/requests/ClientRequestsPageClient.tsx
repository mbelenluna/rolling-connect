'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation, type TranslationKeys } from '@/lib/translations';

type Request = {
  id: string;
  status: string;
  serviceType: string;
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  createdAt: string;
  jobs: { id: string; status: string; assignedInterpreter?: { name: string } }[];
};

function CancelButton({ requestId, onCanceled, t }: { requestId: string; onCanceled: () => void; t: (k: TranslationKeys) => string }) {
  const [loading, setLoading] = useState(false);
  const handleCancel = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/cancel`, { method: 'POST' });
      if (res.ok) onCanceled();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={loading}
      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? t('canceling') : t('cancel')}
    </button>
  );
}

function ClientRequestsContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const { locale } = useLanguage();
  const t = (k: TranslationKeys) => getTranslation(locale, k);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');

  useEffect(() => {
    const load = () =>
      fetch('/api/requests')
        .then((r) => r.json())
        .then(setRequests)
        .catch(console.error)
        .finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  // Real-time: when interpreter accepts, auto-redirect client to call
  useEffect(() => {
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) return;
    const socket = io({ path: '/api/socketio' });
    socket.emit('auth', { userId, role: 'client' });
    socket.on('request_status', (payload: { status: string; requestId?: string }) => {
      if (payload.status === 'assigned' && payload.requestId) {
        router.replace(`/client/call/${payload.requestId}`);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [session?.user, router]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: t('pending'),
      matching: t('matching'),
      offered: t('offered'),
      assigned: t('assigned'),
      in_call: t('inCall'),
      completed: t('completed'),
      canceled: t('canceled'),
    };
    return map[s] || s;
  };

  if (loading) return <div className="text-slate-600">{t('loading')}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t('requests')}</h1>
        <Link href="/client/request" className="px-4 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700">
          {t('newRequest')}
        </Link>
      </div>

      <div className="space-y-4">
        {requests.length === 0 ? (
          <p className="text-slate-500">{t('noRequestsYet')}</p>
        ) : (
          requests.map((r) => {
            const job = r.jobs?.[0];
            const interpreter = job?.assignedInterpreter?.name;
            const canJoin = r.status === 'assigned' || r.status === 'in_call';
            const canCancel = canJoin || r.status === 'offered';
            return (
              <div
                key={r.id}
                className={`p-4 bg-white rounded-xl border ${
                  highlightId === r.id ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {r.serviceType} — {r.sourceLanguage} → {r.targetLanguage} ({r.specialty})
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {statusLabel(r.status)}
                      {interpreter && ` • ${interpreter}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canJoin && (
                      <Link
                        href={`/client/call/${r.id}`}
                        className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700"
                      >
                        {t('joinCall')}
                      </Link>
                    )}
                    {canCancel && (
                      <CancelButton
                        requestId={r.id}
                        t={t}
                        onCanceled={() => setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'canceled' } : x)))}
                      />
                    )}
                    <Link href={`/client/requests/${r.id}`} className="text-brand-600 hover:underline text-sm">
                      {t('details')}
                    </Link>
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

export default function ClientRequestsPageClient() {
  return (
    <Suspense fallback={<div className="text-slate-600">Loading...</div>}>
      <ClientRequestsContent />
    </Suspense>
  );
}
