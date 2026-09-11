/**
 * Měří, jak spolehlivý je příznak webu (HAS / NONE / UNKNOWN) — proti ověřené skutečnosti.
 *
 * Tři kroky, každý samostatně. Drahý krok (ověření pravdy u každé firmy) se udělá jednou,
 * a po každé opravě detekce se nad stejným vzorkem zopakuje jen `detect` a `score`:
 *
 *   npx tsx scripts/verify-website-flags.ts sample [--size 100] [--seed 42]
 *   npx tsx scripts/verify-website-flags.ts detect [--concurrency 6] [--out detect.json]
 *   npx tsx scripts/verify-website-flags.ts score  [--detect detect.json] [--truth truth.json]
 *
 * sample  Vybere firmy z databáze rovnoměrně po oborech, bez duplicit (IČO, jinak název+adresa).
 * detect  Pustí na vzorek SOUČASNOU detekci webu — přímo `verifyWebsite` z `src/lib/lead-pipeline.ts`,
 *         tedy tentýž kód, který volá hledání. Údaje o firmě (IČO, telefon, e-mail,
 *         adresa, web uvedený zdrojem) se berou z databáze, takže skript se neptá ARES ani
 *         Overpassu a jejich limity nezatíží. Ptá se jen DNS a webů samotných firem.
 * score   Porovná detekci s ověřenou pravdou (`truth.json`) a vypíše tabulku.
 *
 * Výstupy jdou do `scripts/.out/website-audit/`, který je v .gitignore: vzorek obsahuje jména
 * živnostníků a repozitář je veřejný.
 *
 * Omezení, která je fér znát:
 *  • Telefon a e-mail v databázi mohou u firem s nalezeným webem pocházet z toho webu. Pro ně
 *    je tedy důkaz „telefon na stránce" o něco snazší než při skutečném hledání.
 *  • Index jmen (co je v názvu obecné slovo) se staví ze všech firem téhož hledání, stejně jako
 *    v aplikaci; u hledání „Celá ČR" aplikace index staví po městech, tady z celého hledání.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/db';
import { tradeWordsFor, verifyWebsite } from '../src/lib/lead-pipeline';
import { createRobotsCache } from '../src/lib/robots';
import { webSearchEnabled } from '../src/lib/sources/web-search';
import { buildNameIndex, tldForRegion, type NameIndex } from '../src/lib/website-discovery';
import {
  createProbeCache,
  normalizeName,
  resolveStatus,
  type WebsiteStatus,
  type WebsiteVerdict,
} from '../src/lib/website-status';

const OUT_DIR = path.resolve(process.cwd(), 'scripts/.out/website-audit');

/** Stejný strop na firmu jako `PER_CANDIDATE_MS` v lead-pipeline.ts. */
const PER_CANDIDATE_MS = 20_000;

// ── Typy výstupů ─────────────────────────────────────────────────────────────

interface SampleFirm {
  id: string;
  searchId: string;
  trade: string;
  region: string;
  name: string;
  ico: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  source: string;
  /** Web, který uvedl zdroj (OSM), rekonstruovaný z uloženého řádku. */
  claimedUrl: string | null;
  /** Příznak uložený v době hledání — často starší verzí detekce. */
  stored: { status: WebsiteStatus; url: string | null; evidence: string; at: string };
}

interface DetectRow {
  id: string;
  status: WebsiteStatus;
  url: string | null;
  evidence: string;
  ms: number;
}

type Truth = 'HAS' | 'NONE' | 'UNSURE';

interface TruthRow {
  id: string;
  truth: Truth;
  url?: string | null;
  /** Další adresy, které jsou také web té firmy (dva weby, přesměrování). */
  alsoValid?: string[];
  kind?: string;
  confidence?: string;
  evidence?: string;
}

// ── Pomocné ─────────────────────────────────────────────────────────────────

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function outFile(name: string): string {
  return path.isAbsolute(name) ? name : path.join(OUT_DIR, name);
}

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(outFile(name), 'utf8')) as T;
}

function writeJson(name: string, data: unknown): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(outFile(name), JSON.stringify(data, null, 2));
}

/** Deterministický generátor (mulberry32), aby šel vzorek zopakovat. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${((part / total) * 100).toFixed(1).replace('.', ',')} %`;
}

/**
 * Web, který uvedl zdroj, z uloženého řádku.
 *
 * `rawData` se neukládá, takže se to čte z toho, co po hledání zbylo: u ověřeného webu je adresa
 * ve sloupci `website` a evidence neříká, že ho aplikace sama dohledala; u neověřeného je adresa
 * ve větě „zdroj uvádí web …, ale …".
 */
function claimedUrlOf(row: { website: string | null; websiteEvidence: string }): string | null {
  const ev = row.websiteEvidence ?? '';
  const selfFound = /^(web dohledán|web z vyhledávače|web na doméně z e-mailu)/.test(ev);
  if (row.website && !selfFound) return row.website;
  const m = /^(?:nedoloženo: )?zdroj uvádí web (https?:\/\/\S+?),? ale /.exec(ev);
  return m ? m[1] : null;
}

function withCap<T>(work: Promise<T>, onTimeout: () => T, ms: number): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    const settle = (value: T) => { clearTimeout(timer); resolve(value); };
    work.then(settle, () => settle(onTimeout()));
  });
}

// ── 1. Vzorek ────────────────────────────────────────────────────────────────

async function sample(size: number, seed: number): Promise<void> {
  const rows = await prisma.businessResult.findMany({
    select: {
      id: true, searchId: true, name: true, ico: true, address: true, phone: true, email: true,
      website: true, websiteStatus: true, websiteEvidence: true, hasWebsite: true, source: true,
      createdAt: true, search: { select: { query: true, region: true } },
    },
  });

  // Jedna firma = jeden řádek, a to z nejnovějšího hledání: to je nejblíž dnešní detekci.
  const newest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (r.search.query === 'CSV import') continue;
    const key = r.ico ? `ico:${r.ico}` : `name:${normalizeName(r.name)}|${normalizeName(r.address ?? '')}`;
    const prev = newest.get(key);
    if (!prev || r.createdAt > prev.createdAt) newest.set(key, r);
  }

  const byTrade = new Map<string, Array<(typeof rows)[number]>>();
  for (const r of Array.from(newest.values())) {
    const list = byTrade.get(r.search.query) ?? [];
    list.push(r);
    byTrade.set(r.search.query, list);
  }

  const random = rng(seed);
  const trades = Array.from(byTrade.keys()).sort();
  const shuffled = new Map(trades.map(t => {
    const list = [...(byTrade.get(t) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return [t, list] as const;
  }));

  // Po oborech dokola, aby žádný obor vzorek nepřeválcoval — kadeřnictví je v databázi pětkrát víc.
  const picked: Array<(typeof rows)[number]> = [];
  for (let round = 0; picked.length < size; round++) {
    let added = false;
    for (const t of trades) {
      const list = shuffled.get(t) ?? [];
      if (round < list.length && picked.length < size) {
        picked.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
  }

  const firms: SampleFirm[] = picked.map(r => ({
    id: r.id,
    searchId: r.searchId,
    trade: r.search.query,
    region: r.search.region,
    name: r.name,
    ico: r.ico,
    address: r.address,
    phone: r.phone,
    email: r.email,
    source: r.source,
    claimedUrl: claimedUrlOf({ website: r.website, websiteEvidence: r.websiteEvidence }),
    stored: {
      status: resolveStatus(r),
      url: r.website,
      evidence: r.websiteEvidence,
      at: r.createdAt.toISOString(),
    },
  }));

  writeJson('sample.json', { createdAt: new Date().toISOString(), seed, size: firms.length, firms });

  const perTrade = trades.map(t => `${t} ${firms.filter(f => f.trade === t).length}`).join(' · ');
  console.log(`Vzorek: ${firms.length} firem z ${newest.size} unikátních (seed ${seed}).`);
  console.log(`Po oborech: ${perTrade}`);
  console.log(`Uloženo: ${outFile('sample.json')}`);
}

// ── 2. Současná detekce ─────────────────────────────────────────────────────

async function detect(concurrency: number, outName: string): Promise<void> {
  const { firms } = readJson<{ firms: SampleFirm[] }>('sample.json');

  const indexes = new Map<string, NameIndex>();
  for (const searchId of Array.from(new Set(firms.map(f => f.searchId)))) {
    const names = await prisma.businessResult.findMany({ where: { searchId }, select: { name: true } });
    indexes.set(searchId, buildNameIndex(names.map(n => n.name)));
  }

  const legalForms = new Map(
    (await prisma.businessResult.findMany({ where: { id: { in: firms.map(f => f.id) } }, select: { id: true, legalForm: true } }))
      .map(r => [r.id, r.legalForm] as const),
  );

  const robots = createRobotsCache();
  const probe = createProbeCache(robots);

  /** Přímo rozhodování aplikace (`verifyWebsite`), jen bez obohacení z rejstříků. */
  const verify = async (f: SampleFirm): Promise<WebsiteVerdict> => {
    const sources = f.source.split('+');
    const { verdict } = await verifyWebsite(
      {
        name: f.name,
        ico: f.ico ?? undefined,
        phone: f.phone ?? undefined,
        email: f.email ?? undefined,
        address: f.address ?? undefined,
        legalForm: legalForms.get(f.id) ?? undefined,
        signals: {
          claimedUrl: f.claimedUrl ?? undefined,
          osmSaysEmpty: sources[0] === 'osm' && !f.claimedUrl,
          registryHasNoField: sources.includes('ares'),
        },
      },
      {
        nameIndex: indexes.get(f.searchId) ?? buildNameIndex([f.name]),
        tld: tldForRegion(f.region),
        region: f.region,
        tradeWords: tradeWordsFor(f.trade),
        probe,
        deadlineAt: Date.now() + PER_CANDIDATE_MS,
        probeNetwork: true,
        // Skript měsíční strop aplikace nepoužívá (lokální databáze je jiná než produkční);
        // s WEB_SEARCH_ENABLED=1 se ptá bez omezení počtu, jinak vůbec.
        searchQuota: webSearchEnabled() ? { reserve: async () => 'skript', release: async () => {} } : undefined,
      },
    );
    return verdict;
  };

  const results: DetectRow[] = new Array(firms.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= firms.length) return;
      const f = firms[i];
      const started = Date.now();
      const v = await withCap(
        verify(f),
        () => ({ status: 'UNKNOWN' as const, evidence: 'nestihli jsme web ověřit — na tuhle firmu nezbyl čas' }),
        PER_CANDIDATE_MS,
      );
      results[i] = { id: f.id, status: v.status, url: v.url ?? null, evidence: v.evidence, ms: Date.now() - started };
      done++;
      if (done % 10 === 0) console.log(`  ${done}/${firms.length}`);
    }
  };

  console.log(`Detekce na ${firms.length} firmách (vyhledávač ${webSearchEnabled() ? 'ZAPNUTÝ' : 'vypnutý, jako na produkci'})…`);
  await Promise.all(Array.from({ length: Math.min(concurrency, firms.length) }, worker));

  writeJson(outName, { ranAt: new Date().toISOString(), searchEnabled: webSearchEnabled(), firms: results });

  const count = (s: WebsiteStatus) => results.filter(r => r.status === s).length;
  const stored = (s: WebsiteStatus) => firms.filter(f => f.stored.status === s).length;
  console.log(`Dnešní detekce:  HAS ${count('HAS')} · NONE ${count('NONE')} · UNKNOWN ${count('UNKNOWN')}`);
  console.log(`Uložený příznak: HAS ${stored('HAS')} · NONE ${stored('NONE')} · UNKNOWN ${stored('UNKNOWN')}`);
  console.log(`Uloženo: ${outFile(outName)}`);
}

// ── 3. Vyhodnocení ──────────────────────────────────────────────────────────

function host(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function sameSite(appUrl: string | null, truth: TruthRow): boolean {
  const a = host(appUrl);
  if (!a) return false;
  return [truth.url, ...(truth.alsoValid ?? [])].some(u => {
    const b = host(u);
    return Boolean(b) && (a === b || a.endsWith(`.${b}`) || (b as string).endsWith(`.${a}`));
  });
}

type Outcome =
  | 'správně – má web'
  | 'správně – nemá web'
  | 'falešně negativní (říká nemá, web má)'
  | 'falešně pozitivní (říká má, web nemá)'
  | 'cizí web (říká má, ale jiný web)'
  | 'nevíme – web má'
  | 'nevíme – web nemá'
  | 'pravda nejistá';

function outcome(status: WebsiteStatus, url: string | null, t: TruthRow): Outcome {
  if (t.truth === 'UNSURE') return 'pravda nejistá';
  if (status === 'UNKNOWN') return t.truth === 'HAS' ? 'nevíme – web má' : 'nevíme – web nemá';
  if (status === 'NONE') return t.truth === 'NONE' ? 'správně – nemá web' : 'falešně negativní (říká nemá, web má)';
  if (t.truth === 'NONE') return 'falešně pozitivní (říká má, web nemá)';
  return sameSite(url, t) ? 'správně – má web' : 'cizí web (říká má, ale jiný web)';
}

const WRONG: Outcome[] = [
  'falešně negativní (říká nemá, web má)',
  'falešně pozitivní (říká má, web nemá)',
  'cizí web (říká má, ale jiný web)',
];

function report(
  label: string,
  firms: SampleFirm[],
  verdictOf: (f: SampleFirm) => { status: WebsiteStatus; url: string | null; evidence: string },
  truth: Map<string, TruthRow>,
): string[] {
  const lines: string[] = [];
  const rows = firms
    .filter(f => truth.has(f.id))
    .map(f => ({ f, v: verdictOf(f), t: truth.get(f.id) as TruthRow }))
    .map(x => ({ ...x, o: outcome(x.v.status, x.v.url, x.t) }));

  const n = rows.length;
  const by = (o: Outcome) => rows.filter(r => r.o === o).length;
  const certain = rows.filter(r => r.t.truth !== 'UNSURE').length;
  const wrong = rows.filter(r => WRONG.includes(r.o)).length;
  const decided = rows.filter(r => r.t.truth !== 'UNSURE' && r.v.status !== 'UNKNOWN').length;
  const appNone = rows.filter(r => r.v.status === 'NONE' && r.t.truth !== 'UNSURE').length;
  const appHas = rows.filter(r => r.v.status === 'HAS' && r.t.truth !== 'UNSURE').length;
  const truthHas = rows.filter(r => r.t.truth === 'HAS').length;

  lines.push(`\n## ${label}\n`);
  lines.push('| Výsledek | Počet | Podíl ze všech |');
  lines.push('|---|---:|---:|');
  const order: Outcome[] = [
    'správně – má web', 'správně – nemá web',
    'falešně negativní (říká nemá, web má)', 'falešně pozitivní (říká má, web nemá)', 'cizí web (říká má, ale jiný web)',
    'nevíme – web má', 'nevíme – web nemá', 'pravda nejistá',
  ];
  for (const o of order) lines.push(`| ${o} | ${by(o)} | ${pct(by(o), n)} |`);
  lines.push(`| **celkem** | **${n}** | |`);

  lines.push('');
  lines.push(`- **Špatný příznak**: ${wrong} z ${n} (${pct(wrong, n)} všech; ${pct(wrong, certain)} firem s jistou pravdou; ${pct(wrong, decided)} z těch, kde appka řekla HAS nebo NONE)`);
  lines.push(`- **Když appka řekne „nemá web"**, mýlí se v ${pct(by('falešně negativní (říká nemá, web má)'), appNone)} případů (${by('falešně negativní (říká nemá, web má)')} z ${appNone})`);
  lines.push(`- **Když appka řekne „má web"**, je to špatně (žádný nebo cizí web) v ${pct(by('falešně pozitivní (říká má, web nemá)') + by('cizí web (říká má, ale jiný web)'), appHas)} případů`);
  lines.push(`- **Firmy, které web opravdu mají** (${truthHas}): appka ho potvrdí u ${pct(by('správně – má web'), truthHas)}, „nemá web" řekne u ${pct(by('falešně negativní (říká nemá, web má)'), truthHas)}, „nevíme" u ${pct(by('nevíme – web má'), truthHas)}`);
  lines.push(`- **„Nevíme"** celkem ${rows.filter(r => r.v.status === 'UNKNOWN').length} (${pct(rows.filter(r => r.v.status === 'UNKNOWN').length, n)})`);

  lines.push('\n| Obor | Firem | Špatně | Falešně „nemá" | Falešně „má"/cizí | Nevíme |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const trade of Array.from(new Set(rows.map(r => r.f.trade))).sort()) {
    const tr = rows.filter(r => r.f.trade === trade);
    const c = (o: Outcome) => tr.filter(r => r.o === o).length;
    lines.push(`| ${trade} | ${tr.length} | ${tr.filter(r => WRONG.includes(r.o)).length} | ${c('falešně negativní (říká nemá, web má)')} | ${c('falešně pozitivní (říká má, web nemá)') + c('cizí web (říká má, ale jiný web)')} | ${tr.filter(r => r.v.status === 'UNKNOWN').length} |`);
  }

  const detail = rows.filter(r => WRONG.includes(r.o) || r.o === 'nevíme – web má');
  if (detail.length > 0) {
    lines.push('\n| Firma | Obor | Appka | Důvod appky | Skutečnost |');
    lines.push('|---|---|---|---|---|');
    for (const r of detail) {
      const truthText = r.t.truth === 'HAS' ? `web ${r.t.url}` : 'web nemá';
      lines.push(`| ${r.f.name.replace(/\|/g, '/')} | ${r.f.trade} | ${r.v.status}${r.v.url ? ` ${host(r.v.url)}` : ''} | ${r.v.evidence.replace(/\|/g, '/')} | ${truthText} — ${r.o} |`);
    }
  }
  return lines;
}

function score(detectName: string, truthName: string): void {
  const { firms } = readJson<{ firms: SampleFirm[] }>('sample.json');
  const detected = new Map(readJson<{ firms: DetectRow[] }>(detectName).firms.map(d => [d.id, d]));
  const truth = new Map(readJson<TruthRow[]>(truthName).map(t => [t.id, t]));

  const missing = firms.filter(f => !truth.has(f.id)).length;
  const lines = [`# Spolehlivost příznaku webu — ${new Date().toISOString().slice(0, 10)}`];
  lines.push(`\nVzorek ${firms.length} firem, ověřená pravda u ${firms.length - missing}.`);

  lines.push(...report('Dnešní detekce (kód v repozitáři)', firms, f => {
    const d = detected.get(f.id);
    return d ? { status: d.status, url: d.url, evidence: d.evidence } : { status: 'UNKNOWN', url: null, evidence: 'nedetekováno' };
  }, truth));
  lines.push(...report('Příznak uložený v databázi (starší běhy detekce)', firms, f => f.stored, truth));

  const text = lines.join('\n');
  const reportName = detectName.replace(/\.json$/, '') + '-report.md';
  fs.writeFileSync(outFile(reportName), text);
  console.log(text);
  console.log(`\nUloženo: ${outFile(reportName)}`);
}

// ── Spuštění ────────────────────────────────────────────────────────────────

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'sample') await sample(Number(arg('size', '100')), Number(arg('seed', '42')));
  else if (cmd === 'detect') await detect(Number(arg('concurrency', '6')), arg('out', 'detect.json'));
  else if (cmd === 'score') score(arg('detect', 'detect.json'), arg('truth', 'truth.json'));
  else {
    console.error('Použití: npx tsx scripts/verify-website-flags.ts sample|detect|score');
    process.exit(2);
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
