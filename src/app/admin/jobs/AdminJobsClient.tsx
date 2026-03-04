'use client';

import { useState, useEffect } from 'react';

type Job = {
  id: string;
  status: string;
  createdAt: string;
  request: { sourceLanguage: string; targetLanguage: string; specialty: string; serviceType: string };
  assignedInterpreter?: { name: string };
};

export default function AdminJobsClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/jobs')
      .then((r) => r.json())
      .then(setJobs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: 'Pending',
      offered: 'Offered',
      assigned: 'Assigned',
      in_call: 'In Call',
      completed: 'Completed',
      expired: 'Expired',
      canceled: 'Canceled',
    };
    return map[s] || s;
  };

  if (loading) return <div className="text-slate-600">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Jobs</h1>
      <div className="space-y-4">
        {jobs.length === 0 ? (
          <p className="text-slate-500">No jobs.</p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="p-4 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {j.request.serviceType} — {j.request.sourceLanguage} → {j.request.targetLanguage} ({j.request.specialty})
                  </p>
                  <p className="text-sm text-slate-500">
                    {statusLabel(j.status)} • {j.assignedInterpreter?.name ?? '—'} • {new Date(j.createdAt).toLocaleString()}
                  </p>
                </div>
                {(j.status === 'assigned' || j.status === 'in_call') && (
                  <button
                    onClick={async () => {
                      if (!confirm('Cancel this job? The interpreter will be freed.')) return;
                      await fetch(`/api/admin/jobs/${j.id}/cancel`, { method: 'POST' });
                      setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: 'canceled' } : x)));
                    }}
                    className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
