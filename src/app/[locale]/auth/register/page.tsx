'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          locale === 'cs' ? 'Email je již registrovaný' : 'Email already in use'
        );
        return;
      }
      router.push(`/${locale}/dashboard`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">{t('register_title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('name_label')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('name_placeholder')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('email_label')}</label>
            <input
              type="email"
              className="input"
              placeholder={t('email_placeholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('password_label')}</label>
            <input
              type="password"
              className="input"
              placeholder={locale === 'cs' ? 'Alespoň 8 znaků' : 'At least 8 characters'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? '...' : t('register_button')}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('have_account')}{' '}
          <Link href={`/${locale}/auth/login`} className="text-primary-600 hover:underline">
            {t('login_link')}
          </Link>
        </p>
      </div>
    </div>
  );
}
