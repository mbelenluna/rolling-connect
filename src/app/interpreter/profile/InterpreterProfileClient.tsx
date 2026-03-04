'use client';

import { useState, useEffect } from 'react';

type LanguagePair = { source: string; target: string };
type Language = { code: string; name: string };
type Specialty = { code: string; name: string };

export default function InterpreterProfileClient() {
  const [profile, setProfile] = useState<{
    languagePairs: LanguagePair[];
    specialties: string[];
    timeZone?: string;
    maxConcurrentJobs: number;
  } | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [editForm, setEditForm] = useState<{
    languagePairs: LanguagePair[];
    specialties: string[];
    timeZone: string;
  }>({ languagePairs: [], specialties: [], timeZone: '' });

  useEffect(() => {
    Promise.all([
      fetch('/api/interpreter/profile').then((r) => r.json()),
      fetch('/api/languages').then((r) => r.json()),
      fetch('/api/specialties').then((r) => r.json()),
    ])
      .then(([p, l, s]) => {
        setProfile(p);
        setLanguages(l);
        setSpecialties(s);
        setEditForm({
          languagePairs: p.languagePairs?.length ? p.languagePairs : [{ source: 'en', target: 'es' }],
          specialties: p.specialties?.length ? p.specialties : [],
          timeZone: p.timeZone || 'America/Los_Angeles',
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addLanguagePair = () => {
    setEditForm((f) => ({
      ...f,
      languagePairs: [...f.languagePairs, { source: 'en', target: 'es' }],
    }));
  };

  const removeLanguagePair = (i: number) => {
    setEditForm((f) => ({
      ...f,
      languagePairs: f.languagePairs.filter((_, idx) => idx !== i),
    }));
  };

  const updateLanguagePair = (i: number, field: 'source' | 'target', value: string) => {
    setEditForm((f) => ({
      ...f,
      languagePairs: f.languagePairs.map((p, idx) =>
        idx === i ? { ...p, [field]: value } : p
      ),
    }));
  };

  const toggleSpecialty = (code: string) => {
    setEditForm((f) => ({
      ...f,
      specialties: f.specialties.includes(code)
        ? f.specialties.filter((s) => s !== code)
        : [...f.specialties, code],
    }));
  };

  const handleSave = async () => {
    if (editForm.languagePairs.length === 0 || editForm.specialties.length === 0) {
      setMessage('Add at least one language pair and one specialty.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/interpreter/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setProfile({ ...profile!, ...editForm });
      setMessage('Profile saved. You will only receive offers that match your languages and specialties.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-600">Loading…</div>;
  if (!profile) return <div className="text-slate-600">No profile found.</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Profile</h1>
      <p className="text-slate-600 mb-6">
        Set your working languages and specialties. You will only receive job offers that match your skills.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Language pairs</label>
          <p className="text-xs text-slate-500 mb-2">Add each language pair you can interpret (e.g., English → Spanish)</p>
          {editForm.languagePairs.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <select
                value={p.source}
                onChange={(e) => updateLanguagePair(i, 'source', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <span className="py-2 text-slate-500">→</span>
              <select
                value={p.target}
                onChange={(e) => updateLanguagePair(i, 'target', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeLanguagePair(i)}
                className="px-2 text-red-600 hover:bg-red-50 rounded"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLanguagePair}
            className="text-sm text-brand-600 hover:underline"
          >
            + Add language pair
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Specialties</label>
          <p className="text-xs text-slate-500 mb-2">Select the areas you can interpret in. &quot;General&quot; matches any request.</p>
          <div className="flex flex-wrap gap-2">
            {specialties.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => toggleSpecialty(s.code)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  editForm.specialties.includes(s.code)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Time zone</label>
          <select
            value={editForm.timeZone}
            onChange={(e) => setEditForm((f) => ({ ...f, timeZone: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          >
            <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
            <option value="America/Denver">Mountain (Denver)</option>
            <option value="America/Chicago">Central (Chicago)</option>
            <option value="America/New_York">Eastern (New York)</option>
            <option value="UTC">UTC</option>
            <option value="Europe/London">Europe (London)</option>
          </select>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </div>
  );
}
