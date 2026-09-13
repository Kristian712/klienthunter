import type { Metadata } from 'next';
import Link from 'next/link';
import { localized } from '@/lib/lead-filters';
import { OSM_ATTRIBUTION_L, RES_ATTRIBUTION_L } from '@/lib/attribution';
import { REGISTRY_INDEX_MONTHS } from '@/lib/registry-index-config';

/**
 * Odkud aplikace bere data — jedna veřejná stránka, na kterou vede patička.
 *
 * Není to právní text, je to poctivý popis: co který zdroj umí, co neumí a za jakých podmínek
 * ho používáme. U ČSÚ je to zároveň uvedení zdroje, které vyžaduje licence CC BY 4.0 — a to má
 * být tam, kde ho uživatel najde, ne schované v podmínkách.
 */

const M = {
  title: { cs: 'Zdroje dat', sk: 'Zdroje dát', en: 'Data sources' },
  description: {
    cs: 'Odkud KlientHunter bere firmy a jejich údaje: ARES, živnostenský rejstřík, registr plátců DPH, Registr ekonomických subjektů ČSÚ a OpenStreetMap.',
    sk: 'Odkiaľ KlientHunter berie firmy a ich údaje: ARES, živnostenský register, register platiteľov DPH, Register ekonomických subjektov ČSÚ a OpenStreetMap.',
    en: 'Where KlientHunter gets its firms and their details: ARES, the Czech trade register, the VAT payer register, the Czech Statistical Office register and OpenStreetMap.',
  },
  intro: {
    cs: 'Všechno, co aplikace ukazuje, pochází z veřejných rejstříků a otevřených dat. Nic z toho nekupujeme od zprostředkovatelů a nic neodhadujeme — kde údaj chybí, aplikace řekne, že ho nezná.',
    sk: 'Všetko, čo aplikácia ukazuje, pochádza z verejných registrov a otvorených dát. Nič z toho nekupujeme od sprostredkovateľov a nič neodhadujeme — kde údaj chýba, aplikácia povie, že ho nepozná.',
    en: 'Everything the app shows comes from public registers and open data. None of it is bought from brokers and none of it is guessed — where a value is missing, the app says it does not know.',
  },
  optout: {
    cs: 'Kterýkoli subjekt může požádat o trvalé vyřazení ze seznamu — bez přihlášení, na stránce',
    sk: 'Ktorýkoľvek subjekt môže požiadať o trvalé vyradenie zo zoznamu — bez prihlásenia, na stránke',
    en: 'Any entity can ask to be permanently removed from the list — no sign-in needed, on the page',
  },
  optoutLink: { cs: 'Nechci být v seznamu', sk: 'Nechcem byť v zozname', en: 'Remove me from the list' },
};

const SOURCES: Array<{
  name: { cs: string; sk?: string; en: string };
  operator: { cs: string; sk?: string; en: string };
  what: { cs: string; sk?: string; en: string };
  licence: { cs: string; sk?: string; en: string };
  url: string;
}> = [
  {
    name: { cs: 'ARES — Administrativní registr ekonomických subjektů', sk: 'ARES — Administratívny register ekonomických subjektov', en: 'ARES — Administrative Register of Economic Subjects' },
    operator: { cs: 'Ministerstvo financí ČR', sk: 'Ministerstvo financií ČR', en: 'Czech Ministry of Finance' },
    what: {
      cs: 'Základní údaje o každém podnikatelském subjektu: obchodní jméno, IČO, DIČ, sídlo, právní forma, obory (CZ-NACE), datum vzniku a příznak insolvence. Je to páteř hledání — podle něj se firma vůbec najde.',
      sk: 'Základné údaje o každom podnikateľskom subjekte: obchodné meno, IČO, DIČ, sídlo, právna forma, odbory (CZ-NACE), dátum vzniku a príznak insolvencie. Je to chrbtica hľadania — podľa neho sa firma vôbec nájde.',
      en: 'Core data on every business entity: name, company ID, VAT ID, registered address, legal form, trades (CZ-NACE), founding date and an insolvency flag. It is the backbone of the search — it is how a firm is found at all.',
    },
    licence: { cs: 'Veřejný rejstřík, otevřené rozhraní bez registrace.', sk: 'Verejný register, otvorené rozhranie bez registrácie.', en: 'Public register, open API without registration.' },
    url: 'https://ares.gov.cz',
  },
  {
    name: { cs: 'Živnostenský rejstřík (RŽP)', sk: 'Živnostenský register (RŽP)', en: 'Czech Trade Licensing Register (RŽP)' },
    operator: { cs: 'Ministerstvo průmyslu a obchodu ČR, přes ARES', sk: 'Ministerstvo priemyslu a obchodu ČR, cez ARES', en: 'Czech Ministry of Industry and Trade, via ARES' },
    what: {
      cs: 'Živnostenská oprávnění a počet aktivních provozoven. Odtud aplikace pozná, že firma opravdu funguje.',
      sk: 'Živnostenské oprávnenia a počet aktívnych prevádzok. Odtiaľ aplikácia spozná, že firma naozaj funguje.',
      en: 'Trade licences and the number of active premises. This is how the app tells a firm is actually operating.',
    },
    licence: { cs: 'Veřejný rejstřík.', sk: 'Verejný register.', en: 'Public register.' },
    url: 'https://rzp.gov.cz',
  },
  {
    name: { cs: 'Registr plátců DPH', sk: 'Register platiteľov DPH', en: 'VAT payer register' },
    operator: { cs: 'Finanční správa ČR', sk: 'Finančná správa ČR', en: 'Czech Financial Administration' },
    what: {
      cs: 'Zda je firma plátcem DPH a zda není označená jako nespolehlivý plátce.',
      sk: 'Či je firma platiteľom DPH a či nie je označená ako nespoľahlivý platiteľ.',
      en: 'Whether a firm is VAT-registered and whether it is flagged as an unreliable payer.',
    },
    licence: { cs: 'Veřejný rejstřík.', sk: 'Verejný register.', en: 'Public register.' },
    url: 'https://adisspr.mfcr.cz',
  },
  {
    name: RES_ATTRIBUTION_L,
    operator: { cs: 'Český statistický úřad', sk: 'Český štatistický úrad', en: 'Czech Statistical Office' },
    what: {
      cs: `Otevřená data celého registru, aktualizovaná dvakrát měsíčně. Aplikace si z nich drží index aktivních subjektů se vznikem za posledních ${REGISTRY_INDEX_MONTHS} měsíců — jen IČO, datum vzniku, právní formu, obor, kategorii počtu pracovníků a kód okresu a obce. Žádná jména ani adresy: ty se dohledávají v ARESu až u firem, které projdou filtrem. Díky indexu umí aplikace hledat podle data vzniku a v celém kraji, což ARES sám neumí. Kategorie počtu pracovníků je vyplněná zhruba u poloviny subjektů, u živnostníků asi u 40 % — kde chybí, aplikace to řekne.`,
      sk: `Otvorené dáta celého registra, aktualizované dvakrát mesačne. Aplikácia si z nich drží index aktívnych subjektov so vznikom za posledných ${REGISTRY_INDEX_MONTHS} mesiacov — len IČO, dátum vzniku, právnu formu, odbor, kategóriu počtu pracovníkov a kód okresu a obce. Žiadne mená ani adresy: tie sa dohľadávajú v ARESe až pri firmách, ktoré prejdú filtrom. Vďaka indexu vie aplikácia hľadať podľa dátumu vzniku a v celom kraji, čo ARES sám nevie. Kategória počtu pracovníkov je vyplnená zhruba pri polovici subjektov, pri živnostníkoch asi pri 40 % — kde chýba, aplikácia to povie.`,
      en: `Open data of the whole register, updated twice a month. The app keeps an index of active entities founded in the last ${REGISTRY_INDEX_MONTHS} months — only the company ID, founding date, legal form, trade, employee-count category and district and municipality codes. No names or addresses: those are looked up in ARES only for the firms that pass the filter. The index is what lets the app search by founding date and across a whole region, which ARES alone cannot do. The employee-count category is filled for roughly half of all entities, about 40 % of sole traders — where it is missing, the app says so.`,
    },
    licence: { cs: 'Otevřená data, licence Creative Commons BY 4.0 — podmínkou je uvést zdroj, což tímto činíme.', sk: 'Otvorené dáta, licencia Creative Commons BY 4.0 — podmienkou je uviesť zdroj, čo týmto robíme.', en: 'Open data under Creative Commons BY 4.0 — attribution is the condition, and this page is it.' },
    url: 'https://opendata.csu.gov.cz',
  },
  {
    name: OSM_ATTRIBUTION_L,
    operator: { cs: 'OpenStreetMap Foundation a přispěvatelé', sk: 'OpenStreetMap Foundation a prispievatelia', en: 'OpenStreetMap Foundation and contributors' },
    what: {
      cs: 'Provozovny na mapě a kontakty, které k nim přispěvatelé zapsali: telefon, e-mail, web, profily na sítích. Údaje od komunity — aplikace je předává i s tím, odkud jsou, a neověřuje je.',
      sk: 'Prevádzky na mape a kontakty, ktoré k nim prispievatelia zapísali: telefón, e-mail, web, profily na sieťach. Údaje od komunity — aplikácia ich odovzdáva aj s tým, odkiaľ sú, a neoveruje ich.',
      en: 'Premises on the map and the contacts contributors recorded for them: phone, e-mail, website, social profiles. Community data — the app passes it on with its origin and does not verify it.',
    },
    licence: { cs: 'Open Database License (ODbL) — uvedení zdroje je podmínka licence.', sk: 'Open Database License (ODbL) — uvedenie zdroja je podmienka licencie.', en: 'Open Database License (ODbL) — attribution is a licence condition.' },
    url: 'https://www.openstreetmap.org/copyright',
  },
  {
    name: { cs: 'RÚIAN — adresní místa', sk: 'RÚIAN — adresné miesta', en: 'RÚIAN — address points' },
    operator: { cs: 'Český úřad zeměměřický a katastrální', sk: 'Český úrad zememeračský a katastrálny', en: 'Czech Office for Surveying, Mapping and Cadastre' },
    what: {
      cs: 'Souřadnice sídel firem pro mapu, podle kódu adresního místa z ARESu. Jen adresní body — z katastru nemovitostí aplikace nic nebere.',
      sk: 'Súradnice sídel firiem pre mapu, podľa kódu adresného miesta z ARESu. Len adresné body — z katastra nehnuteľností aplikácia nič neberie.',
      en: 'Coordinates of registered addresses for the map, by the address-point code from ARES. Address points only — the app takes nothing from the land registry.',
    },
    licence: { cs: 'Otevřená data ČÚZK.', sk: 'Otvorené dáta ČÚZK.', en: 'ČÚZK open data.' },
    url: 'https://vdp.cuzk.gov.cz',
  },
];

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: `${localized(M.title, locale)} – KlientHunter`,
    description: localized(M.description, locale),
  };
}

export default function DataSourcesPage({ params: { locale } }: { params: { locale: string } }) {
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  return (
    <div className="max-w-3xl mx-auto px-5 py-16 pt-28">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t(M.title)}</h1>
      <p className="mt-6 text-ink-muted leading-relaxed">{t(M.intro)}</p>

      <div className="mt-10 space-y-9">
        {SOURCES.map((s, i) => (
          <section key={i}>
            <h2 className="text-base font-semibold text-ink">{t(s.name)}</h2>
            <p className="mt-1 text-xs text-ink-faint">{t(s.operator)}</p>
            <p className="mt-3 text-ink-muted leading-relaxed">{t(s.what)}</p>
            <p className="mt-2 text-sm text-ink-faint">
              {t(s.licence)}{' '}
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">{s.url.replace(/^https?:\/\//, '')}</a>
            </p>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-ink-muted leading-relaxed">
        {t(M.optout)}{' '}
        <Link href={`/${locale}/optout`} className="underline hover:text-ink">{t(M.optoutLink)}</Link>.
      </p>
    </div>
  );
}
