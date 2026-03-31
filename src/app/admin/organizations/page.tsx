'use client';

import { useState, useEffect, useCallback } from 'react';

type OrgMember = {
  id: string;
  role: 'owner' | 'member' | 'billing';
  user: { id: string; name: string; email: string };
};

type Org = {
  id: string;
  name: string;
  billingEmail: string | null;
  members: OrgMember[];
};

type UserOption = { id: string; name: string; email: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  member: 'Member',
  billing: 'Finance / PM',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  member: 'bg-slate-100 text-slate-600',
  billing: 'bg-green-100 text-green-700',
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);

  // Add-member form state
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState<'owner' | 'member' | 'billing'>('billing');
  const [addLoading, setAddLoading] = useState(false);
  const [addMsg, setAddMsg] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    const data = await fetch('/api/admin/organizations').then((r) => r.json());
    setOrgs(data);
    setLoading(false);
    // Refresh the selected org if one is open
    if (selectedOrg) {
      const refreshed = data.find((o: Org) => o.id === selectedOrg.id);
      if (refreshed) setSelectedOrg(refreshed);
    }
  }, [selectedOrg]);

  useEffect(() => {
    fetchOrgs();
    fetch('/api/admin/users').then((r) => r.json()).then(setUsers).catch(() => setUsers([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddMember = async () => {
    if (!selectedOrg || !addUserId) return;
    setAddLoading(true);
    setAddMsg('');
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrg.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addUserId, role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAddMsg(`${data.user.name} added as ${ROLE_LABELS[addRole]}.`);
      setAddUserId('');
      setUserSearch('');
      await fetchOrgs();
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async (orgId: string, userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from this organization?`)) return;
    await fetch(`/api/admin/organizations/${orgId}/members?userId=${userId}`, { method: 'DELETE' });
    await fetchOrgs();
  };

  const handleChangeRole = async (orgId: string, userId: string, newRole: string) => {
    await fetch(`/api/admin/organizations/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await fetchOrgs();
  };

  // Filter users for the search dropdown
  const filteredUsers = users.filter(
    (u) =>
      (u.role === 'client' || u.role === 'interpreter') &&
      (userSearch === '' ||
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Organization Access Management</h1>
      <p className="text-slate-600 text-sm mb-6">
        Assign users a <strong>Finance / PM</strong> role within a specific organization so they can view that org&apos;s usage reports — without access to any other org&apos;s data.
      </p>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Org list */}
          <div className="md:col-span-1 space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Organizations ({orgs.length})</p>
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => { setSelectedOrg(org); setAddMsg(''); }}
                className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                  selectedOrg?.id === org.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-brand-300'
                }`}
              >
                <p className="font-medium text-slate-900 truncate">{org.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{org.members.length} member{org.members.length !== 1 ? 's' : ''}</p>
              </button>
            ))}
          </div>

          {/* Org detail */}
          <div className="md:col-span-2">
            {!selectedOrg ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                Select an organization to manage its members
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedOrg.name}</h2>
                  {selectedOrg.billingEmail && (
                    <p className="text-sm text-slate-500 mt-0.5">Billing email: {selectedOrg.billingEmail}</p>
                  )}
                </div>

                {/* Current members */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3">Current Members</p>
                  {selectedOrg.members.length === 0 ? (
                    <p className="text-sm text-slate-400">No members assigned yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedOrg.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{m.user.name}</p>
                            <p className="text-xs text-slate-400 truncate">{m.user.email}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={m.role}
                              onChange={(e) => handleChangeRole(selectedOrg.id, m.user.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="owner">Owner</option>
                              <option value="member">Member</option>
                              <option value="billing">Finance / PM</option>
                            </select>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role]}`}>
                              {ROLE_LABELS[m.role]}
                            </span>
                            <button
                              onClick={() => handleRemoveMember(selectedOrg.id, m.user.id, m.user.name)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add member */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm font-semibold text-slate-700 mb-3">Add a Member</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Search user by name or email</label>
                      <input
                        type="text"
                        value={userSearch}
                        onChange={(e) => { setUserSearch(e.target.value); setAddUserId(''); }}
                        placeholder="Type to search…"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
                      />
                      {userSearch && filteredUsers.length > 0 && (
                        <div className="mt-1 border border-slate-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                          {filteredUsers.slice(0, 10).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => { setAddUserId(u.id); setUserSearch(`${u.name} (${u.email})`); }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
                            >
                              <span className="font-medium">{u.name}</span>
                              <span className="text-slate-400 ml-2 text-xs">{u.email}</span>
                              <span className="text-slate-400 ml-2 text-xs capitalize">({u.role})</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {userSearch && filteredUsers.length === 0 && (
                        <p className="mt-1 text-xs text-slate-400 px-1">No users found. They must be registered first.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                      <select
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as typeof addRole)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="billing">Finance / PM — can view this org&apos;s usage reports only</option>
                        <option value="member">Member — standard org access</option>
                        <option value="owner">Owner — full org access</option>
                      </select>
                    </div>

                    <button
                      onClick={handleAddMember}
                      disabled={!addUserId || addLoading}
                      className="px-5 py-2 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 disabled:opacity-50"
                    >
                      {addLoading ? 'Adding…' : 'Add to Organization'}
                    </button>

                    {addMsg && (
                      <p className={`text-sm ${addMsg.includes('added') ? 'text-green-600' : 'text-red-600'}`}>
                        {addMsg}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
