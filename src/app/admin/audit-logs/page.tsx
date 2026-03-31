'use client';

import { useState, useEffect, useCallback } from 'react';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (actionFilter) params.set('action', actionFilter);
    if (entityFilter) params.set('entityType', entityFilter);
    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, actionFilter, entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actionColors: Record<string, string> = {
    login: 'bg-green-100 text-green-700',
    call_ended: 'bg-blue-100 text-blue-700',
    user_approved: 'bg-purple-100 text-purple-700',
    user_rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Audit Logs</h1>
      <p className="text-sm text-slate-600 mb-4">Showing {total} total events. Last 50 per page.</p>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input
          type="text"
          placeholder="Filter by action (e.g. login)"
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm w-52 focus:ring-2 focus:ring-brand-500"
        />
        <input
          type="text"
          placeholder="Filter by entity (e.g. user)"
          value={entityFilter}
          onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm w-52 focus:ring-2 focus:ring-brand-500"
        />
        {(actionFilter || entityFilter) && (
          <button
            onClick={() => { setActionFilter(''); setEntityFilter(''); setPage(1); }}
            className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-slate-500">No audit logs found.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Entity ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Metadata</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {log.user ? (
                        <div>
                          <p className="font-medium">{log.user.name}</p>
                          <p className="text-xs text-slate-400">{log.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{log.entityType}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono truncate max-w-[120px]">{log.entityId ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px]">
                      {log.metadata ? (
                        <span className="font-mono text-xs">{JSON.stringify(log.metadata)}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{log.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
