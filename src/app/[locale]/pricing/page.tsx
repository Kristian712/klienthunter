import Link from 'next/link';
import { useLocale } from 'next-intl';
import { CheckCircle2, Zap } from 'lucide-react';

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
  const isCs = locale === 'cs';

  return (
    <div className="min-h-screen bg-surface pt-16">
      {/* Header */}
      <section className="section bg-[#07071a] text-white text-center">
        <div className="container">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/15 border border-brand-500/25 text-brand-300 text-xs font-semibold mb-6">
            <Zap size={12} className="fill-brand-400 text-brand-400" />
            {isCs ? 'Jednoduchý ceník' : 'Simple pricing'}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
            {isCs ? 'Vyberte si plán' : 'Choose your plan'}
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            {isCs
              ? 'Začněte zdarma, upgradujte až budete potřebovat více.'
              : 'Start free, upgrade when you need more.'}
          </p>
        </div>
      </section>

      {/* Cards */}
      <section className="section bg-surface-subtle">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PLANS.map(plan => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  plan.highlight
                    ? 'bg-brand-600 border-brand-500 shadow-glow text-white'
                    : 'bg-white border-ink/5 shadow-card'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-brand-700 text-xs font-bold rounded-full shadow-card border border-brand-100">
                    {isCs ? '⭐ Nejoblíbenější' : '⭐ Most popular'}
                  </div>
                )}

                <div className="p-7 pb-0">
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-2 ${plan.highlight ? 'text-brand-200' : 'text-ink-faint'}`}>
                    {isCs ? plan.name_cs : plan.name_en}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-extrabold">
                      {isCs ? plan.price_cs : plan.price_en}
                    </span>
                    <span className={`text-sm mb-1 ${plan.highlight ? 'text-brand-200' : 'text-ink-faint'}`}>
                      {isCs ? '/měs' : '/mo'}
                    </span>
                  </div>
                  <p className={`text-sm mb-6 ${plan.highlight ? 'text-brand-200' : 'text-ink-faint'}`}>
                    {isCs ? plan.desc_cs : plan.desc_en}
                  </p>

                  <Link
                    href={`/${locale}/auth/register`}
                    className={`block text-center py-2.5 px-4 rounded-xl font-medium text-sm transition-all ${
                      plan.highlight
                        ? 'bg-white text-brand-700 hover:bg-brand-50'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                  >
                    {isCs ? 'Začít' : 'Get started'}
                  </Link>
                </div>

                <div className={`p-7 border-t mt-6 ${plan.highlight ? 'border-brand-500/30' : 'border-ink/5'}`}>
                  <ul className="space-y-3">
                    {(isCs ? plan.features_cs : plan.features_en).map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 size={15} className={`shrink-0 mt-0.5 ${plan.highlight ? 'text-brand-200' : 'text-emerald-500'}`} />
                        <span className={plan.highlight ? 'text-white/80' : 'text-ink-muted'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ teaser */}
          <div className="text-center mt-14">
            <p className="text-ink-muted text-sm">
              {isCs
                ? 'Máte otázky? Napište nám na '
                : 'Have questions? Contact us at '}
              <a href="mailto:hello@klienthunter.cz" className="text-brand-600 hover:underline">
                hello@klienthunter.cz
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
