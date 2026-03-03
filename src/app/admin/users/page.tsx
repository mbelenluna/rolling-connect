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
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
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
      <div className="overflow-x-auto">
        <table className="w-full bg-white rounded-xl border border-slate-200">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left p-4 font-medium text-slate-900">Name</th>
              <th className="text-left p-4 font-medium text-slate-900">Email</th>
              <th className="text-left p-4 font-medium text-slate-900">Role</th>
              <th className="text-left p-4 font-medium text-slate-900">Status</th>
              <th className="text-left p-4 font-medium text-slate-900">Created</th>
              <th className="text-left p-4 font-medium text-slate-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isClient = u.role === 'client';
              const isInterpreter = u.role === 'interpreter';
              const needsApproval = isClient || isInterpreter;
              const approved = u.approvedAt != null;
              const rejected = u.rejectedAt != null;
              const pending = !approved && !rejected;
              const status = approved ? 'Approved' : rejected ? 'Rejected' : 'Pending';
              return (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-4">{u.name}</td>
                  <td className="p-4">{u.email}</td>
                  <td className="p-4 capitalize">{u.role}</td>
                  <td className="p-4">
                    {needsApproval ? (
                      <span
                        className={`text-sm font-medium ${
                          approved ? 'text-green-600' : rejected ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {status}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-slate-500 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-4">
                    {needsApproval && pending && (
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {users.length === 0 && !loading && (
        <p className="mt-4 text-slate-500">No users found.</p>
      )}
    </div>
  );
}
