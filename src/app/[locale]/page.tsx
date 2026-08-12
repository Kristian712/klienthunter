import Link from 'next/link';
import { useLocale } from 'next-intl';
import { LeadScore, GOOD_LEAD } from '@/components/LeadScore';
import { Reveal } from '@/components/Reveal';

/**
 * The landing page has five seconds and no brand recognition, so it says one thing in type big
 * enough to be unmissable and then immediately shows the product working. The demo table below
 * the fold is the argument: a visitor sees the actual output before being asked to register.
 *
 * Deliberately absent: gradients, coloured sections, card shadows, stock imagery, and any
 * social proof — we have no real numbers yet, and invented ones would be a lie a paying
 * customer eventually notices.
 */

/** Made-up but plausible rows, labelled as such on screen. Scores follow `lib/lead-score.ts`. */
const DEMO = [
  { name: 'Autoservis Dvořák', trade: 'Opravy motorových vozidel', city: 'Brno',     web: 'Web neuveden',    since: 2009, score: 85 },
  { name: 'Kadeřnictví Hana',  trade: 'Kadeřnické služby',         city: 'Brno',     web: 'Web neuveden',    since: 2014, score: 80 },
  { name: 'Pekárna U Mostu',   trade: 'Pekařství',                 city: 'Olomouc',  web: 'Pomalý web 3,4 s', since: 2004, score: 70 },
  { name: 'Zámečnictví Král',  trade: 'Zámečnictví',               city: 'Zlín',     web: 'Zastaralý web',   since: 1998, score: 65 },
  { name: 'Květinářství Iva',  trade: 'Maloobchod s květinami',    city: 'Brno',     web: 'Web neuveden',    since: 2021, score: 60 },
  { name: 'Restaurace Na Rohu', trade: 'Stravování v restauracích', city: 'Olomouc', web: 'Zastaralý web',   since: 2011, score: 55 },
  { name: 'Optika Novák',      trade: 'Oční optika',               city: 'Plzeň',    web: 'Má web',          since: 2006, score: 25 },
  { name: 'Lékárna Centrum',   trade: 'Lékárny',                   city: 'Plzeň',    web: 'Má web',          since: 2001, score: 20 },
];

const STEPS = [
  {
    cs: ['Zadáš obor a město', 'Například „kadeřnictví" a „Brno". Nic dalšího vyplňovat nemusíš.'],
    en: ['Enter a trade and a town', 'For example "hair salon" and "Brno". Nothing else to fill in.'],
  },
  {
    cs: ['Prohledáme ARES a OpenStreetMap', 'Veřejný rejstřík dá objem a IČO, mapa dá telefony a e-maily.'],
    en: ['We search ARES and OpenStreetMap', 'The public registry brings volume and company numbers, the map brings contacts.'],
  },
  {
    cs: ['Ověříme web u každé firmy', 'Načteme stránku, změříme rychlost a poznáme zastaralý web. Robots.txt respektujeme.'],
    en: ['We check every website', 'We load the page, measure its speed and spot an outdated site. We respect robots.txt.'],
  },
  {
    cs: ['Seřadíme podle skóre a exportuješ', 'Nahoře je ten, koho má smysl volat první. Export do Excelu i CSV.'],
    en: ['We rank by score, you export', 'The best opportunity is on top. Export to Excel or CSV.'],
  },
];

const FAQ = [
  {
    q_cs: 'Odkud pocházejí data o firmách?',
    q_en: 'Where does the business data come from?',
    a_cs: 'Z veřejných zdrojů: rejstřík ARES a živnostenský rejstřík, registr plátců DPH a OpenStreetMap (© přispěvatelé OpenStreetMap, ODbL). Kontakty bereme jen z webů firem, které to v robots.txt dovolují.',
    a_en: 'From public sources: the ARES and trade registries, the VAT payer register and OpenStreetMap (© OpenStreetMap contributors, ODbL). Contacts come only from company websites whose robots.txt allows it.',
  },
  {
    q_cs: 'Co znamená skóre u každé firmy?',
    q_en: 'What does the score mean?',
    a_cs: 'Jak dobrá je to příležitost, ne jak dobrá je to firma. Nejvýš je firma bez webu, se zveřejněným telefonem a s pár lety na trhu. Firma s rychlým moderním webem je dole – tu přesvědčíš těžko.',
    a_en: 'How good an opportunity it is, not how good the business is. Highest: no website, a public phone number, a few years of trading. A firm with a fast modern site sits at the bottom.',
  },
  {
    q_cs: 'Proč u některých firem píšete „web neuveden" místo „bez webu"?',
    q_en: 'Why "no website found" instead of "no website"?',
    a_cs: 'Protože to je pravda. Žádný veřejný rejstřík neeviduje weby, takže nikdo nemůže dokázat, že firma web nemá – jen že jsme žádný nenašli. Radši ti řekneme, co víme, než abychom hádali.',
    a_en: 'Because it is the truth. No public registry records websites, so nobody can prove a business has none — only that we found none.',
  },
  {
    q_cs: 'Je to zdarma?',
    q_en: 'Is it free?',
    a_cs: 'Základní plán je zdarma – 5 vyhledávání měsíčně, 20 výsledků každé. Registrace je zatím na pozvánku.',
    a_en: 'The basic plan is free – 5 searches a month, 20 results each. Registration is currently invite-only.',
  },
  {
    q_cs: 'Mohu nahrát vlastní seznam firem?',
    q_en: 'Can I upload my own list?',
    a_cs: 'Ano. CSV import projde stejnou kontrolou jako hledání: doplní IČO a DPH, ověří weby a spočítá skóre.',
    a_en: 'Yes. A CSV import runs through the same pipeline as a search: registry data, website checks, score.',
  },
];

export default function HomePage() {
  const locale = useLocale();
  const isCs = locale === 'cs';

  return (
    <div className="bg-white">

      {/* ── Hero: one headline, one line, one button ── */}
      <section className="px-5 pt-32 pb-16 md:pt-44 md:pb-24">
        <div className="max-w-6xl mx-auto">
          <h1 className="display animate-fade-up max-w-5xl">
            {isCs ? (
              <>Najdi firmy,<br />které nemají web<span className="text-accent">.</span></>
            ) : (
              <>Find the firms<br />with no website<span className="text-accent">.</span></>
            )}
          </h1>

          <p className="mt-8 text-lg md:text-xl text-ink-muted max-w-xl animate-fade-up" style={{ animationDelay: '.06s' }}>
            {isCs
              ? 'Z veřejných rejstříků a map. Ověříme web, doplníme IČO a DPH a seřadíme podle toho, koho má smysl volat první.'
              : 'From public registries and maps. We verify the website, add registry data and rank by who is worth calling first.'}
          </p>

          <div className="mt-10 animate-fade-up" style={{ animationDelay: '.12s' }}>
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {isCs ? 'Začít zdarma' : 'Start for free'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── The product, before registering ── */}
      <section className="px-5 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between border-b border-ink pb-3 mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              {isCs ? 'Kadeřnictví · Brno · 8 z 214 výsledků' : 'Hair salons · Brno · 8 of 214 results'}
            </h2>
            <span className="text-xs text-ink-faint">
              {isCs ? 'Ukázková data' : 'Sample data'}
            </span>
          </div>

          <div>
            {DEMO.map((d, i) => (
              <div
                key={d.name}
                className="stagger row flex items-center gap-5 py-5 pl-4 border-l-[3px]"
                style={{ '--i': i, borderLeftColor: d.score >= GOOD_LEAD ? '#e63900' : 'transparent' } as React.CSSProperties}
              >
                <LeadScore value={d.score} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{d.name}</p>
                  <p className="text-sm text-ink-muted truncate">{d.trade} · {d.city}</p>
                </div>
                <div className="hidden sm:block text-sm text-ink-muted w-40 text-right">{d.web}</div>
                <div className="hidden md:block text-sm text-ink-faint tnum w-24 text-right">
                  {isCs ? 'od' : 'since'} {d.since}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-ink-faint max-w-2xl">
            {isCs
              ? 'Ukázková data pro představu, jak výsledek vypadá. Skóre počítáme z ověřeného stavu webu, dostupných kontaktů, stáří firmy a registrace k DPH.'
              : 'Sample rows showing what a result looks like. The score is computed from the verified website status, available contacts, company age and VAT registration.'}
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display-sm max-w-2xl">
            {isCs ? 'Čtyři kroky, tři minuty.' : 'Four steps, three minutes.'}
          </h2>

          <div className="mt-14 max-w-3xl">
            {STEPS.map((s, i) => {
              const [title, desc] = isCs ? s.cs : s.en;
              return (
                <Reveal key={title} delay={i * 60}>
                  <div className="py-6 border-b border-line">
                    <p className="font-semibold">{title}</p>
                    <p className="text-ink-muted mt-1.5">{desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>

          <div className="mt-12">
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {isCs ? 'Vyzkoušet' : 'Try it'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-5 py-24 border-t border-line">
        <div className="max-w-3xl mx-auto">
          <h2 className="display-sm mb-12">{isCs ? 'Otázky.' : 'Questions.'}</h2>
          {FAQ.map((item, i) => (
            <details key={i} className="group border-b border-line py-5">
              <summary className="font-semibold cursor-pointer list-none flex items-start justify-between gap-6">
                {isCs ? item.q_cs : item.q_en}
                <span className="text-ink-faint shrink-0 group-open:rotate-45 transition-transform duration-200">+</span>
              </summary>
              <p className="text-ink-muted mt-3 leading-relaxed">{isCs ? item.a_cs : item.a_en}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="px-5 py-28 border-t border-line">
        <div className="max-w-6xl mx-auto">
          <h2 className="display max-w-4xl">
            {isCs ? <>Kdo je na řadě<span className="text-accent">?</span></> : <>Who is next<span className="text-accent">?</span></>}
          </h2>
          <div className="mt-10">
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg">
              {isCs ? 'Založit účet zdarma' : 'Create a free account'}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line px-5 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                {isCs ? 'Produkt' : 'Product'}
              </p>
              <div className="space-y-2">
                <Link href={`/${locale}/search`} className="block text-sm text-ink-muted hover:text-ink">{isCs ? 'Vyhledávání' : 'Search'}</Link>
                <Link href={`/${locale}/pricing`} className="block text-sm text-ink-muted hover:text-ink">{isCs ? 'Ceník' : 'Pricing'}</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                {isCs ? 'Podpora' : 'Support'}
              </p>
              <Link href={`/${locale}/contact`} className="block text-sm text-ink-muted hover:text-ink">{isCs ? 'Kontakt' : 'Contact'}</Link>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                {isCs ? 'Právní' : 'Legal'}
              </p>
              <div className="space-y-2">
                <Link href={`/${locale}/privacy`} className="block text-sm text-ink-muted hover:text-ink">{isCs ? 'Ochrana údajů' : 'Privacy'}</Link>
                <Link href={`/${locale}/terms`} className="block text-sm text-ink-muted hover:text-ink">{isCs ? 'Podmínky' : 'Terms'}</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">
                {isCs ? 'Jazyk' : 'Language'}
              </p>
              <div className="space-y-2">
                <Link href="/cs" className="block text-sm text-ink-muted hover:text-ink">Čeština</Link>
                <Link href="/sk" className="block text-sm text-ink-muted hover:text-ink">Slovenčina</Link>
                <Link href="/en" className="block text-sm text-ink-muted hover:text-ink">English</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-line mt-10 pt-6 flex flex-col md:flex-row justify-between gap-2 text-xs text-ink-faint">
            <span>© 2026 KlientHunter</span>
            <span>{isCs ? 'Data: ARES · OpenStreetMap (ODbL) · registr plátců DPH' : 'Data: ARES · OpenStreetMap (ODbL) · Czech VAT register'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
