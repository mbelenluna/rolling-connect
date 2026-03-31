'use client';

import { useState, useEffect } from 'react';

export default function ClientSettingsPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/auth/mfa')
      .then((r) => r.json())
      .then((data) => setMfaEnabled(data.mfaEnabled ?? false))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleMfa = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !mfaEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setMfaEnabled(data.mfaEnabled);
      setMessage(data.mfaEnabled ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Account Settings</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Two-Factor Authentication (2FA)</h2>
        <p className="text-sm text-slate-600 mb-4">
          When enabled, you will be required to enter a one-time verification code sent to your email each time you sign in.
          This adds an extra layer of security to your account.
        </p>

        {loading ? (
          <p className="text-slate-500 text-sm">Loading…</p>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Status:{' '}
              <span className={mfaEnabled ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                {mfaEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </span>
            <button
              onClick={toggleMfa}
              disabled={saving}
              className={`px-5 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-50 ${
                mfaEnabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {saving ? 'Saving…' : mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </button>
          </div>
        )}

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.includes('enabled')
                ? 'text-green-600'
                : message.includes('disabled')
                ? 'text-slate-600'
                : 'text-red-600'
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
