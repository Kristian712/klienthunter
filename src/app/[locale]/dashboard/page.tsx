'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Search, ArrowRight, Crown, Clock, BarChart3 } from 'lucide-react';

interface Search {
  id: string; query: string; region: string; createdAt: string;
  _count: { results: number };
}
interface User {
  name?: string; email: string; plan: string; isAdmin: boolean; isVip: boolean;
}

const PLAN_LABELS: Record<string, string> = { FREE: 'Zdarma', PRO: 'Pro', BUSINESS: 'Business' };

export default function DashboardPage() {
  const locale = useLocale();
  const isCs = locale === 'cs';
  const [user, setUser]       = useState<User | null>(null);
  const [searches, setSearches] = useState<Search[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setUser(d.user);
        setSearches(d.searches ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-brand-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          {user?.name ? `${isCs ? 'Vítejte' : 'Welcome'}, ${user.name}!` : (isCs ? 'Přehled' : 'Dashboard')}
        </h1>
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-2">
          <Crown size={16} className="text-brand-600" />
          <span className="text-sm font-medium text-brand-700">
            {PLAN_LABELS[user?.plan ?? 'FREE']}
            {user?.isVip && ' · VIP'}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Link href={`/${locale}/search`} className="card flex items-center gap-4 hover:shadow-card-hover transition-shadow group">
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center group-hover:bg-brand-200 transition-colors">
            <Search size={22} className="text-brand-600" />
          </div>
          <div>
            <div className="font-semibold">{isCs ? 'Nové vyhledávání' : 'New search'}</div>
            <div className="text-sm text-gray-500">{isCs ? 'Najít nové firmy' : 'Find new businesses'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </Link>
        <Link href={`/${locale}/profile`} className="card flex items-center gap-4 hover:shadow-card-hover transition-shadow group">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
            <BarChart3 size={22} className="text-emerald-600" />
          </div>
          <div>
            <div className="font-semibold">{isCs ? 'Můj profil' : 'My profile'}</div>
            <div className="text-sm text-gray-500">{isCs ? 'Historie a nastavení' : 'History & settings'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </Link>
      </div>

      {/* Recent searches */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{isCs ? 'Poslední vyhledávání' : 'Recent searches'}</h2>
        {searches.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p>{isCs ? 'Zatím žádná vyhledávání.' : 'No searches yet.'}</p>
            <Link href={`/${locale}/search`} className="btn-primary mt-4 inline-flex">
              {isCs ? 'Vyhledat firmy' : 'Search businesses'}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {searches.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-medium">{s.query}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-500">{s.region}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">{s._count.results} {isCs ? 'firem' : 'businesses'}</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} />
                    {new Date(s.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
