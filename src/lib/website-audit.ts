import { localized, webStatusOf, type FilterableLead } from './lead-filters';

/**
 * Audit webu v jedné větě — argument do nabídky, ne technický výpis.
 *
 * `business-checks.ts` při ověření webu sbírá důvody typu „<font> tag (HTML 3.x era)" a skóre
 * 0–100. Do teď to bylo jen v bublině myši nad odznakem, tedy na telefonu nikde. Konkurence
 * (LeedFinder, B2BLeadFinder) staví celý produkt na tom, že u firmy řekne „web bez HTTPS,
 * bez mobilní verze" — a to je přesně věta, se kterou tvůrce webů volá. Tady se ty důvody
 * přeloží do lidské řeči a doplní o to, co víme odjinud (kontaktní stránka, sociální sítě).
 *
 * Nic se neodhaduje: každá položka odpovídá jednomu změřenému faktu. Když web neznáme,
 * věta se nevrátí vůbec — o neověřeném webu nemáme co říct.
 */

type Text = { cs: string; sk?: string; en: string };

/** Technický důvod z `business-checks.ts` → co to znamená pro majitele. */
const REASONS: Array<{ test: RegExp; text: Text }> = [
  { test: /^Bez HTTPS/i,            text: { cs: 'bez zabezpečení HTTPS (prohlížeč hlásí „Nezabezpečeno")', sk: 'bez zabezpečenia HTTPS (prehliadač hlási „Nezabezpečené")', en: 'no HTTPS (browser shows “Not secure”)' } },
  { test: /mobilní verze/i,         text: { cs: 'na telefonu se nepřizpůsobí', sk: 'na telefóne sa neprispôsobí', en: 'not mobile-friendly' } },
  { test: /^Copyright (\d{4})/i,    text: { cs: 'copyright {y} — od té doby nejspíš neaktualizovaný', sk: 'copyright {y} — odvtedy najskôr neaktualizovaný', en: 'copyright {y} — probably not updated since' } },
  { test: /font> tag|marquee|bgcolor|frames|DOCTYPE/i, text: { cs: 'kód z dob před rokem 2010', sk: 'kód z čias pred rokom 2010', en: 'code from before 2010' } },
  { test: /Flash/i,                 text: { cs: 'používá Flash, který prohlížeče už nepřehrají', sk: 'používa Flash, ktorý prehliadače už neprehrajú', en: 'uses Flash, which browsers no longer run' } },
  { test: /tabulkový layout/i,      text: { cs: 'rozvržení v tabulkách (starý způsob stavby)', sk: 'rozloženie v tabuľkách (starý spôsob stavby)', en: 'table-based layout (an old way to build pages)' } },
  { test: /Starý jQuery|Bootstrap v1/i, text: { cs: 'zastaralé knihovny', sk: 'zastarané knižnice', en: 'outdated libraries' } },
  { test: /externí CSS|inline styly/i, text: { cs: 'styly psané napřímo do stránky', sk: 'štýly písané priamo do stránky', en: 'styles written inline' } },
  { test: /malá stránka/i,          text: { cs: 'skoro prázdná stránka', sk: 'skoro prázdna stránka', en: 'an almost empty page' } },
];

const T = {
  dated:   { cs: 'Web působí zastarale', sk: 'Web pôsobí zastaralo', en: 'The website looks dated' },
  ok:      { cs: 'Web v pořádku', sk: 'Web v poriadku', en: 'Website in good shape' },
  weak:    { cs: 'Web má slabiny', sk: 'Web má slabiny', en: 'The website has weak spots' },
  noContact: { cs: 'bez stránky s kontakty', sk: 'bez stránky s kontaktmi', en: 'no contact page' },
  noSocial:  { cs: 'bez odkazu na sociální sítě', sk: 'bez odkazu na sociálne siete', en: 'no social links' },
  socials:   { cs: 'sítě: {s}', sk: 'siete: {s}', en: 'social: {s}' },
};

export interface WebsiteAudit {
  /** `dated` = doložené stáří (websiteIsOld), `weak` = pár výhrad, `ok` = nic k vytknutí. */
  verdict: 'dated' | 'weak' | 'ok';
  score: number | null;
  /** Hotová věta pro řádek výsledku. */
  sentence: string;
}

export interface AuditInput extends FilterableLead {
  websiteScore?: number | null;
  websiteAgeNote?: string | null;
}

export function websiteAudit(b: AuditInput, locale: string): WebsiteAudit | null {
  if (webStatusOf(b) !== 'HAS') return null;
  const t = (x: Text) => localized(x, locale);

  const reasons = (b.websiteAgeNote ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const items: string[] = [];
  for (const raw of reasons) {
    const hit = REASONS.find(r => r.test.test(raw));
    if (!hit) continue;
    const year = /Copyright (\d{4})/i.exec(raw)?.[1];
    const text = t(hit.text).replace('{y}', year ?? '');
    if (!items.includes(text)) items.push(text);
  }
  if (!b.contactUrl) items.push(t(T.noContact));
  if (b.socialsChecked) {
    const socials = [b.hasFacebook && 'Facebook', b.hasInstagram && 'Instagram', b.hasLinkedIn && 'LinkedIn'].filter(Boolean) as string[];
    items.push(socials.length ? t(T.socials).replace('{s}', socials.join(', ')) : t(T.noSocial));
  }

  // 50 je výchozí „neměřeno" (business-checks.ts) — takové číslo se neukazuje.
  const score = typeof b.websiteScore === 'number' && b.websiteScore !== 50 ? b.websiteScore : null;
  const verdict: WebsiteAudit['verdict'] = b.websiteIsOld ? 'dated' : reasons.length > 0 || !b.contactUrl ? 'weak' : 'ok';
  const head = t(verdict === 'dated' ? T.dated : verdict === 'weak' ? T.weak : T.ok);
  const sentence = `${head}${score !== null ? ` (${score}/100)` : ''}${items.length ? `: ${items.join(', ')}.` : '.'}`;
  return { verdict, score, sentence };
}
