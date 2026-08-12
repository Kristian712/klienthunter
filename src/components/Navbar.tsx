'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { loadUser, clearUser, type StoredUser } from '@/lib/client-auth';

type UserType = StoredUser;

/**
 * White bar, one hairline underneath, black type. The only colour is the accent on the
 * register button and under the active link — everything else earns attention through weight.
 */
export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [user, setUser]     = useState<UserType | null>(null);
  const [mobile, setMobile] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(loadUser());
  }, [pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    clearUser();
    window.location.href = `/${locale}`;
  };

  const switchLocale = () => {
    const order = ['cs', 'en', 'sk'];
    const next = order[(order.indexOf(locale) + 1) % order.length];
    window.location.href = pathname.replace(`/${locale}`, `/${next}`);
  };

  const links = [
    { href: `/${locale}/search`,    label: t('search') },
    { href: `/${locale}/pricing`,   label: t('pricing') },
    ...(user ? [
      { href: `/${locale}/import`,    label: locale === 'cs' ? 'Import CSV' : 'CSV import' },
      { href: `/${locale}/dashboard`, label: t('dashboard') },
    ] : []),
    ...(user?.isAdmin ? [{ href: `/${locale}/admin`, label: 'Admin' }] : []),
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-line">
      <nav className="max-w-6xl mx-auto px-5 flex items-center h-14 gap-8">

        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight shrink-0">
          KlientHunter<span className="text-accent">.</span>
        </Link>

        <div className="hidden md:flex items-center gap-6 flex-1">
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href}
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
          <button onClick={switchLocale}
            className="text-xs font-semibold tracking-wide text-ink-muted hover:text-ink transition-colors">
            {locale.toUpperCase()}
          </button>

          {user ? (
            <div className="relative" ref={dropRef}>
              <button onClick={() => setDropdown(v => !v)}
                className="text-sm text-ink-muted hover:text-ink transition-colors max-w-[180px] truncate">
                {user.name || user.email}
                {user.isAdmin && <span className="ml-2 badge">Admin</span>}
              </button>

              {dropdown && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-line rounded-lg py-1 animate-fade-in">
                  <Link href={`/${locale}/profile`} onClick={() => setDropdown(false)}
                    className="block px-4 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                    {locale === 'cs' ? 'Můj profil' : 'My profile'}
                  </Link>
                  <Link href={`/${locale}/dashboard`} onClick={() => setDropdown(false)}
                    className="block px-4 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                    {t('dashboard')}
                  </Link>
                  {user.isAdmin && (
                    <Link href={`/${locale}/admin`} onClick={() => setDropdown(false)}
                      className="block px-4 py-2.5 text-sm text-ink hover:bg-surface-subtle transition-colors">
                      Admin panel
                    </Link>
                  )}
                  <button onClick={handleLogout}
                    className="block w-full text-left px-4 py-2.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors border-t border-line mt-1">
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

        <button className="md:hidden ml-auto p-2 text-ink" onClick={() => setMobile(v => !v)}
          aria-label="Menu">
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobile && (
        <div className="md:hidden border-t border-line px-5 py-4 space-y-1 bg-white animate-fade-in">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className="block py-2.5 text-sm font-medium text-ink"
              onClick={() => setMobile(false)}>
              {l.label}
            </Link>
          ))}
          {user && (
            <Link href={`/${locale}/profile`} className="block py-2.5 text-sm font-medium text-ink"
              onClick={() => setMobile(false)}>
              {locale === 'cs' ? 'Můj profil' : 'My profile'}
            </Link>
          )}
          <div className="pt-3 border-t border-line flex flex-col gap-2">
            <button onClick={switchLocale} className="btn-outline text-sm">
              {locale === 'cs' ? 'English' : 'Čeština'}
            </button>
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
