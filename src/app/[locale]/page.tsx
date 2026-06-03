import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Search, BarChart3, Download, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {t('hero_title')}
          </h1>
          <p className="text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            {t('hero_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/auth/register`} className="btn-primary bg-white text-primary-700 hover:bg-primary-50 text-base px-8 py-3">
              {t('cta_start')}
            </Link>
            <Link href={`/${locale}/search`} className="btn-secondary border-white text-white hover:bg-primary-700 text-base px-8 py-3">
              {t('cta_demo')}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-4">
              <Search size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('feature1_title')}</h3>
            <p className="text-gray-500">{t('feature1_desc')}</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100 text-green-600 mb-4">
              <BarChart3 size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('feature2_title')}</h3>
            <p className="text-gray-500">{t('feature2_desc')}</p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 mb-4">
              <Download size={28} />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('feature3_title')}</h3>
            <p className="text-gray-500">{t('feature3_desc')}</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            {locale === 'cs' ? 'Jak to funguje?' : 'How does it work?'}
          </h2>
          <div className="space-y-6">
            {[
              {
                step: '1',
                cs: 'Zadej region a obor (např. Praha + restaurace)',
                en: 'Enter region and industry (e.g. London + restaurant)',
              },
              {
                step: '2',
                cs: 'Automaticky prohledáme Google Maps a najdeme firmy',
                en: 'We automatically search Google Maps and find businesses',
              },
              {
                step: '3',
                cs: 'Zkontrolujeme web, sociální sítě a recenze každé firmy',
                en: 'We check the website, social media and reviews for each business',
              },
              {
                step: '4',
                cs: 'Filtruj výsledky a exportuj seznam do Excelu',
                en: 'Filter results and export the list to Excel',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4 items-start card">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-sm">
                  {item.step}
                </div>
                <p className="text-gray-700 pt-1">
                  {locale === 'cs' ? item.cs : item.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-primary-700 text-white">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold mb-1">10k+</div>
            <div className="text-primary-200">{t('stats_businesses')}</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-1">500+</div>
            <div className="text-primary-200">{t('stats_users')}</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-1">30+</div>
            <div className="text-primary-200">{t('stats_countries')}</div>
          </div>
        </div>
      </section>

      {/* CTA bottom */}
      <section className="py-20 px-4 bg-white text-center">
        <h2 className="text-3xl font-bold mb-4">
          {locale === 'cs' ? 'Začni získávat klienty ještě dnes' : 'Start getting clients today'}
        </h2>
        <p className="text-gray-500 mb-8">
          {locale === 'cs' ? 'Zdarma. Bez platební karty.' : 'Free. No credit card required.'}
        </p>
        <Link href={`/${locale}/auth/register`} className="btn-primary text-base px-10 py-3">
          {t('cta_start')}
        </Link>
      </section>
    </div>
  );
}
