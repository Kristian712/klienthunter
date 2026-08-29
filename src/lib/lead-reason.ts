import { localized, webStatusOf, yearsSince, type FilterableLead } from './lead-filters';
import { scoreBreakdown } from './lead-score';

/**
 * Jedna věta, proč má smysl tuhle firmu oslovit.
 *
 * Nahrazuje sloupec, ve kterém stály dvě útržkovité nálepky („Nová firma (do 1 roku)"). Nálepka
 * je název filtru, ne důvod k telefonátu — člověk si z ní musí důvod domyslet sám a u dvaceti
 * řádků to nedělá.
 *
 * Tři pravidla, kterými se to řídí:
 *
 *  1. **Žádný další request.** Všechno se skládá z toho, co už v řádku je.
 *  2. **Žádná AI.** Šablony, protože věta musí být stejná pro stejná data a musí jít přečíst
 *     v kódu, co která znamená.
 *  3. **Nic, co z dat neplyne.** Tohle je ta nejtěžší část a je to důvod, proč tenhle soubor
 *     vypadá, jak vypadá: „nemá web" neříkáme nikdy, protože to nevíme — ARES web needviduje
 *     a OpenStreetMap ho tagne u menšiny firem. Píšeme „web jsme nenašli", což je tvrzení
 *     o našem hledání, ne o firmě. Stejně tak „nezastihli jsme ji na webu" místo „nemá HTTPS
 *     a je jí to jedno".
 *
 * Věta se skládá ze dvou částí: co firma splňuje z kritérií uživatele (to je i důvod, proč
 * sedí tam, kde sedí ve výsledcích), a jak se dá oslovit. Když nesplňuje nic, řekne se to —
 * prázdné místo by čtenář přečetl jako „tady nic nebylo", ne jako „tady nic nevíme".
 */

type Text = { cs: string; sk?: string; en: string };

/** Spojka podle jazyka — „a" mezi poslední dvojicí, jinde čárka. */
function joinList(parts: string[], locale: string): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const and = locale === 'en' ? ' and ' : locale === 'sk' ? ' a ' : ' a ';
  return parts.slice(0, -1).join(', ') + and + parts[parts.length - 1];
}

/**
 * Fráze pro jednotlivé signály, vždy jako *část věty* („nemá web, který bychom našli"), ne jako
 * nadpis. Klíč je id filtru z `lead-filters.ts`, takže slovník důvodů a slovník kritérií
 * zůstávají tentýž seznam — nový filtr se tu buď objeví, nebo spadne na svou vlastní nálepku.
 */
const PHRASE: Record<string, Text> = {
  no_website:       { cs: 'web jsme jí nenašli', sk: 'web sme jej nenašli', en: 'we found no website for it' },
  has_website:      { cs: 'web má', sk: 'web má', en: 'it has a website' },
  insecure_website: { cs: 'její web běží bez HTTPS', sk: 'jej web beží bez HTTPS', en: 'its site runs without HTTPS' },
  old_website:      { cs: 'její web působí zastarale', sk: 'jej web pôsobí zastarano', en: 'its site looks dated' },
  slow_website:     { cs: 'její web se načítá pomalu', sk: 'jej web sa načítava pomaly', en: 'its site loads slowly' },
  no_social:        { cs: 'sociální sítě jsme jí nenašli', sk: 'sociálne siete sme jej nenašli', en: 'we found no social profiles' },
  has_contact:      { cs: 'je na koho se obrátit', sk: 'je na koho sa obrátiť', en: 'there is someone to contact' },
  no_contact:       { cs: 'telefon ani e-mail jsme nenašli', sk: 'telefón ani e-mail sme nenašli', en: 'we found no phone or e-mail' },
  has_phone:        { cs: 'má telefon', sk: 'má telefón', en: 'it has a phone number' },
  has_email:        { cs: 'má e-mail', sk: 'má e-mail', en: 'it has an e-mail' },
  has_contact_page: { cs: 'na webu má stránku s kontakty', sk: 'na webe má stránku s kontaktmi', en: 'its site has a contact page' },
  new_firm:         { cs: 'vznikla během posledního roku', sk: 'vznikla počas posledného roka', en: 'it was founded within the last year' },
  new_firm_6m:      { cs: 'vznikla během posledního půlroku', sk: 'vznikla počas posledného polroka', en: 'it was founded within the last six months' },
  established_3y:   { cs: 'podniká přes tři roky', sk: 'podniká vyše troch rokov', en: 'it has traded for over three years' },
  established_10y:  { cs: 'podniká přes deset let', sk: 'podniká vyše desiatich rokov', en: 'it has traded for over ten years' },
  vat_payer:        { cs: 'je plátce DPH', sk: 'je platiteľ DPH', en: 'it is VAT-registered' },
  vat_none:         { cs: 'není plátce DPH', sk: 'nie je platiteľ DPH', en: 'it is not VAT-registered' },
  no_category:      { cs: 'obor nemá v rejstříku uvedený', sk: 'odbor nemá v registri uvedený', en: 'its trade is not listed in the register' },
};

const T = {
  lead:      { cs: 'Sedí, protože ', sk: 'Sedí, pretože ', en: 'A fit because ' },
  nothing:   { cs: 'Z vašich kritérií nesplňuje nic — ve výsledcích je kvůli oboru a kraji.',
               sk: 'Z vašich kritérií nespĺňa nič — vo výsledkoch je kvôli odboru a kraju.',
               en: 'It meets none of your criteria — it is here because of the trade and region.' },
  noData:    { cs: 'O téhle firmě víme zatím jen jméno a sídlo z rejstříku.',
               sk: 'O tejto firme vieme zatiaľ len meno a sídlo z registra.',
               en: 'So far we only know its name and registered address from the register.' },
  unreliable:{ cs: ' Pozor: finanční správa ji vede jako nespolehlivého plátce DPH.',
               sk: ' Pozor: finančná správa ju vedie ako nespoľahlivého platiteľa DPH.',
               en: ' Careful: the tax office lists it as an unreliable VAT payer.' },
  // Zvlášť, protože tohle není důvod k oslovení, ale způsob, jak ho provést.
  viaPage:   { cs: ' Nejrychleji se k ní dostanete přes její stránku s kontakty.',
               sk: ' Najrýchlejšie sa k nej dostanete cez jej stránku s kontaktmi.',
               en: ' The quickest way in is its contact page.' },
  viaPageShort: { cs: ' Tou začněte.', sk: ' Tou začnite.', en: ' Start there.' },
  viaPhone:  { cs: ' Zavolat jde rovnou.', sk: ' Zavolať ide rovno.', en: ' You can call straight away.' },
  viaEmail:  { cs: ' Napsat jde rovnou.', sk: ' Napísať ide rovno.', en: ' You can e-mail straight away.' },
  viaSearch: { cs: ' Kontakt na ni zatím nemáme — dohledejte si ji podle názvu.',
               sk: ' Kontakt na ňu zatiaľ nemáme — dohľadajte si ju podľa názvu.',
               en: ' We have no contact for it yet — look it up by name.' },
};

/**
 * Sestaví větu. `criteria` jsou id filtrů z profilu uživatele, stejná jako pro skóre, takže
 * věta a číslo mluví o tomtéž — kdyby se rozešly, uživatel by četl zdůvodnění pořadí, které
 * pořadí nevysvětluje.
 */
export function leadReason(lead: FilterableLead & { name?: string }, criteria: readonly string[] | null | undefined, locale: string): string {
  const { matched, unreliable } = scoreBreakdown(lead, criteria);

  const phrases = matched
    .map(f => (PHRASE[f.id] ? localized(PHRASE[f.id], locale) : localized(f.label, locale).toLowerCase()))
    .slice(0, 3);

  const knowsNothing =
    !lead.phone && !lead.email && webStatusOf(lead) !== 'HAS' && yearsSince(lead.foundedAt) === null;

  let sentence: string;
  if (phrases.length > 0) {
    sentence = localized(T.lead, locale) + joinList(phrases, locale) + '.';
  } else if (knowsNothing) {
    sentence = localized(T.noData, locale);
  } else {
    sentence = localized(T.nothing, locale);
  }

  // Jak ji oslovit. Pořadí podle toho, co je pro navázání hovoru nejlepší.
  //
  // Kontaktní stránka může být zároveň splněným kritériem. Pak už je ve větě jednou a druhá
  // zmínka by z ní udělala „…má stránku s kontakty. Dostanete se k ní přes stránku s kontakty."
  const pageAlreadySaid = matched.some(f => f.id === 'has_contact_page');
  if (lead.contactUrl && !pageAlreadySaid) sentence += localized(T.viaPage, locale);
  else if (lead.contactUrl) sentence += localized(T.viaPageShort, locale);
  else if (lead.phone) sentence += localized(T.viaPhone, locale);
  else if (lead.email) sentence += localized(T.viaEmail, locale);
  else sentence += localized(T.viaSearch, locale);

  if (unreliable) sentence += localized(T.unreliable, locale);

  return sentence;
}
