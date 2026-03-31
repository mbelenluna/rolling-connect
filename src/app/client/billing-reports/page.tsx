'use client';

import { useState, useEffect, useCallback } from 'react';

type Call = {
  durationSeconds?: number;
  billableDurationSeconds?: number;
  startedAt?: string | null;
  endedAt?: string | null;
};

type Job = {
  assignedInterpreter?: { name: string };
  call?: Call;
};

type Request = {
  id: string;
  serviceType: string;
  sourceLanguage: string;
  targetLanguage: string;
  specialty: string;
  costCenter?: string;
  createdAt: string;
  jobs: Job[];
};

function formatDuration(secs?: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function BillingReportsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    fetch(`/api/client/org-reports?${params}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load');
        setRequests(data.requests ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalBillable = requests.reduce((sum, r) => {
    const call = r.jobs.find((j) => j.call)?.call;
    return sum + (call?.billableDurationSeconds ?? call?.durationSeconds ?? 0);
  }, 0);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Billing Reports</h1>
      <p className="text-slate-600 mb-6 text-sm">View all completed interpretation sessions and usage for your organization.</p>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="pt-5">
          <button
            onClick={fetchData}
            className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
          >
            Apply
          </button>
        </div>
        {(startDate || endDate) && (
          <div className="pt-5">
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500">Total Sessions</p>
          <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-xs text-slate-500">Total Billable Time</p>
          <p className="text-2xl font-bold text-slate-900">{formatDuration(totalBillable)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : requests.length === 0 ? (
        <p className="text-slate-500">No completed sessions found for this period.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Service</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Language Pair</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Specialty</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cost Center</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Interpreter</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => {
                  const job = r.jobs.find((j) => j.call) ?? r.jobs[0];
                  const call = job?.call;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.serviceType}</td>
                      <td className="px-4 py-3 text-slate-700">{r.sourceLanguage} → {r.targetLanguage}</td>
                      <td className="px-4 py-3 text-slate-700">{r.specialty}</td>
                      <td className="px-4 py-3 text-slate-500">{r.costCenter || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{job?.assignedInterpreter?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDuration(call?.billableDurationSeconds ?? call?.durationSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
