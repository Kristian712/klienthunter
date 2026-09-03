import dns from 'node:dns/promises';
import { searchDomains, webSearchEnabled } from './sources/web-search';
import { normalizeName, probeWebsite, type ProbeResult, type RobotsCheck } from './website-status';

/**
 * Finding the firm's own website when no source named one.
 *
 * Why this exists: ARES has no website column and OpenStreetMap tags one on a small minority of
 * what it maps — for a search like "zubaři v Ostravě" that means 206 firms and zero websites,
 * while the first name typed into a search engine turns one up in seconds. Saying nothing was
 * honest but useless; the fix is to actually go and look.
 *
 * The danger is obvious and is the reason this module is so cautious: a guessed domain that
 * happens to answer would attach a stranger's website to a firm, which is exactly the confident
 * wrong answer the app must never produce. So a guess is only ever a question, and only the
 * fetched page can answer it:
 *
 *   • the firm's IČO printed on the page — decisive, nobody else prints that number, or
 *   • every word of the firm's name found on the page, on a domain built out of that same name.
 *
 * Anything less and we stay quiet. Measured on 60 real Ostrava dental practices from ARES this
 * confirms a website for about one in five and produced no false match; the domains it walked
 * away from (ostrava.cz for "EuroDent Ostrava", centrum.cz for "TRT zubní centrum",
 * ordinace.cz for "o.dent zubní ordinace") are exactly the ones a looser rule would have
 * printed as facts.
 */

/** Words that describe a trade rather than name a firm, so they can never be a domain by themselves. */
const GENERIC_WORDS = new Set([
  'ordinace', 'klinika', 'centrum', 'studio', 'salon', 'servis', 'sluzby', 'praxe', 'poradna',
  'atelier', 'group', 'company', 'firma', 'shop', 'store', 'czech', 'ceska', 'ceske', 'cesky',
  'morava', 'praha', 'brno', 'ostrava', 'plzen', 'olomouc', 'liberec', 'bratislava', 'kosice',
  'dental', 'dentalni', 'denta', 'dent', 'zubni', 'zubar', 'stomatologie', 'medicina', 'estetika',
  'esteticka', 'doktor', 'lekar', 'smile', 'profi', 'plus', 'prvni', 'nova', 'nove', 'novy',
  'restaurace', 'kavarna', 'pekarna', 'reznictvi', 'kadernictvi', 'kosmetika', 'masaze',
  'autoservis', 'pneuservis', 'instalater', 'elektro', 'elektrikar', 'truhlarstvi', 'zamecnictvi',
  'stavby', 'staveb', 'reality', 'realitni', 'advokat', 'advokatni', 'ucetnictvi', 'ucetni',
  'fitness', 'sport', 'design', 'media', 'online', 'system', 'systemy', 'trade', 'invest',
]);

/** Academic and professional titles — part of a person's name, never part of a domain. */
const TITLES = /\b(mudr|mddr|mvdr|judr|ing|mgr|bc|phdr|rndr|paeddr|prof|doc|csc|ph\s*d)\b\.?/g;

/** Country the search runs in decides which TLD a firm would have registered. */
const TLD_BY_COUNTRY: Array<[RegExp, string]> = [
  [/slovakia|slovensk/i, 'sk'],
  [/germany|deutschland|německ|nemeck/i, 'de'],
  [/austria|rakous/i, 'at'],
  [/\bUK\b|united kingdom|británi|britani/i, 'co.uk'],
  [/\bUSA\b|united states/i, 'com'],
  [/poland|polsk/i, 'pl'],
];

export function tldForRegion(region: string): string {
  for (const [re, tld] of TLD_BY_COUNTRY) if (re.test(region)) return tld;
  return 'cz';
}

/**
 * How often each word occurs across the whole result set.
 *
 * This is what tells "ajna" apart from "dental" without anyone maintaining a list per trade: in
 * a search for dentists half the names contain "dental", and exactly one contains "ajna". The
 * static list above only covers the words that would be generic even in a set of one.
 */
export interface NameIndex {
  df: Map<string, number>;
  size: number;
}

export function buildNameIndex(names: string[]): NameIndex {
  const df = new Map<string, number>();
  for (const name of names) {
    for (const token of Array.from(new Set(nameTokens(name)))) df.set(token, (df.get(token) ?? 0) + 1);
  }
  return { df, size: names.length };
}

/** The firm's name reduced to plain words: no legal form, no titles, no diacritics. */
export function nameTokens(name: string): string[] {
  const cely = normalizeName(name.replace(/"[^"]*"/g, ' '))
    .split(' ')
    .filter(t => t.length >= 2);
  const bezTitulu = normalizeName(name.replace(/"[^"]*"/g, ' '))
    .replace(TITLES, ' ')
    .split(' ')
    .filter(t => t.length >= 2);

  /**
   * Titul se škrtá jen tehdy, když po něm zbude čím firmu pojmenovat.
   *
   * „PROF SERVIS s.r.o." není profesor: `TITLES` z něj udělalo jen „servis", což je obecné
   * slovo, takže firma nedostala jediného kandidáta na doménu a její web (profservis.cz) jsme
   * nikdy nehledali. U „MUDr. Nováková" naopak škrtnout chceme. Rozhoduje výsledek: když
   * škrtání nenechá ani jedno slovo, které firmu odlišuje, bereme název, jak přišel.
   */
  const zbylo = bezTitulu.filter(t => !GENERIC_WORDS.has(t));
  return zbylo.length > 0 ? bezTitulu : cely;
}

/** A word specific enough that a domain made of it alone could plausibly be this firm's. */
function isDistinctive(token: string, index: NameIndex): boolean {
  if (token.length < 4 || GENERIC_WORDS.has(token)) return false;
  const ceiling = Math.max(2, Math.ceil(index.size * 0.02));
  return (index.df.get(token) ?? 0) <= ceiling;
}

/**
 * Slova, kterými se firma odlišuje od ostatních ve svém oboru.
 *
 * Obecná slova oboru se na stránce vyžadovat nedají: česká ordinace se anglicky „clinic"
 * nenapíše, i když to má v názvu. Když ale po odstranění obecných slov nezbude nic — „PK DENT",
 * „U2 Dent", „ST HP" —, bere se název, jak přišel: krátká zkratka je pro tu firmu často
 * odlišující víc než cokoli jiného.
 */
export function identifyingTokens(name: string): string[] {
  const vsechna = nameTokens(name);
  const odlisujici = vsechna.filter(t => !GENERIC_WORDS.has(t) && t.length >= 3);
  if (odlisujici.length > 0) return odlisujici;
  const kratke = vsechna.filter(t => !GENERIC_WORDS.has(t));
  return kratke.length > 0 ? kratke : vsechna;
}

const MIN_SLUG = 4;
const MAX_SLUG = 40;
export const MAX_DOMAINS_PER_FIRM = 10;

/** Kolik domén jedné firmy smí dojít až ke stažení stránky. DNS je levné, HTTP ne. */
const MAX_PROBES_PER_FIRM = 5;

/**
 * Domains worth asking about, best first.
 *
 * The whole name joined up is always fair game — `dentalnistudiokpd.cz` cannot belong to anybody
 * else. Shortened forms are only built from a distinctive word, which is what keeps this from
 * proposing `centrum.cz` for "TRT zubní centrum".
 */
/**
 * Co ještě zkusit u firem, které se jmenují po majiteli.
 *
 * „Radek Lizanec" má web na `kadernictvi-lizanec.cz`, ne na `radeklizanec.cz` — jméno v doméně
 * často doprovází obor nebo město, protože samo o sobě nic neprodává. Doména navíc stojí jeden
 * DNS dotaz; teprve ta, která existuje, stojí stažení stránky, a i pak musí projít důkazem.
 */
export interface DomainHints {
  /** Slova oboru, jak je zná `nace-map` — `kadernictvi`, `autoservis`. */
  tradeWords?: readonly string[];
  /** Město, ve kterém se hledá. */
  city?: string;
}

export function domainCandidates(
  name: string,
  index: NameIndex,
  tld: string,
  hints: DomainHints = {},
): string[] {
  const tokens = nameTokens(name);
  if (tokens.length === 0) return [];
  const distinctive = tokens.filter(t => isDistinctive(t, index));

  const slugs: string[] = [];
  const push = (slug: string) => {
    if (slug.length >= MIN_SLUG && slug.length <= MAX_SLUG && !slugs.includes(slug)) slugs.push(slug);
  };

  /**
   * Firma pojmenovaná samými obecnými slovy.
   *
   * „G A Dent s.r.o." se scvrkne na jediné slovo „dent" a `dent.cz` je portál, ne ta firma —
   * jedno obecné slovo doménou být nesmí. Ale „Zubní Estetika" nebo „Dentální centrum Ostrava"
   * mají obecné slovo každé, a přesto je `zubniestetika.cz` doména právě té firmy. Změřeno na
   * 120 zubařích v Ostravě: pět firem tímhle pravidlem propadlo úplně a aplikace o nich
   * nedokázala říct vůbec nic. Takže: víc slov spojených dohromady ano, jedno obecné slovo ne.
   */
  const identifying = tokens.filter(t => !GENERIC_WORDS.has(t));
  if (identifying.length === 0 && tokens.length < 2) return [];

  push(tokens.join(''));
  if (tokens.length > 1) push(tokens.join('-'));
  /**
   * Název bez obecných slov: „Dentdelion – zubní ordinace" má web na `dentdelion.cz`, ne na
   * `dentdelionzubniordinace.cz`. Firmy si do domény obor obvykle nedávají, i když ho mají
   * v obchodním jménu.
   */
  const odlisujici = identifyingTokens(name);
  if (odlisujici.length > 0 && odlisujici.length < tokens.length) {
    push(odlisujici.join(''));
    if (odlisujici.length > 1) push(odlisujici.join('-'));
  }
  // "AJNA dental clinic" is known as ajnadental; the tail of a long name is usually dropped.
  if (tokens.length > 2 && distinctive.some(d => tokens.slice(0, 2).includes(d))) {
    push(tokens.slice(0, 2).join(''));
    push(tokens.slice(0, 2).join('-'));
  }
  for (const token of distinctive) if (token.length >= 5) push(token);

  /**
   * Kombinace se slovem oboru a s městem.
   *
   * Živnostník web pod svým jménem obvykle nemá; má ho pod „obor + příjmení" nebo „obor + město".
   * Bez těchhle tvarů aplikace u poloviny malých firem tvrdila „web nemá", aniž by tu doménu
   * kdy zkusila. Přidávají se až na konec, takže pořadí nejlepších hypotéz zůstává stejné.
   */
  const trade = (hints.tradeWords ?? []).map(w => normalizeName(w).replace(/\s+/g, '')).filter(w => w.length >= 4)[0];
  const city = hints.city ? normalizeName(hints.city).replace(/\s+/g, '') : undefined;
  const jadro = identifyingTokens(name);
  const posledni = jadro[jadro.length - 1];

  if (trade && posledni) {
    push(`${trade}${posledni}`);
    push(`${trade}-${posledni}`);
    push(`${posledni}${trade}`);
  }
  if (city && jadro.length > 0) {
    push(`${jadro.join('')}${city}`);
    push(`${jadro.join('')}-${city}`);
  }

  return slugs.slice(0, MAX_DOMAINS_PER_FIRM).map(s => `${s}.${tld}`);
}

/** Cheap filter: an unregistered domain costs one UDP round trip instead of a five-second probe. */
async function resolvable(domain: string): Promise<boolean> {
  try {
    await dns.resolve4(domain);
    return true;
  } catch {
    /* fall through to IPv6 — some hosts are AAAA-only */
  }
  try {
    await dns.resolve6(domain);
    return true;
  } catch {
    return false;
  }
}

/** Readable text of a page, lowercased and stripped of diacritics, markup and scripts. */
export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Whole-word test on the flattened page text.
 *
 * `String.includes` was not enough and the difference was not academic: "MUDr. Lukáš Mer" ended
 * up matched to `lukas.cz` because the three letters of "mer" occur inside `komerční`. A name is
 * only on a page when it is there as a word.
 */
export function hasWord(text: string, word: string): boolean {
  if (!word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(text);
}

/** Registrar placeholders answer 200 with a page that is nobody's website. */
const PARKED = /(je na prodej|na predaj|for sale|parkovan[aáéy]|zaregistrujte si|under construction|website coming soon)/i;

/** The label a domain is known by, hyphens removed, so `kovac-dental` compares with the name. */
function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/-/g, '');
  } catch {
    return '';
  }
}

export interface DiscoveredSite {
  url: string;
  html?: string;
  /** Czech sentence naming what convinced us, shown in the row's tooltip and in exports. */
  evidence: string;
}

/**
 * Co o firmě víme z registrů a z map. Slouží jako důkazní materiál: doména se hádá z názvu,
 * takže shoda názvu na stránce je kruh — teprve jeden z těchhle údajů odděluje web té firmy
 * od webu jmenovce.
 */
export interface FirmFacts {
  name: string;
  ico?: string;
  /** Telefon, jak ho zná zdroj. Porovnává se po číslicích, na tvaru nezáleží. */
  phone?: string;
  /** Adresa sídla nebo provozovny z registru. */
  address?: string;
}

/** Číslice bez oddělovačů. Telefon i IČO se na webech píšou po skupinách, s mezerami i tečkami. */
function digitsOf(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

/** Devět číslic českého čísla, ať přišlo v jakémkoli tvaru. */
function phoneDigits(phone: string | undefined): string | null {
  if (!phone) return null;
  const d = digitsOf(phone).replace(/^(?:00)?420/, '');
  return d.length === 9 ? d : null;
}

/**
 * Ulice, číslo popisné a obec z registrové adresy.
 *
 * ARES posílá adresu jako jeden řetězec: „V Hruškovém Sadu 871/1, Muglinov, 71200 Ostrava".
 * Rozebrat ji stojí pár řádků a vynese druhý nezávislý fakt o firmě — kontakt na webu je
 * skoro vždycky psaný stejnou adresou.
 */
export function addressParts(address: string | undefined): { street?: string; number?: string; city?: string } {
  if (!address) return {};
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return {};

  const cislo = /(\d+[a-z]?(?:\/\d+[a-z]?)?)\s*$/i.exec(parts[0]);
  const street = normalizeName(parts[0].replace(/(\d+[a-z]?(?:\/\d+[a-z]?)?)\s*$/i, '')).trim();

  let city: string | undefined;
  for (const part of parts) {
    const psc = /^\d{3} ?\d{2}\s+(.+)$/.exec(part);
    if (psc) { city = normalizeName(psc[1].split('-')[0]).trim(); break; }
  }

  return {
    street: street.length >= 3 ? street : undefined,
    number: cislo?.[1],
    city: city && city.length >= 2 ? city : undefined,
  };
}

/**
 * Nezávislé důkazy, že stránka patří téhle firmě — ne jmenovci.
 *
 * Sílu nemají stejnou a taky se tak používají (viz `pageEvidence`): IČO, telefon a plná adresa
 * jsou samy o sobě dost, obec je slabý údaj, který platí jen ve dvojici s oborem.
 */
function factsOnPage(text: string, firm: FirmFacts): { strong?: string; city?: boolean } {
  const cislice = digitsOf(text);

  if (firm.ico && cislice.includes(firm.ico.replace(/^0+/, ''))) {
    return { strong: `na stránce je IČO ${firm.ico}` };
  }

  const tel = phoneDigits(firm.phone);
  if (tel && cislice.includes(tel)) {
    return { strong: 'na stránce je telefon té firmy' };
  }

  const { street, number, city } = addressParts(firm.address);
  const cityOnPage = Boolean(city && hasWord(text, city));
  if (street && number && text.includes(street) && cislice.includes(digitsOf(number))) {
    return { strong: 'na stránce je adresa firmy z registru', city: cityOnPage };
  }

  return { city: cityOnPage };
}

/**
 * Patří stránka téhle firmě? Vrací větu, čím to je doložené, nebo `null`, když to doložené není.
 *
 * Dřív tu platilo „IČO, nebo nic". Změřeno na 22 firmách, o kterých z OpenStreetMap víme, že web
 * mají: stránku jsme stáhli u dvaceti, ale IČO na ní (ani na její stránce „Kontakt") mělo jen
 * pět. Patnáct živých webů tedy aplikace zahodila a o firmě tvrdila „web jsme nenašli" — přesně
 * ta lež, kvůli které se to celé předělávalo.
 *
 * Nové pravidlo drží stejnou laťku, jen připouští víc druhů důkazu. Musí platit obojí:
 *
 *   1. **jméno** — každé slovo názvu, které firmu odlišuje, je na stránce jako slovo, a doména
 *      je z toho názvu postavená;
 *   2. **jeden nezávislý fakt** — IČO, telefon nebo adresa z registru. Když ani jeden nemáme,
 *      stačí obec **a** obor na stránce, ale jen u domény, která nese celý název firmy.
 *
 * Samotná shoda jména nikdy nestačí: doménu jsme si vymysleli z názvu, takže by to bylo kolo
 * dokola. Cizí web přiřazený firmě je horší než přiznané „nevíme" — po jednom takovém omylu
 * uživatel nevěří ani zbytku.
 */
export function pageEvidence(
  html: string,
  firm: FirmFacts,
  url: string,
  index: NameIndex,
  tradeWords: readonly string[] = [],
): string | null {
  const text = pageText(html);
  if (PARKED.test(text)) return null;

  const identifying = identifyingTokens(firm.name);
  if (identifying.length === 0) return null;
  if (!identifying.every(t => hasWord(text, t))) return null;

  const label = domainLabel(url);
  const vsechnaSlova = nameTokens(firm.name);
  if (!identifying.some(t => label.includes(t))) return null;

  const oborSedi = tradeWords.length === 0 || tradeWords.some(w => text.includes(w));

  const facts = factsOnPage(text, firm);
  if (facts.strong) return `doména nese název firmy a ${facts.strong}`;

  /**
   * Doména, která je přesně celým názvem firmy.
   *
   * `lumadent.cz` u firmy LUMADENT není hypotéza jako `novak.cz` u pana Nováka: doména je celé
   * obchodní jméno, nic navíc, nic míň — a to jméno i obor jsou na stránce.
   *
   * Musí sedět **celý** název, ne jen jeho odlišující část. Změřeno: při volnějším pravidle
   * dostala „OPTIMO dental studio" doménu `optimo.cz` a „EuroDent Ostrava" laboratoř
   * `eurodent.cz` — obojí cizí firma se stejným jedním slovem v názvu. Ta laboratoř je přesně
   * ten omyl, kvůli kterému uživatel přestane věřit i správným řádkům.
   */
  if (label === vsechnaSlova.join('') && oborSedi) {
    return 'doména je přesně názvem firmy a obor na stránce sedí';
  }

  return null;
}

/** Stránky, kde firmy nejčastěji uvádějí IČO, telefon a adresu, když je nemají na titulní. */
const KONTAKTNI_CESTY = ['/kontakt', '/kontakty', '/contact'];

/**
 * Looks for the firm's website among the domains its name suggests.
 *
 * Never throws and never runs past `deadlineAt`: a search that ran out of time simply reports
 * nothing, exactly as it did before this module existed.
 */
/**
 * Výsledek hledání webu — i když nic nenašlo.
 *
 * Volající potřebuje rozlišit „prošli jsme všechny domény, které z názvu firmy plynou, a nic
 * tam není" od „došel čas" nebo „z toho názvu se doména odvodit nedá". Bez toho by se všechna
 * tři ticha slila do jednoho a uživatel by u firmy s webem četl „web jsme nenašli".
 */
export interface DiscoveryOutcome {
  site: DiscoveredSite | null;
  /** Kolik kandidátních domén jsme stihli prověřit (DNS a u existujících i stažení stránky). */
  checked: number;
  /** Došel rozpočet dřív, než se prošly všechny domény. */
  ranOut: boolean;
  /** Z názvu firmy nešla odvodit ani jedna doména — „G A Dent s.r.o." nemá čím začít. */
  noCandidates: boolean;
  /** Ptali jsme se i vyhledávače? Volající podle toho počítá placené dotazy. */
  searched: boolean;
  /**
   * Některá doména z názvu firmy existuje, ale neodpověděla.
   *
   * Pak nejde říct „firma web nemá": server mohl být na pár vteřin mimo a doména je zaregistrovaná
   * právě proto, že na ní někdo něco má. Verdikt v takovém případě zůstává „nevíme".
   */
  inconclusive: boolean;
}

export async function discoverWebsite(
  firm: FirmFacts,
  index: NameIndex,
  opts: {
    tld: string;
    deadlineAt: number;
    /** Injected so this shares the pipeline's robots.txt cache and per-host memo. */
    probe: (url: string, mode?: 'all' | 'first-only') => Promise<ProbeResult>;
    /** Words of the searched trade; a page that mentions none of them is somebody else's. */
    tradeWords?: readonly string[];
    /** Město hledání — jde do tvarů domén jako `kadernictvi-zlin.cz`. */
    city?: string;
    /**
     * Smí se firma dohledávat i přes vyhledávač? Volající tím drží počet placených dotazů:
     * pouští se to jen na firmy, u kterých by jinak padl verdikt „web nemá".
     */
    search?: boolean;
  },
): Promise<DiscoveryOutcome> {
  const domains = domainCandidates(firm.name, index, opts.tld, {
    tradeWords: opts.tradeWords,
    city: opts.city,
  });
  if (domains.length === 0) return { site: null, checked: 0, ranOut: false, noCandidates: true, searched: false, inconclusive: false };

  // One batch of DNS lookups for the whole firm: they are cheap, independent, and knowing which
  // domains exist at all decides how many expensive probes are left to run.
  const registered: string[] = [];
  await Promise.all(
    domains.map(async d => {
      if (await resolvable(d)) registered.push(d);
    }),
  );

  let checked = 0;
  let probes = 0;
  let inconclusive = false;
  /** Slova, kterými se firma odlišuje — podle nich se pozná silná hypotéza od střelby naslepo. */
  const jadro = identifyingTokens(firm.name);
  for (const domain of domains) {
    checked++;
    if (!registered.includes(domain)) continue;
    /**
     * Strop na počet stažení stránky u jedné firmy.
     *
     * DNS dotaz je zadarmo, stažení stránky ne — a od chvíle, kdy se zkoušejí i tvary jako
     * `kadernictvi-prijmeni.cz`, může jedné firmě odpovědět víc domén, než na kolik má času.
     * Pět nejpravděpodobnějších stačí: pořadí kandidátů jde od nejlepší hypotézy dolů.
     */
    if (probes >= MAX_PROBES_PER_FIRM) break;
    probes++;
    // Checked before every probe, not once: four dead hosts at five seconds each would otherwise
    // eat the budget the rest of the search needs.
    if (Date.now() >= opts.deadlineAt) {
      return { site: null, checked: checked - 1, ranOut: true, noCandidates: false, searched: false, inconclusive };
    }

    // Zkouší se `https://`, `https://www.` i `http://`: profservis.cz servíruje web výhradně
    // na www a holá doména vrací 403, takže firma s živým webem vycházela jako „web neuveden".
    const result = await opts.probe(`https://${domain}`, 'all');
    // Blocked by robots.txt means a site exists but we may not read it — and without reading it
    // we cannot show it belongs to this firm, so it stays unsaid.
    if (!result.alive || !result.html) {
      /**
       * Doména je zaregistrovaná a přesto mlčí.
       *
       * Váha té informace závisí na tom, jak silná hypotéza to byla. `dentimo.cz` u firmy
       * DENTIMO je skoro jistě její doména a její mlčení znamená „nevíme" — server může být
       * chvíli mimo. `kadernictvi-zlin.cz` u paní Novákové je střelba naslepo; že neodpověděla,
       * o paní Novákové neříká vůbec nic, a nesmí to tedy zabránit verdiktu „web nemá".
       */
      const label = domain.split('.')[0].replace(/-/g, '');
      if (jadro.length > 0 && jadro.every(t => label.includes(t))) inconclusive = true;
      continue;
    }

    const url = result.finalUrl ?? `https://${domain}`;
    let why = pageEvidence(result.html, firm, url, index, opts.tradeWords ?? []);

    /**
     * Když titulní strana nestačí, zkusí se stránka „Kontakt".
     *
     * Právě tam bývá IČO, telefon i adresa — tedy ty nezávislé fakty, které oddělují web téhle
     * firmy od webu jmenovce. Je to jeden požadavek navíc a jen u domény, která už prošla
     * testem na jméno, takže se neplatí za nic.
     */
    if (!why) {
      for (const cesta of KONTAKTNI_CESTY) {
        if (Date.now() >= opts.deadlineAt) break;
        let cil: string;
        try {
          cil = new URL(cesta, url).toString();
        } catch {
          continue;
        }
        const kontakt = await opts.probe(cil, 'first-only');
        if (!kontakt.html) continue;
        // Jméno se hledá na titulní straně, fakty na kontaktní: spojené texty proto obě.
        why = pageEvidence(result.html + kontakt.html, firm, url, index, opts.tradeWords ?? []);
        if (why) break;
      }
    }

    if (why) {
      return {
        site: { url, html: result.html, evidence: `web dohledán podle názvu, ${why}` },
        checked,
        ranOut: false,
        noCandidates: false,
        searched: false,
        inconclusive,
      };
    }
  }

  /**
   * Vyhledávač jako poslední pokus.
   *
   * Domény z názvu jsou hypotézy, které z firmy plynou; tohle je hypotéza, kterou zná jen ten,
   * kdo web viděl. Běží až nakonec a jen když je klíč (viz `web-search.ts`) — bez něj se
   * aplikace chová stejně jako dřív. Nález přesto musí projít týmž důkazem jako uhodnutá
   * doména: vyhledávač dodává adresu, ne pravdu.
   */
  let searched = false;
  if (opts.search && webSearchEnabled() && Date.now() < opts.deadlineAt) {
    searched = true;
    const dotaz = [`"${firm.name}"`, opts.city, opts.tradeWords?.[0]].filter(Boolean).join(' ');
    for (const host of await searchDomains(dotaz, 3)) {
      if (Date.now() >= opts.deadlineAt) {
        return { site: null, checked, ranOut: true, noCandidates: false, searched, inconclusive };
      }
      checked++;
      const res = await opts.probe(`https://${host}`, 'all');
      if (!res.alive || !res.html) continue;

      const adresa = res.finalUrl ?? `https://${host}`;
      const proc = pageEvidence(res.html, firm, adresa, index, opts.tradeWords ?? []);
      if (proc) {
        return {
          site: { url: adresa, html: res.html, evidence: `web z vyhledávače, ${proc}` },
          checked,
          ranOut: false,
          noCandidates: false,
          searched,
          inconclusive,
        };
      }
    }
  }

  return { site: null, checked, ranOut: false, noCandidates: false, searched, inconclusive };
}

/** Exported for the pipeline, which needs a probe that is not memoised per host. */
export async function probeOnce(url: string, robots?: RobotsCheck): Promise<ProbeResult> {
  return probeWebsite(url, robots);
}
