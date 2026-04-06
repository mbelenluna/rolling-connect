'use client';

import { useState, useEffect, useCallback } from 'react';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  languagePairs?: { source: string; target: string }[];
  specialties?: string[];
  opiRateCents?: number | null;
  vriRateCents?: number | null;
};

type RateEdit = { opiRaw: string; vriRaw: string; saving: boolean; error: string };

type Filter = 'all' | 'clients' | 'interpreters';

function formatLanguagePairs(pairs: { source: string; target: string }[]): string {
  if (!pairs?.length) return '—';
  return pairs.map((p) => `${p.source}→${p.target}`).join(', ');
}

function formatSpecialties(specialties: string[]): string {
  if (!specialties?.length) return '—';
  return specialties.map((s) => s.replace(/_/g, ' ')).join(', ');
}

export default function AdminUsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(() => {
    setError('');
    fetch('/api/admin/users')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to load users');
        return Array.isArray(data) ? data : [];
      })
      .then((data) => {
        setUsers(data);
      })
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load users');
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rate editing state keyed by interpreter userId
  const [rateEdits, setRateEdits] = useState<Record<string, RateEdit>>({});

  const openRateEdit = (u: User) => {
    setRateEdits((prev) => ({
      ...prev,
      [u.id]: {
        opiRaw: u.opiRateCents != null ? (u.opiRateCents / 100).toFixed(2) : '',
        vriRaw: u.vriRateCents != null ? (u.vriRateCents / 100).toFixed(2) : '',
        saving: false,
        error: '',
      },
    }));
  };

  const closeRateEdit = (id: string) => {
    setRateEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveRates = async (id: string) => {
    const edit = rateEdits[id];
    if (!edit) return;

    const parseCents = (raw: string): number | null => {
      if (raw.trim() === '') return null;
      const n = parseFloat(raw);
      if (isNaN(n) || n < 0) return NaN;
      return Math.round(n * 100);
    };

    const opiRateCents = parseCents(edit.opiRaw);
    const vriRateCents = parseCents(edit.vriRaw);

    if (isNaN(opiRateCents as number) || isNaN(vriRateCents as number)) {
      setRateEdits((prev) => ({ ...prev, [id]: { ...prev[id], error: 'Enter a valid amount (e.g. 1.50) or leave blank to clear.' } }));
      return;
    }

    setRateEdits((prev) => ({ ...prev, [id]: { ...prev[id], saving: true, error: '' } }));
    try {
      const res = await fetch(`/api/admin/interpreters/${id}/rates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ opiRateCents, vriRateCents }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save rates');
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, opiRateCents: data.opiRateCents, vriRateCents: data.vriRateCents } : u
        )
      );
      closeRateEdit(id);
    } catch (err) {
      setRateEdits((prev) => ({ ...prev, [id]: { ...prev[id], saving: false, error: err instanceof Error ? err.message : 'Failed to save' } }));
    }
  };

  const clients = users.filter((u) => u.role === 'client');
  const interpreters = users.filter((u) => u.role === 'interpreter');
  const admins = users.filter((u) => u.role === 'admin');

  const handleApprove = async (id: string, role: string) => {
    setError('');
    setActionLoading(id);
    const path = role === 'client' ? 'clients' : 'interpreters';
    try {
      const res = await fetch(`/api/admin/${path}/${id}/approve`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to approve (${res.status})`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, approvedAt: new Date().toISOString(), rejectedAt: null } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, role: string) => {
    setError('');
    setActionLoading(id);
    const path = role === 'client' ? 'clients' : 'interpreters';
    try {
      const res = await fetch(`/api/admin/${path}/${id}/reject`, { method: 'POST', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Failed to reject (${res.status})`);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, rejectedAt: new Date().toISOString(), approvedAt: null } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id: string, name: string) => {
    if (!confirm(`Remove user "${name}"? Their account will be permanently deleted and they will need to re-register to use the system again.`)) return;
    setError('');
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove user');
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setActionLoading(null);
    }
  };

  const renderClientRow = (u: User) => {
    const approved = u.approvedAt != null;
    const rejected = u.rejectedAt != null;
    const pending = !approved && !rejected;
    const status = approved ? 'Approved' : rejected ? 'Rejected' : 'Pending';
    return (
      <tr key={u.id} className="border-b border-slate-100">
        <td className="p-4">{u.name}</td>
        <td className="p-4">{u.email}</td>
        <td className="p-4">
          <span className={`text-sm font-medium ${approved ? 'text-green-600' : rejected ? 'text-red-600' : 'text-amber-600'}`}>{status}</span>
        </td>
        <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
        <td className="p-4">
          {pending && (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(u.id, u.role)}
                disabled={actionLoading === u.id}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading === u.id ? '…' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(u.id, u.role)}
                disabled={actionLoading === u.id}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {actionLoading === u.id ? '…' : 'Reject'}
              </button>
            </div>
          )}
        </td>
        <td className="p-4">
          <button
            onClick={() => handleRemove(u.id, u.name)}
            disabled={actionLoading === u.id}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title="Remove user"
            aria-label={`Remove ${u.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </td>
      </tr>
    );
  };

  const formatRate = (cents: number | null | undefined) =>
    cents != null ? `$${(cents / 100).toFixed(2)}/min` : '—';

  const renderInterpreterRow = (u: User) => {
    const approved = u.approvedAt != null;
    const rejected = u.rejectedAt != null;
    const pending = !approved && !rejected;
    const status = approved ? 'Approved' : rejected ? 'Rejected' : 'Pending';
    const edit = rateEdits[u.id];
    return (
      <tr key={u.id} className="border-b border-slate-100">
        <td className="p-4">{u.name}</td>
        <td className="p-4">{u.email}</td>
        <td className="p-4 text-slate-600 text-sm max-w-[200px]">{formatLanguagePairs(u.languagePairs ?? [])}</td>
        <td className="p-4 text-slate-600 text-sm max-w-[150px]">{formatSpecialties(u.specialties ?? [])}</td>
        <td className="p-4">
          {edit ? (
            <div className="flex flex-col gap-1.5 min-w-[180px]">
              <label className="text-xs text-slate-500 font-medium">OPI rate ($/min)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 1.50"
                value={edit.opiRaw}
                onChange={(e) => setRateEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], opiRaw: e.target.value } }))}
                className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              />
              <label className="text-xs text-slate-500 font-medium">VRI rate ($/min)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 2.00"
                value={edit.vriRaw}
                onChange={(e) => setRateEdits((prev) => ({ ...prev, [u.id]: { ...prev[u.id], vriRaw: e.target.value } }))}
                className="w-full px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              />
              {edit.error && <p className="text-xs text-red-600">{edit.error}</p>}
              <div className="flex gap-2 mt-0.5">
                <button
                  onClick={() => saveRates(u.id)}
                  disabled={edit.saving}
                  className="flex-1 px-2 py-1 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {edit.saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => closeRateEdit(u.id)}
                  disabled={edit.saving}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-slate-700">OPI: <span className="font-medium">{formatRate(u.opiRateCents)}</span></span>
              <span className="text-sm text-slate-700">VRI: <span className="font-medium">{formatRate(u.vriRateCents)}</span></span>
              <button
                onClick={() => openRateEdit(u)}
                className="mt-1 text-xs text-brand-600 hover:text-brand-700 hover:underline text-left"
              >
                Edit rates
              </button>
            </div>
          )}
        </td>
        <td className="p-4">
          <span className={`text-sm font-medium ${approved ? 'text-green-600' : rejected ? 'text-red-600' : 'text-amber-600'}`}>{status}</span>
        </td>
        <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
        <td className="p-4">
          {pending && (
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(u.id, u.role)}
                disabled={actionLoading === u.id}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading === u.id ? '…' : 'Approve'}
              </button>
              <button
                onClick={() => handleReject(u.id, u.role)}
                disabled={actionLoading === u.id}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                {actionLoading === u.id ? '…' : 'Reject'}
              </button>
            </div>
          )}
        </td>
        <td className="p-4">
          <button
            onClick={() => handleRemove(u.id, u.name)}
            disabled={actionLoading === u.id}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title="Remove user"
            aria-label={`Remove ${u.name}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </td>
      </tr>
    );
  };

  if (loading) return <div className="text-slate-600">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Users</h1>
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-4 flex items-center justify-between gap-4">
          <span>{error}</span>
          <div className="flex gap-2">
            {users.length === 0 && (
              <button onClick={fetchUsers} className="px-3 py-1.5 bg-red-100 rounded-lg hover:bg-red-200 font-medium">
                Retry
              </button>
            )}
            <button onClick={() => setError('')} className="text-red-600 hover:underline">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('clients')}
          className={`px-4 py-2 rounded-lg font-medium ${filter === 'clients' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Clients ({clients.length})
        </button>
        <button
          onClick={() => setFilter('interpreters')}
          className={`px-4 py-2 rounded-lg font-medium ${filter === 'interpreters' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
        >
          Interpreters ({interpreters.length})
        </button>
      </div>

      {(filter === 'all' || filter === 'clients') && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Clients</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 font-medium text-slate-900">Name</th>
                  <th className="text-left p-4 font-medium text-slate-900">Email</th>
                  <th className="text-left p-4 font-medium text-slate-900">Status</th>
                  <th className="text-left p-4 font-medium text-slate-900">Created</th>
                  <th className="text-left p-4 font-medium text-slate-900">Actions</th>
                  <th className="text-left p-4 font-medium text-slate-900 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {clients.map(renderClientRow)}
              </tbody>
            </table>
          </div>
          {clients.length === 0 && <p className="text-slate-500 py-4">No clients found.</p>}
        </section>
      )}

      {(filter === 'all' || filter === 'interpreters') && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Interpreters</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 font-medium text-slate-900">Name</th>
                  <th className="text-left p-4 font-medium text-slate-900">Email</th>
                  <th className="text-left p-4 font-medium text-slate-900">Language Pairs</th>
                  <th className="text-left p-4 font-medium text-slate-900">Specialties</th>
                  <th className="text-left p-4 font-medium text-slate-900">Rates</th>
                  <th className="text-left p-4 font-medium text-slate-900">Status</th>
                  <th className="text-left p-4 font-medium text-slate-900">Created</th>
                  <th className="text-left p-4 font-medium text-slate-900">Actions</th>
                  <th className="text-left p-4 font-medium text-slate-900 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {interpreters.map(renderInterpreterRow)}
              </tbody>
            </table>
          </div>
          {interpreters.length === 0 && <p className="text-slate-500 py-4">No interpreters found.</p>}
        </section>
      )}

      {filter === 'all' && admins.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Admins</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 font-medium text-slate-900">Name</th>
                  <th className="text-left p-4 font-medium text-slate-900">Email</th>
                  <th className="text-left p-4 font-medium text-slate-900">Created</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="p-4">{u.name}</td>
                    <td className="p-4">{u.email}</td>
                    <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {users.length === 0 && !loading && (
        <p className="mt-4 text-slate-500">No users found.</p>
      )}
    </div>
  );
}
