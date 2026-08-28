import Link from 'next/link';
import { useLocale } from 'next-intl';
import { LeadScore, GOOD_LEAD } from '@/components/LeadScore';
import { Reveal } from '@/components/Reveal';
import { localized } from '@/lib/lead-filters';

/**
 * The landing page has five seconds and no brand recognition, so it says one thing in type big
 * enough to be unmissable and then immediately shows the product working. The demo table below
 * the fold is the argument: a visitor sees the actual output before being asked to register.
 *
 * The demo is deliberately an *accountant's* search, not a web developer's. The tool used to be
 * pitched as "find firms without a website", which quietly told every other trade it was not for
 * them. What it actually does is match public registry data against criteria the user picks, so
 * the page shows one concrete person's criteria and the rows they get.
 *
 * Deliberately absent: gradients, coloured sections, card shadows, stock imagery, and any
 * social proof — we have no real numbers yet, and invented ones would be a lie a paying
 * customer eventually notices. Also absent: any promise the data cannot keep. We know what is
 * publicly recorded about a firm, never what the firm needs.
 */

type Text = { cs: string; sk?: string; en: string };

/**
 * The three criteria our imaginary accountant ticked during onboarding. Everything in the demo
 * table is scored against exactly these, the same way `lib/lead-score.ts` does it for real.
 */
const DEMO_CRITERIA: Text[] = [
  { cs: 'Nová firma',           sk: 'Nová firma',             en: 'New firm' },
  { cs: 'Telefon nebo e-mail',  sk: 'Telefón alebo e-mail',   en: 'Phone or e-mail' },
  { cs: 'Není plátce DPH',      sk: 'Nie je platiteľ DPH',    en: 'Not VAT registered' },
];

/** Made-up but plausible rows, labelled as such on screen. `meets` indexes DEMO_CRITERIA. */
const DEMO: Array<{ name: string; trade: Text; since: number; meets: number[] }> = [
  { name: 'Kavárna Zrnko s.r.o.',   trade: { cs: 'Stravování a pohostinství', sk: 'Stravovanie a pohostinstvo', en: 'Food and drink' },      since: 2025, meets: [0, 1, 2] },
  { name: 'Truhlářství Beran s.r.o.', trade: { cs: 'Truhlářství',             sk: 'Stolárstvo',                 en: 'Joinery' },              since: 2025, meets: [0, 1, 2] },
  { name: 'Fitness studio Vlna',    trade: { cs: 'Provoz sportovních zařízení', sk: 'Prevádzka športových zariadení', en: 'Sports facilities' }, since: 2025, meets: [0, 1] },
  { name: 'Grafika Vosecká s.r.o.', trade: { cs: 'Reklamní činnost',          sk: 'Reklamná činnosť',           en: 'Advertising' },          since: 2026, meets: [0, 2] },
  { name: 'Autodíly Morava s.r.o.', trade: { cs: 'Velkoobchod s díly',        sk: 'Veľkoobchod s dielmi',       en: 'Parts wholesale' },      since: 2019, meets: [1, 2] },
  { name: 'Pekárna U Mostu',        trade: { cs: 'Pekařství',                 sk: 'Pekárstvo',                  en: 'Bakery' },               since: 2004, meets: [1] },
  { name: 'Zámečnictví Král',       trade: { cs: 'Zámečnictví',               sk: 'Zámočníctvo',                en: 'Locksmithing' },         since: 1998, meets: [2] },
];

/**
 * Five trades and the search each one actually runs. Every line here has to be answerable from
 * ARES, the trade register, the VAT register, OpenStreetMap and our own website check — nothing
 * else. That rules out tempting copy like "firms that are moving or expanding": we cannot see
 * that, and a promise the first search breaks costs more than the click it wins.
 */
const AUDIENCE: Array<{ who: Text; what: Text }> = [
  {
    who:  { cs: 'Účetní',            sk: 'Účtovník',            en: 'Accountant' },
    what: { cs: 'Firmy založené v posledním roce v okolí, které ještě nejsou plátci DPH a mají zveřejněný telefon.',
            sk: 'Firmy založené v poslednom roku v okolí, ktoré ešte nie sú platiteľmi DPH a majú zverejnený telefón.',
            en: 'Firms founded in the last year nearby that are not VAT registered yet and have a published phone number.' },
  },
  {
    who:  { cs: 'Realitní makléř',   sk: 'Realitný maklér',     en: 'Estate agent' },
    what: { cs: 'Zaběhnuté firmy v kraji, deset a více let na trhu, s dohledatelným kontaktem.',
            sk: 'Zabehnuté firmy v kraji, desať a viac rokov na trhu, s dohľadateľným kontaktom.',
            en: 'Established firms in the region, ten years or more on the market, with a findable contact.' },
  },
  {
    who:  { cs: 'Marketér',          sk: 'Marketér',            en: 'Marketer' },
    what: { cs: 'Firmy bez dohledatelného webu i bez profilů na sociálních sítích.',
            sk: 'Firmy bez dohľadateľného webu aj bez profilov na sociálnych sieťach.',
            en: 'Firms with no findable website and no social profiles either.' },
  },
  {
    who:  { cs: 'Fotograf',          sk: 'Fotograf',            en: 'Photographer' },
    what: { cs: 'Restaurace a kavárny v kraji, které web mají, ale žádné sociální sítě.',
            sk: 'Reštaurácie a kaviarne v kraji, ktoré web majú, ale žiadne sociálne siete.',
            en: 'Restaurants and cafés in the region that have a website but no social presence.' },
  },
  {
    who:  { cs: 'Tvůrce webů',       sk: 'Tvorca webov',        en: 'Web developer' },
    what: { cs: 'Firmy bez dohledatelného webu, nebo s webem, který se načítá přes dvě a půl sekundy.',
            sk: 'Firmy bez dohľadateľného webu, alebo s webom, ktorý sa načítava vyše dve a pol sekundy.',
            en: 'Firms with no findable website, or with one that takes over two and a half seconds to load.' },
  },
];

const STEPS: Array<[Text, Text]> = [
  [
    { cs: 'Řekneš, co nabízíš a komu',  sk: 'Povieš, čo ponúkaš a komu',  en: 'Tell us what you sell and to whom' },
    { cs: 'Čtyři otázky po registraci: obor, který nabízíš, obor firem, které hledáš, kraj a co je pro tebe důležité.',
      sk: 'Štyri otázky po registrácii: odbor, ktorý ponúkaš, odbor firiem, ktoré hľadáš, kraj a čo je pre teba dôležité.',
      en: 'Four questions after signing up: your trade, the trade you are looking for, the region, and what matters to you.' },
  ],
  [
    { cs: 'Prohledáme ARES a OpenStreetMap', sk: 'Prehľadáme ARES a OpenStreetMap', en: 'We search ARES and OpenStreetMap' },
    { cs: 'Veřejný rejstřík dá objem, IČO a datum vzniku, mapa dá telefony a e-maily.',
      sk: 'Verejný register dá objem, IČO a dátum vzniku, mapa dá telefóny a e-maily.',
      en: 'The public registry brings volume, company numbers and founding dates, the map brings contacts.' },
  ],
  [
    { cs: 'Ověříme, co je o firmě veřejné', sk: 'Overíme, čo je o firme verejné', en: 'We verify what is public about each firm' },
    { cs: 'Registrace k DPH a její spolehlivost, dohledatelný web a jak rychle se načítá, sociální sítě. Robots.txt respektujeme.',
      sk: 'Registrácia k DPH a jej spoľahlivosť, dohľadateľný web a ako rýchlo sa načítava, sociálne siete. Robots.txt rešpektujeme.',
      en: 'VAT registration and its reliability, a findable website and how fast it loads, social profiles. We respect robots.txt.' },
  ],
  [
    { cs: 'Seřadíme podle tvých kritérií', sk: 'Zoradíme podľa tvojich kritérií', en: 'We rank by your criteria' },
    // Export do Excelu je zamčený za plán PRO, který si zatím nikdo koupit nemůže (žádné platby
    // neexistují). Slibovat ho na titulce by byl přesně ten druh tvrzení, kvůli kterému šly z
    // ceníku pryč vymyšlené funkce. CSV dostane každý, tak se píše jen CSV.
    { cs: 'Nahoře je firma, která splňuje nejvíc z toho, co sis nastavil. U každé vidíš, co přesně splnila. Výsledky si stáhneš v CSV.',
      sk: 'Hore je firma, ktorá spĺňa najviac z toho, čo si si nastavil. Pri každej vidíš, čo presne splnila. Výsledky si stiahneš v CSV.',
      en: 'Top of the list is whoever meets most of what you set. Each row shows exactly what it met. Download the results as CSV.' },
  ],
];

const FAQ: Array<{ q: Text; a: Text }> = [
  {
    q: { cs: 'Odkud pocházejí data o firmách?', sk: 'Odkiaľ pochádzajú dáta o firmách?', en: 'Where does the business data come from?' },
    a: { cs: 'Z veřejných zdrojů: rejstřík ARES a živnostenský rejstřík, registr plátců DPH a OpenStreetMap (© přispěvatelé OpenStreetMap, ODbL). Kontakty bereme jen z webů firem, které to v robots.txt dovolují.',
         sk: 'Z verejných zdrojov: register ARES a živnostenský register, register platiteľov DPH a OpenStreetMap (© prispievatelia OpenStreetMap, ODbL). Kontakty berieme len z webov firiem, ktoré to v robots.txt dovoľujú.',
         en: 'From public sources: the ARES and trade registries, the VAT payer register and OpenStreetMap (© OpenStreetMap contributors, ODbL). Contacts come only from company websites whose robots.txt allows it.' },
  },
  {
    q: { cs: 'Co znamená skóre u každé firmy?', sk: 'Čo znamená skóre pri každej firme?', en: 'What does the score mean?' },
    a: { cs: 'Kolik z tvých kritérií firma splňuje. Nastavíš si třeba tři věci — firma, která splní všechny, má 100, která dvě, má 67. Jediná srážka navíc je 25 bodů za nespolehlivého plátce DPH, což je veřejný údaj finanční správy a špatné znamení pro každého. Žádná černá skříňka: u každé firmy vidíš, co přesně splnila.',
         sk: 'Koľko z tvojich kritérií firma spĺňa. Nastavíš si napríklad tri veci — firma, ktorá splní všetky, má 100, ktorá dve, má 67. Jediná zrážka navyše je 25 bodov za nespoľahlivého platiteľa DPH, čo je verejný údaj finančnej správy a zlé znamenie pre každého. Žiadna čierna skrinka: pri každej firme vidíš, čo presne splnila.',
         en: 'How many of your criteria the firm meets. Set three things and a firm meeting all of them scores 100, one meeting two scores 67. The only extra deduction is 25 points for an unreliable VAT payer — a public tax-office flag and a bad sign for anyone. No black box: every row shows what it actually met.' },
  },
  {
    q: { cs: 'Je to jen pro lidi, co dělají weby?', sk: 'Je to len pre ľudí, čo robia weby?', en: 'Is this only for web people?' },
    a: { cs: 'Ne. Chybějící web je jedno z šestnácti kritérií, která si můžeš zapnout — vedle stáří firmy, registrace k DPH, dostupného telefonu nebo e-mailu a sociálních sítí. Účetní si zapne jiná než fotograf a dostane jiné pořadí výsledků.',
         sk: 'Nie. Chýbajúci web je jedno zo šestnástich kritérií, ktoré si môžeš zapnúť — popri veku firmy, registrácii k DPH, dostupnom telefóne alebo e-maile a sociálnych sieťach. Účtovník si zapne iné než fotograf a dostane iné poradie výsledkov.',
         en: 'No. A missing website is one of sixteen criteria you can switch on — alongside company age, VAT registration, an available phone or e-mail, and social profiles. An accountant picks different ones than a photographer and gets a different ranking.' },
  },
  {
    q: { cs: 'Co když nechci nic vyplňovat?', sk: 'Čo ak nechcem nič vypĺňať?', en: 'What if I do not want to answer anything?' },
    a: { cs: 'Úvodní čtyři otázky jdou přeskočit jedním kliknutím. Pak řadíme podle neutrálního výchozího nastavení — dostupný kontakt a alespoň tři roky na trhu — a kritéria si můžeš kdykoli doplnit v nastavení.',
         sk: 'Úvodné štyri otázky sa dajú preskočiť jedným kliknutím. Potom radíme podľa neutrálneho východiskového nastavenia — dostupný kontakt a aspoň tri roky na trhu — a kritériá si môžeš kedykoľvek doplniť v nastaveniach.',
         en: 'The four opening questions are one click to skip. We then rank by a neutral default — a reachable contact and at least three years of trading — and you can set your own criteria later in settings.' },
  },
  {
    q: { cs: 'Jak poznáte, že firma nemá web?', sk: 'Ako poznáte, že firma nemá web?', en: 'How do you know a business has no website?' },
    a: { cs: 'Žádný veřejný rejstřík weby neeviduje, takže je hledáme sami — třemi cestami: adresu, kterou uvádí zdroj, ověříme tím, že se stránka opravdu načte; zkusíme doménu z firemního e-mailu; a zkusíme domény, které dává název firmy. Nalezenou stránku ale uznáme, jen když sama doloží, že patří té firmě — má na sobě její IČO, nebo celý název i obor. Když se to nepovede, u firmy o webu nenapíšeme nic a nabídneme tlačítko, kterým si ji vyhledáte sami. Prázdno je poctivější než tvrzení, které neumíme doložit.',
         sk: 'Žiadny verejný register weby neeviduje, takže ich hľadáme sami — tromi cestami: adresu, ktorú uvádza zdroj, overíme tým, že sa stránka naozaj načíta; skúsime doménu z firemného e-mailu; a skúsime domény, ktoré dáva názov firmy. Nájdenú stránku ale uznáme, len keď sama doloží, že patrí tej firme — má na sebe jej IČO, alebo celý názov aj odbor. Keď sa to nepodarí, pri firme o webe nenapíšeme nič a ponúkneme tlačidlo, ktorým si ju vyhľadáte sami. Prázdno je poctivejšie než tvrdenie, ktoré nevieme doložiť.',
         en: 'No public registry records websites, so we go looking ourselves, three ways: we confirm an address a source gave us by loading the page, we try the domain of the firm’s e-mail, and we try the domains its name suggests. A page only counts once it proves it belongs to that firm — its company number is on it, or its full name together with its trade. When none of that works we say nothing about a website and give you a button to look the firm up yourself. Silence is more honest than a claim we cannot back up.' },
  },
  {
    q: { cs: 'Je to zdarma?', sk: 'Je to zadarmo?', en: 'Is it free?' },
    a: { cs: 'Základní plán je zdarma – 5 vyhledávání měsíčně, 20 výsledků každé. Registrace je zatím na pozvánku.',
         sk: 'Základný plán je zadarmo – 5 vyhľadávaní mesačne, 20 výsledkov každé. Registrácia je zatiaľ na pozvánku.',
         en: 'The basic plan is free – 5 searches a month, 20 results each. Registration is currently invite-only.' },
  },
  {
    q: { cs: 'Mohu nahrát vlastní seznam firem?', sk: 'Môžem nahrať vlastný zoznam firiem?', en: 'Can I upload my own list?' },
    a: { cs: 'Ano. CSV import projde stejnou kontrolou jako hledání: doplní IČO a DPH, ověří weby a spočítá skóre podle tvých kritérií.',
         sk: 'Áno. CSV import prejde rovnakou kontrolou ako hľadanie: doplní IČO a DPH, overí weby a spočíta skóre podľa tvojich kritérií.',
         en: 'Yes. A CSV import runs through the same pipeline as a search: registry data, website checks, and a score against your criteria.' },
  },
];

const UI = {
  hero1:      { cs: 'Najdi firmy, které',       sk: 'Nájdi firmy, ktoré',       en: 'Find the firms that' },
  hero2:      { cs: 'můžou být tvoji klienti',  sk: 'môžu byť tvoji klienti',   en: 'could be your clients' },
  perex:      { cs: 'S kontakty. Z veřejných rejstříků a map. Řekneš nám, komu prodáváš a kde, a my seřadíme, koho volat první.',
                sk: 'S kontaktmi. Z verejných registrov a máp. Povieš nám, komu predávaš a kde, a my zoradíme, koho volať prvého.',
                en: 'With contacts. From public registries and maps. Tell us who you sell to and where, and we rank who to call first.' },
  ctaFree:    { cs: 'Začít zdarma',             sk: 'Začať zadarmo',            en: 'Start for free' },
  ctaTry:     { cs: 'Vyzkoušet',                sk: 'Vyskúšať',                 en: 'Try it' },
  ctaAccount: { cs: 'Založit účet zdarma',      sk: 'Založiť účet zadarmo',     en: 'Create a free account' },
  demoHead:   { cs: 'Účetní hledá v Brně · 7 z 214 výsledků',
                sk: 'Účtovník hľadá v Brne · 7 z 214 výsledkov',
                en: 'An accountant searching Brno · 7 of 214 results' },
  demoTag:    { cs: 'Ukázková data',            sk: 'Ukážkové dáta',            en: 'Sample data' },
  demoCrit:   { cs: 'Jeho kritéria',            sk: 'Jeho kritériá',            en: 'Their criteria' },
  demoNote:   { cs: 'Ukázková data pro představu, jak výsledek vypadá. Skóre je podíl splněných kritérií — jiný obor si zapne jiná a dostane jiné pořadí.',
                sk: 'Ukážkové dáta pre predstavu, ako výsledok vyzerá. Skóre je podiel splnených kritérií — iný odbor si zapne iné a dostane iné poradie.',
                en: 'Sample rows showing what a result looks like. The score is the share of criteria met — another trade ticks different ones and gets a different order.' },
  since:      { cs: 'od',                       sk: 'od',                       en: 'since' },
  audTitle:   { cs: 'Pět lidí, pět hledání.',   sk: 'Päť ľudí, päť hľadaní.',   en: 'Five people, five searches.' },
  audNote:    { cs: 'Když se ve výčtu nevidíš, poskládáš si kritéria sám — je jich šestnáct a kombinují se libovolně.',
                sk: 'Keď sa vo výpočte nevidíš, poskladáš si kritériá sám — je ich šestnásť a kombinujú sa ľubovoľne.',
                en: 'Not on the list? Build your own combination — there are sixteen criteria and they mix freely.' },
  stepsTitle: { cs: 'Čtyři kroky, tři minuty.', sk: 'Štyri kroky, tri minúty.', en: 'Four steps, three minutes.' },
  faqTitle:   { cs: 'Otázky.',                  sk: 'Otázky.',                  en: 'Questions.' },
  closing:    { cs: 'Kdo je na řadě',           sk: 'Kto je na rade',           en: 'Who is next' },
};

export default function HomePage() {
  const locale = useLocale();
  const t = (text: Text) => localized(text, locale);

  return (
    <div className="bg-white">

      {/* ── Hero: one headline, one line, one button ── */}
      <section className="px-5 pt-32 pb-16 md:pt-44 md:pb-24">
        <div className="max-w-6xl mx-auto">
          <h1 className="display animate-fade-up max-w-5xl">
            {t(UI.hero1)}<br />{t(UI.hero2)}<span className="text-accent">.</span>
          </h1>

          <p className="mt-8 text-lg md:text-xl text-ink-muted max-w-xl animate-fade-up" style={{ animationDelay: '.06s' }}>
            {t(UI.perex)}
          </p>

          <div className="mt-10 animate-fade-up" style={{ animationDelay: '.12s' }}>
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {t(UI.ctaFree)}
            </Link>
          </div>
        </div>
      </section>

      {/* ── The product, before registering ── */}
      <section className="px-5 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider">{t(UI.demoHead)}</h2>
            <span className="text-xs text-ink-faint">{t(UI.demoTag)}</span>
          </div>

          {/* Naming the criteria makes the score readable: without them a number is just a number. */}
          <p className="text-xs text-ink-faint mb-1">
            <span className="uppercase tracking-wider font-semibold">{t(UI.demoCrit)}:</span>{' '}
            {DEMO_CRITERIA.map(c => t(c)).join(' · ')}
          </p>

          <div>
            {DEMO.map((d, i) => {
              const score = Math.round((d.meets.length / DEMO_CRITERIA.length) * 100);
              return (
                <div
                  key={d.name}
                  className="stagger row flex items-center gap-5 py-5 pl-4 border-l-[3px]"
                  style={{ '--i': i, borderLeftColor: score >= GOOD_LEAD ? '#e63900' : 'transparent' } as React.CSSProperties}
                >
                  <LeadScore value={score} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{d.name}</p>
                    <p className="text-sm text-ink-muted truncate">{t(d.trade)} · Brno</p>
                  </div>
                  <div className="hidden sm:block text-sm text-ink-muted w-56 text-right truncate">
                    {d.meets.map(m => t(DEMO_CRITERIA[m])).join(' · ')}
                  </div>
                  <div className="hidden md:block text-sm text-ink-faint tnum w-24 text-right">
                    {t(UI.since)} {d.since}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-sm text-ink-faint max-w-2xl">{t(UI.demoNote)}</p>
        </div>
      </section>

      {/* ── Who it is for ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display-sm max-w-2xl">{t(UI.audTitle)}</h2>

          <div className="mt-14 max-w-3xl">
            {AUDIENCE.map((a, i) => (
              <Reveal key={a.who.en} delay={i * 60}>
                <div className="py-6 border-b border-line md:flex md:gap-8">
                  <p className="font-semibold md:w-48 md:shrink-0">{t(a.who)}</p>
                  <p className="text-ink-muted mt-1.5 md:mt-0">{t(a.what)}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <p className="mt-8 text-sm text-ink-faint max-w-2xl">{t(UI.audNote)}</p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display-sm max-w-2xl">{t(UI.stepsTitle)}</h2>

          <div className="mt-14 max-w-3xl">
            {STEPS.map(([title, desc], i) => (
              <Reveal key={title.en} delay={i * 60}>
                <div className="py-6 border-b border-line">
                  <p className="font-semibold">{t(title)}</p>
                  <p className="text-ink-muted mt-1.5">{t(desc)}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <div className="mt-12">
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {t(UI.ctaTry)}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-3xl mx-auto">
          <h2 className="display-sm mb-12">{t(UI.faqTitle)}</h2>
          {FAQ.map((item, i) => (
            <details key={i} className="group border-b border-line py-5">
              <summary className="font-semibold cursor-pointer list-none flex items-start justify-between gap-6">
                {t(item.q)}
                <span className="text-ink-faint shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
              </summary>
              <p className="text-ink-muted mt-3 leading-relaxed">{t(item.a)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="px-5 py-28 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display max-w-4xl">
            {t(UI.closing)}<span className="text-accent">?</span>
          </h2>
          <div className="mt-10">
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {t(UI.ctaAccount)}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
