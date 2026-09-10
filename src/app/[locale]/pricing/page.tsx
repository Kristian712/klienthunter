'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { OPERATOR } from '@/lib/legal';
import { PLAN_LIMITS } from '@/lib/plans';

/**
 * Ceník se třemi tarify a tlačítky, která vedou do Stripe Checkoutu.
 *
 * Stránka tvrdí jen to, co aplikace umí. Čísla vyhledávání a výsledků se berou z `PLAN_LIMITS`,
 * tedy z téhož místa, které limity vynucuje API — ceník tak nemůže slíbit víc, než co uživatel
 * dostane. Vlastnosti, které v kódu neexistují (API přístup, branding, SLA), tu nejsou.
 *
 * Cena v Kč platí ve všech jazycích. Stripe účtuje v CZK a číslo na stránce se musí rovnat
 * číslu na výpisu z karty; „20 €" vedle „499 Kč" na kartě by byla klamavá cena. Slovenská
 * a anglická verze mají navíc větu, že se účtuje v korunách.
 *
 * Tarif uživatele se čte z `/api/auth/me`, tedy z databáze, kam ho zapsal webhook Stripe.
 * Nikdy z URL: `?checkout=success` říká jen „platba proběhla", banner z něj nesmí tvrdit,
 * že tarif už platí.
 */

/** Cena za měsíc v Kč. Musí se rovnat ceně nastavené ve Stripe (STRIPE_PRICE_*). */
const PRICE_CZK: Record<'PRO' | 'BUSINESS', number> = { PRO: 499, BUSINESS: 1499 };

type PaidPlan = 'PRO' | 'BUSINESS';
type PlanId = 'FREE' | PaidPlan;

interface Me {
  plan: string;
  isAdmin: boolean;
  isVip: boolean;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
}

const T = {
  title:   { cs: 'Ceník',   sk: 'Cenník',  en: 'Pricing' },
  lead: {
    cs: 'Začni zdarma, zaplať až když ti to nosí klienty. Bez závazku, zrušit jde kdykoli.',
    sk: 'Začni zadarmo, zaplať až keď ti to nosí klientov. Bez záväzku, zrušiť sa dá kedykoľvek.',
    en: 'Start free, pay once it brings you clients. No commitment, cancel any time.',
  },
  currencyNote: {
    cs: '',
    sk: 'Účtuje sa v českých korunách (CZK). Kartou zaplatíte prepočet vašej banky.',
    en: 'Billed in Czech koruna (CZK). Your bank converts the amount at its own rate.',
  },
  perMonth: { cs: '/ měsíc', sk: '/ mesiac', en: '/ month' },

  names: {
    FREE:     { cs: 'Zdarma',   sk: 'Zadarmo',  en: 'Free' },
    PRO:      { cs: 'Pro',      sk: 'Pro',      en: 'Pro' },
    BUSINESS: { cs: 'Business', sk: 'Business', en: 'Business' },
  } as Record<PlanId, { cs: string; sk: string; en: string }>,

  searches: {
    cs: '{n} vyhledávání za měsíc', sk: '{n} hľadaní za mesiac', en: '{n} searches per month',
  },
  searchesUnlimited: {
    cs: 'Neomezený počet vyhledávání', sk: 'Neobmedzený počet hľadaní', en: 'Unlimited searches',
  },
  results: {
    cs: '{n} výsledků na jedno vyhledávání', sk: '{n} výsledkov na jedno hľadanie', en: '{n} results per search',
  },
  // Co umí každý účet — bere se z toho, co aplikace opravdu dělá, ne z marketingu.
  common: [
    { cs: 'Všechny filtry a vlastní kritéria',   sk: 'Všetky filtre a vlastné kritériá',   en: 'All filters and your own criteria' },
    { cs: 'Ověření webu a dohledání kontaktů',   sk: 'Overenie webu a dohľadanie kontaktov', en: 'Website check and contact discovery' },
    { cs: 'Mapa, značky a historie hledání',     sk: 'Mapa, značky a história hľadaní',    en: 'Map, tags and search history' },
    { cs: 'Import vlastního seznamu z CSV',      sk: 'Import vlastného zoznamu z CSV',     en: 'Import your own list from CSV' },
    { cs: 'Export do CSV',                       sk: 'Export do CSV',                      en: 'CSV export' },
  ],
  // Excel je jediná funkce, kterou API opravdu váže na placený tarif (viz /api/export).
  paidOnly: { cs: 'Export do Excelu', sk: 'Export do Excelu', en: 'Excel export' },

  freeNote: {
    cs: 'Bez platební karty. Registrace je možná jen s kódem pozvánky.',
    sk: 'Bez platobnej karty. Registrácia je možná len s kódom pozvánky.',
    en: 'No card required. Registration needs an invite code.',
  },
  register:  { cs: 'Mám kód pozvánky',     sk: 'Mám kód pozvánky',      en: 'I have an invite code' },
  login:     { cs: 'Přihlásit se a koupit', sk: 'Prihlásiť sa a kúpiť', en: 'Sign in to buy' },
  buy:       { cs: 'Koupit',               sk: 'Kúpiť',                 en: 'Buy' },
  current:   { cs: 'Váš tarif',            sk: 'Váš tarif',             en: 'Your plan' },
  manage:    { cs: 'Spravovat předplatné', sk: 'Spravovať predplatné',  en: 'Manage subscription' },
  unlimited: { cs: 'Máte neomezený přístup, tarify se vás netýkají.',
               sk: 'Máte neobmedzený prístup, tarify sa vás netýkajú.',
               en: 'You have unlimited access; plans do not apply to you.' },
  renews:    { cs: 'Zaplaceno do {d}', sk: 'Zaplatené do {d}', en: 'Paid until {d}' },
  working:   { cs: 'Přesměrovávám…', sk: 'Presmerovávam…', en: 'Redirecting…' },

  success: {
    cs: 'Platba proběhla. Tarif se aktivuje během chvíle — až Stripe potvrdí platbu, změní se i tady.',
    sk: 'Platba prebehla. Tarif sa aktivuje o chvíľu — keď Stripe potvrdí platbu, zmení sa aj tu.',
    en: 'Payment received. Your plan activates in a moment — once Stripe confirms it, this page updates too.',
  },
  cancel: {
    cs: 'Platba nebyla dokončena. Nic se nestrhlo, tarif zůstává jak byl.',
    sk: 'Platba nebola dokončená. Nič sa nestrhlo, tarif zostáva ako bol.',
    en: 'Payment was not completed. Nothing was charged and your plan is unchanged.',
  },
  failed: {
    cs: 'Nepodařilo se otevřít platbu. Zkuste to znovu, nebo mi napište.',
    sk: 'Nepodarilo sa otvoriť platbu. Skúste to znova, alebo mi napíšte.',
    en: 'Could not open the payment page. Try again or write to me.',
  },
  vat: {
    cs: 'Provozovatel není plátce DPH, ceny jsou konečné.',
    sk: 'Prevádzkovateľ nie je platiteľ DPH, ceny sú konečné.',
    en: 'The operator is not VAT-registered; prices are final.',
  },
  questions: { cs: 'Máš otázku? Napiš na ', sk: 'Máš otázku? Napíš na ', en: 'Questions? Write to ' },
};

const PLANS: PlanId[] = ['FREE', 'PRO', 'BUSINESS'];

function formatCzk(n: number): string {
  // Mezera jako oddělovač tisíců: „1 499 Kč" je běžný český zápis, „1,499" čte Čech jako desetiny.
  return `${n.toLocaleString('cs-CZ')} Kč`;
}

export default function PricingPage() {
  const locale = useLocale();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);

  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined = ještě nevíme
  const [busy, setBusy] = useState<PaidPlan | 'portal' | null>(null);
  const [notice, setNotice] = useState<'success' | 'cancel' | 'failed' | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMe(d.user ?? null))
      .catch(() => setMe(null));

    // Návrat ze Stripe. Čte se jen proto, aby se ukázala věta — tarif z toho neplyne.
    const flag = new URLSearchParams(window.location.search).get('checkout');
    if (flag === 'success' || flag === 'cancel') setNotice(flag);
  }, []);

  const buy = async (plan: PaidPlan) => {
    setBusy(plan);
    setNotice(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.assign(data.url); return; }
      // Kdo už předplatné má, mění ho v portálu — stránka ho tam rovnou pošle.
      if (res.status === 409) { await portal(); return; }
      setNotice('failed');
    } catch {
      setNotice('failed');
    } finally {
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy('portal');
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) { window.location.assign(data.url); return; }
      setNotice('failed');
    } catch {
      setNotice('failed');
    } finally {
      setBusy(null);
    }
  };

  const unlimited = Boolean(me && (me.isAdmin || me.isVip));
  const currentPlan: PlanId = me && PLANS.includes(me.plan as PlanId) ? (me.plan as PlanId) : 'FREE';

  /** Tlačítko pod tarifem — podle toho, kdo se dívá. */
  const action = (plan: PlanId) => {
    if (me === undefined) return <span className="btn-outline mt-6 inline-flex opacity-50">…</span>;

    if (!me) {
      return (
        <Link href={`/${locale}/auth/${plan === 'FREE' ? 'register' : 'login'}`} className={`${plan === 'FREE' ? 'btn-primary' : 'btn-outline'} mt-6 inline-flex`}>
          {t(plan === 'FREE' ? T.register : T.login)}
        </Link>
      );
    }

    if (unlimited) return null;

    const isCurrent = currentPlan === plan;
    // Aktivní předplatné se mění v portálu; druhý Checkout by založil druhé předplatné.
    // Platí to i pro ostatní placené sloupce — změna tarifu je taky práce pro portál.
    if (me.hasSubscription && plan !== 'FREE') {
      return (
        <button type="button" onClick={portal} disabled={busy !== null} className={`${isCurrent ? 'btn-primary' : 'btn-outline'} mt-6 inline-flex disabled:opacity-60`}>
          {busy === 'portal' ? t(T.working) : t(T.manage)}
        </button>
      );
    }
    // Tarif bez předplatného ve Stripe (nastavený ručně, nebo Zdarma): není co spravovat.
    if (isCurrent) {
      return <span className="mt-6 inline-flex text-sm font-semibold text-ink">{t(T.current)}</span>;
    }
    if (plan === 'FREE') return null;

    return (
      <button type="button" onClick={() => buy(plan)} disabled={busy !== null} className="btn-primary mt-6 inline-flex disabled:opacity-60">
        {busy === plan ? t(T.working) : t(T.buy)}
      </button>
    );
  };

  const lines = (plan: PlanId) => {
    const limits = PLAN_LIMITS[plan];
    const out = [
      limits.searches === Infinity
        ? t(T.searchesUnlimited)
        : t(T.searches).replace('{n}', String(limits.searches)),
      t(T.results).replace('{n}', String(limits.resultsPerSearch)),
      ...T.common.map(t),
    ];
    if (plan !== 'FREE') out.push(t(T.paidOnly));
    return out;
  };

  return (
    <div className="min-h-screen bg-white pt-14">
      <section className="section pb-10">
        <div className="container">
          <h1 className="display-sm max-w-3xl">
            {t(T.title)}<span className="text-accent">.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-muted max-w-xl">{t(T.lead)}</p>
          {t(T.currencyNote) && (
            <p className="mt-2 text-sm text-ink-faint max-w-xl">{t(T.currencyNote)}</p>
          )}
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="container">
          {notice && (
            <div className="mb-6 rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink max-w-2xl">
              {t(notice === 'success' ? T.success : notice === 'cancel' ? T.cancel : T.failed)}
            </div>
          )}

          {unlimited && (
            <p className="mb-6 text-sm text-ink-muted">{t(T.unlimited)}</p>
          )}

          <div className="grid md:grid-cols-3 border-t border-line">
            {PLANS.map((plan, i) => {
              const isCurrent = Boolean(me) && !unlimited && currentPlan === plan;
              // Zvýrazněný je tarif, který uživatel má; nepřihlášenému ten, který si může vzít hned.
              const highlight = me ? isCurrent : plan === 'FREE';
              return (
                <div
                  key={plan}
                  className={`p-7 border-b md:border-b-0 border-line ${i < PLANS.length - 1 ? 'md:border-r' : ''} ${
                    highlight ? 'border-t-[3px] border-t-accent -mt-[3px]' : ''
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    {isCurrent ? t(T.current) : t(T.names[plan])}
                  </p>

                  <div className="flex items-end gap-1.5 mt-4">
                    <span className="tnum text-4xl font-extrabold tracking-tight">
                      {plan === 'FREE' ? formatCzk(0) : formatCzk(PRICE_CZK[plan])}
                    </span>
                    <span className="text-sm text-ink-faint mb-1.5">{t(T.perMonth)}</span>
                  </div>

                  {plan === 'FREE' && <p className="mt-2 text-sm text-ink-muted">{t(T.freeNote)}</p>}
                  {isCurrent && plan !== 'FREE' && me?.currentPeriodEnd && (
                    <p className="mt-2 text-sm text-ink-muted tnum">
                      {t(T.renews).replace('{d}', new Date(me.currentPeriodEnd).toLocaleDateString(locale === 'en' ? 'en-GB' : 'cs-CZ'))}
                    </p>
                  )}

                  {action(plan)}

                  <ul className="mt-7 space-y-3 border-t border-line pt-6">
                    {lines(plan).map((line, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-ink-muted">
                        <Check size={14} className="shrink-0 mt-0.5 text-ink" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-8 max-w-2xl text-sm text-ink-faint leading-relaxed">{t(T.vat)}</p>

          <p className="mt-12 text-sm text-ink-muted">
            {t(T.questions)}
            <a
              href={`mailto:${OPERATOR.email}`}
              className="text-ink underline underline-offset-2 hover:text-accent transition-colors"
            >
              {OPERATOR.email}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
