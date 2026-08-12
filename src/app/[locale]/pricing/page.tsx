import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';

const PLANS = [
  {
    key: 'free',
    highlight: false,
    name_cs: 'Zdarma', name_en: 'Free',
    price_cs: '0 Kč', price_en: '$0',
    desc_cs: 'Pro vyzkoušení', desc_en: 'To get started',
    features_cs: ['5 vyhledávání / měsíc', '20 výsledků / vyhledávání', 'Základní filtry', 'Export do CSV'],
    features_en: ['5 searches / month', '20 results / search', 'Basic filters', 'CSV export'],
  },
  {
    key: 'pro',
    highlight: true,
    name_cs: 'Pro', name_en: 'Pro',
    price_cs: '499 Kč', price_en: '$19',
    desc_cs: 'Pro freelancery', desc_en: 'For freelancers',
    features_cs: ['100 vyhledávání / měsíc', '200 výsledků / vyhledávání', 'Všechny filtry', 'Export do Excelu', 'Uložené výsledky', 'Prioritní podpora'],
    features_en: ['100 searches / month', '200 results / search', 'All filters', 'Excel export', 'Saved results', 'Priority support'],
  },
  {
    key: 'business',
    highlight: false,
    name_cs: 'Business', name_en: 'Business',
    price_cs: '1 499 Kč', price_en: '$59',
    desc_cs: 'Pro agentury', desc_en: 'For agencies',
    features_cs: ['Neomezená vyhledávání', '500 výsledků / vyhledávání', 'Všechny filtry', 'Excel export', 'API přístup', 'Vlastní branding', 'SLA podpora'],
    features_en: ['Unlimited searches', '500 results / search', 'All filters', 'Excel export', 'API access', 'Custom branding', 'SLA support'],
  },
];

export default function PricingPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  return (
    <div className="min-h-screen bg-white pt-14">
      <section className="section pb-10">
        <div className="container">
          <h1 className="display-sm max-w-3xl">
            {isCs ? 'Ceník' : 'Pricing'}<span className="text-accent">.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-muted max-w-xl">
            {isCs
              ? 'Začněte zdarma. Připlatíte si, teprve až vám hledání začne vydělávat.'
              : 'Start free. Pay only once the search starts paying for itself.'}
          </p>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="container">
          <div className="grid md:grid-cols-3 border-t border-line">
            {PLANS.map(plan => (
              <div
                key={plan.key}
                className={`flex flex-col p-7 border-b border-line md:border-b-0 md:border-r last:md:border-r-0 ${
                  plan.highlight ? 'border-t-[3px] border-t-accent -mt-[3px]' : ''
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                  {isCs ? plan.name_cs : plan.name_en}
                </p>

                <div className="flex items-end gap-1.5 mt-4">
                  <span className="tnum text-4xl font-extrabold tracking-tight">
                    {isCs ? plan.price_cs : plan.price_en}
                  </span>
                  <span className="text-sm text-ink-faint mb-1.5">{isCs ? '/měs' : '/mo'}</span>
                </div>

                <p className="mt-2 text-sm text-ink-muted">{isCs ? plan.desc_cs : plan.desc_en}</p>

                <Link
                  href={`/${locale}/auth/register`}
                  className={`mt-6 w-full text-center ${plan.highlight ? 'btn-primary' : 'btn-outline'}`}
                >
                  {isCs ? 'Začít' : 'Get started'}
                </Link>

                <ul className="mt-7 space-y-3 border-t border-line pt-6">
                  {(isCs ? plan.features_cs : plan.features_en).map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-ink-muted">
                      <Check size={14} className="shrink-0 mt-0.5 text-ink" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-12 text-sm text-ink-muted">
            {isCs ? 'Máte otázky? Napište na ' : 'Questions? Write to '}
            <a href="mailto:krstnjanku@gmail.com" className="text-ink underline underline-offset-2 hover:text-accent transition-colors">
              krstnjanku@gmail.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
