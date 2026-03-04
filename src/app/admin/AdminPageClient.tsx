'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPageClient() {
  const [stats, setStats] = useState<{ users: number; requests: number; jobs: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()).catch(() => ({})),
    ]).then(([s]) => setStats(s || { users: 0, requests: 0, jobs: 0 }));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Users</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.users ?? '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Requests</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.requests ?? '—'}</p>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-500">Active Jobs</p>
          <p className="text-2xl font-bold text-slate-900">{stats?.jobs ?? '—'}</p>
        </div>
      </div>
      <div className="space-y-4">
        <Link href="/admin/jobs" className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-500">
          <h2 className="font-semibold text-slate-900">Manage Jobs</h2>
          <p className="text-sm text-slate-500">View queue, force reassign, cancel</p>
        </Link>
        <Link href="/admin/users" className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-500">
          <h2 className="font-semibold text-slate-900">Manage Users</h2>
          <p className="text-sm text-slate-500">Clients, interpreters, admins</p>
        </Link>
        <Link href="/admin/reports" className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-brand-500">
          <h2 className="font-semibold text-slate-900">Billing Reports</h2>
          <p className="text-sm text-slate-500">Client charges and interpreter pay by month</p>
        </Link>
      </div>
    </div>
  );
}
