'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Crown, Shield, User, Mail, Calendar, Search, BarChart3, Edit2, Check, X, Lock, Target, CreditCard, Webhook } from 'lucide-react';
import { clearUser } from '@/lib/client-auth';
import { localized } from '@/lib/lead-filters';
import { EMPTY_PROFILE, type UserProfile } from '@/lib/profile';
import {
  CriteriaField, FollowUpField, IndustryField, ProfessionField, RegionField,
  EMPTY_DRAFT, draftToPayload, toDraft, type ProfileDraft,
} from '@/components/ProfileFields';
import { industryLabel } from '@/lib/search-options';
import { hasActiveSubscription, paymentFailing, trialDaysLeft } from '@/lib/subscription';
import { formatDate, formatTime } from '@/lib/format-date';

interface ProfileData {
  user: UserProfile & {
    id: string; email: string; name?: string;
    plan: string; isAdmin: boolean; isVip: boolean; createdAt: string;
    subscriptionStatus?: string | null; currentPeriodEnd?: string | null; trialEndsAt?: string | null;
    webhookUrl?: string | null; webhookSecret?: string | null;
    _count: { searches: number };
  };
  searches: Array<{
    id: string; query: string; region: string; createdAt: string;
    _count: { results: number };
  }>;
  totalResults: number;
}

const PLAN_LABELS: Record<string, string> = { FREE: 'Zdarma', PRO: 'Pro', BUSINESS: 'Business' };

/** „zbývá 1 den / zbývají 3 dny / zbývá 5 dní“ — čeština se skloňuje podle čísla. */
function daysLeftText(n: number, cs: boolean): string {
  if (!cs) return `${n} ${n === 1 ? 'day' : 'days'} left`;
  if (n === 1) return 'zbývá 1 den';
  if (n >= 2 && n <= 4) return `zbývají ${n} dny`;
  return `zbývá ${n} dní`;
}

const T = {
  title:      { cs: 'Koho hledáte',  sk: 'Koho hľadáte',  en: 'Who you are looking for' },
  lead:       { cs: 'Odpovědi z úvodního dotazníku. Předvyplňují hledání a určují pořadí výsledků — nic neodfiltrují.',
                sk: 'Odpovede z úvodného dotazníka. Predvypĺňajú hľadanie a určujú poradie výsledkov — nič neodfiltrujú.',
                en: 'Your onboarding answers. They pre-fill the search and set the ranking — they filter nothing out.' },
  save:       { cs: 'Uložit',        sk: 'Uložiť',        en: 'Save' },
  savingNow:  { cs: 'Ukládám…',      sk: 'Ukladám…',      en: 'Saving…' },
  saved:      { cs: 'Profil uložen', sk: 'Profil uložený', en: 'Profile saved' },
  saveFailed: { cs: 'Uložení se nepovedlo. Zkuste to znovu.',
                sk: 'Uloženie sa nepodarilo. Skúste to znova.',
                en: 'Saving failed. Please try again.' },
};

export default function ProfilePage() {
  const locale = useLocale();
  const [portalBusy, setPortalBusy] = useState(false);

  /** Otevře zákaznický portál Stripe. Adresu tvoří server — v prohlížeči žádné Stripe ID není. */
  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.assign(data.url); return; }
      showToast(isCs ? 'Portál se nepodařilo otevřít. Zkuste to znovu, nebo nám napište.' : 'Could not open the portal. Try again or write to us.');
    } catch (err) {
      console.error('profile/portal:', err);
      showToast(isCs ? 'Nepodařilo se spojit se serverem.' : 'Could not reach the server.');
    }
    setPortalBusy(false);
  };
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

  // Pět vteřin, ne dvě a půl: kdo čte pomaleji nebo přes čtečku, dřív zprávu nestihl.
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 5000); };

  useEffect(() => {
    // Propadlá session je „přihlaste se znovu", ne „nejste přihlášeni" na slepé stránce.
    fetch('/api/profile')
      .then(async res => {
        if (res.status === 401) {
          clearUser();
          window.location.href = `/${locale}/auth/login`;
          return;
        }
        if (!res.ok) throw new Error(`profile ${res.status}`);
        const d = await res.json();
        setData(d);
        setNameVal(d.user?.name ?? '');
        if (d.user) setDraft(toDraft({ ...EMPTY_PROFILE, ...d.user }));
        setLoading(false);
      })
      .catch(err => {
        console.error('profile:', err);
        setLoading(false);
      });
  }, [locale]);

  const saveName = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal }),
      });
      if (!res.ok) throw new Error(`profile ${res.status}`);
      setData(prev => prev ? { ...prev, user: { ...prev.user, name: nameVal } } : prev);
      setEditName(false);
      showToast(isCs ? 'Jméno uloženo' : 'Name saved');
    } catch (err) {
      console.error('profile/name:', err);
      showToast(isCs ? 'Jméno se nepodařilo uložit. Zkuste to znovu.' : 'Could not save the name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const patch = (next: Partial<ProfileDraft>) => setDraft(d => ({ ...d, ...next }));

  /**
   * Webhook pro Make/Zapier. Adresa se ukládá zvlášť od profilu: je to technické nastavení,
   * ne odpověď z dotazníku, a tajemství pro podpis vzniká na serveru při prvním uložení.
   */
  const [webhookVal, setWebhookVal] = useState('');
  const [webhookBusy, setWebhookBusy] = useState<'save' | 'test' | null>(null);
  const [webhookNote, setWebhookNote] = useState('');
  useEffect(() => { setWebhookVal(data?.user.webhookUrl ?? ''); }, [data?.user.webhookUrl]);
  const saveWebhook = async () => {
    setWebhookBusy('save'); setWebhookNote('');
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookVal.trim() || null }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.user) {
        setData(prev => (prev ? { ...prev, user: { ...prev.user, webhookUrl: d.user.webhookUrl, webhookSecret: d.user.webhookSecret } } : prev));
        setWebhookNote(webhookVal.trim() ? (isCs ? 'Uloženo. Tajemství pro podpis je níž.' : 'Saved. The signing secret is below.') : (isCs ? 'Webhook vypnutý.' : 'Webhook off.'));
      } else if (res.status === 422 || res.status === 400) {
        setWebhookNote(isCs ? 'Adresa musí začínat https:// a nesmí mířit do vnitřní sítě.' : 'The address must start with https:// and must not point to a private network.');
      } else {
        setWebhookNote(isCs ? 'Uložení se nepodařilo — chyba na naší straně. Zkuste to znovu.' : 'Saving failed on our side. Please try again.');
      }
    } catch (err) {
      console.error('profile/webhook:', err);
      setWebhookNote(isCs ? 'Nepodařilo se spojit se serverem.' : 'Could not reach the server.');
    } finally {
      setWebhookBusy(null);
    }
  };
  const testWebhook = async () => {
    setWebhookBusy('test'); setWebhookNote('');
    const res = await fetch('/api/profile/webhook-test', { method: 'POST' });
    const d = await res.json().catch(() => null);
    setWebhookNote(res.ok
      ? (isCs ? 'Testovací událost dorazila, scénář na druhé straně ji přijal.' : 'The test event arrived; the receiving scenario accepted it.')
      : (isCs ? 'Testovací událost nedorazila. Zkontrolujte adresu a jestli je scénář zapnutý.' : 'The test event did not arrive. Check the address and that the scenario is switched on.'));
    setWebhookBusy(null);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftToPayload(draft)),
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
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      // Odpověď nemusí být JSON (504 od proxy) — dřív to shodilo handler a tlačítko zůstalo zamčené.
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setChangePw(false);
        setPwForm({ current: '', next: '' });
        showToast(isCs ? 'Heslo změněno' : 'Password changed');
      } else if (d.error === 'Wrong current password') {
        setError(isCs ? 'Současné heslo nesedí.' : 'The current password is wrong.');
      } else if (res.status === 400 || res.status === 422) {
        setError(isCs ? 'Nové heslo musí mít alespoň 8 znaků.' : 'The new password must have at least 8 characters.');
      } else {
        setError(isCs ? 'Změna hesla se nepodařila — chyba na naší straně. Zkuste to prosím znovu.' : 'Changing the password failed on our side. Please try again.');
      }
    } catch (err) {
      console.error('profile/password:', err);
      setError(isCs ? 'Nepodařilo se spojit se serverem.' : 'Could not reach the server.');
    } finally {
      setSaving(false);
    }
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
    <div className="min-h-screen pt-16 flex flex-col items-center justify-center gap-3 text-ink-muted">
      {isCs ? 'Nejste přihlášeni.' : 'Not logged in.'}
      <Link href={`/${locale}/auth/login`} className="btn-outline btn-sm">
        {isCs ? 'Přihlásit se' : 'Sign in'}
      </Link>
    </div>
  );

  const { user, searches, totalResults } = data;
  const trialDays = trialDaysLeft(user);

  return (
    <div className="min-h-screen pt-16">
      {toast && (
        <div role="status" className="fixed top-20 right-4 z-50 bg-surface-muted text-ink border border-line-strong shadow-[0_12px_32px_rgba(0,0,0,.55)] text-sm px-4 py-3 rounded-lg animate-fade-in">
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
                      onChange={e => setNameVal(e.target.value)} />
                    {/* Ikonová tlačítka bez textu potřebují `aria-label` — lucide ikona žádný
                        `<title>` nenese, takže čtečka hlásila jen „tlačítko". Padding zvětšuje
                        dotykový cíl z 21 px na 40+. */}
                    <button onClick={saveName} disabled={saving}
                      aria-label={isCs ? 'Uložit jméno' : 'Save name'}
                      className="p-2.5 rounded-lg bg-accent text-accent-ink hover:bg-accent-hover transition-colors">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditName(false)}
                      aria-label={isCs ? 'Zrušit úpravu' : 'Cancel editing'}
                      className="p-2.5 rounded-lg bg-ink/5 text-ink-faint hover:bg-ink/10">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-bold text-ink">{user.name || (isCs ? 'Bez jména' : 'No name')}</h1>
                    <button onClick={() => setEditName(true)}
                      aria-label={isCs ? 'Upravit jméno' : 'Edit name'}
                      className="p-2.5 rounded text-ink-faint hover:text-ink">
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
                  {isCs ? 'Člen od' : 'Member since'} {formatDate(user.createdAt, locale)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {/* Na 375 px zbývalo na obsah karty ~54 px, takže „Vyhledávání" i hodnota „Business"
            přetékaly z rámečku. Pod `sm` jsou karty pod sebou. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        {/*
          Předplatné.
          Tarif sám je vidět v kartě účtu nahoře; tahle sekce je o penězích — kdy se strhne
          další platba, jestli neprošla karta, a kde se to všechno mění. Kdo předplatné nemá
          (VIP, tarif od admina, účet zdarma), vidí jen odkaz na ceník.
        */}
        <div className="card">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <span className="icon-tile icon-tile--event h-7 w-7"><CreditCard size={14} /></span>
            {isCs ? 'Předplatné' : 'Subscription'}
          </h2>

          {paymentFailing(user) && (
            <p className="mt-3 rounded-lg border border-ink px-3 py-2 text-sm font-medium text-ink">
              {isCs
                ? 'Poslední platba neprošla. Stripe ji ještě několik dní zkouší — tarif vám zatím běží. Opravte prosím kartu ve správě předplatného.'
                : 'Your last payment failed. Stripe keeps retrying for a few days and your plan stays active meanwhile. Please fix your card in the billing portal.'}
            </p>
          )}

          {/* Když předplatné běží, zkušební období i se zbývajícími dny ukazuje řádek níž.
              Sem patří jen případ, kdy je stav pořád „trialing“, ale `currentPeriodEnd` už uplynul. */}
          {trialDays !== null && !hasActiveSubscription(user) && (
            <p className="mt-3 text-sm text-ink-muted tnum">
              {isCs ? 'Zkušební období, ' : 'Trial period, '}
              {daysLeftText(trialDays, isCs)}.
            </p>
          )}

          {hasActiveSubscription(user) ? (
            <>
              {/* Ve zkušebním období se ještě nic nezaplatilo, „Zaplaceno do“ by nebyla pravda. */}
              {trialDays !== null && user.trialEndsAt ? (
                <p className="mt-3 text-sm text-ink-muted tnum">
                  {isCs ? 'Zkušební období do ' : 'Trial until '}
                  {formatDate(user.trialEndsAt, locale)}
                  {', '}{daysLeftText(trialDays, isCs)}.
                </p>
              ) : user.currentPeriodEnd && (
                <p className="mt-3 text-sm text-ink-muted tnum">
                  {isCs ? 'Zaplaceno do ' : 'Paid until '}
                  {formatDate(user.currentPeriodEnd, locale)}
                </p>
              )}
              <button
                type="button"
                onClick={openPortal}
                disabled={portalBusy}
                className="btn-outline mt-4 inline-flex disabled:opacity-60"
              >
                {portalBusy
                  ? (isCs ? 'Přesměrovávám…' : 'Redirecting…')
                  : (isCs ? 'Správa předplatného' : 'Manage subscription')}
              </button>
              <p className="mt-2 text-xs text-ink-faint">
                {isCs
                  ? 'Změna tarifu, výměna karty, faktury i zrušení — všechno na jednom místě u Stripe.'
                  : 'Change plan, update card, invoices and cancellation — all in one place at Stripe.'}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              {isCs ? 'Žádné předplatné neběží. ' : 'No active subscription. '}
              <Link href={`/${locale}/pricing`} className="text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors">
                {isCs ? 'Ceník' : 'Pricing'}
              </Link>
            </p>
          )}
        </div>

        {/* Onboarding answers — editable for good, so a change of trade is one visit away */}
        <div className="card">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <span className="icon-tile icon-tile--who h-7 w-7"><Target size={14} /></span>
            {localized(T.title, locale)}
          </h2>
          <p className="text-xs text-ink-faint mb-6">{localized(T.lead, locale)}</p>

          <div className="space-y-6">
            <ProfessionField draft={draft} patch={patch} locale={locale} />
            <FollowUpField   draft={draft} patch={patch} locale={locale} />
            <IndustryField   draft={draft} patch={patch} locale={locale} />
            <RegionField     draft={draft} patch={patch} locale={locale} />
            <CriteriaField   draft={draft} patch={patch} locale={locale} />
          </div>

          <div className="mt-6 pt-4 border-t border-line">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary btn-sm">
              {savingProfile ? localized(T.savingNow, locale) : localized(T.save, locale)}
            </button>
          </div>
        </div>

        {/* Integrace: webhook pro Make a Zapier. Viz lib/webhook.ts. */}
        <div className="card" id="integrace">
          <h2 className="font-semibold text-ink flex items-center gap-2 mb-1">
            <span className="icon-tile icon-tile--reach h-7 w-7"><Webhook size={14} /></span>
            {isCs ? 'Integrace: Make, Zapier, vlastní systém' : 'Integrations: Make, Zapier, your own system'}
          </h2>
          <p className="text-xs text-ink-faint mb-4 max-w-2xl">
            {isCs
              ? 'Když doběhne hledání, pošleme firmy jako JSON (název, IČO, telefon, e-mail, web, skóre, věta „proč oslovit", audit webu) na tuhle adresu. V Make nebo Zapieru založte „Custom webhook / Catch hook" a vložte sem jeho URL. Tělo je podepsané hlavičkou X-KlientHunter-Signature (HMAC-SHA256 tajemstvím níž).'
              : 'When a search finishes we POST the firms as JSON (name, company ID, phone, e-mail, website, score, the “why” sentence, website audit) to this address. Create a “Custom webhook / Catch hook” in Make or Zapier and paste its URL here. The body is signed with the X-KlientHunter-Signature header (HMAC-SHA256 with the secret below).'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-2xl">
            <input id="kh-webhook" type="url" className="input" placeholder="https://hook.eu1.make.com/…" value={webhookVal}
              onChange={e => setWebhookVal(e.target.value)} aria-label="Webhook URL" />
            <button type="button" onClick={saveWebhook} disabled={webhookBusy !== null} className="btn-primary btn-sm whitespace-nowrap">
              {webhookBusy === 'save' ? (isCs ? 'Ukládám…' : 'Saving…') : (isCs ? 'Uložit' : 'Save')}
            </button>
            {user.webhookUrl && (
              <button type="button" onClick={testWebhook} disabled={webhookBusy !== null} className="btn-outline btn-sm whitespace-nowrap">
                {webhookBusy === 'test' ? (isCs ? 'Posílám…' : 'Sending…') : (isCs ? 'Poslat test' : 'Send a test')}
              </button>
            )}
          </div>
          {webhookNote && <p className="text-xs text-ink-muted mt-2">{webhookNote}</p>}
          {user.webhookSecret && (
            <p className="text-[11px] text-ink-faint mt-3">
              {isCs ? 'Tajemství pro podpis: ' : 'Signing secret: '}<code className="font-mono text-ink-muted select-all">{user.webhookSecret}</code>
            </p>
          )}
        </div>

        {/* Change password */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <span className="icon-tile icon-tile--standing h-7 w-7"><Lock size={14} /></span>
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
                {/* Bez `htmlFor`/`id` byl přístupný název tohohle pole prázdný — čtečka ohlásila
                    jen „editační pole". */}
                <label className="label" htmlFor="kh-pw-current">{isCs ? 'Současné heslo' : 'Current password'}</label>
                <input id="kh-pw-current" type="password" autoComplete="current-password" className="input" value={pwForm.current}
                  onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
              </div>
              <div>
                <label className="label" htmlFor="kh-pw-next">{isCs ? 'Nové heslo' : 'New password'}</label>
                <input id="kh-pw-next" type="password" autoComplete="new-password" className="input" minLength={8}
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

        {/*
          Tady stávala karta „Oslovovací e-maily“ a nad ní pole na podpis. Aplikace psala
          uživateli první zprávu za něj — jenže ty šablony vznikly pro jednoho člověka, který
          prodává weby, a každý další uživatel se jimi představoval jako někdo, kdo není.
          Napsat si vlastní zprávu umí každý líp než my; najít firmu, které stojí za to psát,
          je to, co tahle appka umí. Zbylo tedy jen hledání.

          Předtím tu byl ještě odkaz „smazat uložené údaje k Brevo“. Sloupce `brevoApiKey`
          a `brevoSenderEmail` už v databázi nejsou — držet nepoužívaný přístupový klíč
          k cizí službě odporuje zásadě minimalizace údajů (čl. 5 odst. 1 písm. c) GDPR)
          a je to bezpečnostní riziko zadarmo. Smazané je lepší než smazatelné.
        */}

        {/* Search history */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-semibold text-ink flex items-center gap-2">
              <span className="icon-tile icon-tile--standing h-7 w-7"><Search size={14} /></span>
              {isCs ? 'Historie vyhledávání' : 'Search history'}
            </h2>
          </div>
          {searches.length === 0 ? (
            <div className="text-center py-12 text-ink-faint text-sm">
              <Search size={32} className="mx-auto mb-2 opacity-20" />
              {isCs ? 'Zatím žádná vyhledávání.' : 'No searches yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Na 375 px tabulka přetékala o 20 px a rozhoupala celou stránku do stran.
                  Vodorovné rolování patří tabulce, ne dokumentu. */}
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
                    <td className="font-medium text-ink">{industryLabel(s.query, locale)}</td>
                    <td className="text-ink-muted">{s.region}</td>
                    <td>
                      <span className="badge-green text-xs">{s._count.results}</span>
                    </td>
                    <td className="text-ink-faint text-xs">
                      {formatDate(s.createdAt, locale)}
                      {' '}
                      {formatTime(s.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
