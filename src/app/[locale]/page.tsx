import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowRight, Building2, Calculator, Camera, Code2, Database, ListOrdered, MapPinned, Megaphone, MessageSquareText, Plus, Search as SearchIcon, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { Backdrop } from '@/components/Backdrop';
import { LeadScore, GOOD_LEAD } from '@/components/LeadScore';
import { Reveal } from '@/components/Reveal';
import { LEAD_FILTERS, localized } from '@/lib/lead-filters';

/** Kolik kritérií skládačka opravdu nabízí — z katalogu, aby číslo na úvodu nezastaralo. */
const CRITERIA = LEAD_FILTERS.length;

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
 * Deliberately absent: stock imagery and any social proof — we have no real numbers yet, and
 * invented ones would be a lie a paying customer eventually notices. Also absent: any promise
 * the data cannot keep. We know what is publicly recorded about a firm, never what the firm
 * needs. Colour and motion (13. 9. 2026, majitel: „živější tmavá") jsou jen v pozadí, ikonkách
 * a jednom teplém akcentu — text a čísla zůstávají v původní paletě.
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
    what: { cs: 'Firmy, u kterých jsme nenašli web ani profil na sociálních sítích.',
            sk: 'Firmy, pri ktorých sme nenašli web ani profil na sociálnych sieťach.',
            en: 'Firms where we found neither a website nor a social profile.' },
  },
  {
    who:  { cs: 'Fotograf',          sk: 'Fotograf',            en: 'Photographer' },
    what: { cs: 'Restaurace a kavárny v kraji, které web mají, ale žádné sociální sítě.',
            sk: 'Reštaurácie a kaviarne v kraji, ktoré web majú, ale žiadne sociálne siete.',
            en: 'Restaurants and cafés in the region that have a website but no social presence.' },
  },
  {
    who:  { cs: 'Tvůrce webů',       sk: 'Tvorca webov',        en: 'Web developer' },
    // Jen co se opravdu měří (lib/website-audit.ts): HTTPS, mobilní verze, stáří kódu. Rychlost
    // načítání se neměří, tak se neslibuje.
    what: { cs: 'Firmy, u kterých jsme web nenašli, nebo mají web bez HTTPS, bez mobilní verze či s kódem z dob před rokem 2010.',
            sk: 'Firmy, pri ktorých sme web nenašli, alebo majú web bez HTTPS, bez mobilnej verzie či s kódom z čias pred rokom 2010.',
            en: 'Firms we found no website for, or whose site has no HTTPS, no mobile version or code from before 2010.' },
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
    { cs: 'Registrace k DPH a její spolehlivost, ověřený web a v jakém je stavu, sociální sítě. Robots.txt respektujeme.',
      sk: 'Registrácia k DPH a jej spoľahlivosť, overený web a v akom je stave, sociálne siete. Robots.txt rešpektujeme.',
      en: 'VAT registration and its reliability, a verified website and what shape it is in, social profiles. We respect robots.txt.' },
  ],
  [
    { cs: 'Seřadíme podle tvých kritérií', sk: 'Zoradíme podľa tvojich kritérií', en: 'We rank by your criteria' },
    // Export do Excelu mají jen placené tarify (API ho váže na tarif, viz /api/export). Krok
    // popisuje, co dostane každý účet včetně bezplatného, takže se píše jen CSV — Excel by tu byl
    // slib, který většina čtenářů po registraci nedostane.
    { cs: 'Nahoře je firma, která splňuje nejvíc z toho, co sis nastavil. U každé vidíš, co přesně splnila. Výsledky si stáhneš v CSV.',
      sk: 'Hore je firma, ktorá spĺňa najviac z toho, čo si si nastavil. Pri každej vidíš, čo presne splnila. Výsledky si stiahneš v CSV.',
      en: 'Top of the list is whoever meets most of what you set. Each row shows exactly what it met. Download the results as CSV.' },
  ],
];

const FAQ: Array<{ q: Text; a: Text }> = [
  {
    q: { cs: 'Odkud pocházejí data o firmách?', sk: 'Odkiaľ pochádzajú dáta o firmách?', en: 'Where does the business data come from?' },
    a: { cs: 'Z veřejných zdrojů: rejstřík ARES a živnostenský rejstřík, registr plátců DPH a OpenStreetMap (© přispěvatelé OpenStreetMap, ODbL). Telefony a e-maily bereme ze dvou míst: z webů firem, které to v robots.txt dovolují, a z OpenStreetMap, kde je uvedli mapéři. U každého kontaktu vidíš, odkud je.',
         sk: 'Z verejných zdrojov: register ARES a živnostenský register, register platiteľov DPH a OpenStreetMap (© prispievatelia OpenStreetMap, ODbL). Telefóny a e-maily berieme z dvoch miest: z webov firiem, ktoré to v robots.txt dovoľujú, a z OpenStreetMap, kde ich uviedli mapéri. Pri každom kontakte vidíš, odkiaľ je.',
         en: 'From public sources: the ARES and trade registries, the VAT payer register and OpenStreetMap (© OpenStreetMap contributors, ODbL). Phones and e-mails come from two places: company websites whose robots.txt allows it, and OpenStreetMap, where mappers listed them. Every contact shows where it came from.' },
  },
  {
    q: { cs: 'Co znamená skóre u každé firmy?', sk: 'Čo znamená skóre pri každej firme?', en: 'What does the score mean?' },
    a: { cs: 'Kolik z tvých kritérií firma splňuje. Nastavíš si třeba tři věci — firma, která splní všechny, má 100, která dvě, má 67. Jediná srážka navíc je 25 bodů za nespolehlivého plátce DPH, což je veřejný údaj finanční správy a špatné znamení pro každého. Žádná černá skříňka: u každé firmy vidíš, co přesně splnila.',
         sk: 'Koľko z tvojich kritérií firma spĺňa. Nastavíš si napríklad tri veci — firma, ktorá splní všetky, má 100, ktorá dve, má 67. Jediná zrážka navyše je 25 bodov za nespoľahlivého platiteľa DPH, čo je verejný údaj finančnej správy a zlé znamenie pre každého. Žiadna čierna skrinka: pri každej firme vidíš, čo presne splnila.',
         en: 'How many of your criteria the firm meets. Set three things and a firm meeting all of them scores 100, one meeting two scores 67. The only extra deduction is 25 points for an unreliable VAT payer — a public tax-office flag and a bad sign for anyone. No black box: every row shows what it actually met.' },
  },
  {
    q: { cs: 'Je to jen pro lidi, co dělají weby?', sk: 'Je to len pre ľudí, čo robia weby?', en: 'Is this only for web people?' },
    // Počet kritérií se bere z katalogu, ne z hlavy — tady stálo „šestnácti", když jich bylo přes třicet.
    a: { cs: `Ne. Chybějící web je jedno z ${CRITERIA} kritérií, která si můžeš zapnout — vedle stáří firmy, registrace k DPH, dostupného telefonu nebo e-mailu a sociálních sítí. Účetní si zapne jiná než fotograf a dostane jiné pořadí výsledků.`,
         sk: `Nie. Chýbajúci web je jedno z ${CRITERIA} kritérií, ktoré si môžeš zapnúť — popri veku firmy, registrácii k DPH, dostupnom telefóne alebo e-maile a sociálnych sieťach. Účtovník si zapne iné než fotograf a dostane iné poradie výsledkov.`,
         en: `No. A missing website is one of ${CRITERIA} criteria you can switch on — alongside company age, VAT registration, an available phone or e-mail, and social profiles. An accountant picks different ones than a photographer and gets a different ranking.` },
  },
  {
    q: { cs: 'Co když nechci nic vyplňovat?', sk: 'Čo ak nechcem nič vypĺňať?', en: 'What if I do not want to answer anything?' },
    a: { cs: 'Úvodní čtyři otázky jdou přeskočit jedním kliknutím. Pak řadíme podle neutrálního výchozího nastavení — dostupný kontakt a alespoň tři roky na trhu — a kritéria si můžeš kdykoli doplnit v nastavení.',
         sk: 'Úvodné štyri otázky sa dajú preskočiť jedným kliknutím. Potom radíme podľa neutrálneho východiskového nastavenia — dostupný kontakt a aspoň tri roky na trhu — a kritériá si môžeš kedykoľvek doplniť v nastaveniach.',
         en: 'The four opening questions are one click to skip. We then rank by a neutral default — a reachable contact and at least three years of trading — and you can set your own criteria later in settings.' },
  },
  {
    q: { cs: 'Jak zjišťujete, jestli firma má web?', sk: 'Ako zisťujete, či firma má web?', en: 'How do you work out whether a firm has a website?' },
    a: { cs: 'Žádný veřejný rejstřík weby neeviduje, takže je hledáme sami — třemi cestami: adresu, kterou uvádí zdroj, ověříme tím, že se stránka opravdu načte; zkusíme doménu z firemního e-mailu; a zkusíme domény, které dává název firmy. Nalezenou stránku uznáme, jen když sama doloží, že patří té firmě — má na sobě její IČO, nebo celý název i obor. Výsledek je pak jeden ze tří: ověřený web, nevíme, nebo web nemá. Prostřední stav je zdaleka nejčastější a je to záměr: firmy mívají web pod značkou, kterou z obchodního jména nikdo neuhodne, takže tipovat „nemá web“ by znamenalo lhát zhruba u každé třetí. Že firma web nemá, napíšeme jen tam, kde jsme to opravdu prověřili.',
         sk: 'Žiadny verejný register weby neeviduje, takže ich hľadáme sami — tromi cestami: adresu, ktorú uvádza zdroj, overíme tým, že sa stránka naozaj načíta; skúsime doménu z firemného e-mailu; a skúsime domény, ktoré dáva názov firmy. Nájdenú stránku uznáme, len keď sama doloží, že patrí tej firme — má na sebe jej IČO, alebo celý názov aj odbor. Výsledok je potom jeden z troch: overený web, nevieme, alebo web nemá. Prostredný stav je zďaleka najčastejší a je to zámer: firmy mávajú web pod značkou, ktorú z obchodného mena nikto neuhádne, takže tipovať „nemá web“ by znamenalo klamať zhruba pri každej tretej. Že firma web nemá, napíšeme len tam, kde sme to naozaj preverili.',
         en: 'No public registry records websites, so we go looking ourselves, three ways: we confirm an address a source gave us by loading the page, we try the domain of the firm’s e-mail, and we try the domains its name suggests. A page only counts once it proves it belongs to that firm — its company number is on it, or its full name together with its trade. The answer is then one of three: a verified website, we don’t know, or no website. The middle one is by far the most common, and that is deliberate: firms often run a site under a brand nobody could guess from the registered name, so guessing “no website” would be a lie about roughly every third one. We say a firm has no website only where we checked properly.' },
  },
  {
    q: { cs: 'Je to zdarma?', sk: 'Je to zadarmo?', en: 'Is it free?' },
    // Čísla musí sedět s aplikací: limity a délka zkušebního období v `lib/plans.ts`, ceny
    // v `PRICE_CZK` na ceníku. Limit vyhledávání je klouzavých 30 dní, ne kalendářní měsíc.
    // `\u00a0` je nezlomitelná mezera, aby se „1 499 Kč" nerozdělilo na dva řádky.
    a: { cs: 'Základní plán je zdarma — 5 vyhledávání za 30 dní, 20 výsledků každé, bez platební karty. Kdo potřebuje víc, má Pro za 499\u00a0Kč nebo Business za 1\u00a0499\u00a0Kč měsíčně; při první objednávce je prvních 7 dní zdarma.',
         sk: 'Základný plán je zadarmo — 5 vyhľadávaní za 30 dní, 20 výsledkov každé, bez platobnej karty. Kto potrebuje viac, má Pro za 499\u00a0Kč alebo Business za 1\u00a0499\u00a0Kč mesačne; pri prvej objednávke je prvých 7 dní zadarmo.',
         en: 'The basic plan is free — 5 searches every 30 days, 20 results each, no card required. If you need more, there is Pro at CZK\u00a0499 or Business at CZK\u00a01,499 a month; the first 7 days of your first order are free.' },
  },
  {
    q: { cs: 'Mohu nahrát vlastní seznam firem?', sk: 'Môžem nahrať vlastný zoznam firiem?', en: 'Can I upload my own list?' },
    a: { cs: 'Ano. CSV import projde stejnou kontrolou jako hledání: doplní IČO a DPH, ověří weby a spočítá skóre podle tvých kritérií.',
         sk: 'Áno. CSV import prejde rovnakou kontrolou ako hľadanie: doplní IČO a DPH, overí weby a spočíta skóre podľa tvojich kritérií.',
         en: 'Yes. A CSV import runs through the same pipeline as a search: registry data, website checks, and a score against your criteria.' },
  },
];

const UI = {
  eyebrow:    { cs: 'Veřejné rejstříky · ARES, RES ČSÚ, OpenStreetMap', sk: 'Verejné registre · ARES, RES ČSÚ, OpenStreetMap', en: 'Public registers · ARES, CZSO, OpenStreetMap' },
  hero1:      { cs: 'Najdi firmy, které',       sk: 'Nájdi firmy, ktoré',       en: 'Find the firms that' },
  hero2:      { cs: 'můžou být tvoji klienti',  sk: 'môžu byť tvoji klienti',   en: 'could be your clients' },
  perex:      { cs: 'S kontakty. Z veřejných rejstříků a map. Řekneš nám, komu prodáváš a kde, a my seřadíme, koho volat první.',
                sk: 'S kontaktmi. Z verejných registrov a máp. Povieš nám, komu predávaš a kde, a my zoradíme, koho volať prvého.',
                en: 'With contacts. From public registries and maps. Tell us who you sell to and where, and we rank who to call first.' },
  ctaFree:    { cs: 'Začít zdarma',             sk: 'Začať zadarmo',            en: 'Start for free' },
  ctaHow:     { cs: 'Jak to funguje',           sk: 'Ako to funguje',           en: 'How it works' },
  ctaTry:     { cs: 'Vyzkoušet',                sk: 'Vyskúšať',                 en: 'Try it' },
  ctaAccount: { cs: 'Založit účet zdarma',      sk: 'Založiť účet zadarmo',     en: 'Create a free account' },
  demoHead:   { cs: '7 z 214 výsledků, seřazeno podle skóre',
                sk: '7 z 214 výsledkov, zoradené podľa skóre',
                en: '7 of 214 results, ranked by score' },
  demoQuery:  { cs: 'Účetní hledá: Nové firmy · Všechny obory · Jihomoravský kraj',
                sk: 'Účtovník hľadá: Nové firmy · Všetky odbory · Juhomoravský kraj',
                en: 'An accountant searches: New firms · All trades · South Moravia' },
  demoTag:    { cs: 'Ukázková data',            sk: 'Ukážkové dáta',            en: 'Sample data' },
  demoCrit:   { cs: 'Jeho kritéria',            sk: 'Jeho kritériá',            en: 'Their criteria' },
  demoNote:   { cs: 'Ukázková data pro představu, jak výsledek vypadá. Skóre je podíl splněných kritérií — jiný obor si zapne jiná a dostane jiné pořadí.',
                sk: 'Ukážkové dáta pre predstavu, ako výsledok vyzerá. Skóre je podiel splnených kritérií — iný odbor si zapne iné a dostane iné poradie.',
                en: 'Sample rows showing what a result looks like. The score is the share of criteria met — another trade ticks different ones and gets a different order.' },
  since:      { cs: 'od',                       sk: 'od',                       en: 'since' },
  audTitle:   { cs: 'Pět lidí, pět hledání.',   sk: 'Päť ľudí, päť hľadaní.',   en: 'Five people, five searches.' },
  audNote:    { cs: `Když se ve výčtu nevidíš, poskládáš si kritéria sám — je jich ${CRITERIA} a kombinují se libovolně, i napříč obory.`,
                sk: `Keď sa vo výpočte nevidíš, poskladáš si kritériá sám — je ich ${CRITERIA} a kombinujú sa ľubovoľne, aj naprieč odbormi.`,
                en: `Not on the list? Build your own combination — there are ${CRITERIA} criteria and they mix freely, across trades too.` },
  stepsTitle: { cs: 'Čtyři kroky, tři minuty.', sk: 'Štyri kroky, tri minúty.', en: 'Four steps, three minutes.' },
  faqTitle:   { cs: 'Otázky.',                  sk: 'Otázky.',                  en: 'Questions.' },
  closing:    { cs: 'Kdo je na řadě',           sk: 'Kto je na rade',           en: 'Who is next' },
  // Limit účtu zdarma je za 30 dní (lib/plans.ts), ne kalendářní měsíc — obchodní podmínky říkají totéž.
  closingSub: { cs: 'Účet zdarma, bez karty. Pět hledání za 30 dní na vyzkoušení.',
                sk: 'Účet zadarmo, bez karty. Päť hľadaní za 30 dní na vyskúšanie.',
                en: 'Free account, no card. Five searches every 30 days to try it out.' },
};

/**
 * Tři fakta pod nadpisem. Každé musí být doložitelné z aplikace, ne slib: zdroje jsou ty, které
 * patička uvádí; „celý kraj" a „do 30 dnů" dává index z ČSÚ (lib/registry-index.ts).
 */
const FACTS: Array<{ icon: LucideIcon; tile: string; text: Text }> = [
  { icon: Database,  tile: 'who',      text: { cs: 'Jen veřejné rejstříky, nic koupeného', sk: 'Len verejné registre, nič kúpené', en: 'Public registers only, nothing bought' } },
  { icon: MapPinned, tile: 'standing', text: { cs: 'Celý kraj, ne jen krajské město',      sk: 'Celý kraj, nie len krajské mesto',  en: 'The whole region, not just its capital' } },
  { icon: Sparkles,  tile: 'event',    text: { cs: 'Nové firmy do 30 dnů od vzniku',       sk: 'Nové firmy do 30 dní od vzniku',    en: 'New firms within 30 days of founding' } },
];

/** Ikonka ke každému kroku — v pořadí `STEPS`. Bez číslování: pořadí říká mřížka sama. */
const STEP_ICONS: Array<{ icon: LucideIcon; tile: string }> = [
  { icon: MessageSquareText, tile: 'who' },
  { icon: Database,          tile: 'standing' },
  { icon: ShieldCheck,       tile: 'event' },
  { icon: ListOrdered,       tile: 'reach' },
];

/** Ikonka a barva ke každému z pěti lidí — v pořadí `AUDIENCE`. */
const AUDIENCE_ICONS: Array<{ icon: LucideIcon; tile: string }> = [
  { icon: Calculator, tile: 'event' },
  { icon: Building2,  tile: 'standing' },
  { icon: Megaphone,  tile: 'reach' },
  { icon: Camera,     tile: 'reach' },
  { icon: Code2,      tile: 'who' },
];

export default function HomePage() {
  const locale = useLocale();
  const t = (text: Text) => localized(text, locale);

  return (
    <div>

      {/* ── Hero: štítek, nadpis, jedna věta, dvě tlačítka, tři fakta. Pod tím živé pozadí. ── */}
      <section className="relative overflow-hidden px-5 pt-32 pb-16 md:pt-44 md:pb-24">
        <Backdrop />
        <div className="relative z-10 max-w-6xl mx-auto">
          <p className="eyebrow animate-fade-up">{t(UI.eyebrow)}</p>

          <h1 className="display animate-fade-up max-w-5xl mt-6" style={{ animationDelay: '.04s' }}>
            {t(UI.hero1)}<br /><span className="text-gradient">{t(UI.hero2)}</span><span className="text-accent">.</span>
          </h1>

          <p className="mt-8 text-lg md:text-xl text-ink-muted max-w-xl animate-fade-up" style={{ animationDelay: '.08s' }}>
            {t(UI.perex)}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 animate-fade-up" style={{ animationDelay: '.12s' }}>
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {t(UI.ctaFree)} <ArrowRight size={16} />
            </Link>
            <a href="#how" className="btn-ghost btn-lg">{t(UI.ctaHow)}</a>
          </div>

          <ul className="mt-14 grid gap-3 sm:grid-cols-3 animate-fade-up" style={{ animationDelay: '.16s' }}>
            {FACTS.map(f => (
              <li key={f.text.en} className="flex items-center gap-3 rounded-xl border border-line bg-surface-subtle/70 px-4 py-3 backdrop-blur">
                <span className={`icon-tile icon-tile--${f.tile}`}><f.icon size={16} /></span>
                <span className="text-sm text-ink-muted">{t(f.text)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── The product, before registering ── */}
      <section className="px-5 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="card-glow p-0 overflow-hidden">
            {/* Rám prohlížeče: ukázka má vypadat jako aplikace, ne jako tabulka na webu. Tři tečky
                a řádek s adresou jsou konvence, kterou každý přečte na první pohled. */}
            <div className="flex items-center gap-3 border-b border-line bg-surface-muted/60 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink/20" />
              </span>
              <span className="mx-auto rounded-md border border-line bg-surface px-3 py-0.5 font-mono text-[11px] text-ink-faint">klienthunter.vercel.app/search</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-5 pt-5 md:px-7">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-field bg-surface-muted px-3 py-2 text-sm">
                <SearchIcon size={14} className="shrink-0 text-ink-faint" />
                <span className="truncate text-ink">{t(UI.demoQuery)}</span>
              </div>
              <span className="badge-warm">{t(UI.demoTag)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-2 md:px-7">
              <h2 className="text-sm font-semibold">{t(UI.demoHead)}</h2>
            </div>

            {/* Naming the criteria makes the score readable: without them a number is just a number. */}
            <p className="px-5 md:px-7 text-xs text-ink-faint mb-2">
              <span className="uppercase tracking-wider font-semibold">{t(UI.demoCrit)}:</span>{' '}
              {DEMO_CRITERIA.map(c => t(c)).join(' · ')}
            </p>

            <div className="px-2 md:px-4 pb-3">
              {DEMO.map((d, i) => {
                const score = Math.round((d.meets.length / DEMO_CRITERIA.length) * 100);
                return (
                  <div
                    key={d.name}
                    className="stagger row flex items-center gap-5 py-5 pl-4 pr-3 border-l-[3px] rounded-r-lg"
                    style={{ '--i': i, borderLeftColor: score >= GOOD_LEAD ? 'rgb(var(--accent))' : 'transparent' } as React.CSSProperties}
                  >
                    <LeadScore value={score} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{d.name}</p>
                      <p className="text-sm text-ink-muted truncate">{t(d.trade)} · Brno</p>
                    </div>
                    <div className="hidden sm:flex flex-wrap justify-end gap-1.5 w-64">
                      {d.meets.map(m => (
                        <span key={m} className={m === 0 ? 'badge-warm' : 'badge'}>{t(DEMO_CRITERIA[m])}</span>
                      ))}
                    </div>
                    <div className="hidden md:block text-sm text-ink-faint tnum w-20 text-right">
                      {t(UI.since)} {d.since}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-6 text-sm text-ink-faint max-w-2xl">{t(UI.demoNote)}</p>
        </div>
      </section>

      {/* ── Who it is for ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display-sm max-w-2xl">{t(UI.audTitle)}</h2>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {AUDIENCE.map((a, i) => {
              const Icon = AUDIENCE_ICONS[i].icon;
              return (
                <Reveal key={a.who.en} delay={i * 60}>
                  <div className="card h-full hover:border-line-strong transition-colors">
                    <span className={`icon-tile icon-tile--${AUDIENCE_ICONS[i].tile}`}><Icon size={16} /></span>
                    <p className="mt-4 font-semibold">{t(a.who)}</p>
                    <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{t(a.what)}</p>
                  </div>
                </Reveal>
              );
            })}
            <Reveal delay={AUDIENCE.length * 60}>
              <div className="h-full rounded-xl border border-dashed border-line-strong p-6 flex items-center">
                <p className="text-sm text-ink-muted leading-relaxed">{t(UI.audNote)}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="px-5 py-24 border-t border-line scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="display-sm max-w-2xl">{t(UI.stepsTitle)}</h2>

          <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, desc], i) => {
              const Icon = STEP_ICONS[i].icon;
              return (
              <Reveal key={title.en} delay={i * 60}>
                <li className="card h-full">
                  <span className={`icon-tile icon-tile--${STEP_ICONS[i].tile}`}><Icon size={16} /></span>
                  <p className="mt-4 font-semibold">{t(title)}</p>
                  <p className="text-sm text-ink-muted mt-1.5 leading-relaxed">{t(desc)}</p>
                </li>
              </Reveal>
              );
            })}
          </ol>

          <div className="mt-12">
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {t(UI.ctaTry)} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-3xl mx-auto">
          <h2 className="display-sm mb-12">{t(UI.faqTitle)}</h2>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="group card py-4 px-5 md:px-6">
                <summary className="font-semibold cursor-pointer list-none flex items-start justify-between gap-6">
                  {t(item.q)}
                  <span className="icon-tile icon-tile--who h-7 w-7 rounded-full group-open:rotate-45 transition-transform duration-200"><Plus size={14} /></span>
                </summary>
                <p className="text-ink-muted mt-3 leading-relaxed">{t(item.a)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="px-5 py-28 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <div className="card-glow relative overflow-hidden px-6 py-14 md:px-14 md:py-20">
            <Backdrop />
            <div className="relative z-10">
              <h2 className="display max-w-4xl">
                {t(UI.closing)}<span className="text-accent">?</span>
              </h2>
              <p className="mt-6 text-lg text-ink-muted max-w-xl">{t(UI.closingSub)}</p>
              <div className="mt-10">
                <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
                  {t(UI.ctaAccount)} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
