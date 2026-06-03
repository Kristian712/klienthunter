'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target, Mail, Lock, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const isCs = locale === 'cs';
  const router = useRouter();
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
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
      if (!res.ok) { setError(isCs ? 'Neplatné přihlašovací údaje.' : 'Invalid credentials.'); return; }
      router.push(`/${locale}/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex pt-16">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between bg-[#07071a] w-[420px] shrink-0 p-10">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 font-bold text-lg text-white">
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 shadow-glow">
            <Target size={18} />
          </span>
          Klient<span className="text-brand-400">Hunter</span>
        </Link>
        <div>
          <p className="text-white/30 text-sm italic leading-relaxed">
            "KlientHunter mi ušetřil hodiny hledání. Teď za 5 minut mám seznam 20 firem, které potřebují mou pomoc."
          </p>
          <p className="text-white/50 text-xs mt-3">— Jan K., webdesigner</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink">{t('login_title')}</h1>
            <p className="text-ink-muted text-sm mt-1">
              {isCs ? 'Vítejte zpět!' : 'Welcome back!'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('email_label')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder={t('email_placeholder')}
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label">{t('password_label')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="password"
                  className="input pl-9"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl text-base">
              {loading ? (
                <svg className="animate-spin h-5 w-5 mx-auto" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              ) : (
                <><span>{t('login_button')}</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-ink-faint mt-6">
            {t('no_account')}{' '}
            <Link href={`/${locale}/auth/register`} className="text-brand-600 font-medium hover:underline">
              {t('register_link')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
