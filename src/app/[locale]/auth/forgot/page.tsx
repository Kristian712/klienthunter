'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Mail, ArrowRight } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { OPERATOR } from '@/lib/legal';

/**
 * Zapomenuté heslo. Odpověď je vždy stejná, ať účet existuje nebo ne — formulář nesmí
 * prozrazovat, kdo má u nás účet. Odkaz v e-mailu platí hodinu (viz /api/auth/forgot).
 */
const T = {
  title:   { cs: 'Obnova hesla', sk: 'Obnova hesla', en: 'Reset your password' },
  lead:    { cs: 'Zadejte e-mail, kterým jste se registrovali. Pošleme vám odkaz na nastavení nového hesla.',
             sk: 'Zadajte e-mail, ktorým ste sa registrovali. Pošleme vám odkaz na nastavenie nového hesla.',
             en: 'Enter the e-mail you registered with. We will send you a link to set a new password.' },
  email:   { cs: 'E-mail', sk: 'E-mail', en: 'E-mail' },
  send:    { cs: 'Poslat odkaz', sk: 'Poslať odkaz', en: 'Send the link' },
  sending: { cs: 'Odesílám…', sk: 'Odosielam…', en: 'Sending…' },
  done:    { cs: 'Pokud k tomuto e-mailu existuje účet, odkaz je na cestě. Platí hodinu. Nepřišel? Zkontrolujte spam a překlepy v adrese.',
             sk: 'Ak k tomuto e-mailu existuje účet, odkaz je na ceste. Platí hodinu. Neprišiel? Skontrolujte spam a preklepy v adrese.',
             en: 'If an account exists for this e-mail, the link is on its way. It is valid for an hour. Nothing arrived? Check spam and typos in the address.' },
  // Pošta se zapíná proměnnými GMAIL_USER+GMAIL_APP_PASSWORD (nebo RESEND_API_KEY); dokud není, heslo obnoví ručně provozovatel
  // (admin má v přehledu uživatelů tlačítko „Odkaz na nové heslo").
  noMail:  { cs: 'Automatické e-maily zatím nejsou zapnuté. Napište z registrované adresy na {email} — heslo vám nastavíme ručně, obvykle do 24 hodin.',
             sk: 'Automatické e-maily zatiaľ nie sú zapnuté. Napíšte z registrovanej adresy na {email} — heslo vám nastavíme ručne, zvyčajne do 24 hodín.',
             en: 'Automatic e-mails are not enabled yet. Write from your registered address to {email} — we will reset the password by hand, usually within 24 hours.' },
  rate:    { cs: 'Příliš mnoho žádostí z této adresy. Zkuste to za den, nebo nám napište.',
             sk: 'Príliš veľa žiadostí z tejto adresy. Skúste to o deň, alebo nám napíšte.',
             en: 'Too many requests from this address. Try again tomorrow or write to us.' },
  server:  { cs: 'Odeslání se nepodařilo — chyba na naší straně. Zkuste to prosím znovu.',
             sk: 'Odoslanie sa nepodarilo — chyba na našej strane. Skúste to prosím znova.',
             en: 'Sending failed on our side. Please try again.' },
  network: { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
             sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
             en: 'Could not reach the server. Check your connection and try again.' },
  back:    { cs: 'Zpět na přihlášení', sk: 'Späť na prihlásenie', en: 'Back to sign-in' },
};

const LINK = 'text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors';

export default function ForgotPage() {
  const locale = useLocale();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'noMail'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending'); setError('');
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
      if (res.status === 429) { setError(t(T.rate)); setState('idle'); return; }
      if (!res.ok) { setError(t(T.server)); setState('idle'); return; }
      const data = await res.json().catch(() => ({}));
      setState(data?.mail === 'disabled' ? 'noMail' : 'done');
    } catch {
      setError(t(T.network)); setState('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight">KlientHunter<span className="text-accent">.</span></Link>
        <h1 className="text-2xl font-bold text-ink mt-8">{t(T.title)}</h1>
        <p className="text-ink-muted text-sm mt-1 mb-6">{t(T.lead)}</p>

        {state === 'done' ? (
          <div role="status" className="rounded-lg border border-line-strong bg-surface-subtle px-4 py-3 text-sm text-ink">{t(T.done)}</div>
        ) : state === 'noMail' ? (
          <div role="status" className="rounded-lg border border-line-strong bg-surface-subtle px-4 py-3 text-sm text-ink">
            {t(T.noMail).split('{email}').map((part, i) => (
              <span key={i}>{i > 0 && <a className={LINK} href={`mailto:${OPERATOR.email}?subject=${encodeURIComponent('KlientHunter – obnova hesla')}`}>{OPERATOR.email}</a>}{part}</span>
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="kh-forgot-email">{t(T.email)}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="kh-forgot-email" type="email" autoComplete="email" className="input pl-9" value={email}
                  onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            {error && <div role="alert" className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink">{error}</div>}
            <button type="submit" disabled={state === 'sending'} className="btn-primary w-full">
              {state === 'sending' ? t(T.sending) : <span className="flex items-center gap-2 justify-center">{t(T.send)} <ArrowRight size={16} /></span>}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-ink-faint mt-6">
          <Link href={`/${locale}/auth/login`} className={LINK}>{t(T.back)}</Link>
        </p>
      </div>
    </div>
  );
}
