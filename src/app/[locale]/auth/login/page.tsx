'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { saveUser } from '@/lib/client-auth';
import { localized } from '@/lib/lead-filters';

/**
 * Chybové hlášky. Rozlišení mezi „špatné heslo" a „server je rozbitý" není kosmetika: dokud
 * se každé selhání hlásilo jako neplatné údaje, uživatel při výpadku databáze desetkrát
 * přepsal správné heslo a pak si založil nový účet.
 */
const ERR = {
  credentials: { cs: 'Neplatný e-mail nebo heslo.',
                 sk: 'Neplatný e-mail alebo heslo.',
                 en: 'Wrong e-mail or password.' },
  server:      { cs: 'Přihlášení se teď nepodařilo — chyba na naší straně. Zkuste to prosím za chvíli.',
                 sk: 'Prihlásenie sa teraz nepodarilo — chyba na našej strane. Skúste to prosím o chvíľu.',
                 en: 'Sign-in failed on our side. Please try again in a moment.' },
  network:     { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
                 sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
                 en: 'Could not reach the server. Check your connection and try again.' },
  revoked:     { cs: 'Tento účet už nemá přístup. Napište nám, pokud je to omyl.',
                 sk: 'Tento účet už nemá prístup. Napíšte nám, ak je to omyl.',
                 en: 'This account no longer has access. Write to us if that is a mistake.' },
};

const UI = {
  welcome: { cs: 'Vítejte zpět',  sk: 'Vitajte späť',  en: 'Welcome back' },
  sources: { cs: 'Data z ARESu a OpenStreetMap.',
             sk: 'Dáta z ARESu a OpenStreetMap.',
             en: 'Data from ARES and OpenStreetMap.' },
  // Stejný název, jaký nese stránka /terms i souhlas u registrace — jinak by odkaz sliboval jiný dokument.
  terms:   { cs: 'Obchodní podmínky',      sk: 'Obchodné podmienky',      en: 'Terms of Service' },
  privacy: { cs: 'Ochrana osobních údajů', sk: 'Ochrana osobných údajov', en: 'Privacy Policy' },
};

/** Odkaz v textu: akcent s tlumeným podtržením, které na hover zesílí. */
const LINK = 'text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors';

/**
 * Podmínky a ochrana údajů. Navigace i patička jsou na /auth schované, takže jinak by se
 * z přihlášení k těm dokumentům nedalo dostat. Na velké obrazovce sedí pod uvedením zdrojů
 * v levém panelu, na menší (kde panel není) pod formulářem.
 */
function LegalLinks({ locale, className }: { locale: string; className?: string }) {
  return (
    <p className={className}>
      <Link href={`/${locale}/terms`} className={LINK}>{localized(UI.terms, locale)}</Link>
      <span aria-hidden="true" className="mx-2">·</span>
      <Link href={`/${locale}/privacy`} className={LINK}>{localized(UI.privacy, locale)}</Link>
    </p>
  );
}

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        // 401 znamená „tyhle údaje nesedí", 403 „účet je zablokovaný nebo pozvánka propadla".
        // Cokoliv jiného je naše chyba, ne uživatelova.
        const which = res.status === 401 ? ERR.credentials : res.status === 403 ? ERR.revoked : ERR.server;
        setError(localized(which, locale));
        return;
      }
      // `res.json()` vyhodí výjimku, kdykoli odpověď není JSON — třeba když se mezi prohlížeč
      // a aplikaci vloží chybová stránka proxy. Bez tohohle bloku spadl celý handler mlčky.
      const data = await res.json();
      saveUser(data.user);
      window.location.href = `/${locale}/dashboard`;
    } catch {
      setError(localized(ERR.network, locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel má vlastní plochu: bez ní by na tmavém podkladu splynul s formulářem v jednu černou plochu. */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 bg-surface-subtle border-r border-line">
        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight">
          KlientHunter<span className="text-accent">.</span>
        </Link>
        <p className="display-sm leading-[0.9]">
          {localized(UI.welcome, locale)}<span className="text-accent">.</span>
        </p>
        <div className="text-sm text-ink-faint space-y-2">
          <p>{localized(UI.sources, locale)}</p>
          <LegalLinks locale={locale} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{t('login_title')}</h1>
            <p className="text-ink-muted text-sm mt-1">{localized(UI.welcome, locale)}!</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              {/* `htmlFor` + `id`: bez nich čtečka u pole hesla nemá z čeho postavit název —
                  placeholder jsou jen tečky — a klepnutí na popisek nepřesune fokus do pole. */}
              <label className="label" htmlFor="kh-login-email">{t('email_label')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="kh-login-email" type="email" autoComplete="email" className="input pl-9" placeholder={t('email_placeholder')}
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="kh-login-password">{t('password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="kh-login-password" type="password" autoComplete="current-password" className="input pl-9" placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
              </div>
            </div>
            {error && <div className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? (
                <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  {t('login_button')} <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>
          <p className="text-center text-sm text-ink-faint mt-4">
            <Link href={`/${locale}/auth/forgot`} className={LINK}>{t('forgot_link')}</Link>
          </p>
          <p className="text-center text-sm text-ink-faint mt-3">
            {t('no_account')}{' '}
            <Link href={`/${locale}/auth/register`} className={`font-medium ${LINK}`}>
              {t('register_link')}
            </Link>
          </p>
          <LegalLinks locale={locale} className="lg:hidden text-center text-xs text-ink-faint mt-8" />
        </div>
      </div>
    </div>
  );
}
