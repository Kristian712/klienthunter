import { useTranslations, useLocale } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

const PLANS = [
  {
    key: 'free',
    highlight: false,
    features_cs: ['5 vyhledávání měsíčně', '20 výsledků / vyhledávání', 'Základní filtry', 'Export do CSV'],
    features_en: ['5 searches per month', '20 results / search', 'Basic filters', 'CSV export'],
    price_cs: '0 Kč',
    price_en: '$0',
  },
  {
    key: 'pro',
    highlight: true,
    features_cs: ['100 vyhledávání měsíčně', '200 výsledků / vyhledávání', 'Pokročilé filtry', 'Export do Excelu', 'Uložené výsledky'],
    features_en: ['100 searches per month', '200 results / search', 'Advanced filters', 'Excel export', 'Saved results'],
    price_cs: '499 Kč',
    price_en: '$19',
  },
  {
    key: 'business',
    highlight: false,
    features_cs: ['Neomezená vyhledávání', '500 výsledků / vyhledávání', 'Všechny filtry', 'Excel export', 'API přístup', 'Prioritní podpora'],
    features_en: ['Unlimited searches', '500 results / search', 'All filters', 'Excel export', 'API access', 'Priority support'],
    price_cs: '1 499 Kč',
    price_en: '$59',
  },
];

const names_cs: Record<string, string> = { free: 'Zdarma', pro: 'Pro', business: 'Business' };
const names_en: Record<string, string> = { free: 'Free', pro: 'Pro', business: 'Business' };

export default function PricingPage() {
  const locale = useLocale();

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold mb-3">
          {locale === 'cs' ? 'Ceník' : 'Pricing'}
        </h1>
        <p className="text-gray-500 text-lg">
          {locale === 'cs' ? 'Vyberte si plán který vám vyhovuje' : 'Choose the plan that works for you'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`card flex flex-col ${plan.highlight ? 'ring-2 ring-primary-500 shadow-lg' : ''}`}
          >
            {plan.highlight && (
              <div className="text-center mb-4">
                <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                  {locale === 'cs' ? 'Nejoblíbenější' : 'Most popular'}
                </span>
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-xl font-bold mb-1">
                {locale === 'cs' ? names_cs[plan.key] : names_en[plan.key]}
              </h3>
              <div className="text-3xl font-bold text-gray-900">
                {locale === 'cs' ? plan.price_cs : plan.price_en}
                <span className="text-base font-normal text-gray-400">
                  {locale === 'cs' ? '/měsíc' : '/month'}
                </span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {(locale === 'cs' ? plan.features_cs : plan.features_en).map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              href={`/${locale}/auth/register`}
              className={plan.highlight ? 'btn-primary text-center' : 'btn-secondary text-center'}
            >
              {locale === 'cs' ? 'Začít' : 'Get started'}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
