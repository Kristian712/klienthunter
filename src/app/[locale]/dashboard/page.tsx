import { redirect } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Search, ArrowRight, Crown } from 'lucide-react';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/cs/auth/login');

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, email: true, name: true, plan: true },
  });

  const searches = await prisma.search.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { _count: { select: { results: true } } },
  });

  const locale = 'cs';
  const planLabels: Record<string, string> = { FREE: 'Zdarma', PRO: 'Pro', BUSINESS: 'Business' };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          {dbUser?.name ? `Vítejte, ${dbUser.name}!` : 'Přehled'}
        </h1>
        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-full px-4 py-2">
          <Crown size={16} className="text-primary-600" />
          <span className="text-sm font-medium text-primary-700">
            {planLabels[dbUser?.plan ?? 'FREE']}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href={`/${locale}/search`} className="card flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
            <Search size={22} className="text-primary-600" />
          </div>
          <div>
            <div className="font-semibold">Nové vyhledávání</div>
            <div className="text-sm text-gray-500">Najít nové firmy</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </Link>
        <Link href={`/${locale}/pricing`} className="card flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center group-hover:bg-yellow-200 transition-colors">
            <Crown size={22} className="text-yellow-600" />
          </div>
          <div>
            <div className="font-semibold">Upgradovat plán</div>
            <div className="text-sm text-gray-500">Více výsledků a exportů</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-gray-400" />
        </Link>
      </div>

      {/* Recent searches */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Poslední vyhledávání</h2>
        {searches.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p>Zatím žádná vyhledávání.</p>
            <Link href={`/${locale}/search`} className="btn-primary mt-4 inline-flex">
              Vyhledat firmy
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {searches.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-medium">{s.query}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-gray-500">{s.region}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400">{s._count.results} firem</span>
                  <span className="text-xs text-gray-400">
                    {new Date(s.createdAt).toLocaleDateString('cs-CZ')}
                  </span>
                  <Link
                    href={`/${locale}/search?searchId=${s.id}`}
                    className="text-primary-600 hover:underline text-sm"
                  >
                    Zobrazit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
