'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { OPERATOR } from '@/lib/legal';
import { PLAN_LIMITS, PLAN_PRICES_CZK, TRIAL_DAYS, trialDaysFor } from '@/lib/plans';
import { paymentFailing, trialDaysLeft } from '@/lib/subscription';
import { formatDate as sharedFormatDate } from '@/lib/format-date';

/**
 * Ceník se třemi tarify a tlačítky, která vedou do Stripe Checkoutu.
 *
 * Stránka tvrdí jen to, co aplikace umí. Čísla vyhledávání a výsledků se berou z `PLAN_LIMITS`,
 * tedy z téhož místa, které limity vynucuje API — ceník tak nemůže slíbit víc, než co uživatel
 * dostane. Vlastnosti, které v kódu neexistují (API přístup, branding, SLA), tu nejsou.
 * Vyhledávání API počítá za posledních 30 dní, ne za kalendářní měsíc, a tak to ceník i píše.
 *
 * Cena v Kč platí ve všech jazycích. Stripe účtuje v CZK a číslo na stránce se musí rovnat
 * číslu na výpisu z karty; „20 €" vedle „499 Kč" na kartě by byla klamavá cena. Slovenská
 * a anglická verze mají navíc větu, že se účtuje v korunách.
 *
 * Tarif uživatele se čte z `/api/auth/me`, tedy z databáze, kam ho zapsal webhook Stripe.
 * Nikdy z URL: `?checkout=success` říká jen „Checkout doběhl". Banner z něj nesmí tvrdit,
 * že tarif už platí, ani že se platilo — při prvním nákupu běží zkušební období a nestrhlo se nic.
 */

/**
 * Cena za měsíc v Kč. Musí se rovnat ceně nastavené ve Stripe (STRIPE_PRICE_*). Bere se
 * z `lib/plans.ts`, odkud ji čtou i obchodní podmínky — ceník a smlouva tak nemůžou uvádět
 * dvě různé částky.
 */
const PRICE_CZK: Record<'PRO' | 'BUSINESS', number> = PLAN_PRICES_CZK;

type PaidPlan = 'PRO' | 'BUSINESS';
type PlanId = 'FREE' | PaidPlan;

interface Me {
  plan: string;
  isAdmin: boolean;
  isVip: boolean;
  hasSubscription: boolean;
  currentPeriodEnd: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const T = {
  title:   { cs: 'Ceník',   sk: 'Cenník',  en: 'Pricing' },
  lead: {
    cs: 'Začni zdarma. Placené tarify jsou měsíční předplatné bez závazku — zrušíš ho kdykoli a platí do konce zaplaceného období.',
    sk: 'Začni zadarmo. Platené tarify sú mesačné predplatné bez záväzku — zrušíš ho kedykoľvek a platí do konca zaplateného obdobia.',
    en: 'Start free. Paid plans are monthly subscriptions with no commitment — cancel any time and your plan stays active until the end of the paid period.',
  },
  currencyNote: {
    cs: '',
    sk: 'Účtuje sa v českých korunách (CZK). Kartou zaplatíte prepočet vašej banky.',
    en: 'Billed in Czech koruna (CZK). Your bank converts the amount at its own rate.',
  },
  perMonth: { cs: '/ měsíc', sk: '/ mesiac', en: '/ month' },

  // Fakta vedle nadpisu. Platí pro každého, kdo stránku čte — proto u zkušebního období
  // stojí i podmínka „jen u prvního předplatného" (viz `trialDaysFor`).
  facts: {
    currency: { cs: 'Ceny v českých korunách (CZK), za měsíc.', sk: 'Ceny v českých korunách (CZK), za mesiac.', en: 'Prices in Czech koruna (CZK), per month.' },
    cancel: {
      cs: 'Zrušit jde kdykoli v zákaznickém portálu, tarif platí do konce zaplaceného období.',
      sk: 'Zrušiť sa dá kedykoľvek v zákazníckom portáli, tarif platí do konca zaplateného obdobia.',
      en: 'Cancel any time in the customer portal; your plan runs until the end of the paid period.',
    },
    stripe: {
      cs: 'Platby zpracovává Stripe, údaje z karty se k nám nedostanou.',
      sk: 'Platby spracúva Stripe, údaje z karty sa k nám nedostanú.',
      en: 'Payments are processed by Stripe; your card details never reach us.',
    },
    trial: {
      cs: 'U prvního předplatného na účtu {n} dní zdarma.',
      sk: 'Pri prvom predplatnom na účte {n} dní zadarmo.',
      en: '{n} days free on your account’s first subscription.',
    },
  },

  names: {
    FREE:     { cs: 'Zdarma',   sk: 'Zadarmo',  en: 'Free' },
    PRO:      { cs: 'Pro',      sk: 'Pro',      en: 'Pro' },
    BUSINESS: { cs: 'Business', sk: 'Business', en: 'Business' },
  } as Record<PlanId, { cs: string; sk: string; en: string }>,

  searches: {
    cs: '{n} vyhledávání za 30 dní', sk: '{n} hľadaní za 30 dní', en: '{n} searches per 30 days',
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
    { cs: 'Ověřený web, nebo poctivé „nevíme“',  sk: 'Overený web, alebo poctivé „nevieme“', en: 'A verified website, or an honest “we don’t know”' },
    { cs: 'Dohledání telefonu a e-mailu z webu firmy', sk: 'Dohľadanie telefónu a e-mailu z webu firmy', en: 'Phone and e-mail found on the firm’s own site' },
    { cs: 'Mapa, značky a historie hledání',     sk: 'Mapa, značky a história hľadaní',    en: 'Map, tags and search history' },
    { cs: 'Import vlastního seznamu z CSV',      sk: 'Import vlastného zoznamu z CSV',     en: 'Import your own list from CSV' },
    { cs: 'Export do CSV',                       sk: 'Export do CSV',                      en: 'CSV export' },
  ],
  // Excel je jediná funkce, kterou API opravdu váže na placený tarif (viz /api/export).
  paidOnly: { cs: 'Export do Excelu', sk: 'Export do Excelu', en: 'Excel export' },

  /**
   * Co „ověření webu" doopravdy znamená. Bez téhle věty si čtenář ceníku odvodí, že appka
   * spolehlivě vyjmenuje firmy bez webu — a to je přesně to zklamání, které přijde až po
   * zaplacení. Trojice ověřený web / nevíme / web nemá je stejná v celé aplikaci.
   */
  webNote: {
    cs: 'Web potvrdíme, jen když se stránka sama přihlásí k firmě — má na sobě její IČO, nebo celý název i obor. Když se to nepovede, napíšeme „nevíme“. Že firma web nemá, tvrdíme jen tam, kde to umíme doložit.',
    sk: 'Web potvrdíme, len keď sa stránka sama prihlási k firme — má na sebe jej IČO, alebo celý názov aj odbor. Keď sa to nepodarí, napíšeme „nevieme“. Že firma web nemá, tvrdíme len tam, kde to vieme doložiť.',
    en: 'We confirm a website only when the page itself proves it belongs to the firm — its company number, or its full name together with its trade. When that fails we say “we don’t know”. We claim a firm has no website only where we can back it up.',
  },

  // Kód pozvánky je při registraci nepovinný (viz /api/auth/register), takže ho tu nezmiňujeme.
  freeNote:  { cs: 'Bez platební karty.', sk: 'Bez platobnej karty.', en: 'No card required.' },
  register:  { cs: 'Založit účet zdarma',  sk: 'Založiť účet zadarmo',  en: 'Create a free account' },
  buy:       { cs: 'Koupit',               sk: 'Kúpiť',                 en: 'Buy' },
  tryFree:   { cs: 'Vyzkoušet zdarma',     sk: 'Vyskúšať zadarmo',      en: 'Try it free' },
  trialLine: { cs: '{n} dní zdarma',       sk: '{n} dní zadarmo',       en: '{n} days free' },
  current:   { cs: 'Váš tarif',            sk: 'Váš tarif',             en: 'Your plan' },
  recommended: { cs: 'Doporučujeme',       sk: 'Odporúčame',            en: 'Recommended' },
  manage:    { cs: 'Spravovat předplatné', sk: 'Spravovať predplatné',  en: 'Manage subscription' },
  unlimitedCard: { cs: 'Neomezený přístup — není co kupovat', sk: 'Neobmedzený prístup — nie je čo kupovať', en: 'Unlimited access — nothing to buy' },
  unlimited: { cs: 'Máte neomezený přístup, tarify se vás netýkají.',
               sk: 'Máte neobmedzený prístup, tarify sa vás netýkajú.',
               en: 'You have unlimited access; plans do not apply to you.' },
  renews:    { cs: 'Zaplaceno do {d}', sk: 'Zaplatené do {d}', en: 'Paid until {d}' },
  trialUntil: { cs: 'Zkušební období do {d}', sk: 'Skúšobné obdobie do {d}', en: 'Trial until {d}' },
  trial:     { cs: 'Zkušební období, zbývá {n} dní. Kartu vám strhneme až potom.',
               sk: 'Skúšobné obdobie, zostáva {n} dní. Kartu vám strhneme až potom.',
               en: 'Trial period, {n} days left. Your card is charged only after that.' },
  trialLast: { cs: 'Zkušební období končí dnes.',
               sk: 'Skúšobné obdobie končí dnes.',
               en: 'Your trial ends today.' },
  pastDue:   { cs: 'Poslední platba neprošla. Stripe ji ještě několik dní zkouší — dokud to trvá, tarif vám běží dál. Opravte kartu ve správě předplatného.',
               sk: 'Posledná platba neprešla. Stripe ju ešte niekoľko dní skúša — kým to trvá, tarif vám beží ďalej. Opravte kartu v správe predplatného.',
               en: 'Your last payment failed. Stripe keeps retrying for a few days and your plan stays active meanwhile. Fix your card in the billing portal.' },
  working:   { cs: 'Přesměrovávám…', sk: 'Presmerovávam…', en: 'Redirecting…' },

  // Předsmluvní informace pod tlačítkem placeného tarifu: kolik, jak dlouho a za jakých podmínek.
  termsTrial: {
    cs: '{n} dní zdarma, poté {price} měsíčně, dokud předplatné nezrušíte.',
    sk: '{n} dní zadarmo, potom {price} mesačne, kým predplatné nezrušíte.',
    en: '{n} days free, then {price} per month until you cancel.',
  },
  termsPaid: {
    cs: '{price} měsíčně, dokud předplatné nezrušíte.',
    sk: '{price} mesačne, kým predplatné nezrušíte.',
    en: '{price} per month until you cancel.',
  },
  // Rozdělené na kusy, aby „podmínky" a „zásady" mohly být odkazy uprostřed věty.
  consent: {
    before:  { cs: ' Objednáním souhlasíte s ', sk: ' Objednaním súhlasíte s ', en: ' By ordering you agree to the ' },
    terms:   { cs: 'obchodními podmínkami', sk: 'obchodnými podmienkami', en: 'terms of service' },
    middle:  { cs: ', berete na vědomí ', sk: ', beriete na vedomie ', en: ', acknowledge the ' },
    privacy: { cs: 'zásady ochrany osobních údajů', sk: 'zásady ochrany osobných údajov', en: 'privacy policy' },
    after: {
      cs: ' a žádáte o zpřístupnění tarifu ihned.',
      sk: ' a žiadate o sprístupnenie tarifu ihneď.',
      en: ' and request that the plan be made available immediately.',
    },
  },

  success: {
    cs: 'Objednávka je dokončená. Tarif se tu ukáže během chvíle, jakmile ji Stripe potvrdí.',
    sk: 'Objednávka je dokončená. Tarif sa tu zobrazí o chvíľu, keď ju Stripe potvrdí.',
    en: 'Your order is complete. Your plan will appear here shortly, once Stripe confirms it.',
  },
  successTrial: {
    cs: 'Zkušební období začalo. První platba proběhne {date}, pokud předplatné předtím nezrušíte.',
    sk: 'Skúšobné obdobie začalo. Prvá platba prebehne {date}, ak predplatné predtým nezrušíte.',
    en: 'Your trial has started. The first payment will be taken on {date} unless you cancel before then.',
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

  /**
   * Otázky k předplatnému. Každá odpověď odpovídá kódu: trial jen poprvé (`trialDaysFor`),
   * zrušení a změny přes portál Stripe (`/api/stripe/portal`), po konci předplatného webhook
   * vrátí účet na FREE a nic nemaže.
   */
  faqTitle: { cs: 'Jak funguje předplatné', sk: 'Ako funguje predplatné', en: 'How the subscription works' },
  faq: [
    {
      q: { cs: 'Jak funguje zkušební období?', sk: 'Ako funguje skúšobné obdobie?', en: 'How does the trial work?' },
      a: {
        cs: 'Dostanete ho jen u prvního předplatného na účtu: {n} dní zdarma. Kartu zadáte při objednávce u Stripe, ale během zkušebního období se z ní nic nestrhne. Když předplatné zrušíte před jeho koncem, nezaplatíte nic.',
        sk: 'Dostanete ho len pri prvom predplatnom na účte: {n} dní zadarmo. Kartu zadáte pri objednávke v Stripe, ale počas skúšobného obdobia sa z nej nič nestrhne. Keď predplatné zrušíte pred jeho koncom, nezaplatíte nič.',
        en: 'You get it only with the first subscription on an account: {n} days free. You enter your card at Stripe checkout, but nothing is charged during the trial. Cancel before it ends and you pay nothing.',
      },
    },
    {
      q: { cs: 'Kdy proběhne první platba?', sk: 'Kedy prebehne prvá platba?', en: 'When is the first payment taken?' },
      a: {
        cs: 'Na konci zkušebního období. Potom se předplatné platí každý měsíc ve stejný den. Kdo už předplatné jednou měl, zkušební období nedostane a první platba proběhne hned při objednávce.',
        sk: 'Na konci skúšobného obdobia. Potom sa predplatné platí každý mesiac v rovnaký deň. Kto už predplatné raz mal, skúšobné obdobie nedostane a prvá platba prebehne hneď pri objednávke.',
        en: 'At the end of the trial. After that the subscription is charged every month on the same day. If you have had a subscription before, there is no trial and the first payment is taken when you order.',
      },
    },
    {
      q: { cs: 'Jak předplatné zruším?', sk: 'Ako predplatné zruším?', en: 'How do I cancel?' },
      a: {
        cs: 'V sekci „Můj profil" klikněte na „Správa předplatného". Otevře se zákaznický portál Stripe, kde předplatné zrušíte. Zrušení platí ke konci zaplaceného období (ve zkušebním období k jeho konci) a do té doby vám tarif zůstává.',
        sk: 'V profile kliknite na „Správa predplatného". Otvorí sa zákaznícky portál Stripe, kde predplatné zrušíte. Zrušenie platí ku koncu zaplateného obdobia (v skúšobnom období k jeho koncu) a dovtedy vám tarif zostáva.',
        en: 'Go to My profile → Manage subscription. It opens the Stripe customer portal, where you can cancel. Cancellation takes effect at the end of the paid period (during a trial, at the end of the trial), and your plan stays active until then.',
      },
    },
    {
      q: { cs: 'Co se stane s mými daty po zrušení?', sk: 'Čo sa stane s mojimi dátami po zrušení?', en: 'What happens to my data after cancelling?' },
      a: {
        cs: 'Účet se vrátí na tarif Zdarma. Historie vyhledávání, značky i importované seznamy zůstanou, jen znovu platí limity tarifu Zdarma a export do Excelu už nebude k dispozici.',
        sk: 'Účet sa vráti na tarif Zadarmo. História hľadaní, značky aj importované zoznamy zostanú, len znova platia limity tarifu Zadarmo a export do Excelu už nebude k dispozícii.',
        en: 'Your account goes back to the Free plan. Your search history, tags and imported lists stay; only the Free plan limits apply again and Excel export is no longer available.',
      },
    },
  ],

  questions: { cs: 'Máš otázku? Napiš na ', sk: 'Máš otázku? Napíš na ', en: 'Questions? Write to ' },
};

const PLANS: PlanId[] = ['FREE', 'PRO', 'BUSINESS'];

/** Odkaz v běžném textu: akcentový, podtržení tlumené a na hoveru plné. */
const LINK = 'text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors';

function formatCzk(n: number): string {
  // Mezera jako oddělovač tisíců: „1 499 Kč" je běžný český zápis, „1,499" čte Čech jako desetiny.
  return `${n.toLocaleString('cs-CZ')} Kč`;
}

/**
 * Průhlednost pro zablokované tlačítko. Tlačítko, které právě přesměrovává, zůstává plné:
 * nese text „Přesměrovávám…" a musí být vidět, že se něco děje.
 * Ostatní jsou jen neaktivní a zašednout smí.
 */
function dimUnless(working: boolean): string {
  return working ? 'disabled:opacity-100' : 'disabled:opacity-60';
}

export default function PricingPage() {
  const locale = useLocale();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  // Formát data je společný pro celou aplikaci (viz lib/format-date.ts) — dřív si ho psala
  // každá stránka sama a ceník s profilem ukazovaly totéž datum jinak.
  const formatDate = (iso: string) => sharedFormatDate(iso, locale);

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
  const trialDays = me ? trialDaysLeft(me) : null;
  /** Dostane tenhle návštěvník v Checkoutu zkušební období? Nepřihlášený = budoucí nový účet = ano. */
  const trialEligible = me === null || (me !== undefined && trialDaysFor(me.subscriptionStatus) !== undefined);
  const currentPlan: PlanId = me && PLANS.includes(me.plan as PlanId) ? (me.plan as PlanId) : 'FREE';

  /**
   * Věta po návratu z Checkoutu. „Platba proběhla" by u prvního nákupu nebyla pravda: běží
   * zkušební období a nestrhlo se nic. Jestli trial běží, ví až `me` z databáze — dokud to
   * webhook nezapíše, ukáže se neutrální věta, která o penězích nic netvrdí.
   */
  const noticeText = (): string => {
    if (notice === 'success') {
      return me?.subscriptionStatus === 'trialing' && me.trialEndsAt
        ? t(T.successTrial).replace('{date}', formatDate(me.trialEndsAt))
        : t(T.success);
    }
    return t(notice === 'cancel' ? T.cancel : T.failed);
  };

  /** Tlačítko pod tarifem — podle toho, kdo se dívá. */
  const action = (plan: PlanId) => {
    // Kostra bez textu: dokud nevíme, kdo se dívá, nevíme ani, co na tlačítku bude.
    if (me === undefined) {
      return <span aria-hidden="true" className="mt-6 inline-flex h-10 w-40 rounded-lg bg-ink/[0.08] animate-pulse" />;
    }

    if (!me) {
      // Placený tarif je hlavní akce stránky, účet zdarma vedlejší.
      return (
        <Link href={`/${locale}/auth/${plan === 'FREE' ? 'register' : 'login'}`} className={`${plan === 'FREE' ? 'btn-outline' : 'btn-primary'} mt-6 inline-flex`}>
          {t(plan === 'FREE' ? T.register : T.tryFree)}
        </Link>
      );
    }

    // Admin a VIP nic nekupují — Checkout by jim založil předplatné, které nepotřebují. Prázdné
    // místo po tlačítku ale vypadalo jako chyba, tak tu stojí, proč tlačítko není.
    if (unlimited) {
      return (
        <span className="mt-6 inline-flex rounded-full border border-line px-3 py-1.5 text-xs text-ink-faint">
          {t(T.unlimitedCard)}
        </span>
      );
    }

    const isCurrent = currentPlan === plan;
    // Aktivní předplatné se mění v portálu; druhý Checkout by založil druhé předplatné.
    // Platí to i pro ostatní placené sloupce — změna tarifu je taky práce pro portál.
    if (me.hasSubscription && plan !== 'FREE') {
      return (
        <button type="button" onClick={portal} disabled={busy !== null} className={`${isCurrent ? 'btn-primary' : 'btn-outline'} mt-6 inline-flex ${dimUnless(busy === 'portal')}`}>
          {busy === 'portal' ? t(T.working) : t(T.manage)}
        </button>
      );
    }
    // Tarif bez předplatného ve Stripe (nastavený ručně, nebo Zdarma): není co spravovat
    // a „Váš tarif" už stojí ve štítku nad kartou.
    if (isCurrent || plan === 'FREE') return null;

    return (
      <button type="button" onClick={() => buy(plan)} disabled={busy !== null} className={`btn-primary mt-6 inline-flex ${dimUnless(busy === plan)}`}>
        {busy === plan ? t(T.working) : t(trialEligible ? T.tryFree : T.buy)}
      </button>
    );
  };

  /** Může si návštěvník tarif v tomhle sloupci objednat? Stejné větve jako v `action`. */
  const buyable = (plan: PlanId) =>
    plan !== 'FREE' && (me === null || (me !== undefined && !unlimited && !me.hasSubscription && currentPlan !== plan));

  const terms = (plan: PaidPlan) =>
    (trialEligible ? t(T.termsTrial).replace('{n}', String(TRIAL_DAYS)) : t(T.termsPaid))
      .replace('{price}', formatCzk(PRICE_CZK[plan]));

  /**
   * Datum u tarifu, který uživatel má. Ve zkušebním období se nic nezaplatilo, takže tam
   * „Zaplaceno do" stát nesmí — ukáže se konec zkušebního období.
   */
  const periodLine = (): string | null => {
    if (!me) return null;
    // Neprošlá platba: při obnově Stripe posunul `currentPeriodEnd` na konec nového, nezaplaceného
    // období. „Zaplaceno do" by lhalo hned pod bannerem o neprošlé platbě, datum se tu neukáže.
    if (paymentFailing(me)) return null;
    if (me.subscriptionStatus === 'trialing') {
      return me.trialEndsAt ? t(T.trialUntil).replace('{d}', formatDate(me.trialEndsAt)) : null;
    }
    return me.currentPeriodEnd ? t(T.renews).replace('{d}', formatDate(me.currentPeriodEnd)) : null;
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
    <div className="min-h-screen">
      {/* Navigace je fixní a vysoká h-14. pt-24 / md:pt-28 nechá pod ní 40 / 56 px, ne 136 / 168 px jako `.section`. */}
      <section className="relative overflow-hidden px-5 pt-24 pb-10 md:pt-28">
        <div className="container relative z-10 grid gap-8 md:grid-cols-2 md:items-end md:gap-12">
          <div>
            <h1 className="display-sm">
              {t(T.title)}<span className="text-accent">.</span>
            </h1>
            <p className="mt-5 text-lg text-ink-muted max-w-xl">{t(T.lead)}</p>
            {t(T.currencyNote) && (
              <p className="mt-2 text-sm text-ink-faint max-w-xl">{t(T.currencyNote)}</p>
            )}
          </div>

          <ul className="space-y-2.5 md:justify-self-end md:max-w-sm md:border-l md:border-line md:pl-8">
            {[T.facts.currency, T.vat, T.facts.cancel, T.facts.stripe, T.facts.trial].map((fact, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-muted">
                <Check size={14} className="shrink-0 mt-0.5 text-ink" />
                {t(fact).replace('{n}', String(TRIAL_DAYS))}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="container">
          {notice && (
            <div className="mb-6 max-w-2xl rounded-lg border border-line-strong bg-surface-subtle px-4 py-3 text-sm font-medium text-ink">
              {noticeText()}
            </div>
          )}

          {unlimited && (
            <p className="mb-6 text-sm text-ink-muted">{t(T.unlimited)}</p>
          )}

          {/* Neprošlá platba patří nahoru a s odkazem, kde se to spraví — ne mezi tarify. Vzhled jako
              chybová hláška (světlý rámeček), ne akcent: modrou tu nesou nabídky a vypadala by jako jedna z nich. */}
          {me && paymentFailing(me) && (
            <div className="mb-6 max-w-2xl rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink">
              {t(T.pastDue)}{' '}
              <button type="button" onClick={portal} disabled={busy !== null} className={LINK}>
                {t(T.manage)}
              </button>
            </div>
          )}

          {me && trialDays !== null && (
            <p className="mb-6 text-sm text-ink-muted tnum">
              {trialDays > 0 ? t(T.trial).replace('{n}', String(trialDays)) : t(T.trialLast)}
            </p>
          )}

          {/*
            Na md+ je každá karta subgrid se šesti řádky: název, cena, poznámka, tlačítko,
            podmínky pod tlačítkem a výčet. Řádky sdílí všechny tři karty, takže tlačítka i čáry
            nad výčtem sedí v jedné výšce, ať je poznámka nebo text pod tlačítkem jakkoli dlouhý.
            Proto se každý řádek vykreslí vždycky, i prázdný — chybějící prvek by posunul další
            o řádek výš. Štítek nahoře je `absolute`, do mřížky se nepočítá.
          */}
          <div className="grid gap-4 md:grid-cols-3 md:gap-y-0">
            {PLANS.map(plan => {
              const isCurrent = Boolean(me) && !unlimited && currentPlan === plan;
              // Zvýrazněný je tarif, který uživatel má; nepřihlášenému Pro, placený tarif se
              // zkušebním obdobím. Dokud se `me` načítá, nezvýrazňuje se nic — jinak by štítek
              // „Doporučujeme" přihlášenému uživateli problikl a přeskočil na jeho tarif.
              const highlight = me ? isCurrent : me === null && plan === 'PRO';
              const period = isCurrent && plan !== 'FREE' ? periodLine() : null;
              // Jen kdo trial opravdu dostane. Kdo už předplatné měl, ho v Checkoutu nedostane,
              // a slibovat mu ho tady by byla lež přímo pod cenou.
              const showTrial = plan !== 'FREE' && trialEligible && !unlimited && !isCurrent && !(me && me.hasSubscription);
              return (
                <div
                  key={plan}
                  className={`flex flex-col p-7 md:row-span-6 md:grid md:grid-rows-subgrid ${
                    highlight ? 'card-glow' : 'card'
                  }`}
                >
                  {highlight && (
                    <span className="absolute -top-3 left-7 z-10 rounded-full border border-accent/60 bg-surface px-2.5 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-wider text-accent shadow-glow">
                      {t(me ? T.current : T.recommended)}
                    </span>
                  )}

                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                    {t(T.names[plan])}
                  </p>

                  <div className="mt-4 flex flex-wrap items-end gap-x-1.5">
                    <span className="tnum whitespace-nowrap text-4xl font-extrabold tracking-tight text-ink">
                      {plan === 'FREE' ? formatCzk(0) : formatCzk(PRICE_CZK[plan])}
                    </span>
                    <span className="mb-1.5 text-sm text-ink-faint">{t(T.perMonth)}</span>
                  </div>

                  <div className="mt-3">
                    {plan === 'FREE' && <p className="text-sm text-ink-muted">{t(T.freeNote)}</p>}
                    {showTrial && (
                      <p className="inline-flex items-center rounded-full border border-warm/50 bg-warm/10 px-2.5 py-0.5 text-xs font-semibold text-warm">
                        {t(T.trialLine).replace('{n}', String(TRIAL_DAYS))}
                      </p>
                    )}
                    {period && <p className="text-sm text-ink-muted tnum">{period}</p>}
                  </div>

                  <div>{action(plan)}</div>

                  {/*
                    Předsmluvní informace u tlačítka, ne jen v podmínkách: „7 dní zdarma" bez toho,
                    co přijde potom, by bylo klamavé opomenutí. Věta o zpřístupnění ihned souvisí se
                    lhůtou pro odstoupení spotřebitele — tarif začne platit hned po objednávce.
                  */}
                  <div>
                    {plan !== 'FREE' && buyable(plan) && (
                      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                        {terms(plan)}
                        {t(T.consent.before)}
                        <Link href={`/${locale}/terms`} className={LINK}>{t(T.consent.terms)}</Link>
                        {t(T.consent.middle)}
                        <Link href={`/${locale}/privacy`} className={LINK}>{t(T.consent.privacy)}</Link>
                        {t(T.consent.after)}
                      </p>
                    )}
                  </div>

                  {/* Výčet a věta o webu v jednom potomkovi: karta je subgrid se šesti řádky
                      a sedmý potomek by se do žádného řádku nevešel — kreslil se přes výčet. */}
                  <div className="mt-7 border-t border-line pt-6">
                    <ul className="space-y-3">
                      {lines(plan).map((line, j) => (
                        <li key={j} className="flex items-start gap-2.5 text-sm text-ink-muted">
                          <Check size={14} className="shrink-0 mt-0.5 text-accent" />
                          {line}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-5 text-xs leading-relaxed text-ink-faint">{t(T.webNote)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="container border-t border-line pt-14">
          <h2 className="text-2xl text-ink md:text-3xl">{t(T.faqTitle)}</h2>

          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            {T.faq.map((item, i) => (
              <div key={i} className="card">
                <dt className="font-semibold text-ink">{t(item.q)}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {t(item.a).replace('{n}', String(TRIAL_DAYS))}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-sm text-ink-muted">
            {t(T.questions)}
            <a href={`mailto:${OPERATOR.email}`} className={LINK}>
              {OPERATOR.email}
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
