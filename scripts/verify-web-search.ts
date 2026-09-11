/**
 * Měří, co by vyhledávač (Brave Search API) přidal k dohledávání webu — dřív, než se zapne v aplikaci.
 *
 *   npx tsx scripts/verify-web-search.ts [--detect detect-b.json] [--limit 5] [--gap 1100]
 *
 * Potřebuje `BRAVE_SEARCH_API_KEY` (z prostředí nebo z `.env`). Aplikační vypínač
 * `WEB_SEARCH_ENABLED` nepotřebuje a nic v aplikaci nezapíná: API volá sám.
 *
 * Pro každou firmu ze vzorku (`scripts/.out/website-audit/sample.json`) pošle tři dotazy:
 *   Q1  "<název>" <obec>
 *   Q2  <název bez právní formy a titulů> <obor česky> <obec>
 *   Q3  "<IČO>"                                    (jen když IČO je)
 * U prvních pěti adres z každého dotazu (bez katalogů a sociálních sítí, stejný seznam jako
 * aplikace) stáhne stránku a zkusí dvě pravidla:
 *   • dnešní `pageEvidence` — doména musí nést název firmy;
 *   • `searchPageEvidence` — pravidlo, které aplikace používá pro výsledky vyhledávače: firmu na
 *     stránce dokládá IČO, telefon nebo adresa z registru, nebo celý název + obec + obor. Doménu
 *     tu nechceme, protože přesně značkové weby (kings-barbers.cz u „Adam Beneš") z názvu nevyplývají.
 * Výsledek porovná s ověřenou pravdou (`truth.json`) a spočítá, kolik dotazů by stála každá
 * strategie.
 *
 * Náklady: nejvýš 3 dotazy × 100 firem = 300 dotazů, tedy nejvýš $1,50 z měsíčního kreditu $5.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/db';
import { domainCityFor, tradeWordsFor } from '../src/lib/lead-pipeline';
import { resolveNiche } from '../src/lib/nace-map';
import { createRobotsCache } from '../src/lib/robots';
import { BRAVE_ENDPOINT, NOT_A_WEBSITE } from '../src/lib/sources/web-search';
import { buildNameIndex, pageEvidence, searchPageEvidence, type NameIndex } from '../src/lib/website-discovery';
import { createProbeCache, isRealWebsite, normalizeName, type ProbeResult } from '../src/lib/website-status';

const OUT_DIR = path.resolve(process.cwd(), 'scripts/.out/website-audit');
const TOP_N = 5;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** `.env` bez závislosti: skript se spouští přes tsx, které ho samo nenačte. */
function loadDotEnv(): void {
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* bez .env se bere jen prostředí */
  }
}

interface SampleFirm {
  id: string; searchId: string; trade: string; region: string; name: string;
  ico: string | null; address: string | null; phone: string | null; email: string | null;
}
interface TruthRow { id: string; truth: 'HAS' | 'NONE' | 'UNSURE'; url?: string | null; alsoValid?: string[] }
interface DetectRow { id: string; status: 'HAS' | 'NONE' | 'UNKNOWN'; url: string | null }

// ── Dotazy ──────────────────────────────────────────────────────────────────

let lastCall = 0;
let requests = 0;

async function brave(q: string, gapMs: number): Promise<{ ok: boolean; status: number; urls: string[] }> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) throw new Error('Chybí BRAVE_SEARCH_API_KEY (v prostředí ani v .env).');
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = lastCall + gapMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCall = Date.now();
    const url = new URL(BRAVE_ENDPOINT);
    url.searchParams.set('q', q);
    url.searchParams.set('country', 'cz');
    url.searchParams.set('search_lang', 'cs');
    url.searchParams.set('count', '10');
    url.searchParams.set('safesearch', 'off');
    requests++;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': key },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status === 429) { await new Promise(r => setTimeout(r, 2_000 * (attempt + 1))); continue; }
      if (res.status !== 200) return { ok: false, status: res.status, urls: [] };
      const data = await res.json() as { web?: { results?: Array<{ url?: string }> } };
      return { ok: true, status: 200, urls: (data.web?.results ?? []).map(r => r.url ?? '').filter(Boolean) };
    } catch {
      return { ok: false, status: 0, urls: [] };
    }
  }
  return { ok: false, status: 429, urls: [] };
}

function host(u: string | null | undefined): string {
  if (!u) return '';
  try { return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function usableHost(u: string): string | null {
  const h = host(u);
  if (!h || !isRealWebsite(u)) return null;
  return NOT_A_WEBSITE.some(d => h === d || h.endsWith(`.${d}`)) ? null : h;
}

function sameSite(a: string, t: TruthRow): boolean {
  return [t.url, ...(t.alsoValid ?? [])].some(u => {
    const b = host(u);
    return Boolean(a && b) && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
  });
}

/** Obec z adresy tak, jak je napsaná (s diakritikou) — do dotazu, ne do domény. */
function townOf(address: string | null, region: string): string {
  for (const part of (address ?? '').split(',').map(p => p.trim())) {
    const m = /^\d{3} ?\d{2}\s+(.+)$/.exec(part);
    if (m) return m[1].split(' - ')[0].replace(/\s+\d+$/, '').trim();
  }
  const r = region.split(',')[0].trim();
  return /^cel/i.test(r) ? '' : r;
}

function bareName(name: string): string {
  return name
    .replace(/"/g, ' ')
    .replace(/\b(MUDr|MDDr|MVDr|JUDr|Ing|Mgr|Bc|PhDr|RNDr|PaedDr|prof|doc)\.\s*/gi, ' ')
    .replace(/,?\s*(spol\.\s*s\s*r\.\s*o\.|s\.\s*r\.\s*o\.|a\.\s*s\.|v\.\s*o\.\s*s\.|k\.\s*s\.|z\.\s*s\.|o\.\s*p\.\s*s\.|v likvidaci)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Běh ─────────────────────────────────────────────────────────────────────

interface FirmOutcome {
  id: string; name: string; trade: string; truth: string; truthHost: string; app: string;
  queries: Array<{ q: string; ok: boolean; status: number; hosts: string[]; truthRank: number | null }>;
  /** Pro každý dotaz: přijatý web podle pravidla (host) nebo null. */
  accepted: Array<{ current: string | null; search: string | null; why: string | null }>;
}

async function main() {
  loadDotEnv();
  const gap = Number(arg('gap', '1100'));
  const limit = Number(arg('limit', '0'));
  const detectName = arg('detect', 'detect.json');

  const firms: SampleFirm[] = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'sample.json'), 'utf8')).firms;
  const truth = new Map<string, TruthRow>(JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'truth.json'), 'utf8')).map((t: TruthRow) => [t.id, t]));
  const detect = new Map<string, DetectRow>(JSON.parse(fs.readFileSync(path.join(OUT_DIR, detectName), 'utf8')).firms.map((d: DetectRow) => [d.id, d]));
  const todo = limit > 0 ? firms.slice(0, limit) : firms;

  const indexes = new Map<string, NameIndex>();
  for (const searchId of Array.from(new Set(todo.map(f => f.searchId)))) {
    const names = await prisma.businessResult.findMany({ where: { searchId }, select: { name: true } });
    indexes.set(searchId, buildNameIndex(names.map(n => n.name)));
  }
  const probe = createProbeCache(createRobotsCache());
  const pages = new Map<string, Promise<ProbeResult>>();
  const page = (h: string) => pages.get(h) ?? pages.set(h, probe(`https://${h}`, 'all')).get(h)!;

  const outcomes: FirmOutcome[] = [];
  let n = 0;
  for (const f of todo) {
    const t = truth.get(f.id);
    const tradeWords = tradeWordsFor(f.trade);
    const tradeCz = resolveNiche(f.trade).keywords[0] ?? '';
    const town = townOf(f.address, f.region);
    const bare = bareName(f.name);
    const qs = [`"${bare}" ${town}`.trim(), `${bare} ${tradeCz} ${town}`.trim()];
    if (f.ico) qs.push(`"${f.ico}"`);

    const o: FirmOutcome = {
      id: f.id, name: f.name, trade: f.trade, truth: t?.truth ?? '?', truthHost: host(t?.url), app: detect.get(f.id)?.status ?? '?',
      queries: [], accepted: [],
    };
    for (const q of qs) {
      const r = await brave(q, gap);
      const hosts = Array.from(new Set(r.urls.map(usableHost).filter((h): h is string => Boolean(h)))).slice(0, TOP_N);
      const truthRank = t ? hosts.findIndex(h => sameSite(h, t)) : -1;
      o.queries.push({ q, ok: r.ok, status: r.status, hosts, truthRank: truthRank >= 0 ? truthRank + 1 : null });

      let current: string | null = null;
      let search: string | null = null;
      let why: string | null = null;
      for (const h of hosts) {
        const p = await page(h);
        if (!p.html) continue;
        const url = p.finalUrl ?? `https://${h}`;
        const facts = { name: f.name, ico: f.ico ?? undefined, phone: f.phone ?? undefined, address: f.address ?? undefined };
        if (!current && pageEvidence(p.html, facts, url, indexes.get(f.searchId) ?? buildNameIndex([f.name]), tradeWords)) current = host(url);
        if (!search) {
          const w = searchPageEvidence(p.html, facts, domainCityFor(f.address ?? undefined, f.region), tradeWords);
          if (w) { search = host(url); why = w; }
        }
        if (current && search) break;
      }
      o.accepted.push({ current, search, why });
    }
    outcomes.push(o);
    if (++n % 10 === 0) console.log(`  ${n}/${todo.length} firem, ${requests} dotazů`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'web-search.json'), JSON.stringify({ ranAt: new Date().toISOString(), requests, outcomes }, null, 1));

  // ── Vyhodnocení strategií ─────────────────────────────────────────────────
  type Strategy = { label: string; uses: number[] };
  const strategies: Strategy[] = [
    { label: 'Q1 ("název" obec)', uses: [0] },
    { label: 'Q1, když nic → Q2 (název obor obec)', uses: [0, 1] },
    { label: 'Q1 → Q2 → Q3 (IČO)', uses: [0, 1, 2] },
  ];
  const lines: string[] = [`# Vyhledávač Brave na vzorku — ${new Date().toISOString().slice(0, 10)}`, '', `Firem ${outcomes.length}, dotazů celkem ${requests} (neúspěšných ${outcomes.flatMap(o => o.queries).filter(q => !q.ok).length}).`];

  for (const rule of ['search', 'current'] as const) {
    lines.push('', `## Pravidlo: ${rule === 'search' ? 'pro výsledky vyhledávače (IČO / telefon / adresa / název+obec+obor)' : 'dnešní pageEvidence (doména nese název)'}`, '');
    lines.push('| Strategie | Ø dotazů na firmu | Přehlédnuté weby nalezeny | Chybně přiřazený web (pravda: nemá) | Cizí web (pravda: jiný) | Když nic nenajde, firma opravdu nemá web |');
    lines.push('|---|---:|---:|---:|---:|---:|');
    for (const s of strategies) {
      let queries = 0, missedTotal = 0, missedFound = 0, fpNone = 0, wrongSite = 0, nothing = 0, nothingNone = 0;
      for (const o of outcomes) {
        const t = truth.get(o.id);
        let found: string | null = null;
        for (const i of s.uses) {
          if (i >= o.queries.length) break;
          queries++;
          const a = o.accepted[i];
          found = rule === 'search' ? a.search : a.current;
          if (found) break;
        }
        const missed = t?.truth === 'HAS' && o.app !== 'HAS';
        if (missed) { missedTotal++; if (found && sameSite(found, t!)) missedFound++; }
        if (found && t?.truth === 'NONE') fpNone++;
        if (found && t?.truth === 'HAS' && !sameSite(found, t)) wrongSite++;
        if (!found && o.app !== 'HAS' && t && t.truth !== 'UNSURE') { nothing++; if (t.truth === 'NONE') nothingNone++; }
      }
      const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
      lines.push(`| ${s.label} | ${(queries / outcomes.length).toFixed(2).replace('.', ',')} | ${missedFound} z ${missedTotal} (${pct(missedFound, missedTotal)}) | ${fpNone} | ${wrongSite} | ${nothingNone} z ${nothing} (${pct(nothingNone, nothing)}) |`);
    }
  }

  lines.push('', '## Přehlédnuté weby: kde je vyhledávač ukázal', '', '| Firma | Web | Q1 pořadí | Q2 pořadí | Q3 pořadí | Přijato (pravidlo vyhledávače) |', '|---|---|---:|---:|---:|---|');
  for (const o of outcomes.filter(o => truth.get(o.id)?.truth === 'HAS' && o.app !== 'HAS')) {
    const rank = (i: number) => (o.queries[i] ? (o.queries[i].truthRank ?? '—') : 'x');
    const acc = o.accepted.map(a => a.search).find(Boolean) ?? '—';
    lines.push(`| ${o.name.replace(/\|/g, '/')} | ${o.truthHost} | ${rank(0)} | ${rank(1)} | ${rank(2)} | ${acc} |`);
  }

  const bad = outcomes.filter(o => o.accepted.some(a => a.search) && truth.get(o.id)?.truth !== 'HAS');
  if (bad.length) {
    lines.push('', '## Přijaté weby u firem, které podle pravdy web nemají (nebo je pravda nejistá)', '', '| Firma | Pravda | Přijato | Důkaz |', '|---|---|---|---|');
    for (const o of bad) {
      const a = o.accepted.find(x => x.search)!;
      lines.push(`| ${o.name.replace(/\|/g, '/')} | ${o.truth} | ${a.search} | ${a.why} |`);
    }
  }

  const report = lines.join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'web-search-report.md'), report);
  console.log(report);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
