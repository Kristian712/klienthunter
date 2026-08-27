'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Crown, Shield, User, Mail, Calendar, Search, BarChart3, Edit2, Check, X, Lock, Send, Target } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { EMPTY_PROFILE, type UserProfile } from '@/lib/profile';
import {
  CriteriaField, IndustryField, ProfessionField, RegionField,
  EMPTY_DRAFT, draftToPayload, toDraft, type ProfileDraft,
} from '@/components/ProfileFields';

interface ProfileData {
  user: UserProfile & {
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

const T = {
  title:      { cs: 'Koho hledáte',  sk: 'Koho hľadáte',  en: 'Who you are looking for' },
  lead:       { cs: 'Odpovědi z úvodního dotazníku. Předvyplňují hledání a určují pořadí výsledků — nic neodfiltrují.',
                sk: 'Odpovede z úvodného dotazníka. Predvypĺňajú hľadanie a určujú poradie výsledkov — nič neodfiltrujú.',
                en: 'Your onboarding answers. They pre-fill the search and set the ranking — they filter nothing out.' },
  sigLabel:   { cs: 'Podpis pod oslovovací zprávu',
                sk: 'Podpis pod oslovovaciu správu',
                en: 'Signature under your outreach message' },
  sigHint:    { cs: 'Jeden řádek pod vaše jméno — web, telefon, cokoli. Nepovinné.',
                sk: 'Jeden riadok pod vaše meno — web, telefón, čokoľvek. Nepovinné.',
                en: 'One line under your name — a site, a phone number, anything. Optional.' },
  save:       { cs: 'Uložit',        sk: 'Uložiť',        en: 'Save' },
  savingNow:  { cs: 'Ukládám…',      sk: 'Ukladám…',      en: 'Saving…' },
  saved:      { cs: 'Profil uložen', sk: 'Profil uložený', en: 'Profile saved' },
  saveFailed: { cs: 'Uložení se nepovedlo. Zkuste to znovu.',
                sk: 'Uloženie sa nepodarilo. Skúste to znova.',
                en: 'Saving failed. Please try again.' },
};

export default function ProfilePage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  const [data, setData]         = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal]   = useState('');
  const [changePw, setChangePw] = useState(false);
  const [pwForm, setPwForm]     = useState({ current: '', next: '' });
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState('');
  const [error, setError]       = useState('');

  // The onboarding answers, editable here for good. Held as a draft so a half-finished edit is
  // never written — the user presses Save, or nothing happens.
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [savingProfile, setSavingProfile] = useState(false);
  // Not part of the draft: the onboarding modal asks four questions and this is not one of them.
  const [signature, setSignature] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      setData(d);
      setNameVal(d.user?.name ?? '');
      if (d.user) {
        setDraft(toDraft({ ...EMPTY_PROFILE, ...d.user }));
        setSignature(d.user.outreachSignature ?? '');
      }
      setLoading(false);
    });
  }, []);

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

  const patch = (next: Partial<ProfileDraft>) => setDraft(d => ({ ...d, ...next }));

  const saveProfile = async () => {
    setSavingProfile(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...draftToPayload(draft), outreachSignature: signature }),
    });
    if (res.ok) {
      const d = await res.json();
      setData(prev => (prev ? { ...prev, user: { ...prev.user, ...d.user } } : prev));
      showToast(localized(T.saved, locale));
    } else {
      showToast(localized(T.saveFailed, locale));
    }
    setSavingProfile(false);
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
      <svg className="animate-spin h-6 w-6 text-ink-faint" viewBox="0 0 24 24" fill="none">
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
        <div className="fixed top-20 right-4 z-50 bg-ink text-white text-sm px-4 py-3 rounded-lg animate-fade-in">
          {toast}
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Profile card */}
        <div className="card">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-lg border border-line flex items-center justify-center font-extrabold text-xl shrink-0">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <div className="flex-1">
              {/* Name */}
              <div className="flex items-center gap-2 mb-1">
                {editName ? (
                  <div className="flex items-center gap-2">
                    <input className="input py-1 text-lg font-bold w-48" value={nameVal}
                      onChange={e => setNameVal(e.target.value)} autoFocus />
                    <button onClick={saveName} disabled={saving} className="p-1.5 rounded-lg bg-ink text-white hover:bg-ink/85 transition-colors">
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
                    <Crown size={11} /> VIP
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
              <div className="flex justify-center mb-2 text-ink-faint">{s.icon}</div>
              <div className="text-2xl font-bold text-ink">{s.value}</div>
              <div className="text-xs text-ink-faint mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Onboarding answers — editable for good, so a change of trade is one visit away */}
        <div className="card">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <Target size={16} className="text-ink-faint" />
            {localized(T.title, locale)}
          </h2>
          <p className="text-xs text-ink-faint mb-6">{localized(T.lead, locale)}</p>

          <div className="space-y-6">
            <ProfessionField draft={draft} patch={patch} locale={locale} />
            <IndustryField   draft={draft} patch={patch} locale={locale} />
            <RegionField     draft={draft} patch={patch} locale={locale} />
            <CriteriaField   draft={draft} patch={patch} locale={locale} />

            <div>
              <label className="label">{localized(T.sigLabel, locale)}</label>
              <input
                type="text"
                className="input"
                maxLength={160}
                placeholder="https://…  ·  +420 …"
                value={signature}
                onChange={e => setSignature(e.target.value)}
              />
              <p className="text-[11px] text-ink-faint mt-1">{localized(T.sigHint, locale)}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-line">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary btn-sm">
              {savingProfile ? localized(T.savingNow, locale) : localized(T.save, locale)}
            </button>
          </div>
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
              {error && <p className="text-sm font-medium text-ink">{error}</p>}
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

        {/* Oslovovací e-maily */}
        <div className="card">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <Send size={16} className="text-ink-faint" /> Oslovovací e-maily
          </h2>
          <p className="text-xs text-ink-faint mb-4">
            KlientHunter e-maily neodesílá. Připraví ti u každé firmy koncept, který zkopíruješ
            nebo otevřeš ve své schránce a odešleš sám. Hromadné obchodní sdělení bez souhlasu
            příjemce zakazuje § 7 zákona 480/2004 Sb. – pokuta až 10 000 000 Kč.
          </p>
          {/*
            Tady dřív visel odkaz „smazat uložené údaje k Brevo“. Sloupce `brevoApiKey`
            a `brevoSenderEmail` už v databázi nejsou — držet nepoužívaný přístupový klíč
            k cizí službě odporuje zásadě minimalizace údajů (čl. 5 odst. 1 písm. c) GDPR)
            a je to bezpečnostní riziko zadarmo. Smazané je lepší než smazatelné.
          */}
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
