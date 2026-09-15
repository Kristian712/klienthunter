'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Check, Menu, X } from 'lucide-react';
import { loadUser, clearUser, type StoredUser, saveUser } from '@/lib/client-auth';
import { localized } from '@/lib/lead-filters';
import { LANGUAGES, switchLocale } from '@/lib/locale-switch';

type UserType = StoredUser;

/** Jazyky psané tak, jak si je čte jejich vlastní mluvčí — ne přeložené do jazyka stránky. */
/** Položky lišty mimo `messages/*.json`. Slovenština chyběla, takže Slovák dostal angličtinu. */
const T = {
  importCsv: { cs: 'Import CSV', sk: 'Import CSV', en: 'CSV import' },
  profile:   { cs: 'Můj profil', sk: 'Môj profil', en: 'My profile' },
  menu:      { cs: 'Menu', sk: 'Menu', en: 'Menu' },
  menuClose: { cs: 'Zavřít menu', sk: 'Zavrieť menu', en: 'Close menu' },
};

/**
 * Dark bar, one hairline underneath, light type. The only colour is the light-blue accent: the
 * dot in the wordmark, the register button, the active page (underline on desktop, text in the mobile menu) and the
 * chosen language — everything else earns attention through weight.
 *
 * The bar is 90 % opaque with a blur, so content scrolling under it stays faintly visible and
 * the bar reads as floating above the page. The hairline alone (white at 10 %) barely
 * separates two dark surfaces.
 *
 * Both dropdowns use surface-muted, the top of the page < card < menu ladder, so they stay
 * lighter than any card they open over. They also get a stronger edge and a shadow, because
 * neighbouring dark surfaces differ by only about 1.1 : 1. Their items hover to a faint ink
 * wash rather than to a surface token: the panel's own colour gave no feedback at all, and
 * `surface` is darker, so the item sank instead of lifting.
 */
export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  // Přihlašovací a registrační stránka je celoobrazovkový split s vlastním logem vlevo. Když
  // nad ním visela ještě tahle lišta, značka na obrazovce byla dvakrát a stránka měla dvě
  // navigace, ze kterých ani jedna nevedla dopředu. Na těch dvou cestách se lišta skrývá.
  const standalone = pathname.includes('/auth/');
  const [user, setUser]     = useState<UserType | null>(null);
  const [mobile, setMobile] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  /**
   * Jméno v liště je z localStorage, takže po vypršení relace tam zůstalo i s odkazem na
   * Přehled, který pak skončil na přihlášení. Při každé změně cesty se uložený uživatel ověří
   * u serveru; „nepřihlášen" ho smaže, výpadek serveru (`reason: 'error'`) ho nechá být.
   */
  useEffect(() => {
    const stored = loadUser();
    setUser(stored);
    if (!stored) return;
    let alive = true;
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return;
        if (d.user) { saveUser(d.user); setUser(d.user); }
        else if (d.reason !== 'error') { clearUser(); setUser(null); }
      })
      .catch(err => console.error('navbar/me:', err));
    return () => { alive = false; };
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdown(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearUser();
    window.location.href = `/${locale}`;
  };

  /**
   * Přepnutí jazyka.
   *
   * Dřív to bylo tlačítko s jedním popiskem, které cyklilo cs → en → sk. Kdo si chtěl přečíst
   * anglicky a klikl o jednou navíc, skončil ve slovenštině — a protože se volba ukládala do
   * cookie na rok, zůstal v ní i po návratu na holou doménu. Odsud ta stížnost, že se aplikace
   * sama přepíná. Teď je to seznam tří jazyků: uživatel vybere, co chce, a cookie se zapíše
   * jedině tímhle kliknutím (middleware ji už nepíše sám).
   */
  const chooseLocale = (next: string) => {
    setLangOpen(false);
    setMobile(false);
    switchLocale(pathname, next);
  };

  const links = [
    { href: `/${locale}/search`,    label: t('search') },
    { href: `/${locale}/pricing`,   label: t('pricing') },
    ...(user ? [
      { href: `/${locale}/import`,    label: localized(T.importCsv, locale) },
      { href: `/${locale}/dashboard`, label: t('dashboard') },
    ] : []),
    ...(user?.isAdmin ? [{ href: `/${locale}/admin`, label: 'Admin' }] : []),
  ];


  if (standalone) return null;
  return (
    // Skleněná lišta: jediný `backdrop-filter` v appce, pod ní prosvítá pozadí i obsah.
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/55 backdrop-blur-xl backdrop-saturate-150 border-b border-line">
      <nav className="max-w-6xl mx-auto px-5 flex items-center h-14 gap-8">

        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight shrink-0">
          KlientHunter<span className="text-accent">.</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 flex-1">
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`text-sm transition-colors ${
                  active
                    ? 'text-ink font-semibold border-b-2 border-accent -mb-[1px] pb-[2px]'
                    : 'text-ink-muted hover:text-ink'
                }`}>
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-4 ml-auto">
          <div className="relative" ref={langRef}>
            <button onClick={() => setLangOpen(v => !v)}
              aria-haspopup="listbox" aria-expanded={langOpen}
              className="text-xs font-semibold tracking-wide text-ink-muted hover:text-ink transition-colors">
              {locale.toUpperCase()}
            </button>
            {langOpen && (
              <div role="listbox"
                className="absolute right-0 top-full mt-2 w-36 bg-surface-muted border border-line-strong rounded-lg py-1 shadow-[0_12px_32px_rgba(0,0,0,.6)] animate-fade-in">
                {LANGUAGES.map(l => (
                  <button key={l.code} role="option" aria-selected={l.code === locale}
                    onClick={() => chooseLocale(l.code)}
                    className={`flex w-full items-center justify-between gap-2 text-left px-4 py-2 text-sm transition-colors hover:bg-ink/[0.06] ${
                      l.code === locale ? 'text-accent font-semibold' : 'text-ink-muted hover:text-ink'
                    }`}>
                    {l.label}
                    {/* Zvolený jazyk nese i značku, ne jen barvu: modrá od šedé textu má jen 1,2 : 1. */}
                    {l.code === locale && <Check size={14} aria-hidden />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <div className="relative" ref={dropRef}>
              <button onClick={() => setDropdown(v => !v)}
                className="text-sm text-ink-muted hover:text-ink transition-colors max-w-[180px] truncate">
                {user.name || user.email}
                {user.isAdmin && <span className="ml-2 badge">Admin</span>}
              </button>

              {dropdown && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-surface-muted border border-line-strong rounded-lg py-1 shadow-[0_12px_32px_rgba(0,0,0,.6)] animate-fade-in">
                  <Link href={`/${locale}/profile`} onClick={() => setDropdown(false)}
                    className="block px-4 py-2.5 text-sm text-ink hover:bg-ink/[0.06] transition-colors">
                    {localized(T.profile, locale)}
                  </Link>
                  <Link href={`/${locale}/dashboard`} onClick={() => setDropdown(false)}
                    className="block px-4 py-2.5 text-sm text-ink hover:bg-ink/[0.06] transition-colors">
                    {t('dashboard')}
                  </Link>
                  {user.isAdmin && (
                    <Link href={`/${locale}/admin`} onClick={() => setDropdown(false)}
                      className="block px-4 py-2.5 text-sm text-ink hover:bg-ink/[0.06] transition-colors">
                      Admin panel
                    </Link>
                  )}
                  <button onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-ink-muted hover:text-ink hover:bg-ink/[0.06] transition-colors border-t border-line mt-1">
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="text-sm text-ink-muted hover:text-ink transition-colors">
                {t('login')}
              </Link>
              <Link href={`/${locale}/auth/register`} className="btn-primary btn-sm">{t('register')}</Link>
            </>
          )}
        </div>

        <button className="md:hidden ml-auto p-2.5 text-ink" onClick={() => setMobile(v => !v)}
          aria-expanded={mobile}
          aria-controls="kh-mobile-menu"
          aria-label={localized(mobile ? T.menuClose : T.menu, locale)}>
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobile && (
        <div id="kh-mobile-menu" className="md:hidden border-t border-line px-5 py-4 space-y-1 bg-surface shadow-[0_12px_32px_rgba(0,0,0,.6)] animate-fade-in">
          {/* Mobilní menu dřív aktivní stránku nijak neukazovalo. Teď barva i svislá čárka — samotná
              modrá se od světlého textu liší jen 1,45 : 1, tvar to musí nést taky. */}
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
                aria-current={active ? 'page' : undefined}
                className={`block py-2.5 text-sm ${active ? 'font-semibold text-accent border-l-2 border-accent pl-3' : 'font-medium text-ink border-l-2 border-transparent pl-3'}`}
                onClick={() => setMobile(false)}>
                {l.label}
              </Link>
            );
          })}
          {user && (
            <Link href={`/${locale}/profile`}
              aria-current={pathname.startsWith(`/${locale}/profile`) ? 'page' : undefined}
              className={`block py-2.5 text-sm ${
                pathname.startsWith(`/${locale}/profile`)
                  ? 'font-semibold text-accent border-l-2 border-accent pl-3'
                  : 'font-medium text-ink border-l-2 border-transparent pl-3'
              }`}
              onClick={() => setMobile(false)}>
              {localized(T.profile, locale)}
            </Link>
          )}
          <div className="pt-3 border-t border-line flex flex-col gap-2">
            <div className="flex gap-2">
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => chooseLocale(l.code)}
                  className={`flex-1 text-sm py-2 border rounded-lg transition-colors ${
                    l.code === locale
                      ? 'border-accent text-accent font-semibold'
                      : 'border-line-strong text-ink-muted hover:text-ink'
                  }`}>
                  {l.label}
                </button>
              ))}
            </div>
            {user ? (
              <button onClick={handleLogout} className="btn-outline text-sm">{t('logout')}</button>
            ) : (
              <>
                <Link href={`/${locale}/auth/login`} className="btn-outline text-sm text-center">{t('login')}</Link>
                <Link href={`/${locale}/auth/register`} className="btn-primary text-sm text-center">{t('register')}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
