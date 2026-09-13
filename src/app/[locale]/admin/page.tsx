'use client';

import { useEffect, useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Crown, Shield, Users, RefreshCw, Ticket, Plus, Trash2, Copy, Check, Clock, Link2 } from 'lucide-react';
import { formatDate } from '@/lib/format-date';

interface AdminUser {
  id: string; email: string; name?: string;
  plan: string; isAdmin: boolean; isVip: boolean;
  accessExpiresAt?: string | null;
  createdAt: string; _count: { searches: number };
}

interface InviteCode {
  id: string; code: string; note?: string;
  createdAt: string; expiresAt?: string;
  usedAt?: string;
  accessDurationMinutes?: number;
  creator:    { name?: string; email: string };
  usedByUser?: { name?: string; email: string };
}

// Row action pills, monochrome. All have a 1px border (transparent on On/Off) so heights match.
const ROW_BTN       = 'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors';
const ROW_BTN_OFF   = `${ROW_BTN} font-medium border-transparent bg-ink/[0.06] text-ink-faint hover:bg-ink/10 hover:text-ink`;
const ROW_BTN_ON    = `${ROW_BTN} font-medium border-transparent bg-ink text-surface hover:bg-ink/90`;
const ROW_BTN_BLOCK = `${ROW_BTN} font-medium border-field text-ink-muted hover:border-ink hover:text-ink`;

// Paid plans and unused codes
const BADGE_STRONG = 'badge border-field text-ink';

interface Optout {
  id: string; firmKey: string; email: string | null; status: 'active' | 'confirmed' | 'rejected';
  note: string | null; createdAt: string; confirmedAt: string | null; reviewedAt: string | null;
}

export default function AdminPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  const [users, setUsers]             = useState<AdminUser[]>([]);
  const [codes, setCodes]             = useState<InviteCode[]>([]);
  const [tab, setTab]                 = useState<'users' | 'codes' | 'optouts'>('users');
  const [optouts, setOptouts]         = useState<Optout[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  /** Načtení selhalo — prázdný panel by tvrdil, že v databázi nikdo není. */
  const [loadFailed, setLoadFailed]   = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [updating, setUpdating]       = useState<string | null>(null);
  const [toast, setToast]             = useState('');

  // Generate form
  const [genCount, setGenCount]       = useState(1);
  const [genNote, setGenNote]         = useState('');
  const [genExpiry, setGenExpiry]     = useState('');
  const [genAccessMinutes, setGenAccessMinutes] = useState<number | ''>('');
  const [generating, setGenerating]   = useState(false);

  // Copy state per code
  const [copiedId, setCopiedId]       = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const failToast = () => showToast(isCs ? 'Akce se nepovedla. Zkuste to prosím znovu.' : 'That did not work. Please try again.');

  /**
   * Chyba načtení se musí poznat od prázdné databáze.
   *
   * Dřív se odpověď rovnou rozbalila: při 401 nebo 500 z toho vyšlo `d.users ?? []`, tedy panel
   * bez jediného uživatele — a admin nemá jak poznat, že data prostě nedorazila. Když navíc
   * odpověď nebyla JSON, `res.json()` vyhodilo výjimku, kterou nikdo nechytal, a kolečko se
   * točilo napořád.
   */
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error(`users ${res.status}`);
      const d = await res.json();
      setUsers(d.users ?? []);
      setLoadFailed(false);
    } catch (err) {
      console.error('admin/users:', err);
      setLoadFailed(true);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchCodes = useCallback(async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/admin/invite-codes');
      if (!res.ok) throw new Error(`invite-codes ${res.status}`);
      const d = await res.json();
      setCodes(d.codes ?? []);
      setLoadFailed(false);
    } catch (err) {
      console.error('admin/invite-codes:', err);
      setLoadFailed(true);
    } finally {
      setLoadingCodes(false);
    }
  }, []);

  const fetchOptouts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/optouts');
      if (!res.ok) throw new Error(`optouts ${res.status}`);
      const d = await res.json();
      setOptouts(d.optouts ?? []);
    } catch (err) {
      console.error('admin/optouts:', err);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { fetchUsers(); fetchCodes(); fetchOptouts(); }, [fetchUsers, fetchCodes, fetchOptouts]);

  /** Zamítnutí vrátí subjekt do výsledků; obnovení ho zase vyřadí. Vyřazení samo na nikoho nečekalo. */
  const setOptoutStatus = async (o: Optout, status: 'active' | 'rejected') => {
    setUpdating(o.id + '-optout');
    const res = await fetch('/api/admin/optouts', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: o.id, status }),
    });
    if (res.ok) {
      setOptouts(prev => prev.map(x => x.id === o.id ? { ...x, status, reviewedAt: new Date().toISOString() } : x));
      showToast(status === 'rejected' ? (isCs ? `Žádost zamítnuta, ${o.firmKey} se zase zobrazuje` : `Request rejected, ${o.firmKey} is visible again`)
                                      : (isCs ? `${o.firmKey} znovu vyřazeno` : `${o.firmKey} removed again`));
    } else {
      failToast();
    }
    setUpdating(null);
  };

  const toggleVip = async (user: AdminUser) => {
    setUpdating(user.id + '-vip');
    const res = await fetch(`/api/admin/users/${user.id}/vip`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isVip: !user.isVip }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isVip: !u.isVip } : u));
      showToast(`VIP ${!user.isVip ? (isCs ? 'přidáno' : 'granted') : (isCs ? 'odebráno' : 'revoked')}: ${user.email}`);
    } else {
      failToast();
    }
    setUpdating(null);
  };

  const toggleBlock = async (user: AdminUser) => {
    const isBlocked = user.accessExpiresAt === '1970-01-01T00:00:00.000Z' || (!!user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date());
    setUpdating(user.id + '-block');
    const res = await fetch(`/api/admin/users/${user.id}/block`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: !isBlocked }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, accessExpiresAt: !isBlocked ? null : '1970-01-01T00:00:00.000Z' } : u));
      showToast(!isBlocked ? (isCs ? `Přístup obnoven: ${user.email}` : `Access restored: ${user.email}`) : (isCs ? `Zablokováno: ${user.email}` : `Blocked: ${user.email}`));
    } else {
      failToast();
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
    } else {
      failToast();
    }
    setUpdating(null);
  };

  const generateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: genCount, note: genNote || undefined, expiresAt: genExpiry || undefined, accessDurationMinutes: genAccessMinutes || undefined }),
      });
      if (!res.ok) throw new Error(`invite-codes ${res.status}`);
      const d = await res.json();
      setCodes(prev => [...(d.codes ?? []), ...prev]);
      setGenNote(''); setGenExpiry(''); setGenAccessMinutes('');
      showToast(isCs ? `${d.codes.length} kódů vygenerováno` : `${d.codes.length} codes generated`);
    } catch (err) {
      console.error('admin/generate-codes:', err);
      failToast();
    } finally {
      setGenerating(false);
    }
  };

  const deleteCode = async (id: string) => {
    const res = await fetch(`/api/admin/invite-codes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCodes(prev => prev.filter(c => c.id !== id));
      showToast(isCs ? 'Kód smazán' : 'Code deleted');
    } else {
      failToast();
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
    <div className="min-h-screen pt-16">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-surface-muted text-ink border border-line-strong text-sm px-4 py-3 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,.55)] animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-line">
        <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Shield size={20} className="text-accent" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">Admin panel</h1>
              <p className="text-ink-faint text-xs">{isCs ? 'Správa uživatelů a invite kódů' : 'User and invite code management'}</p>
            </div>
          </div>
          <button onClick={() => { fetchUsers(); fetchCodes(); }}
            className="btn-ghost">
            <RefreshCw size={14} />{isCs ? 'Obnovit' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Nuly ve statistikách a prázdná tabulka vypadají stejně jako čerstvá databáze, takže
            když načtení selže, musí to být napsané — jinak admin řeší chybu, která není. */}
        {loadFailed && (
          <div className="card mb-6 border-ink text-sm font-medium flex flex-wrap items-center gap-3">
            <span>{isCs ? 'Data se nepodařilo načíst, čísla níž tedy nic neříkají.' : 'The data could not be loaded, so the numbers below mean nothing.'}</span>
            <button className="btn-outline btn-sm" onClick={() => { void fetchUsers(); void fetchCodes(); }}>
              {isCs ? 'Zkusit znovu' : 'Try again'}
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: isCs ? 'Uživatelů' : 'Users',      value: stats.total,       icon: <Users size={18} />  },
            { label: isCs ? 'VIP'        : 'VIP',        value: stats.vip,         icon: <Crown size={18} />  },
            { label: isCs ? 'Adminů'     : 'Admins',     value: stats.admins,      icon: <Shield size={18} /> },
            { label: isCs ? 'Volné kódy' : 'Free codes', value: stats.unusedCodes, icon: <Ticket size={18} /> },
          ].map(s => (
            <div key={s.label} className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-ink-faint">{s.label}</span>
                <span className="p-1.5 rounded-lg text-ink-muted bg-ink/[0.06]">{s.icon}</span>
              </div>
              <span className="text-3xl font-bold text-ink tnum">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Tabs (transparent border on the inactive one: no 2px shift) */}
        <div className="flex gap-1 mb-6 bg-surface-muted border border-line p-1 rounded-xl w-fit">
          {(['users', 'codes', 'optouts'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                tab === t
                  ? 'bg-surface text-ink border-line-strong'
                  : 'border-transparent text-ink-faint hover:text-ink'
              }`}>
              {t === 'users' ? (isCs ? 'Uživatelé' : 'Users') : t === 'codes' ? (isCs ? 'Invite kódy' : 'Invite codes') : (isCs ? 'Vyřazení' : 'Opt-outs')}
              <span className="ml-2 text-xs tnum text-ink-faint">
                {t === 'users' ? users.length : t === 'codes' ? codes.length : optouts.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Opt-outs ── Vyřazení platí od žádosti; tady se jen kontroluje a případně zamítá. */}
        {tab === 'optouts' && (
          <div className="card">
            <p className="text-xs text-ink-faint mb-4">
              {isCs
                ? 'Žádost vyřadí subjekt okamžitě. „Potvrzeno" = žadatel klikl na odkaz v e-mailu. Zamítnout jen prokazatelně neoprávněnou žádost — subjekt se pak vrátí do výsledků.'
                : 'A request removes the entity immediately. “Confirmed” = the requester clicked the e-mail link. Reject only a demonstrably unauthorised request — the entity then returns to results.'}
            </p>
            {optouts.length === 0 ? (
              <p className="text-sm text-ink-faint">{isCs ? 'Zatím žádná žádost.' : 'No requests yet.'}</p>
            ) : (
              <div className="overflow-x-auto"><table className="table">
                <thead><tr>
                  <th>IČO / klíč</th><th>E-mail</th><th>{isCs ? 'Stav' : 'Status'}</th><th>{isCs ? 'Podáno' : 'Filed'}</th><th></th>
                </tr></thead>
                <tbody>
                  {optouts.map(o => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.firmKey}</td>
                      <td className="text-xs">{o.email || '—'}</td>
                      <td className="text-xs">
                        {o.status === 'confirmed' ? (isCs ? 'potvrzeno' : 'confirmed') : o.status === 'rejected' ? (isCs ? 'zamítnuto' : 'rejected') : (isCs ? 'platí, nepotvrzeno' : 'active, unconfirmed')}
                      </td>
                      <td className="text-xs text-ink-faint">{new Date(o.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-GB')}</td>
                      <td>
                        {o.status === 'rejected' ? (
                          <button className="btn-outline btn-sm" disabled={updating === o.id + '-optout'} onClick={() => setOptoutStatus(o, 'active')}>
                            {isCs ? 'Znovu vyřadit' : 'Remove again'}
                          </button>
                        ) : (
                          <button className="btn-outline btn-sm" disabled={updating === o.id + '-optout'} onClick={() => setOptoutStatus(o, 'rejected')}>
                            {isCs ? 'Zamítnout žádost' : 'Reject request'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-line flex items-center gap-2">
              <Users size={16} className="text-ink-faint" />
              <h2 className="font-semibold text-ink">{isCs ? 'Uživatelé' : 'Users'}</h2>
            </div>
            {loadingUsers ? (
              <div className="flex justify-center py-16">
                <svg className="animate-spin h-6 w-6 text-ink-faint" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm results-table">
                  <thead><tr>
                    <th>{isCs ? 'Uživatel' : 'User'}</th>
                    <th>{isCs ? 'Plán' : 'Plan'}</th>
                    <th>{isCs ? 'Vyhledávání' : 'Searches'}</th>
                    <th>{isCs ? 'Registrace' : 'Joined'}</th>
                    <th>VIP</th><th>Admin</th>
                    <th>{isCs ? 'Přístup' : 'Access'}</th>
                  </tr></thead>
                  <tbody>
                    {users.map(user => {
                      const isBlocked = !!user.accessExpiresAt && new Date(user.accessExpiresAt) < new Date();
                      return (
                      <tr key={user.id}>
                        <td>
                          <div className="font-medium text-ink">
                            {user.name || '—'}
                            {isBlocked && <span className="badge-red ml-2 align-middle">{isCs ? 'Bez přístupu' : 'No access'}</span>}
                          </div>
                          <div className="text-xs text-ink-faint">{user.email}</div>
                        </td>
                        <td><span className={user.plan === 'PRO' || user.plan === 'BUSINESS' ? BADGE_STRONG : 'badge'}>{user.plan}</span></td>
                        <td className="text-ink-muted">{user._count.searches}</td>
                        <td className="text-ink-faint text-xs">{formatDate(user.createdAt, locale)}</td>
                        <td>
                          <button onClick={() => toggleVip(user)} disabled={updating === user.id + '-vip'}
                            className={user.isVip ? ROW_BTN_ON : ROW_BTN_OFF}>
                            <Crown size={13} className={user.isVip ? 'fill-current' : ''} />
                            {user.isVip ? 'VIP' : (isCs ? 'Přidat' : 'Grant')}
                          </button>
                        </td>
                        <td>
                          <button onClick={() => toggleAdmin(user)} disabled={updating === user.id + '-admin'}
                            className={user.isAdmin ? ROW_BTN_ON : ROW_BTN_OFF}>
                            <Shield size={13} />
                            {user.isAdmin ? 'Admin' : (isCs ? 'Přidat' : 'Grant')}
                          </button>
                        </td>
                        <td>
                          {!user.isAdmin && (
                            <button onClick={() => toggleBlock(user)} disabled={updating === user.id + '-block'}
                              className={isBlocked ? ROW_BTN_OFF : ROW_BTN_BLOCK}>
                              {isBlocked ? (isCs ? '✓ Odblokovat' : '✓ Unblock') : (isCs ? '✕ Zablokovat' : '✕ Block')}
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Invite codes tab ── */}
        {tab === 'codes' && (
          <div className="space-y-6">
            {/* Generate form */}
            <div className="card">
              <h2 className="font-semibold text-ink mb-4 flex items-center gap-2">
                <Plus size={16} className="text-ink-faint" />
                {isCs ? 'Vygenerovat nové kódy' : 'Generate new codes'}
              </h2>
              <form onSubmit={generateCodes} className="grid sm:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="label" htmlFor="kh-gen-count">{isCs ? 'Počet kódů' : 'Number of codes'}</label>
                  <input id="kh-gen-count" type="number" className="input" min={1} max={50} value={genCount}
                    onChange={e => setGenCount(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label" htmlFor="kh-gen-note">{isCs ? 'Poznámka (volitelné)' : 'Note (optional)'}</label>
                  <input id="kh-gen-note" type="text" className="input" placeholder={isCs ? 'např. pro Petra' : 'e.g. for John'}
                    value={genNote} onChange={e => setGenNote(e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="kh-gen-minutes">{isCs ? 'Přístup (minuty)' : 'Access (minutes)'}</label>
                  <input id="kh-gen-minutes" type="number" className="input" min={1} placeholder={isCs ? 'např. 30' : 'e.g. 30'}
                    value={genAccessMinutes}
                    onChange={e => setGenAccessMinutes(e.target.value ? Number(e.target.value) : '')} />
                </div>
                <div>
                  <label className="label" htmlFor="kh-gen-expiry">{isCs ? 'Platnost do (volitelné)' : 'Expires (optional)'}</label>
                  <input id="kh-gen-expiry" type="date" className="input" value={genExpiry}
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
              <div className="px-6 py-4 border-b border-line flex items-center gap-2">
                <Ticket size={16} className="text-ink-faint" />
                <h2 className="font-semibold text-ink">{isCs ? 'Všechny invite kódy' : 'All invite codes'}</h2>
              </div>
              {loadingCodes ? (
                <div className="flex justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-ink-faint" viewBox="0 0 24 24" fill="none">
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
                <div className="overflow-x-auto">
                  <table className="w-full text-sm results-table">
                    <thead><tr>
                      <th>{isCs ? 'Kód' : 'Code'}</th>
                      <th>{isCs ? 'Poznámka' : 'Note'}</th>
                      <th>{isCs ? 'Stav' : 'Status'}</th>
                      <th>{isCs ? 'Použil' : 'Used by'}</th>
                      <th>{isCs ? 'Přístup' : 'Access'}</th>
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
                                ? <span className="badge text-xs">✓ {isCs ? 'Použit' : 'Used'}</span>
                                : expired
                                  ? <span className="badge badge-red text-xs">{isCs ? 'Expirován' : 'Expired'}</span>
                                  : <span className={`${BADGE_STRONG} text-xs`}><Clock size={11} aria-hidden /> {isCs ? 'Volný' : 'Available'}</span>}
                            </td>
                            <td className="text-ink-faint text-xs">
                              {c.usedByUser ? (c.usedByUser.name || c.usedByUser.email) : '—'}
                            </td>
                            <td className="text-ink-faint text-xs">
                              {c.accessDurationMinutes
                                ? <span className="text-ink font-medium tnum">{c.accessDurationMinutes} min</span>
                                : <span>∞</span>}
                            </td>
                            <td className="text-ink-faint text-xs">
                              {c.expiresAt ? formatDate(c.expiresAt, locale) : '∞'}
                            </td>
                            <td className="text-ink-faint text-xs">
                              {formatDate(c.createdAt, locale)}
                            </td>
                            <td>
                              <div className="flex items-center gap-1">
                                {!used && (
                                  <button onClick={() => copyCode(c)} title={isCs ? 'Kopírovat odkaz pro registraci' : 'Copy registration link'}
                                    className={`p-1.5 rounded-lg transition-colors ${isCopied ? 'text-ink bg-ink/10' : 'text-ink-faint hover:text-accent hover:bg-ink/[0.06]'}`}>
                                    {isCopied ? <Check size={14} /> : <Link2 size={14} />}
                                  </button>
                                )}
                                {!used && (
                                  <button onClick={() => deleteCode(c.id)} title={isCs ? 'Smazat kód' : 'Delete code'}
                                    className="p-1.5 rounded-lg transition-colors text-ink-faint hover:text-ink hover:bg-ink/10">
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
