'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Crown, Shield, User, Mail, Calendar, Search, BarChart3, Edit2, Check, X, Lock, Facebook } from 'lucide-react';

interface ProfileData {
  user: {
    id: string; email: string; name?: string;
    plan: string; isAdmin: boolean; isVip: boolean; createdAt: string;
    _count: { searches: number };
  };
  searches: Array<{
    id: string; query: string; region: string; createdAt: string;
    _count: { results: number };
  }>;
  totalResults: number;
}

const PLAN_LABELS: Record<string, string> = { FREE: 'Zdarma', PRO: 'Pro', BUSINESS: 'Business' };

export default function ProfilePage() {
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [data, setData]         = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal]   = useState('');
  const [changePw, setChangePw] = useState(false);
  const [pwForm, setPwForm]     = useState({ current: '', next: '' });
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [error, setError]       = useState('');

  const [fbConnected, setFbConnected] = useState(false);
  const [fbForm, setFbForm]           = useState({ cUser: '', xs: '' });
  const [fbSaving, setFbSaving]       = useState(false);
  const [fbOpen, setFbOpen]           = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setData(d);
      setNameVal(d.user?.name ?? '');
      setLoading(false);
    });
    fetch('/api/profile/facebook-cookies').then(r => r.json()).then(d => {
      setFbConnected(d.connected ?? false);
    });
  }, []);

  const saveFbCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbSaving(true);
    const res = await fetch('/api/profile/facebook-cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cUser: fbForm.cUser, xs: fbForm.xs }),
    });
    if (res.ok) {
      setFbConnected(true);
      setFbForm({ cUser: '', xs: '' });
      setFbOpen(false);
      showToast('Facebook cookies uloženy');
    }
    setFbSaving(false);
  };

  const deleteFbCookies = async () => {
    await fetch('/api/profile/facebook-cookies', { method: 'DELETE' });
    setFbConnected(false);
    showToast('Facebook cookies odstraněny');
  };

  const saveName = async () => {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameVal }),
    });
    if (res.ok) {
      setData(prev => prev ? { ...prev, user: { ...prev.user, name: nameVal } } : prev);
      setEditName(false);
      showToast(isCs ? 'Jméno uloženo' : 'Name saved');
    }
    setSaving(false);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
    });
    const d = await res.json();
    if (res.ok) {
      setChangePw(false);
      setPwForm({ current: '', next: '' });
      showToast(isCs ? 'Heslo změněno' : 'Password changed');
    } else {
      setError(d.error === 'Wrong current password'
        ? (isCs ? 'Špatné současné heslo' : 'Wrong current password')
        : (isCs ? 'Chyba' : 'Error'));
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    </div>
  );

  if (!data?.user) return (
    <div className="min-h-screen pt-16 flex items-center justify-center text-ink-muted">
      {isCs ? 'Nejste přihlášeni.' : 'Not logged in.'}
    </div>
  );

  const { user, searches, totalResults } = data;

  return (
    <div className="min-h-screen bg-surface-subtle pt-16">
      {toast && (
        <div className="fixed top-20 right-4 z-50 bg-ink text-white text-sm px-4 py-3 rounded-xl shadow-card-hover animate-fade-in">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Profile card */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xl flex-shrink-0">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="flex-1">
              {/* Name */}
              <div className="flex items-center gap-2 mb-1">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input className="input py-1 text-lg font-bold w-48" value={nameVal}
                      onChange={e => setNameVal(e.target.value)} autoFocus />
                    <button onClick={saveName} disabled={saving} className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditName(false)} className="p-1.5 rounded-lg bg-ink/5 text-ink-faint hover:bg-ink/10">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-ink">{user.name || (isCs ? 'Bez jména' : 'No name')}</h1>
                    <button onClick={() => setEditName(true)} className="p-1 rounded text-ink-faint hover:text-ink">
                      <Edit2 size={13} />
                    </button>
                  </>
                )}
              </div>

              {/* Email */}
              <p className="flex items-center gap-1.5 text-sm text-ink-muted mb-3">
                <Mail size={13} /> {user.email}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={user.plan === 'PRO' ? 'badge-purple' : user.plan === 'BUSINESS' ? 'badge-green' : 'badge-yellow'}>
                  {PLAN_LABELS[user.plan] ?? user.plan}
                </span>
                {user.isVip && (
                  <span className="badge badge-yellow">
                    <Crown size={11} className="fill-yellow-500" /> VIP
                  </span>
                )}
                {user.isAdmin && (
                  <span className="badge badge-purple">
                    <Shield size={11} /> Admin
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-ink-faint">
                  <Calendar size={11} />
                  {isCs ? 'Člen od' : 'Member since'} {new Date(user.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: isCs ? 'Vyhledávání' : 'Searches',  value: user._count.searches, icon: <Search size={18} /> },
            { label: isCs ? 'Firem nalezeno' : 'Businesses found', value: totalResults, icon: <BarChart3 size={18} /> },
            { label: isCs ? 'Plán' : 'Plan', value: PLAN_LABELS[user.plan] ?? user.plan, icon: <User size={18} /> },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <div className="flex justify-center mb-2 text-brand-500">{s.icon}</div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-faint mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Change password */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Lock size={16} className="text-ink-faint" />
              {isCs ? 'Změna hesla' : 'Change password'}
            </h2>
            {!changePw && (
              <button onClick={() => setChangePw(true)} className="btn-outline btn-sm">
                {isCs ? 'Změnit heslo' : 'Change'}
              </button>
            )}
          </div>
          {changePw && (
            <form onSubmit={savePassword} className="space-y-3 max-w-sm">
              <div>
                <label className="label">{isCs ? 'Současné heslo' : 'Current password'}</label>
                <input type="password" className="input" value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{isCs ? 'Nové heslo' : 'New password'}</label>
                <input type="password" className="input" minLength={8}
                  placeholder={isCs ? 'Alespoň 8 znaků' : 'At least 8 characters'}
                  value={pwForm.next}
                  onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary btn-sm">
                  {isCs ? 'Uložit' : 'Save'}
                </button>
                <button type="button" onClick={() => { setChangePw(false); setError(''); }} className="btn-outline btn-sm">
                  {isCs ? 'Zrušit' : 'Cancel'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Facebook Finder cookies */}
        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Facebook size={16} className="text-[#1877F2]" />
              Facebook Finder
            </h2>
            {fbConnected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  <Check size={11} /> Připojeno
                </span>
                <button onClick={deleteFbCookies} className="btn-outline btn-sm text-red-600 border-red-200 hover:bg-red-50">
                  Odebrat
                </button>
              </div>
            ) : (
              <button onClick={() => setFbOpen(v => !v)} className="btn-outline btn-sm">
                Nastavit cookies
              </button>
            )}
          </div>
          <p className="text-xs text-ink-faint mb-3">
            {fbConnected
              ? 'Facebook session cookies jsou uloženy. Facebook Finder může prohledávat skupiny.'
              : 'Pro vyhledávání v Facebook skupinách potřebujeme tvoje session cookies.'}
          </p>

          {fbOpen && !fbConnected && (
            <>
              {/* Step-by-step instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm">
                <p className="font-semibold text-blue-800 mb-2">Jak získat cookies (30 sekund):</p>
                <ol className="space-y-1 text-blue-700 text-xs list-decimal list-inside">
                  <li>Otevři <strong>facebook.com</strong> v Chrome a přihlas se</li>
                  <li>Otevři DevTools: <strong>Mac:</strong> Cmd+Option+I &nbsp;|&nbsp; <strong>Windows:</strong> F12</li>
                  <li>Klikni na záložku <strong>Application</strong></li>
                  <li>Vlevo rozbal: <strong>Cookies → https://www.facebook.com</strong></li>
                  <li>Najdi řádek <strong>c_user</strong> → klikni na něj → zkopíruj hodnotu ze sloupce Value</li>
                  <li>Najdi řádek <strong>xs</strong> → klikni na něj → zkopíruj hodnotu ze sloupce Value</li>
                </ol>
                <p className="text-[11px] text-blue-600 mt-2">
                  ⚠️ Doporučujeme použít vedlejší FB účet. Cookies expirují za ~90 dní.
                </p>
              </div>

              <form onSubmit={saveFbCookies} className="space-y-3 max-w-lg">
                <div>
                  <label className="label">Hodnota cookie <strong>c_user</strong></label>
                  <input
                    className="input font-mono text-sm"
                    placeholder="123456789"
                    value={fbForm.cUser}
                    onChange={e => setFbForm(p => ({ ...p, cUser: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="label">Hodnota cookie <strong>xs</strong></label>
                  <input
                    className="input font-mono text-sm"
                    placeholder="AbCdEfGhIjKl..."
                    value={fbForm.xs}
                    onChange={e => setFbForm(p => ({ ...p, xs: e.target.value }))}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={fbSaving} className="btn-primary btn-sm">
                    {fbSaving ? 'Ukládám…' : 'Uložit cookies'}
                  </button>
                  <button type="button" onClick={() => setFbOpen(false)} className="btn-outline btn-sm">
                    Zrušit
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Search history */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-ink/5">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <Search size={16} className="text-ink-faint" />
              {isCs ? 'Historie vyhledávání' : 'Search history'}
            </h2>
          </div>
          {searches.length === 0 ? (
            <div className="text-center py-12 text-ink-faint text-sm">
              <Search size={32} className="mx-auto mb-2 opacity-20" />
              {isCs ? 'Zatím žádná vyhledávání.' : 'No searches yet.'}
            </div>
          ) : (
            <table className="w-full text-sm results-table">
              <thead><tr>
                <th>{isCs ? 'Obor' : 'Industry'}</th>
                <th>{isCs ? 'Region' : 'Region'}</th>
                <th>{isCs ? 'Firem' : 'Businesses'}</th>
                <th>{isCs ? 'Datum' : 'Date'}</th>
              </tr></thead>
              <tbody>
                {searches.map(s => (
                  <tr key={s.id}>
                    <td className="font-medium text-ink">{s.query}</td>
                    <td className="text-ink-muted">{s.region}</td>
                    <td>
                      <span className="badge-green text-xs">{s._count.results}</span>
                    </td>
                    <td className="text-ink-faint text-xs">
                      {new Date(s.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                      {' '}
                      <span className="opacity-60">
                        {new Date(s.createdAt).toLocaleTimeString(isCs ? 'cs-CZ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
