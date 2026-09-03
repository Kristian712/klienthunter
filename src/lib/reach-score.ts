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
