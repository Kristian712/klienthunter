'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { saveUser } from '@/lib/client-auth';

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';
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
      const data = await res.json();
      if (!res.ok) {
        setError(isCs ? 'Neplatné přihlašovací údaje.' : 'Invalid credentials.');
        return;
      }
      saveUser(data.user);
      window.location.href = `/${locale}/dashboard`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex pt-16">
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 border-r border-line">
        <Link href={`/${locale}`} className="font-extrabold text-[17px] tracking-tight">
          KlientHunter<span className="text-accent">.</span>
        </Link>
        <p className="display-sm leading-[0.9]">
          {isCs ? 'Vítejte zpět' : 'Welcome back'}<span className="text-accent">.</span>
        </p>
        <p className="text-sm text-ink-faint">
          {isCs ? 'Data z ARESu a OpenStreetMap.' : 'Data from ARES and OpenStreetMap.'}
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{t('login_title')}</h1>
            <p className="text-ink-muted text-sm mt-1">{isCs ? 'Vítejte zpět!' : 'Welcome back!'}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('email_label')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input type="email" className="input pl-9" placeholder={t('email_placeholder')}
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label">{t('password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input type="password" className="input pl-9" placeholder="••••••••"
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
          <p className="text-center text-sm text-ink-faint mt-6">
            {t('no_account')}{' '}
            <Link href={`/${locale}/auth/register`} className="font-medium text-ink underline underline-offset-2 hover:text-accent transition-colors">
              {t('register_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
