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
};

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

  const renderInterpreterRow = (u: User) => {
    const approved = u.approvedAt != null;
    const rejected = u.rejectedAt != null;
    const pending = !approved && !rejected;
    const status = approved ? 'Approved' : rejected ? 'Rejected' : 'Pending';
    return (
      <tr key={u.id} className="border-b border-slate-100">
        <td className="p-4">{u.name}</td>
        <td className="p-4">{u.email}</td>
        <td className="p-4 text-slate-600 text-sm max-w-[200px]">{formatLanguagePairs(u.languagePairs ?? [])}</td>
        <td className="p-4 text-slate-600 text-sm max-w-[150px]">{formatSpecialties(u.specialties ?? [])}</td>
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
