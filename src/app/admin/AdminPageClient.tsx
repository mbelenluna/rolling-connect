'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPageClient() {
  const [stats, setStats] = useState<{ users: number; requests: number; jobs: number } | null>(null);
  const [bannerText, setBannerText] = useState('');
  const [bannerSaving, setBannerSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then((r) => r.json()).catch(() => ({})),
      fetch('/api/admin/settings').then((r) => r.json()).catch(() => ({ banner: '' })),
    ]).then(([s, cfg]) => {
      setStats(s || { users: 0, requests: 0, jobs: 0 });
      setBannerText(cfg.banner ?? '');
    });
  }, []);

  const saveBanner = async (text: string) => {
    setBannerSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner: text }),
      });
      setBannerMsg(text.trim() ? 'Banner saved.' : 'Banner cleared.');
      setTimeout(() => setBannerMsg(''), 3000);
    } finally {
      setBannerSaving(false);
    }
  };

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
      {/* System Status Banner */}
      <div className="mb-8 p-4 bg-white rounded-xl border border-slate-200">
        <h2 className="font-semibold text-slate-900 mb-1">System Status Banner</h2>
        <p className="text-sm text-slate-500 mb-3">Shown to all users at the top of every page. Leave blank to hide.</p>
        <textarea
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          rows={2}
          placeholder="e.g. We are experiencing elevated response times. Our team is working on it."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 resize-none"
        />
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => saveBanner(bannerText)}
            disabled={bannerSaving}
            className="px-4 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {bannerSaving ? 'Saving…' : 'Save Banner'}
          </button>
          {bannerText && (
            <button
              onClick={() => { setBannerText(''); saveBanner(''); }}
              disabled={bannerSaving}
              className="px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Clear Banner
            </button>
          )}
          {bannerMsg && <span role="status" className="text-sm text-green-600">{bannerMsg}</span>}
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
