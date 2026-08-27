'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, User, ArrowRight, Ticket } from 'lucide-react';
import { saveUser } from '@/lib/client-auth';
import { localized } from '@/lib/lead-filters';

/**
 * Hlášky ze serveru mapujeme na lidský text. Server posílá anglické kódy, protože nezná jazyk
 * uživatele — překlad patří sem.
 */
const ERR: Record<string, { cs: string; sk?: string; en: string }> = {
  'Invalid invite code':      { cs: 'Neplatný kód pozvánky.',      sk: 'Neplatný kód pozvánky.',      en: 'Invalid invite code.' },
  'Invite code already used': { cs: 'Tento kód už byl použitý.',   sk: 'Tento kód už bol použitý.',   en: 'This invite code has already been used.' },
  'Invite code expired':      { cs: 'Platnost kódu vypršela.',     sk: 'Platnosť kódu vypršala.',     en: 'This invite code has expired.' },
  'Email already in use':     { cs: 'Na tento e-mail už účet existuje.', sk: 'Na tento e-mail už účet existuje.', en: 'An account with this e-mail already exists.' },
};

const UI = {
  fallback: { cs: 'Registrace se nepodařila. Zkuste to prosím znovu.',
              sk: 'Registrácia sa nepodarila. Skúste to prosím znova.',
              en: 'Registration failed. Please try again.' },
  server:   { cs: 'Registrace se teď nepodařila — chyba na naší straně. Zkuste to prosím za chvíli.',
              sk: 'Registrácia sa teraz nepodarila — chyba na našej strane. Skúste to prosím o chvíľu.',
              en: 'Registration failed on our side. Please try again in a moment.' },
  network:  { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
              sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
              en: 'Could not reach the server. Check your connection and try again.' },
  perksTitle: { cs: 'Co získáš zdarma', sk: 'Čo získaš zadarmo', en: 'What you get for free' },
  inviteOnly: { cs: 'Přístup pouze na pozvánku.', sk: 'Prístup iba na pozvánku.', en: 'Invite-only access.' },
  needCode:   { cs: 'Pro registraci potřebuješ platný kód pozvánky.',
                sk: 'Na registráciu potrebuješ platný kód pozvánky.',
                en: 'You need a valid invite code to register.' },
  codeLabel:  { cs: 'Kód pozvánky', sk: 'Kód pozvánky', en: 'Invite code' },
  codeHint:   { cs: 'Kód ti pošle administrátor.', sk: 'Kód ti pošle administrátor.', en: 'The code is sent by an administrator.' },
  pwHint:     { cs: 'Alespoň 8 znaků', sk: 'Aspoň 8 znakov', en: 'At least 8 characters' },

  // Podmínky se stávají součástí smlouvy jen tehdy, když je druhá strana zná nebo je k nim
  // odkázáno (§ 1751 obč. zák.). Bez tohohle řádku se na uživatele nedaly vztáhnout vůbec.
  // Zaškrtávátko tu schválně není: souhlas se zpracováním údajů nepotřebujeme — právní základ
  // je plnění smlouvy a oprávněný zájem — a předzaškrtnutý ani vynucený „souhlas“ by byl podle
  // čl. 4 bodu 11 GDPR neplatný a jen by mátl. Odkaz před tlačítkem je to, co je správně.
  consent: {
    before: { cs: 'Vytvořením účtu souhlasíš s ', sk: 'Vytvorením účtu súhlasíš s ', en: 'By creating an account you agree to the ' },
    terms:  { cs: 'podmínkami použití',  sk: 'podmienkami použitia', en: 'terms of use' },
    middle: { cs: ' a bereš na vědomí ', sk: ' a berieš na vedomie ', en: ' and acknowledge the ' },
    privacy:{ cs: 'zpracování osobních údajů', sk: 'spracovanie osobných údajov', en: 'privacy policy' },
    after:  { cs: '.', sk: '.', en: '.' },
  },
};

const PERKS = [
  { cs: '5 vyhledávání zdarma',   sk: '5 hľadaní zadarmo',       en: '5 free searches' },
  { cs: 'Přístup ke všem filtrům', sk: 'Prístup ku všetkým filtrom', en: 'All filters included' },
  { cs: 'Export výsledků',        sk: 'Export výsledkov',        en: 'Export results' },
  { cs: 'Bez kreditní karty',     sk: 'Bez kreditnej karty',     en: 'No credit card' },
];

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    inviteCode: searchParams.get('code') ?? '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        // Serverová chyba není chyba uživatele — nemá smysl mu radit, ať opraví kód pozvánky.
        if (res.status >= 500) {
          setError(localized(UI.server, locale));
          return;
        }
        const data = await res.json().catch(() => ({}));
        const known = typeof data.error === 'string' ? ERR[data.error] : undefined;
        setError(known ? localized(known, locale) : localized(UI.fallback, locale));
        return;
      }
      // Až tady, protože `res.json()` na nejsonové odpovědi vyhodí výjimku — a ta dřív
      // propadla mimo handler, takže se uživateli neukázalo vůbec nic.
      const data = await res.json();
      saveUser(data.user);
      // Straight to the search with the onboarding modal open, rather than to a dashboard with
      // nothing on it yet: the four questions there are what make the first search useful.
      window.location.href = `/${locale}/search?welcome=1`;
    } catch {
      setError(localized(UI.network, locale));
    } finally {
      setLoading(false);
    }
  };

  const perks = PERKS.map(p => localized(p, locale));

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 border-r border-line">
        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight">
          KlientHunter<span className="text-accent">.</span>
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint mb-4">
            {localized(UI.perksTitle, locale)}
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {perks.map(p => (
              <li key={p} className="py-3 text-sm text-ink">{p}</li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink-faint">{localized(UI.inviteOnly, locale)}</p>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{t('register_title')}</h1>
            <p className="text-ink-muted text-sm mt-1">
              {localized(UI.needCode, locale)}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invite code – first and prominent */}
            <div>
              <label className="label flex items-center gap-1">
                <Ticket size={13} />
                {localized(UI.codeLabel, locale)}
                <span className="text-accent ml-0.5">*</span>
              </label>
              <input
                type="text"
                className="input font-mono tracking-widest uppercase"
                placeholder="XXXXX-XXXXX"
                value={form.inviteCode}
                onChange={e => setForm({ ...form, inviteCode: e.target.value.toUpperCase() })}
                required
                autoFocus={!form.inviteCode}
              />
              <p className="text-[11px] text-ink-faint mt-1">
                {localized(UI.codeHint, locale)}
              </p>
            </div>

            <div className="border-t border-ink/5 pt-4">
              <div>
                <label className="label">{t('name_label')}</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input type="text" className="input pl-9" placeholder={t('name_placeholder')}
                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="mt-4">
                <label className="label">{t('email_label')}</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input type="email" className="input pl-9" placeholder={t('email_placeholder')}
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>
              <div className="mt-4">
                <label className="label">{t('password_label')}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input type="password" className="input pl-9"
                    placeholder={localized(UI.pwHint, locale)}
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    required minLength={8} />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink">{error}</div>
            )}

            <p className="text-[11px] leading-relaxed text-ink-faint">
              {localized(UI.consent.before, locale)}
              <Link href={`/${locale}/terms`} className="text-ink underline underline-offset-2 hover:text-accent transition-colors">
                {localized(UI.consent.terms, locale)}
              </Link>
              {localized(UI.consent.middle, locale)}
              <Link href={`/${locale}/privacy`} className="text-ink underline underline-offset-2 hover:text-accent transition-colors">
                {localized(UI.consent.privacy, locale)}
              </Link>
              {localized(UI.consent.after, locale)}
            </p>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
              {loading ? (
                <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  {t('register_button')} <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-6">
            {t('have_account')}{' '}
            <Link href={`/${locale}/auth/login`} className="font-medium text-ink underline underline-offset-2 hover:text-accent transition-colors">
              {t('login_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
