import { localized } from './lead-filters';
import { buildGreeting } from './czech-vocative';

/**
 * The first message the user sends a lead — assembled from *their* profile, never from ours.
 *
 * This replaces two separate generators that both opened with the author's own name and "dělám
 * weby na míru", and signed off with a hard-coded agency URL. That was fine while the author was
 * the only user; for anyone else it produced an e-mail introducing them as someone they are not.
 *
 * Two rules the wording follows:
 *
 *  1. **Say what the sender does, never what the recipient needs.** We know a firm's registry
 *     record, not its plans. The old templates opened with "Zaujalo mě, že zatím web nemáte",
 *     which is a guess dressed as an observation — and the reason the old code had to refuse to
 *     write anything at all when the website check came back UNKNOWN. Drop the claim and the
 *     refusal goes with it.
 *  2. **It is a draft, not a send.** § 7 zákona 480/2004 Sb. makes unsolicited commercial mail an
 *     offence, so the app hands the text over and the user decides. The tone is written for that:
 *     an introduction and an offer to follow up, not a pitch that assumes a yes.
 *
 * A third rule applies to the Czech and Slovak strings only: **no gendered first-person forms.**
 * We do not ask the user's gender and never will, so a past participle ("narazil jsem",
 * "budu vděčný") would put a masculine self-description in the mouth of every woman using the
 * app. Every cs/sk sentence below is therefore present tense or impersonal — check any new one
 * against a female sender before adding it.
 */

export interface OutreachSender {
  name: string | null;
  /** An id from PROFESSIONS, or 'other'. */
  profession: string | null;
  /** The user's own words, the only thing we have when profession is 'other'. */
  professionText: string | null;
  /** One free line under the signature — their site, their phone, whatever they want. */
  outreachSignature: string | null;
}

type Text = { cs: string; sk?: string; en: string };

const T = {
  /** `jsem {name} a {does}.` — the trade phrases live in DOES below. */
  introNameDoes: { cs: 'jsem {name} a {does}.', sk: 'som {name} a {does}.', en: "I'm {name} and {does}." },
  introName:     { cs: 'jsem {name}.',          sk: 'som {name}.',          en: "I'm {name}." },
  /** Free text is a noun ("truhlářství"), so it needs a different frame than the verb phrases. */
  introFree:     { cs: 'jsem {name} a věnuji se oboru {what}.',
                   sk: 'som {name} a venujem sa odboru {what}.',
                   en: "I'm {name} and I work in {what}." },
  introFreeNoName: { cs: 'věnuji se oboru {what}.', sk: 'venujem sa odboru {what}.', en: 'I work in {what}.' },

  body: { cs: 'Vaši firmu znám z veřejného rejstříku a napadlo mě, že pro vás možná mám něco užitečného. Pokud je to aktuální, pošlu vám k tomu víc — nezávazně a bez nátlaku.',
          sk: 'Vašu firmu poznám z verejného registra a napadlo mi, že pre vás možno mám niečo užitočné. Ak je to aktuálne, pošlem vám k tomu viac — nezáväzne a bez nátlaku.',
          en: 'I am writing because I found your company in the public register and I may have something useful for you. If it is relevant, I will send more — no obligation and no pressure.' },

  referral: { cs: 'A kdyby to teď nebylo na pořadu dne, ale napadl vás někdo, komu by se to hodilo, díky za doporučení 🙏',
              sk: 'A keby to teraz nebolo na programe dňa, ale napadol vás niekto, komu by sa to hodilo, ďakujem za odporúčanie 🙏',
              en: 'And if now is not the moment but someone else comes to mind, I would be grateful for a pointer 🙏' },

  regards: { cs: 'S pozdravem',  sk: 'S pozdravom',  en: 'Best regards' },

  subject:       { cs: 'Krátké představení – {name}', sk: 'Krátke predstavenie – {name}', en: 'A quick introduction – {name}' },
  subjectNoName: { cs: 'Krátké představení',          sk: 'Krátke predstavenie',          en: 'A quick introduction' },
};

/**
 * How each trade describes itself in the first sentence. A verb phrase, lower-case, no full stop
 * — it is glued after "jsem {jméno} a". Kept next to the trade list rather than inside it so
 * `PROFESSIONS` stays a plain pick-list for the onboarding chips.
 */
const DOES: Record<string, Text> = {
  web:        { cs: 'dělám firmám weby',                  sk: 'robím firmám weby',                     en: 'I build websites for businesses' },
  marketing:  { cs: 'starám se firmám o marketing a reklamu', sk: 'starám sa firmám o marketing a reklamu', en: 'I run marketing and advertising for businesses' },
  accounting: { cs: 'vedu firmám účetnictví a daně',      sk: 'vediem firmám účtovníctvo a dane',      en: 'I handle bookkeeping and tax for businesses' },
  photo:      { cs: 'fotím a natáčím pro firmy',          sk: 'fotím a natáčam pre firmy',             en: 'I shoot photo and video for businesses' },
  realestate: { cs: 'pracuji v realitách',                sk: 'pracujem v realitách',                  en: 'I work in real estate' },
  legal:      { cs: 'poskytuji firmám právní služby',     sk: 'poskytujem firmám právne služby',       en: 'I provide legal services to businesses' },
  cleaning:   { cs: 'zajišťuji firmám úklid a údržbu',    sk: 'zabezpečujem firmám upratovanie a údržbu', en: 'I provide cleaning and maintenance for businesses' },
  it:         { cs: 'starám se firmám o IT',              sk: 'starám sa firmám o IT',                 en: 'I look after IT for businesses' },
  consulting: { cs: 'dělám pro firmy poradenství a školení', sk: 'robím pre firmy poradenstvo a školenia', en: 'I do consulting and training for businesses' },
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The opening line, minus the greeting. Empty when we know nothing at all about the sender. */
function intro(sender: OutreachSender, locale: string): string {
  const name = sender.name?.trim() || '';
  const free = sender.professionText?.trim() || '';
  // 'other' means the list did not fit, so the user's own words are all we have.
  const known = sender.profession && sender.profession !== 'other'
    ? DOES[sender.profession]
    : undefined;

  if (known) {
    const does = localized(known, locale);
    return name
      ? fill(localized(T.introNameDoes, locale), { name, does })
      : `${capitalize(does)}.`;
  }
  if (free) {
    return name
      ? fill(localized(T.introFree, locale), { name, what: free })
      : capitalize(fill(localized(T.introFreeNoName, locale), { what: free }));
  }
  return name ? fill(localized(T.introName, locale), { name }) : '';
}

/**
 * The draft itself. `businessName` is only used to find a first name to greet — nothing in the
 * text makes a claim about the business.
 */
export function outreachBody(sender: OutreachSender, businessName: string, locale: string): string {
  const name = sender.name?.trim() || '';
  const signature = sender.outreachSignature?.trim() || '';

  // `buildGreeting` ends with the comma that a plain "Dobrý den," line needs. The emoji replaces
  // it — "Dobrý den, Petře, 👋" strands a comma in front of a picture.
  const greeting = buildGreeting(businessName, locale).replace(/,\s*$/, '');

  const blocks = [
    `${greeting} 👋`,
    intro(sender, locale),
    localized(T.body, locale),
    localized(T.referral, locale),
  ].filter(Boolean);

  // A sign-off with nothing under it reads worse than no sign-off at all.
  if (name || signature) {
    const signed = [name, signature].filter(Boolean).join(' · ');
    blocks.push(`${localized(T.regards, locale)}\n${signed}`);
  }

  return blocks.join('\n\n');
}

export function outreachSubject(sender: OutreachSender, locale: string): string {
  const name = sender.name?.trim();
  return name
    ? fill(localized(T.subject, locale), { name })
    : localized(T.subjectNoName, locale);
}

/** Narrows anything profile-shaped (the API row, the client profile state) down to what we need. */
export function toSender(source: Partial<OutreachSender>): OutreachSender {
  return {
    name: source.name ?? null,
    profession: source.profession ?? null,
    professionText: source.professionText ?? null,
    outreachSignature: source.outreachSignature ?? null,
  };
}
