'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function CancelButton({ requestId, onCanceled }: { requestId: string; onCanceled: () => void }) {
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
      className="px-6 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-50"
    >
      {loading ? 'Canceling…' : 'Cancel'}
    </button>
  );
}

type Request = {
  id: string;
  status: string;
  serviceType: string;
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  notes?: string;
  estimatedDurationMinutes: number;
  urgency: string;
  createdAt: string;
  jobs: {
    id: string;
    status: string;
    assignedInterpreter?: { name: string };
    call?: { durationSeconds?: number; clientRating?: number | null; clientComments?: string | null };
  }[];
};

export default function RequestDetailClient() {
  const params = useParams();
  const id = params.id as string;
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then((r) => r.json())
      .then(setRequest)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-slate-600">Loading…</div>;
  if (!request) return <div className="text-slate-600">Not found</div>;

  const job = request.jobs?.find((j) => j.call) ?? request.jobs?.[0];
  const canJoin = request.status === 'assigned' || request.status === 'in_call';
  const canCancel = canJoin || request.status === 'offered';

  return (
    <div>
      <Link href="/client/requests" className="text-brand-600 hover:underline mb-4 inline-block">← Back to requests</Link>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Request Details</h1>
        <dl className="space-y-2">
          <div>
            <dt className="text-sm text-slate-500">Status</dt>
            <dd className="font-medium">{request.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Service</dt>
            <dd className="font-medium">{request.serviceType} — {request.sourceLanguage} → {request.targetLanguage}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Specialty</dt>
            <dd className="font-medium">{request.specialty}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Estimated duration</dt>
            <dd className="font-medium">{request.estimatedDurationMinutes} min</dd>
          </div>
          {job?.assignedInterpreter && (
            <div>
              <dt className="text-sm text-slate-500">Interpreter</dt>
              <dd className="font-medium">{job.assignedInterpreter.name}</dd>
            </div>
          )}
          {job?.call?.durationSeconds != null && (
            <div>
              <dt className="text-sm text-slate-500">Call duration</dt>
              <dd className="font-medium">{Math.ceil(job.call.durationSeconds / 60)} min</dd>
            </div>
          )}
          {job?.call?.clientRating != null && (
            <div>
              <dt className="text-sm text-slate-500">Your rating</dt>
              <dd className="font-medium">
                <span className="text-amber-500">{'★'.repeat(job.call.clientRating)}{'☆'.repeat(5 - job.call.clientRating)}</span>
                {' '}{job.call.clientRating}/5
              </dd>
              {job?.call?.clientComments && (
                <dd className="text-slate-600 text-sm mt-1">{job.call.clientComments}</dd>
              )}
            </div>
          )}
          <div>
            <dt className="text-sm text-slate-500">Created</dt>
            <dd className="font-medium">{new Date(request.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-center gap-3">
          {canJoin && (
            <Link
              href={`/client/call/${request.id}`}
              className="px-6 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700"
            >
              Join Call
            </Link>
          )}
          {canCancel && (
            <CancelButton requestId={request.id} onCanceled={() => setRequest((prev) => (prev ? { ...prev, status: 'canceled' } : prev))} />
          )}
        </div>
      </div>
    </div>
  );
}
