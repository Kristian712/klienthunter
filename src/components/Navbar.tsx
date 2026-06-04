'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Globe2, Target, Crown, Shield } from 'lucide-react';

interface User { id: string; email: string; name?: string; plan: string; isAdmin?: boolean; isVip?: boolean }

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobile, setMobile] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUser(d.user));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = `/${locale}`;
  };

  const switchLocale = () => {
    const next = locale === 'cs' ? 'en' : 'cs';
    router.push(pathname.replace(`/${locale}`, `/${next}`));
  };

  const links = [
    { href: `/${locale}/search`,  label: t('search') },
    { href: `/${locale}/pricing`, label: t('pricing') },
    ...(user ? [{ href: `/${locale}/dashboard`, label: t('dashboard') }] : []),
    ...(user?.isAdmin ? [{ href: `/${locale}/admin`, label: 'Admin' }] : []),
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-xl shadow-card border-b border-ink/5'
          : 'bg-transparent'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-4 flex items-center h-16 gap-8">

        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-bold text-lg shrink-0">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 text-white shadow-glow">
            <Target size={18} />
          </span>
          <span className="text-ink">Klient<span className="text-brand-600">Hunter</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {links.map(l => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-brand-600 bg-brand-50'
                    : 'text-ink-muted hover:text-ink hover:bg-surface-muted'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <button
            onClick={switchLocale}
            className="btn-ghost text-xs gap-1.5 rounded-lg px-2.5 py-1.5"
          >
            <Globe2 size={14} />
            {locale.toUpperCase()}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              {user.isVip && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">
                  <Crown size={11} className="fill-yellow-500 text-yellow-500" /> VIP
                </span>
              )}
              {user.isAdmin && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                  <Shield size={11} /> Admin
                </span>
              )}
              <span className="text-sm text-ink-muted font-medium">{user.name || user.email}</span>
              <button onClick={handleLogout} className="btn-outline btn-sm">
                {t('logout')}
              </button>
            </div>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="btn-ghost text-sm px-4 py-2">
                {t('login')}
              </Link>
              <Link href={`/${locale}/auth/register`} className="btn-primary btn-sm">
                {t('register')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden ml-auto p-2 rounded-lg hover:bg-surface-muted transition-colors"
          onClick={() => setMobile(v => !v)}
        >
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobile && (
        <div className="md:hidden bg-white border-t border-ink/5 px-4 py-4 space-y-1 animate-fade-in shadow-card">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-ink hover:bg-surface-muted transition-colors"
              onClick={() => setMobile(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-ink/5 flex flex-col gap-2">
            <button onClick={switchLocale} className="btn-ghost text-sm justify-start">
              <Globe2 size={14} />
              {locale === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
            </button>
            {user ? (
              <button onClick={handleLogout} className="btn-outline text-sm">
                {t('logout')}
              </button>
            ) : (
              <>
                <Link href={`/${locale}/auth/login`} className="btn-outline text-sm text-center">
                  {t('login')}
                </Link>
                <Link href={`/${locale}/auth/register`} className="btn-primary text-sm text-center">
                  {t('register')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
