'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Crown, Shield, Users, RefreshCw, Ticket, Plus, Trash2, Copy, Check, Link2 } from 'lucide-react';

interface AdminUser {
  id: string; email: string; name?: string;
  plan: string; isAdmin: boolean; isVip: boolean;
  createdAt: string; _count: { searches: number };
}

interface InviteCode {
  id: string; code: string; note?: string;
  createdAt: string; expiresAt?: string;
  usedAt?: string;
  creator:    { name?: string; email: string };
  usedByUser?: { name?: string; email: string };
}

export default function AdminPage() {
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [codes, setCodes]             = useState<InviteCode[]>([]);
  const [tab, setTab]                 = useState<'users' | 'codes'>('users');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [toast, setToast]             = useState('');

  // Generate form
  const [genCount, setGenCount]       = useState(1);
  const [genNote, setGenNote]         = useState('');
  const [genExpiry, setGenExpiry]     = useState('');
  const [generating, setGenerating]   = useState(false);

  // Copy state per code
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const res = await fetch('/api/admin/users');
    const d = await res.json();
    setUsers(d.users ?? []);
    setLoadingUsers(false);
  }, []);

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    const res = await fetch('/api/admin/invite-codes');
    const d = await res.json();
    setCodes(d.codes ?? []);
    setLoadingCodes(false);
  }, []);

  useEffect(() => { fetchUsers(); fetchCodes(); }, [fetchUsers, fetchCodes]);

  const toggleVip = async (user: AdminUser) => {
    setUpdating(user.id + '-vip');
    const res = await fetch(`/api/admin/users/${user.id}/vip`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: !user.isVip }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isVip: !u.isVip } : u));
      showToast(`VIP ${!user.isVip ? (isCs ? 'přidáno' : 'granted') : (isCs ? 'odebráno' : 'revoked')}: ${user.email}`);
    }
    setUpdating(null);
  };

  const toggleAdmin = async (user: AdminUser) => {
    setUpdating(user.id + '-admin');
    const res = await fetch(`/api/admin/users/${user.id}/admin`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u));
      showToast(`Admin ${!user.isAdmin ? (isCs ? 'přidán' : 'granted') : (isCs ? 'odebrán' : 'revoked')}: ${user.email}`);
    }
    setUpdating(null);
  };

  const generateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    const res = await fetch('/api/admin/invite-codes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: genCount, note: genNote || undefined, expiresAt: genExpiry || undefined }),
    });
    const d = await res.json();
    if (res.ok) {
      setCodes(prev => [...(d.codes ?? []), ...prev]);
      setGenNote(''); setGenExpiry('');
      showToast(isCs ? `${d.codes.length} kódů vygenerováno` : `${d.codes.length} codes generated`);
    }
    setGenerating(false);
  };

  const deleteCode = async (id: string) => {
    const res = await fetch(`/api/admin/invite-codes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCodes(prev => prev.filter(c => c.id !== id));
      showToast(isCs ? 'Kód smazán' : 'Code deleted');
    }
  };

  const copyCode = async (code: InviteCode) => {
    const url = `${window.location.origin}/${locale}/auth/register?code=${code.code}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(code.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = {
    total: users.length, vip: users.filter(u => u.isVip).length,
    admins: users.filter(u => u.isAdmin).length,
    unusedCodes: codes.filter(c => !c.usedAt).length,
  };

  return (
    <div className="min-h-screen bg-surface-subtle pt-16">
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
              <h1 className="text-xl font-bold text-white">Admin panel</h1>
              <p className="text-white/40 text-xs">{isCs ? 'Správa uživatelů a invite kódů' : 'User and invite code management'}</p>
            </div>
          </div>
          <button onClick={() => { fetchUsers(); fetchCodes(); }}
            className="btn-ghost text-white/50 hover:text-white gap-2 text-sm">
            <RefreshCw size={14} />{isCs ? 'Obnovit' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: isCs ? 'Uživatelů' : 'Users',      value: stats.total,       icon: <Users size={18} />,  color: 'text-brand-500 bg-brand-500/10' },
            { label: isCs ? 'VIP'        : 'VIP',        value: stats.vip,         icon: <Crown size={18} />,  color: 'text-yellow-500 bg-yellow-500/10' },
            { label: isCs ? 'Adminů'     : 'Admins',     value: stats.admins,      icon: <Shield size={18} />, color: 'text-purple-500 bg-purple-500/10' },
            { label: isCs ? 'Volné kódy' : 'Free codes', value: stats.unusedCodes, icon: <Ticket size={18} />, color: 'text-emerald-500 bg-emerald-500/10' },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'rgb(var(--ink-faint))' }}>{s.label}</span>
                <span className={`p-1.5 rounded-lg ${s.color}`}>{s.icon}</span>
              </div>
              <span className="text-3xl font-bold" style={{ color: 'rgb(var(--ink))' }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-surface-muted p-1 rounded-xl w-fit">
          {(['users', 'codes'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? 'shadow-sm'
                  : 'hover:text-[rgb(var(--ink))]'
              }`}
            style={tab === t
              ? { backgroundColor: 'rgb(var(--card-bg))', color: 'rgb(var(--ink))' }
              : { color: 'rgb(var(--ink-faint))' }
            }>
              {t === 'users' ? (isCs ? 'Uživatelé' : 'Users') : (isCs ? 'Invite kódy' : 'Invite codes')}
              <span className="ml-2 text-xs opacity-60">
                {t === 'users' ? users.length : codes.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-ink/5 flex items-center gap-2">
              <Users size={16} className="text-ink-faint" />
              <h2 className="font-semibold text-ink">{isCs ? 'Uživatelé' : 'Users'}</h2>
            </div>
            {loadingUsers ? (
              <div className="flex justify-center py-16">
                <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : (
              <table className="w-full text-sm results-table">
                <thead><tr>
                  <th>{isCs ? 'Uživatel' : 'User'}</th>
                  <th>{isCs ? 'Plán' : 'Plan'}</th>
                  <th>{isCs ? 'Vyhledávání' : 'Searches'}</th>
                  <th>{isCs ? 'Registrace' : 'Joined'}</th>
                  <th>VIP</th><th>Admin</th>
                </tr></thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="font-medium text-ink">{user.name || '—'}</div>
                        <div className="text-xs text-ink-faint">{user.email}</div>
                      </td>
                      <td><span className={user.plan === 'PRO' ? 'badge-purple' : user.plan === 'BUSINESS' ? 'badge-green' : 'badge-yellow'}>{user.plan}</span></td>
                      <td className="text-ink-muted">{user._count.searches}</td>
                      <td className="text-ink-faint text-xs">{new Date(user.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}</td>
                      <td>
                        <button onClick={() => toggleVip(user)} disabled={updating === user.id + '-vip'}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${user.isVip ? 'bg-yellow-500/15 text-yellow-500 hover:bg-yellow-500/25' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--ink-faint))] hover:bg-[rgb(var(--ink)/0.1)]'}`}>
                          <Crown size={13} className={user.isVip ? 'fill-yellow-500 text-yellow-500' : ''} />
                          {user.isVip ? 'VIP' : (isCs ? 'Přidat' : 'Grant')}
                        </button>
                      </td>
                      <td>
                        <button onClick={() => toggleAdmin(user)} disabled={updating === user.id + '-admin'}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${user.isAdmin ? 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25' : 'bg-[rgb(var(--ink)/0.06)] text-[rgb(var(--ink-faint))] hover:bg-[rgb(var(--ink)/0.1)]'}`}>
                          <Shield size={13} />
                          {user.isAdmin ? 'Admin' : (isCs ? 'Přidat' : 'Grant')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Invite codes tab ── */}
        {tab === 'codes' && (
          <div className="space-y-6">
            {/* Generate form */}
            <div className="card">
              <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
                <Plus size={16} className="text-brand-600" />
                {isCs ? 'Vygenerovat nové kódy' : 'Generate new codes'}
              </h2>
              <form onSubmit={generateCodes} className="grid sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="label">{isCs ? 'Počet kódů' : 'Number of codes'}</label>
                  <input type="number" className="input" min={1} max={50} value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">{isCs ? 'Poznámka (volitelné)' : 'Note (optional)'}</label>
                  <input type="text" className="input" placeholder={isCs ? 'např. pro Petra' : 'e.g. for John'}
                    value={genNote} onChange={e => setGenNote(e.target.value)} />
                </div>
                <div>
                  <label className="label">{isCs ? 'Platnost do (volitelné)' : 'Expires (optional)'}</label>
                  <input type="date" className="input" value={genExpiry}
                    onChange={e => setGenExpiry(e.target.value)} />
                </div>
                <button type="submit" disabled={generating} className="btn-primary h-[42px]">
                  {generating ? (
                    <svg className="animate-spin h-4 w-4 mx-auto" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : <><Plus size={15} />{isCs ? 'Generovat' : 'Generate'}</>}
                </button>
              </form>
            </div>

            {/* Codes list */}
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-ink/5 flex items-center gap-2">
                <Ticket size={16} className="text-ink-faint" />
                <h2 className="font-semibold text-ink">{isCs ? 'Všechny invite kódy' : 'All invite codes'}</h2>
              </div>
              {loadingCodes ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : codes.length === 0 ? (
                <div className="text-center py-12 text-ink-faint text-sm">
                  <Ticket size={32} className="mx-auto mb-2 opacity-20" />
                  {isCs ? 'Žádné invite kódy. Vygeneruj první.' : 'No invite codes yet.'}
                </div>
              ) : (
                <table className="w-full text-sm results-table">
                  <thead><tr>
                    <th>{isCs ? 'Kód' : 'Code'}</th>
                    <th>{isCs ? 'Poznámka' : 'Note'}</th>
                    <th>{isCs ? 'Stav' : 'Status'}</th>
                    <th>{isCs ? 'Použil' : 'Used by'}</th>
                    <th>{isCs ? 'Platnost' : 'Expires'}</th>
                    <th>{isCs ? 'Vytvořeno' : 'Created'}</th>
                    <th>{isCs ? 'Akce' : 'Actions'}</th>
                  </tr></thead>
                  <tbody>
                    {codes.map(c => {
                      const used    = Boolean(c.usedAt);
                      const expired = c.expiresAt ? new Date(c.expiresAt) < new Date() : false;
                      const isCopied = copiedId === c.id;
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className="font-mono font-bold text-ink tracking-wider">{c.code}</span>
                          </td>
                          <td className="text-ink-muted">{c.note || '—'}</td>
                          <td>
                            {used
                              ? <span className="badge badge-green text-xs">✓ {isCs ? 'Použit' : 'Used'}</span>
                              : expired
                                ? <span className="badge badge-red text-xs">{isCs ? 'Expirován' : 'Expired'}</span>
                                : <span className="badge badge-yellow text-xs">⏳ {isCs ? 'Volný' : 'Available'}</span>}
                          </td>
                          <td className="text-ink-faint text-xs">
                            {c.usedByUser ? (c.usedByUser.name || c.usedByUser.email) : '—'}
                          </td>
                          <td className="text-ink-faint text-xs">
                            {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US') : '∞'}
                          </td>
                          <td className="text-ink-faint text-xs">
                            {new Date(c.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              {!used && (
                                <button onClick={() => copyCode(c)} title={isCs ? 'Kopírovat odkaz pro registraci' : 'Copy registration link'}
                                  className={`p-1.5 rounded-lg transition-all ${isCopied ? 'bg-emerald-500/15 text-emerald-400' : 'text-[rgb(var(--ink-faint))] hover:text-brand-500 hover:bg-brand-500/10'}`}>
                                  {isCopied ? <Check size={14} /> : <Link2 size={14} />}
                                </button>
                              )}
                              {!used && (
                                <button onClick={() => deleteCode(c.id)} title={isCs ? 'Smazat kód' : 'Delete code'}
                                  className="p-1.5 rounded-lg transition-all text-[rgb(var(--ink-faint))] hover:text-red-400 hover:bg-red-500/10">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
