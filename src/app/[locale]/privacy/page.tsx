import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { localized } from '@/lib/lead-filters';
import { OPERATOR, type LegalBlock } from '@/lib/legal';

/**
 * Zásady ochrany osobních údajů.
 *
 * Dvě věci, které tu dřív chyběly a bez kterých dokument nemohl obstát:
 *
 *  1. **Údaje o nalezených firmách.** Původní text mluvil jen o uživatelích. Jenže kontakt na
 *     OSVČ je osobní údaj a aplikace ho sbírá a ukládá — což z provozovatele dělá správce vůči
 *     lidem, kteří o službě nikdy neslyšeli. Čl. 14 GDPR na tuhle situaci pamatuje a ukládá je
 *     informovat; oddíl 3 a 4 níže to řeší a pojmenovává i výjimku podle čl. 14 odst. 5.
 *  2. **Právní základ a doba uchování.** Čl. 13 odst. 1 písm. c) a odst. 2 písm. a) je vyžadují
 *     u každého účelu. Bez nich je výčet „jaké údaje zpracováváme" jen popis, ne informace.
 */

const M = {
  title: {
    cs: 'Ochrana osobních údajů',
    sk: 'Ochrana osobných údajov',
    en: 'Privacy Policy',
  },
  description: {
    cs: 'Jaké osobní údaje KlientHunter zpracovává, z jakého důvodu, jak dlouho a jaká máte práva.',
    sk: 'Aké osobné údaje KlientHunter spracúva, z akého dôvodu, ako dlho a aké máte práva.',
    en: 'What personal data KlientHunter processes, on what basis, for how long, and what your rights are.',
  },
};

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: `${localized(M.title, locale)} – KlientHunter`,
    description: localized(M.description, locale),
  };
}

const INTRO = {
  cs: 'Tento dokument popisuje, jak KlientHunter nakládá s osobními údaji — jak s údaji o vás jako uživateli, tak s údaji o firmách a podnikatelích, které aplikace vyhledá. Je psaný tak, aby se dal přečíst, ne aby něco zakryl.',
  sk: 'Tento dokument popisuje, ako KlientHunter nakladá s osobnými údajmi — s údajmi o vás ako používateľovi aj s údajmi o firmách a podnikateľoch, ktoré aplikácia vyhľadá. Je písaný tak, aby sa dal prečítať, nie aby niečo zakryl.',
  en: 'This document describes how KlientHunter handles personal data — both yours as a user and that of the businesses and sole traders the app finds. It is written to be read, not to obscure.',
};

const BLOCKS: LegalBlock[] = [
  {
    heading: { cs: 'Kdo je správce', sk: 'Kto je prevádzkovateľ', en: 'Who the controller is' },
    body: [
      {
        cs: `Správcem osobních údajů je ${OPERATOR.name}, kontaktní e-mail ${OPERATOR.email}. Provozovatel nejmenoval pověřence pro ochranu osobních údajů — zpracování nedosahuje rozsahu, který by ho podle čl. 37 GDPR vyžadoval. S čímkoli ohledně svých údajů se proto obracejte přímo na uvedený e-mail.`,
        sk: `Prevádzkovateľom osobných údajov je ${OPERATOR.name}, kontaktný e-mail ${OPERATOR.email}. Prevádzkovateľ nemenoval zodpovednú osobu pre ochranu osobných údajov — spracúvanie nedosahuje rozsah, ktorý by ju podľa čl. 37 GDPR vyžadoval. So všetkým ohľadom svojich údajov sa preto obracajte priamo na uvedený e-mail.`,
        en: `The data controller is ${OPERATOR.name}, contact e-mail ${OPERATOR.email}. No data protection officer has been appointed — the processing does not reach the scale that would require one under Art. 37 GDPR. Please direct anything concerning your data to the address above.`,
      },
    ],
  },
  {
    heading: {
      cs: 'Údaje o vás jako uživateli',
      sk: 'Údaje o vás ako používateľovi',
      en: 'Data about you as a user',
    },
    body: [
      {
        cs: 'Abyste se mohli přihlásit a aplikace vám mohla ukazovat vaše vlastní výsledky, zpracováváme:',
        sk: 'Aby ste sa mohli prihlásiť a aplikácia vám mohla ukazovať vaše vlastné výsledky, spracúvame:',
        en: 'So that you can sign in and see your own results, we process:',
      },
    ],
    bullets: [
      {
        cs: 'E-mail, jméno a heslo (uložené jako nevratný otisk, nikoli v čitelné podobě). Právní základ: plnění smlouvy podle čl. 6 odst. 1 písm. b) GDPR — bez nich vám nejde založit účet.',
        sk: 'E-mail, meno a heslo (uložené ako nevratný odtlačok, nie v čitateľnej podobe). Právny základ: plnenie zmluvy podľa čl. 6 ods. 1 písm. b) GDPR — bez nich vám nejde založiť účet.',
        en: 'E-mail, name and password (stored as an irreversible hash, never in readable form). Legal basis: performance of a contract, Art. 6(1)(b) GDPR — without them there is no account.',
      },
      {
        cs: 'Profil, který vyplníte při registraci: co nabízíte, komu a kde, a podle jakých kritérií chcete výsledky řadit. Právní základ: plnění smlouvy. Profil je nepovinný, onboarding jde přeskočit a kdykoli ho změníte nebo vymažete v nastavení.',
        sk: 'Profil, ktorý vyplníte pri registrácii: čo ponúkate, komu a kde, a podľa akých kritérií chcete výsledky zoraďovať. Právny základ: plnenie zmluvy. Profil je nepovinný, onboarding sa dá preskočiť a kedykoľvek ho zmeníte alebo vymažete v nastaveniach.',
        en: 'The profile you fill in at registration: what you offer, to whom and where, and which criteria should rank your results. Legal basis: performance of a contract. The profile is optional, onboarding can be skipped, and you can change or clear it at any time in settings.',
      },
      {
        cs: 'Historii vašich hledání a jejich výsledky, abyste se k nim mohli vrátit a exportovat je. Právní základ: plnění smlouvy.',
        sk: 'Históriu vašich hľadaní a ich výsledky, aby ste sa k nim mohli vrátiť a exportovať ich. Právny základ: plnenie zmluvy.',
        en: 'Your search history and its results, so you can return to them and export them. Legal basis: performance of a contract.',
      },
    ],
  },
  {
    heading: {
      cs: 'Údaje o firmách, které aplikace najde',
      sk: 'Údaje o firmách, ktoré aplikácia nájde',
      en: 'Data about the businesses the app finds',
    },
    body: [
      {
        cs: 'Tohle je část, kterou většina podobných služeb zamlčuje, tak ji řekněme na rovinu. Aplikace vyhledává firmy ve veřejných rejstřících a mapách a ukládá o nich název, adresu, IČO, obor, a pokud jsou veřejně uvedené, i telefon, e-mail a web. U právnických osob nejde o osobní údaje. U OSVČ ale ano — jméno podnikatele, jeho adresa i kontakt jsou údaje o konkrétním člověku, i když je uvedl při podnikání.',
        sk: 'Toto je časť, ktorú väčšina podobných služieb zamlčuje, tak ju povedzme na rovinu. Aplikácia vyhľadáva firmy vo verejných registroch a mapách a ukladá o nich názov, adresu, IČO, odbor, a ak sú verejne uvedené, aj telefón, e-mail a web. Pri právnických osobách nejde o osobné údaje. Pri živnostníkoch áno — meno podnikateľa, jeho adresa aj kontakt sú údaje o konkrétnom človeku, aj keď ich uviedol pri podnikaní.',
        en: 'This is the part most comparable services stay quiet about, so let us be direct. The app searches public registers and maps and stores each business’s name, address, company number, trade, and — where publicly listed — phone, e-mail and website. For companies this is not personal data. For sole traders it is: the trader’s name, address and contact details identify a specific person, even though they were published in a business context.',
      },
      {
        cs: 'Právním základem je oprávněný zájem podle čl. 6 odst. 1 písm. f) GDPR — konkrétně zájem uživatele nabídnout své služby jiným podnikatelům. Zpracováváme výhradně údaje, které daný podnikatel sám zveřejnil ve veřejném rejstříku nebo na vlastním webu, a jen v rozsahu, který k oslovení stačí. Údaje o soukromém životě, o zaměstnancích ani zvláštní kategorie údajů podle čl. 9 aplikace nesbírá.',
        sk: 'Právnym základom je oprávnený záujem podľa čl. 6 ods. 1 písm. f) GDPR — konkrétne záujem používateľa ponúknuť svoje služby iným podnikateľom. Spracúvame výhradne údaje, ktoré daný podnikateľ sám zverejnil vo verejnom registri alebo na vlastnom webe, a len v rozsahu, ktorý na oslovenie stačí. Údaje o súkromnom živote, o zamestnancoch ani osobitné kategórie údajov podľa čl. 9 aplikácia nezbiera.',
        en: 'The legal basis is legitimate interest under Art. 6(1)(f) GDPR — specifically the user’s interest in offering their services to other businesses. We process only data the trader themselves published in a public register or on their own website, and only as much as an introduction requires. The app collects nothing about private life, nothing about employees, and no special categories of data under Art. 9.',
      },
      {
        cs: 'Podnikatele o zpracování jednotlivě neinformujeme. Čl. 14 odst. 5 písm. b) GDPR tuhle výjimku připouští, pokud by to znamenalo nepřiměřené úsilí — a rozeslat oznámení statisícům subjektů zapsaných v ARESu takové úsilí je. Místo toho je informace veřejně dostupná tady, jak tentýž článek vyžaduje. Pokud jste podnikatel a přejete si být z databáze odstraněn, napište na ' + OPERATOR.email + ' a údaje smažeme, aniž bychom zkoumali důvod.',
        sk: 'Podnikateľov o spracúvaní jednotlivo neinformujeme. Čl. 14 ods. 5 písm. b) GDPR túto výnimku pripúšťa, ak by to znamenalo neprimerané úsilie — a rozoslať oznámenie státisícom subjektov zapísaných v registri takým úsilím je. Namiesto toho je informácia verejne dostupná tu, ako ten istý článok vyžaduje. Ak ste podnikateľ a želáte si byť z databázy odstránený, napíšte na ' + OPERATOR.email + ' a údaje zmažeme bez skúmania dôvodu.',
        en: 'We do not notify each trader individually. Art. 14(5)(b) GDPR allows this where notification would involve disproportionate effort — and writing to the hundreds of thousands of subjects listed in the register is exactly that. Instead the information is publicly available here, as the same article requires. If you are a trader and want to be removed from the database, write to ' + OPERATOR.email + ' and we will delete the record without asking why.',
      },
    ],
  },
  {
    heading: { cs: 'Odkud data pocházejí', sk: 'Odkiaľ dáta pochádzajú', en: 'Where the data comes from' },
    body: [
      {
        cs: 'Aplikace nemá vlastní sběr dat v terénu. Všechno pochází z těchto veřejných zdrojů:',
        sk: 'Aplikácia nemá vlastný zber dát v teréne. Všetko pochádza z týchto verejných zdrojov:',
        en: 'The app collects nothing in the field. Everything comes from these public sources:',
      },
    ],
    bullets: [
      {
        cs: 'ARES a živnostenský rejstřík (Ministerstvo financí ČR) — název, IČO, sídlo, obor, datum vzniku.',
        sk: 'ARES a živnostenský register (Ministerstvo financií ČR) — názov, IČO, sídlo, odbor, dátum vzniku.',
        en: 'ARES and the trade register (Czech Ministry of Finance) — name, company number, registered address, trade, founding date.',
      },
      {
        cs: 'Registr plátců DPH (Finanční správa ČR) — plátcovství DPH a údaj o nespolehlivém plátci.',
        sk: 'Register platiteľov DPH (Finančná správa ČR) — platiteľstvo DPH a údaj o nespoľahlivom platiteľovi.',
        en: 'The VAT payer register (Czech Tax Office) — VAT registration and unreliable-payer status.',
      },
      {
        cs: 'OpenStreetMap prostřednictvím Overpass API — poloha a kontaktní údaje, které do mapy vložili její přispěvatelé. © přispěvatelé OpenStreetMap, licence ODbL.',
        sk: 'OpenStreetMap prostredníctvom Overpass API — poloha a kontaktné údaje, ktoré do mapy vložili jej prispievatelia. © prispievatelia OpenStreetMap, licencia ODbL.',
        en: 'OpenStreetMap via the Overpass API — location and contact details entered by its contributors. © OpenStreetMap contributors, ODbL licence.',
      },
      {
        cs: 'Veřejně dostupné webové stránky firmy, ze kterých aplikace čte kontakt uvedený na stránce. Respektujeme soubor robots.txt a stránky nenavštěvujeme častěji, než je nutné.',
        sk: 'Verejne dostupné webové stránky firmy, z ktorých aplikácia číta kontakt uvedený na stránke. Rešpektujeme súbor robots.txt a stránky nenavštevujeme častejšie, než je nutné.',
        en: 'The business’s own public website, from which the app reads the contact details shown on the page. We honour robots.txt and do not request pages more often than necessary.',
      },
    ],
  },
  {
    heading: { cs: 'Cookies', sk: 'Cookies', en: 'Cookies' },
    body: [
      {
        cs: 'Aplikace používá jedinou cookie: auth-token, která drží vaše přihlášení. Je technicky nezbytná pro službu, kterou jste si vyžádali, takže se na ni podle § 89 odst. 3 zákona č. 127/2005 Sb. souhlas nevyžaduje — proto vás aplikace neotravuje lištou. Odhlášením ji smažete.',
        sk: 'Aplikácia používa jedinú cookie: auth-token, ktorá drží vaše prihlásenie. Je technicky nevyhnutná pre službu, ktorú ste si vyžiadali, takže sa na ňu súhlas nevyžaduje — preto vás aplikácia neobťažuje lištou. Odhlásením ju zmažete.',
        en: 'The app uses exactly one cookie: auth-token, which keeps you signed in. It is strictly necessary for the service you asked for, so no consent is required — which is why there is no cookie banner. Signing out deletes it.',
      },
      {
        cs: 'Neprovozujeme žádnou analytiku, žádné reklamní ani sledovací skripty a nepředáváme nikomu údaje o vašem chování v aplikaci.',
        sk: 'Neprevádzkujeme žiadnu analytiku, žiadne reklamné ani sledovacie skripty a nikomu nepredávame údaje o vašom správaní v aplikácii.',
        en: 'We run no analytics, no advertising or tracking scripts, and we pass no behavioural data about you to anyone.',
      },
    ],
  },
  {
    heading: { cs: 'Kdo se k datům dostane', sk: 'Kto sa k dátam dostane', en: 'Who else touches the data' },
    body: [
      {
        cs: 'Údaje neprodáváme a nepředáváme je nikomu pro jeho vlastní účely. Ke zpracování využíváme dva poskytovatele infrastruktury, kteří jednají jako zpracovatelé podle našich pokynů:',
        sk: 'Údaje nepredávame a nepredávame ich nikomu na jeho vlastné účely. Na spracúvanie využívame dvoch poskytovateľov infraštruktúry, ktorí konajú ako sprostredkovatelia podľa našich pokynov:',
        en: 'We do not sell data and we do not hand it to anyone for their own purposes. Two infrastructure providers process it on our instructions:',
      },
    ],
    bullets: [
      {
        cs: 'Vercel Inc. — hosting aplikace.',
        sk: 'Vercel Inc. — hosting aplikácie.',
        en: 'Vercel Inc. — application hosting.',
      },
      {
        cs: 'Neon Inc. — provoz databáze.',
        sk: 'Neon Inc. — prevádzka databázy.',
        en: 'Neon Inc. — database hosting.',
      },
      {
        cs: 'Oba jsou americké společnosti. Přenos údajů mimo EU je krytý standardními smluvními doložkami Evropské komise, které jsou součástí jejich podmínek zpracování.',
        sk: 'Obaja sú americké spoločnosti. Prenos údajov mimo EÚ je krytý štandardnými zmluvnými doložkami Európskej komisie, ktoré sú súčasťou ich podmienok spracúvania.',
        en: 'Both are US companies. Transfers outside the EU rely on the European Commission’s standard contractual clauses, which form part of their data processing terms.',
      },
    ],
  },
  {
    heading: { cs: 'Jak dlouho data držíme', sk: 'Ako dlho dáta držíme', en: 'How long we keep data' },
    bullets: [
      {
        cs: 'Účet a profil: po dobu trvání účtu. Po jeho zrušení je mažeme do 30 dnů.',
        sk: 'Účet a profil: po dobu trvania účtu. Po jeho zrušení ich mažeme do 30 dní.',
        en: 'Account and profile: for as long as the account exists. Deleted within 30 days of closing it.',
      },
      {
        cs: 'Historie hledání a výsledky: po dobu trvání účtu, nebo dokud hledání sami nesmažete.',
        sk: 'História hľadaní a výsledky: po dobu trvania účtu, alebo kým hľadanie sami nezmažete.',
        en: 'Search history and results: for as long as the account exists, or until you delete the search yourself.',
      },
      {
        cs: 'Údaje o firmách jsou vázané na hledání, ze kterého vzešly — mažou se spolu s ním.',
        sk: 'Údaje o firmách sú viazané na hľadanie, z ktorého vzišli — mažú sa spolu s ním.',
        en: 'Business records belong to the search that produced them and are deleted along with it.',
      },
    ],
  },
  {
    heading: {
      cs: 'Automatizované vyhodnocování',
      sk: 'Automatizované vyhodnocovanie',
      en: 'Automated evaluation',
    },
    body: [
      {
        cs: 'Každé nalezené firmě aplikace spočítá skóre, které vyjadřuje jedinou věc: kolik z kritérií, jež jste si sami nastavili, ta firma podle veřejných dat splňuje. Nejde o hodnocení bonity, spolehlivosti ani čehokoli o dané firmě či člověku — a nemá to vůči nim žádný právní ani jiný podstatný účinek, takže nejde o automatizované rozhodování ve smyslu čl. 22 GDPR. Je to řazení výsledků, nic víc.',
        sk: 'Každej nájdenej firme aplikácia spočíta skóre, ktoré vyjadruje jedinú vec: koľko z kritérií, ktoré ste si sami nastavili, tá firma podľa verejných dát spĺňa. Nejde o hodnotenie bonity, spoľahlivosti ani čohokoľvek o danej firme či človeku — a nemá to voči nim žiadny právny ani iný podstatný účinok, takže nejde o automatizované rozhodovanie v zmysle čl. 22 GDPR. Je to zoraďovanie výsledkov, nič viac.',
        en: 'Each business found is given a score expressing one thing only: how many of the criteria you set yourself it meets according to public data. It is not an assessment of creditworthiness, reliability, or anything else about that business or person — and it has no legal or similarly significant effect on them, so it is not automated decision-making within the meaning of Art. 22 GDPR. It orders a list, nothing more.',
      },
    ],
  },
  {
    heading: { cs: 'Vaše práva', sk: 'Vaše práva', en: 'Your rights' },
    body: [
      {
        cs: 'Vůči svým údajům máte práva podle čl. 15 až 22 GDPR: na přístup, opravu, výmaz, omezení zpracování a přenositelnost. Protože část zpracování stojí na oprávněném zájmu, máte také právo vznést proti němu námitku podle čl. 21 — pak zpracování ukončíme, ledaže prokážeme závažné oprávněné důvody, které převažují nad vaším zájmem.',
        sk: 'Voči svojim údajom máte práva podľa čl. 15 až 22 GDPR: na prístup, opravu, výmaz, obmedzenie spracúvania a prenosnosť. Keďže časť spracúvania stojí na oprávnenom záujme, máte aj právo vzniesť proti nemu námietku podľa čl. 21 — potom spracúvanie ukončíme, ibaže preukážeme závažné oprávnené dôvody, ktoré prevažujú nad vaším záujmom.',
        en: 'You have the rights set out in Art. 15–22 GDPR: access, rectification, erasure, restriction and portability. Because part of the processing rests on legitimate interest, you may also object under Art. 21 — we will then stop, unless we can demonstrate compelling legitimate grounds that override your interest.',
      },
      {
        cs: `Žádost stačí poslat na ${OPERATOR.email}. Odpovíme do jednoho měsíce. Pokud s vyřízením nebudete spokojeni, můžete podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, uoou.gov.cz. Uživatelé ze Slovenska se mohou obrátit na Úrad na ochranu osobných údajov SR.`,
        sk: `Žiadosť stačí poslať na ${OPERATOR.email}. Odpovieme do jedného mesiaca. Ak s vybavením nebudete spokojní, môžete podať sťažnosť na Úrade na ochranu osobných údajov SR, Hraničná 12, 820 07 Bratislava, dataprotection.gov.sk. Používatelia z Česka sa môžu obrátiť na Úřad pro ochranu osobních údajů.`,
        en: `Send any request to ${OPERATOR.email}. We reply within one month. If you are not satisfied with how we handle it, you may lodge a complaint with the Czech Data Protection Authority (Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Prague 7, uoou.gov.cz) or with the supervisory authority in your country of residence.`,
      },
    ],
  },
  {
    heading: { cs: 'Zabezpečení', sk: 'Zabezpečenie', en: 'Security' },
    body: [
      {
        cs: 'Komunikace probíhá výhradně přes HTTPS. Hesla ukládáme jako otisk algoritmem bcrypt, takže je nedokážeme přečíst ani my. Přihlašovací token je uložen v cookie, ke které nemá přístup JavaScript v prohlížeči. Přístup k databázi má pouze aplikace a provozovatel.',
        sk: 'Komunikácia prebieha výhradne cez HTTPS. Heslá ukladáme ako odtlačok algoritmom bcrypt, takže ich nedokážeme prečítať ani my. Prihlasovací token je uložený v cookie, ku ktorej nemá prístup JavaScript v prehliadači. Prístup k databáze má iba aplikácia a prevádzkovateľ.',
        en: 'All traffic runs over HTTPS. Passwords are stored as bcrypt hashes, so not even we can read them. The session token lives in a cookie that browser JavaScript cannot reach. Only the application and the operator can access the database.',
      },
    ],
  },
  {
    heading: { cs: 'Změny tohoto dokumentu', sk: 'Zmeny tohto dokumentu', en: 'Changes to this document' },
    body: [
      {
        cs: 'Zásady se mohou měnit, typicky když přibude funkce nebo zpracovatel. Datum poslední úpravy je uvedeno nahoře. O podstatné změně dáme registrovaným uživatelům vědět e-mailem.',
        sk: 'Zásady sa môžu meniť, typicky keď pribudne funkcia alebo sprostredkovateľ. Dátum poslednej úpravy je uvedený hore. O podstatnej zmene dáme registrovaným používateľom vedieť e-mailom.',
        en: 'These terms may change, typically when a feature or a processor is added. The date of the last revision is shown at the top. We notify registered users by e-mail of any material change.',
      },
    ],
  },
];

export default function PrivacyPage({ params: { locale } }: { params: { locale: string } }) {
  return <LegalDocument title={M.title} intro={INTRO} blocks={BLOCKS} locale={locale} />;
}
