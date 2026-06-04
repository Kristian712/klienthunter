'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Crown, Shield, Users, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name?: string;
  plan: string;
  isAdmin: boolean;
  isVip: boolean;
  createdAt: string;
  _count: { searches: number };
}

const PLAN_COLORS: Record<string, string> = {
  FREE:     'badge-yellow',
  PRO:      'badge-purple',
  BUSINESS: 'badge-green',
};

export default function AdminPage() {
  const locale = useLocale();
  const isCs = locale === 'cs';
  const [users, setUsers]       = useState<AdminUser[]>([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast]       = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const toggleVip = async (user: AdminUser) => {
    setUpdating(user.id + '-vip');
    const res = await fetch(`/api/admin/users/${user.id}/vip`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: !user.isVip }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isVip: !u.isVip } : u));
      showToast(isCs ? `VIP ${!user.isVip ? 'přidáno' : 'odebráno'}: ${user.email}` : `VIP ${!user.isVip ? 'granted' : 'revoked'}: ${user.email}`);
    }
    setUpdating(null);
  };

  const toggleAdmin = async (user: AdminUser) => {
    setUpdating(user.id + '-admin');
    const res = await fetch(`/api/admin/users/${user.id}/admin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u));
      showToast(isCs ? `Admin ${!user.isAdmin ? 'přidán' : 'odebrán'}: ${user.email}` : `Admin ${!user.isAdmin ? 'granted' : 'revoked'}: ${user.email}`);
    }
    setUpdating(null);
  };

  const stats = {
    total:    users.length,
    vip:      users.filter(u => u.isVip).length,
    admins:   users.filter(u => u.isAdmin).length,
    searches: users.reduce((s, u) => s + u._count.searches, 0),
  };

  return (
    <div className="min-h-screen bg-surface-subtle pt-16">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-ink text-white text-sm px-4 py-3 rounded-xl shadow-card-hover animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#07071a] border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
              <Shield size={20} className="text-brand-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{isCs ? 'Admin panel' : 'Admin panel'}</h1>
              <p className="text-white/40 text-xs">{isCs ? 'Správa uživatelů' : 'User management'}</p>
            </div>
          </div>
          <button onClick={fetchUsers} className="btn-ghost text-white/50 hover:text-white gap-2 text-sm">
            <RefreshCw size={14} />
            {isCs ? 'Obnovit' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: isCs ? 'Celkem uživatelů' : 'Total users', value: stats.total, icon: <Users size={18} />, color: 'text-brand-600 bg-brand-50' },
            { label: isCs ? 'VIP uživatelů'    : 'VIP users',   value: stats.vip,   icon: <Crown size={18} />, color: 'text-yellow-600 bg-yellow-50' },
            { label: isCs ? 'Adminů'            : 'Admins',      value: stats.admins, icon: <Shield size={18} />, color: 'text-purple-600 bg-purple-50' },
            { label: isCs ? 'Vyhledávání celkem': 'Total searches', value: stats.searches, icon: null, color: 'text-emerald-600 bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-faint font-medium">{s.label}</span>
                {s.icon && <span className={`p-1.5 rounded-lg ${s.color}`}>{s.icon}</span>}
              </div>
              <span className="text-3xl font-bold text-ink">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-ink/5 flex items-center gap-2">
            <Users size={16} className="text-ink-faint" />
            <h2 className="font-semibold text-ink">{isCs ? 'Uživatelé' : 'Users'}</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          ) : (
            <table className="w-full text-sm results-table">
              <thead>
                <tr>
                  <th>{isCs ? 'Uživatel' : 'User'}</th>
                  <th>{isCs ? 'Plán' : 'Plan'}</th>
                  <th>{isCs ? 'Vyhledávání' : 'Searches'}</th>
                  <th>{isCs ? 'Registrace' : 'Registered'}</th>
                  <th>VIP</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="font-medium text-ink">{user.name || '—'}</div>
                      <div className="text-xs text-ink-faint">{user.email}</div>
                    </td>
                    <td>
                      <span className={PLAN_COLORS[user.plan] || 'badge-yellow'}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="text-ink-muted">{user._count.searches}</td>
                    <td className="text-ink-faint text-xs">
                      {new Date(user.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleVip(user)}
                        disabled={updating === user.id + '-vip'}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                          user.isVip
                            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            : 'bg-ink/5 text-ink-faint hover:bg-ink/10'
                        }`}
                      >
                        {user.isVip
                          ? <><Crown size={13} className="fill-yellow-500 text-yellow-500" /> VIP</>
                          : <><Crown size={13} /> {isCs ? 'Přidat' : 'Grant'}</>
                        }
                      </button>
                    </td>
                    <td>
                      <button
                        onClick={() => toggleAdmin(user)}
                        disabled={updating === user.id + '-admin'}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                          user.isAdmin
                            ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            : 'bg-ink/5 text-ink-faint hover:bg-ink/10'
                        }`}
                      >
                        {user.isAdmin
                          ? <><Shield size={13} /> Admin</>
                          : <><Shield size={13} /> {isCs ? 'Přidat' : 'Grant'}</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
