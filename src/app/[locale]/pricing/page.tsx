import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Check } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { OPERATOR } from '@/lib/legal';

/**
 * Ceník, který říká pravdu.
 *
 * Předchozí verze inzerovala tři tarify za 0 / 499 / 1 499 Kč s tlačítkem „Začít“ u každého.
 * Jenže:
 *   • v aplikaci není žádná platební brána — `stripe` se v `src/` nevyskytuje ani jednou,
 *   • stavy `PRO` a `BUSINESS` sice `PLAN_LIMITS` zná, ale nikdo je uživateli nemůže nastavit
 *     (admin umí jen VIP / admin / blokaci), takže jsou fakticky nedosažitelné,
 *   • funkce „API přístup“, „Vlastní branding“, „SLA podpora“ a „Prioritní podpora“
 *     v kódu neexistují vůbec,
 *   • „Základní filtry“ u tarifu zdarma bylo navíc v přímém rozporu s registrační stránkou,
 *     která slibuje „Přístup ke všem filtrům“ — a ta má pravdu, filtry nejsou nijak omezené.
 *
 * Inzerovat cenu za službu, kterou si nelze koupit, a vlastnosti, které neexistují, je klamavá
 * obchodní praktika podle § 4 a § 5 zákona č. 634/1992 Sb. a klamavá reklama podle § 2977 obč.
 * zák. Proto stránka nově popisuje jen to, co účet opravdu umí, a chystané tarify uvádí
 * výslovně jako záměr s orientační cenou, který není návrhem na uzavření smlouvy
 * (§ 1732 odst. 2 obč. zák.).
 *
 * Až bude platební brána hotová, tahle stránka se vrátí k tlačítkům — ne dřív.
 */

const T = {
  title:   { cs: 'Ceník',   sk: 'Cenník',  en: 'Pricing' },
  lead: {
    cs: 'Aplikace je zatím celá zdarma. Přístup je na pozvánku a placené tarify se teprve chystají.',
    sk: 'Aplikácia je zatiaľ celá zadarmo. Prístup je na pozvánku a platené tarify sa ešte len chystajú.',
    en: 'The app is free for now. Access is invite-only and paid plans are still being prepared.',
  },

  freeTag:   { cs: 'Co máš teď',        sk: 'Čo máš teraz',        en: 'What you get today' },
  freeName:  { cs: 'Účet zdarma',       sk: 'Účet zadarmo',        en: 'Free account' },
  freePrice: { cs: '0 Kč',              sk: '0 €',                 en: '$0' },
  freeNote: {
    cs: 'Bez platební karty. Registrace je možná jen s kódem pozvánky.',
    sk: 'Bez platobnej karty. Registrácia je možná len s kódom pozvánky.',
    en: 'No card required. Registration needs an invite code.',
  },
  freeFeatures: [
    { cs: '5 vyhledávání za měsíc',              sk: '5 hľadaní za mesiac',                    en: '5 searches per month' },
    { cs: '20 výsledků na jedno vyhledávání',    sk: '20 výsledkov na jedno hľadanie',         en: '20 results per search' },
    { cs: 'Všechny filtry a vlastní kritéria',   sk: 'Všetky filtre a vlastné kritériá',       en: 'All filters and your own criteria' },
    { cs: 'Import vlastního seznamu z CSV',      sk: 'Import vlastného zoznamu z CSV',         en: 'Import your own list from CSV' },
    { cs: 'Uložená vyhledávání a historie',      sk: 'Uložené hľadania a história',            en: 'Saved searches and history' },
    { cs: 'Export do CSV',                       sk: 'Export do CSV',                          en: 'CSV export' },
  ],
  cta:      { cs: 'Mám kód pozvánky', sk: 'Mám kód pozvánky', en: 'I have an invite code' },

  soonTag:  { cs: 'Připravujeme',      sk: 'Pripravujeme',     en: 'Coming later' },
  soonTitle:{ cs: 'Placené tarify',    sk: 'Platené tarify',   en: 'Paid plans' },
  soonBody: {
    cs: 'Zatím je nelze koupit — v aplikaci není platební brána a žádný účet do nich nejde převést. Uvedené ceny jsou orientační a nejsou nabídkou k uzavření smlouvy. Až budou tarify spuštěné, dozvíš se to předem e-mailem a ceník tady se změní.',
    sk: 'Zatiaľ ich nie je možné kúpiť — v aplikácii nie je platobná brána a žiadny účet do nich nejde previesť. Uvedené ceny sú orientačné a nie sú ponukou na uzavretie zmluvy. Keď budú tarify spustené, dozvieš sa to vopred e-mailom a cenník sa tu zmení.',
    en: 'They cannot be bought yet — there is no payment gateway in the app and no account can be moved onto them. The prices below are indicative and are not an offer to contract. When the plans go live you will hear about it by e-mail first and this page will change.',
  },
  soonPlans: [
    {
      name:  { cs: 'Pro',      sk: 'Pro',      en: 'Pro' },
      price: { cs: 'kolem 499 Kč / měsíc', sk: 'okolo 20 € / mesiac', en: 'around $19 / month' },
      lines: [
        { cs: '100 vyhledávání za měsíc',           sk: '100 hľadaní za mesiac',               en: '100 searches per month' },
        { cs: '200 výsledků na jedno vyhledávání',  sk: '200 výsledkov na jedno hľadanie',     en: '200 results per search' },
        { cs: 'Export do Excelu',                   sk: 'Export do Excelu',                    en: 'Excel export' },
      ],
    },
    {
      name:  { cs: 'Business', sk: 'Business', en: 'Business' },
      price: { cs: 'kolem 1 499 Kč / měsíc', sk: 'okolo 60 € / mesiac', en: 'around $59 / month' },
      lines: [
        { cs: 'Neomezený počet vyhledávání',        sk: 'Neobmedzený počet hľadaní',           en: 'Unlimited searches' },
        { cs: '500 výsledků na jedno vyhledávání',  sk: '500 výsledkov na jedno hľadanie',     en: '500 results per search' },
        { cs: 'Export do Excelu',                   sk: 'Export do Excelu',                    en: 'Excel export' },
      ],
    },
  ],

  questions: { cs: 'Máš otázku? Napiš na ', sk: 'Máš otázku? Napíš na ', en: 'Questions? Write to ' },
};

export default function PricingPage() {
  const locale = useLocale();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);

  return (
    <div className="min-h-screen bg-white pt-14">
      <section className="section pb-10">
        <div className="container">
          <h1 className="display-sm max-w-3xl">
            {t(T.title)}<span className="text-accent">.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-muted max-w-xl">{t(T.lead)}</p>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="container">
          {/* Co účet umí dnes. Jediné číslo na stránce, které si můžeš koupit — nulu. */}
          <div className="grid md:grid-cols-3 border-t border-line">
            <div className="md:col-span-2 p-7 border-b md:border-b-0 md:border-r border-line border-t-[3px] border-t-accent -mt-[3px]">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                {t(T.freeTag)}
              </p>

              <div className="flex items-end gap-1.5 mt-4">
                <span className="tnum text-4xl font-extrabold tracking-tight">{t(T.freePrice)}</span>
                <span className="text-sm text-ink-faint mb-1.5">{t(T.freeName)}</span>
              </div>

              <p className="mt-2 text-sm text-ink-muted">{t(T.freeNote)}</p>

              <Link
                href={`/${locale}/auth/register`}
                className="btn-primary mt-6 inline-flex text-center"
              >
                {t(T.cta)}
              </Link>

              <ul className="mt-7 grid sm:grid-cols-2 gap-x-8 gap-y-3 border-t border-line pt-6">
                {T.freeFeatures.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-ink-muted">
                    <Check size={14} className="shrink-0 mt-0.5 text-ink" />
                    {t(f)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Chystané tarify. Bez tlačítka, protože není kam vést. */}
            <div className="p-7 border-b border-line md:border-b-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">
                {t(T.soonTag)}
              </p>
              <p className="mt-4 text-base font-semibold text-ink">{t(T.soonTitle)}</p>

              <div className="mt-5 space-y-5">
                {T.soonPlans.map((p, i) => (
                  <div key={i} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                    <p className="text-sm font-semibold text-ink">{t(p.name)}</p>
                    <p className="tnum text-sm text-ink-muted">{t(p.price)}</p>
                    <ul className="mt-2 space-y-1">
                      {p.lines.map((l, j) => (
                        <li key={j} className="flex gap-2.5 text-sm text-ink-faint">
                          <span className="mt-2 h-px w-3 shrink-0 bg-line" aria-hidden />
                          <span>{t(l)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-8 max-w-2xl text-sm text-ink-faint leading-relaxed">{t(T.soonBody)}</p>

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
