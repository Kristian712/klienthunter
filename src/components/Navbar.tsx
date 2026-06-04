'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Menu, X, Globe2, Target, Crown, Shield, User, LogOut, LayoutDashboard, Settings } from 'lucide-react';

interface UserType { id: string; email: string; name?: string; plan: string; isAdmin?: boolean; isVip?: boolean }

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [user, setUser]       = useState<UserType | null>(null);
  const [mobile, setMobile]   = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Read from localStorage first (instant, no network)
    const stored = localStorage.getItem('kh_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    // Then verify with server and update
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          setUser(d.user);
          localStorage.setItem('kh_user', JSON.stringify(d.user));
        } else {
          setUser(null);
          localStorage.removeItem('kh_user');
        }
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('kh_user');
    window.location.href = `/${locale}`;
  };

  const switchLocale = () => {
    const next = locale === 'cs' ? 'en' : 'cs';
    window.location.href = pathname.replace(`/${locale}`, `/${next}`);
  };

  const links = [
    { href: `/${locale}/search`,  label: t('search') },
    { href: `/${locale}/pricing`, label: t('pricing') },
    ...(user ? [{ href: `/${locale}/dashboard`, label: t('dashboard') }] : []),
    ...(user?.isAdmin ? [{ href: `/${locale}/admin`, label: 'Admin' }] : []),
  ];

  const avatar = (user?.name || user?.email || '?')[0].toUpperCase();

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-white/90 backdrop-blur-xl shadow-card border-b border-ink/5' : 'bg-transparent'
    }`}>
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
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'text-brand-600 bg-brand-50'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-muted'
              }`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-2 ml-auto">
          <button onClick={switchLocale} className="btn-ghost text-xs gap-1.5 rounded-lg px-2.5 py-1.5">
            <Globe2 size={14} />{locale.toUpperCase()}
          </button>

          {user ? (
            <div className="relative" ref={dropRef}>
              <button
                onClick={() => setDropdown(v => !v)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-surface-muted transition-colors"
              >
                {/* Avatar */}
                <div className="relative w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                  {avatar}
                  {user.isVip && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                      <Crown size={9} className="text-yellow-900" />
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium text-ink max-w-[120px] truncate">
                  {user.name || user.email}
                </span>
                {user.isAdmin && (
                  <span className="badge badge-purple text-[10px] py-0.5 px-1.5">Admin</span>
                )}
              </button>

              {/* Dropdown */}
              {dropdown && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-card-hover border border-ink/5 py-1.5 animate-fade-in">
                  <div className="px-4 py-2 border-b border-ink/5">
                    <p className="text-xs font-semibold text-ink truncate">{user.name || user.email}</p>
                    <p className="text-[11px] text-ink-faint truncate">{user.email}</p>
                  </div>
                  <Link href={`/${locale}/profile`} onClick={() => setDropdown(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-surface-muted transition-colors">
                    <User size={15} className="text-ink-faint" />
                    {locale === 'cs' ? 'Můj profil' : 'My profile'}
                  </Link>
                  <Link href={`/${locale}/dashboard`} onClick={() => setDropdown(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-surface-muted transition-colors">
                    <LayoutDashboard size={15} className="text-ink-faint" />
                    {t('dashboard')}
                  </Link>
                  {user.isAdmin && (
                    <Link href={`/${locale}/admin`} onClick={() => setDropdown(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-surface-muted transition-colors">
                      <Shield size={15} className="text-ink-faint" />
                      Admin panel
                    </Link>
                  )}
                  <div className="border-t border-ink/5 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut size={15} />
                      {t('logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="btn-ghost text-sm px-4 py-2">{t('login')}</Link>
              <Link href={`/${locale}/auth/register`} className="btn-primary btn-sm">{t('register')}</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden ml-auto p-2 rounded-lg hover:bg-surface-muted transition-colors"
          onClick={() => setMobile(v => !v)}>
          {mobile ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobile && (
        <div className="md:hidden bg-white border-t border-ink/5 px-4 py-4 space-y-1 animate-fade-in shadow-card">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-ink hover:bg-surface-muted transition-colors"
              onClick={() => setMobile(false)}>
              {l.label}
            </Link>
          ))}
          {user && (
            <Link href={`/${locale}/profile`}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-ink hover:bg-surface-muted transition-colors"
              onClick={() => setMobile(false)}>
              {locale === 'cs' ? 'Můj profil' : 'My profile'}
            </Link>
          )}
          <div className="pt-3 border-t border-ink/5 flex flex-col gap-2">
            <button onClick={switchLocale} className="btn-ghost text-sm justify-start">
              <Globe2 size={14} />
              {locale === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
            </button>
            {user ? (
              <button onClick={handleLogout} className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50">
                <LogOut size={14} /> {t('logout')}
              </button>
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
