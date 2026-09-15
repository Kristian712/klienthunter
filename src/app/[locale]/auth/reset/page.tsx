'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { localized } from '@/lib/lead-filters';

/** Nové heslo z odkazu v e-mailu. Token je v `?token=`; bez něj stránka rovnou pošle na žádost o nový. */
const T = {
  title:    { cs: 'Nové heslo', sk: 'Nové heslo', en: 'New password' },
  lead:     { cs: 'Zvolte nové heslo, alespoň 8 znaků.', sk: 'Zvoľte nové heslo, aspoň 8 znakov.', en: 'Choose a new password, at least 8 characters.' },
  password: { cs: 'Nové heslo', sk: 'Nové heslo', en: 'New password' },
  again:    { cs: 'Nové heslo znovu', sk: 'Nové heslo znova', en: 'New password again' },
  mismatch: { cs: 'Hesla se neshodují.', sk: 'Heslá sa nezhodujú.', en: 'The passwords do not match.' },
  save:     { cs: 'Nastavit heslo', sk: 'Nastaviť heslo', en: 'Set the password' },
  saving:   { cs: 'Ukládám…', sk: 'Ukladám…', en: 'Saving…' },
  done:     { cs: 'Heslo je nastavené. Můžete se přihlásit.', sk: 'Heslo je nastavené. Môžete sa prihlásiť.', en: 'Your password is set. You can sign in.' },
  invalid:  { cs: 'Tento odkaz už neplatí — buď vypršel (platí hodinu), nebo byl použit. Požádejte o nový.',
              sk: 'Tento odkaz už neplatí — buď vypršal (platí hodinu), alebo bol použitý. Požiadajte o nový.',
              en: 'This link is no longer valid — it expired (one hour) or was already used. Ask for a new one.' },
  missing:  { cs: 'V odkazu chybí kód. Otevřete odkaz z e-mailu celý, nebo požádejte o nový.',
              sk: 'V odkaze chýba kód. Otvorte odkaz z e-mailu celý, alebo požiadajte o nový.',
              en: 'The link is missing its code. Open the full link from the e-mail, or ask for a new one.' },
  server:   { cs: 'Uložení se nepodařilo — chyba na naší straně. Zkuste to prosím znovu.',
              sk: 'Uloženie sa nepodarilo — chyba na našej strane. Skúste to prosím znova.',
              en: 'Saving failed on our side. Please try again.' },
  network:  { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
              sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
              en: 'Could not reach the server. Check your connection and try again.' },
  login:    { cs: 'Přihlásit se', sk: 'Prihlásiť sa', en: 'Sign in' },
  newLink:  { cs: 'Požádat o nový odkaz', sk: 'Požiadať o nový odkaz', en: 'Ask for a new link' },
};

const LINK = 'text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors';

export default function ResetPage() {
  const locale = useLocale();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const [token, setToken] = useState<string | null>(null);
  const [pw, setPw] = useState({ a: '', b: '' });
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'invalid'>('idle');
  const [error, setError] = useState('');

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') ?? ''); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.a !== pw.b) { setError(t(T.mismatch)); return; }
    setState('saving'); setError('');
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw.a }),
      });
      if (res.status === 400) { setState('invalid'); return; }
      if (!res.ok) { setError(t(T.server)); setState('idle'); return; }
      setState('done');
    } catch {
      setError(t(T.network)); setState('idle');
    }
  };

  const tokenMissing = token !== null && !/^[a-f0-9]{64}$/.test(token);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight">KlientHunter<span className="text-accent">.</span></Link>
        <h1 className="text-2xl font-bold text-ink mt-8">{t(T.title)}</h1>
        <p className="text-ink-muted text-sm mt-1 mb-6">{t(T.lead)}</p>

        {state === 'done' && (
          <div role="status" className="rounded-lg border border-line-strong bg-surface-subtle px-4 py-3 text-sm text-ink">
            {t(T.done)}{' '}<Link href={`/${locale}/auth/login`} className={LINK}>{t(T.login)}</Link>
          </div>
        )}
        {(state === 'invalid' || tokenMissing) && (
          <div role="alert" className="rounded-lg border border-ink px-4 py-3 text-sm text-ink">
            {t(tokenMissing ? T.missing : T.invalid)}{' '}<Link href={`/${locale}/auth/forgot`} className={LINK}>{t(T.newLink)}</Link>
          </div>
        )}
        {state !== 'done' && state !== 'invalid' && !tokenMissing && token !== null && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="kh-reset-a">{t(T.password)}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="kh-reset-a" type="password" autoComplete="new-password" minLength={8} className="input pl-9" value={pw.a}
                  onChange={e => setPw(p => ({ ...p, a: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="kh-reset-b">{t(T.again)}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="kh-reset-b" type="password" autoComplete="new-password" minLength={8} className="input pl-9" value={pw.b}
                  onChange={e => setPw(p => ({ ...p, b: e.target.value }))} required />
              </div>
            </div>
            {error && <div role="alert" className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink">{error}</div>}
            <button type="submit" disabled={state === 'saving'} className="btn-primary w-full">
              {state === 'saving' ? t(T.saving) : <span className="flex items-center gap-2 justify-center">{t(T.save)} <ArrowRight size={16} /></span>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
