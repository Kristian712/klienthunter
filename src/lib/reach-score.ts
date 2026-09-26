import { hasReachChannel, webStatusOf, type FilterableLead } from './lead-filters';

/**
 * Dosažitelnost firmy, 0–100.
 *
 * Jiná otázka než `leadScore`. Ten říká „jak moc se tahle firma hodí k tomu, co prodáváte";
 * tenhle říká „a máte ji vůbec jak oslovit". Firma s ideálním profilem a bez jediného kontaktu
 * je hezká na pohled a k ničemu — a naopak nezajímavá firma s telefonem se aspoň dá zavolat.
 *
 * Váhy nejsou hlasování, jde o cenu jednoho oslovení:
 * - **e-mail (45)** — nejlevnější kanál, dá se poslat hned a v dávce;
 * - **telefon (35)** — nejúčinnější, ale stojí čas a musí se trefit do otevírací doby;
 * - **síť (10)** — Facebook nebo Instagram; zpráva dojde, ale odpovídá se na ni nejhůř;
 * - **stránka „Kontakt" (12)** — kontakt tam je, jen si pro něj musíte kliknout;
 * - **ověřený web (8)** — aspoň formulář nebo adresa; horší už je jen ticho.
 *
 * Součet je zastropovaný na 100. Nula znamená doslova „nemáme jak", ne „skoro nijak" — a přesně
 * na ní stojí filtr `can_reach`.
 */

const W_EMAIL = 45;
const W_PHONE = 35;
const W_CONTACT_PAGE = 12;
const W_SOCIAL = 10;
const W_WEBSITE = 8;

export function reachScore(b: FilterableLead): number {
  let score = 0;
  if (b.email) score += W_EMAIL;
  if (b.phone) score += W_PHONE;
  if (b.hasFacebook || b.hasInstagram || b.hasLinkedIn) score += W_SOCIAL;
  if (b.contactUrl) score += W_CONTACT_PAGE;
  else if (webStatusOf(b) === 'HAS') score += W_WEBSITE;
  return Math.min(100, score);
}

/** Má uživatel firmu jak oslovit? Jediná otázka, na kterou skóre odpovídá ano/ne. */
export function canReach(b: FilterableLead): boolean {
  return hasReachChannel(b);
}

/**
 * Věta ke skóre. Neopisuje číslo slovy, říká, co s tím uživatel udělá — proto je v ní vždycky
 * ten nejlepší kanál, který firma má, ne výčet všech.
 */
export function reachHint(b: FilterableLead): { cs: string; sk: string; en: string } {
  if (b.email && b.phone) {
    return { cs: 'Telefon i e-mail — oslovíte ji hned.',
             sk: 'Telefón aj e-mail — oslovíte ju hneď.',
             en: 'Phone and e-mail — you can reach out right away.' };
  }
  if (b.email) {
    return { cs: 'Má e-mail — nejlevnější cesta, jak začít.',
             sk: 'Má e-mail — najlacnejšia cesta, ako začať.',
             en: 'Has an e-mail — the cheapest way in.' };
  }
  if (b.phone) {
    return { cs: 'Má telefon — zavolat je na ni jediná cesta.',
             sk: 'Má telefón — zavolať je naň jediná cesta.',
             en: 'Has a phone — calling is the only way in.' };
  }
  if (b.contactUrl) {
    return { cs: 'Kontakt má na webu, na vlastní stránce „Kontakt".',
             sk: 'Kontakt má na webe, na vlastnej stránke „Kontakt".',
             en: 'Its contacts live on its own “Contact” page.' };
  }
  if (b.hasFacebook || b.hasInstagram || b.hasLinkedIn) {
    return { cs: 'Jen přes sociální síť — zpráva dojde, odpověď nemusí.',
             sk: 'Len cez sociálnu sieť — správa dôjde, odpoveď nemusí.',
             en: 'Only through social media — the message lands, the reply may not.' };
  }
  if (webStatusOf(b) === 'HAS') {
    return { cs: 'Jen web — kontakt na něm hledejte sami.',
             sk: 'Len web — kontakt na ňom hľadajte sami.',
             en: 'Only a website — you will have to find the contact on it.' };
  }
  return { cs: 'Kontakt nemáme žádný — dohledejte ji podle názvu.',
           sk: 'Kontakt nemáme žiadny — dohľadajte ju podľa názvu.',
           en: 'No contact at all — look the firm up by name.' };
}

/**
 * Pořadí, ve kterém má smysl obvolávat: „jde oslovit" a zároveň „něco jí chybí".
 *
 * Skóre leadu odpovídá na otázku uživatele (jeho kritéria), tohle na otázku produktu: komu volat
 * první. Firma bez jediného kanálu je pro oslovování k ničemu, i kdyby splnila všechna kritéria —
 * proto padá dolů. Nahoru jde ta, která se dá oslovit (telefon, e-mail, sítě) a přitom nemá web
 * nebo má zastaralý: to je přesně firma, které má tvůrce webů co nabídnout.
 *
 * Váhy jsou dohodnuté, ne změřené, a v UI se to říká: řádek ukazuje dosažitelnost i důvod.
 */
const GAP_NO_WEB = 18;
const GAP_OLD_WEB = 12;
const SOCIAL_NO_WEB = 8;
const UNREACHABLE_FACTOR = 0.15;
const UNRELIABLE_MALUS = 15;

/**
 * Známky, že firma má obrat a klientelu — má z čeho zaplatit a je o co přicházet.
 *
 * Rozšířeno 26. 9. 2026 (majitel, režim „Ubytování a wellness"): místo recenzí z Google Map,
 * které legálně nemáme, se bere to, co je v rejstřících. Plátce DPH váží nejvíc — registrace
 * je povinná od obratu 2 mil. Kč za rok, je to jediný veřejný signál obratu. Víc provozoven
 * znamená větší provoz, stáří firmy stálou klientelu. Dřív to byl jediný bonus +6 za „provozovna
 * nebo DPH".
 */
const VAT_BONUS = 8;
const PREMISES_ONE = 3;
const PREMISES_MORE = 6;
const AGE_3Y = 3;
const AGE_10Y = 5;
const YEAR_MS = 365.25 * 86_400_000;

/** Kolik let je firma na trhu; null, když datum vzniku neznáme. */
export function firmAgeYears(b: FilterableLead): number | null {
  if (!b.foundedAt) return null;
  const t = new Date(b.foundedAt).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / YEAR_MS : null;
}

function substanceBonus(b: FilterableLead): number {
  let bonus = 0;
  if (b.vatPayer === true) bonus += VAT_BONUS;
  const premises = b.activePremises ?? 0;
  if (premises >= 2) bonus += PREMISES_MORE;
  else if (premises === 1) bonus += PREMISES_ONE;
  const age = firmAgeYears(b);
  if (age !== null && age >= 10) bonus += AGE_10Y;
  else if (age !== null && age >= 3) bonus += AGE_3Y;
  return bonus;
}

/** Totéž slovy pro řádek: „plátce DPH · 2 provozovny · na trhu 12 let". Prázdné, když nic. */
export function substanceFacts(b: FilterableLead, locale: string, withPremises = true): string[] {
  const facts: string[] = [];
  const pick = (cs: string, sk: string, en: string) => (locale === 'en' ? en : locale === 'sk' ? sk : cs);
  if (b.vatPayer === true) facts.push(pick('plátce DPH', 'platiteľ DPH', 'VAT registered'));
  const premises = b.activePremises ?? 0;
  if (withPremises && premises >= 2) facts.push(pick(`${premises} provozovn${premises < 5 ? 'y' : 'en'}`, `${premises} prevádz${premises < 5 ? 'ky' : 'ok'}`, `${premises} premises`));
  const age = firmAgeYears(b);
  if (age !== null && age >= 3) {
    const y = Math.floor(age);
    facts.push(pick(`na trhu ${y} ${y < 5 ? 'roky' : 'let'}`, `na trhu ${y} ${y < 5 ? 'roky' : 'rokov'}`, `${y} years in business`));
  }
  return facts;
}

export function opportunityScore(b: FilterableLead): number {
  const reach = reachScore(b);
  // Bez kanálu není co dělat: taková firma nesmí předběhnout tu, které jde napsat. Mezi sebou
  // se ale řadí podle obratu a stálosti (max ~10 bodů, pod nejslabší dosažitelnou firmou) —
  // v režimu ubytování je takových většina a kontakt si uživatel dohledá v mapách.
  if (!hasReachChannel(b)) return Math.round(reach * UNREACHABLE_FACTOR + substanceBonus(b) * 0.5);

  let score = reach * 0.7;
  const web = webStatusOf(b);
  if (web !== 'HAS') score += GAP_NO_WEB;
  else if (b.websiteIsOld) score += GAP_OLD_WEB;
  if (web !== 'HAS' && (b.hasFacebook || b.hasInstagram || b.hasLinkedIn)) score += SOCIAL_NO_WEB;
  // Známky toho, že firma opravdu běží a má obrat — jinak by nahoru šly prázdné schránky.
  score += substanceBonus(b);
  if (b.vatUnreliable === true) score -= UNRELIABLE_MALUS;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Jednou větou, proč je firma v pořadí tam, kde je. */
export function opportunityReason(b: FilterableLead): { cs: string; sk: string; en: string } {
  if (!hasReachChannel(b)) {
    return { cs: 'Nemáme na ni žádný kontakt — oslovit ji zatím nejde.',
             sk: 'Nemáme na ňu žiadny kontakt — osloviť ju zatiaľ nejde.',
             en: 'We have no contact for it — there is no way to reach out yet.' };
  }
  const web = webStatusOf(b);
  const social = Boolean(b.hasFacebook || b.hasInstagram || b.hasLinkedIn);
  if (web !== 'HAS' && social) {
    return { cs: 'Jde oslovit a web jsme jí nenašli — na sítích aktivní je.',
             sk: 'Dá sa osloviť a web sme jej nenašli — na sieťach aktívna je.',
             en: 'Reachable and we found no website — yet it is active on social media.' };
  }
  if (web !== 'HAS') {
    return { cs: 'Jde oslovit a web jsme jí nenašli.',
             sk: 'Dá sa osloviť a web sme jej nenašli.',
             en: 'Reachable and we found no website.' };
  }
  if (b.websiteIsOld) {
    return { cs: 'Jde oslovit a její web propadl v auditu.',
             sk: 'Dá sa osloviť a jej web prepadol v audite.',
             en: 'Reachable and its website failed the audit.' };
  }
  return { cs: 'Jde oslovit; web má a vypadá v pořádku.',
           sk: 'Dá sa osloviť; web má a vyzerá v poriadku.',
           en: 'Reachable; it has a website and it looks fine.' };
}
