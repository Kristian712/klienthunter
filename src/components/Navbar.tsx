'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Globe2, Target } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name?: string;
  plan: string;
}

export function Navbar() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push(`/${locale}`);
  };

  const switchLocale = () => {
    const newLocale = locale === 'cs' ? 'en' : 'cs';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  const links = [
    { href: `/${locale}/search`, label: t('search') },
    { href: `/${locale}/pricing`, label: t('pricing') },
    ...(user ? [{ href: `/${locale}/dashboard`, label: t('dashboard') }] : []),
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2 font-bold text-xl text-primary-700">
          <Target size={24} />
          KlientHunter
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={switchLocale}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Globe2 size={16} />
            {locale === 'cs' ? 'EN' : 'CS'}
          </button>
          {user ? (
            <>
              <span className="text-sm text-gray-600">{user.name || user.email}</span>
              <button onClick={handleLogout} className="btn-secondary text-sm px-3 py-1.5">
                {t('logout')}
              </button>
            </>
          ) : (
            <>
              <Link href={`/${locale}/auth/login`} className="btn-secondary text-sm px-3 py-1.5">
                {t('login')}
              </Link>
              <Link href={`/${locale}/auth/register`} className="btn-primary text-sm px-3 py-1.5">
                {t('register')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-sm font-medium text-gray-700"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <button onClick={switchLocale} className="text-left text-sm text-gray-500">
              {locale === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'}
            </button>
            {user ? (
              <button onClick={handleLogout} className="btn-secondary text-sm">
                {t('logout')}
              </button>
            ) : (
              <>
                <Link href={`/${locale}/auth/login`} className="btn-secondary text-sm text-center">
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
    </nav>
  );
}
