import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { localized } from '@/lib/lead-filters';
import { HOSTING, OPERATOR, type LegalBlock } from '@/lib/legal';

/**
 * Zásady ochrany osobních údajů.
 *
 * Verze z 11. 9. 2026 dohání, co se od minulé verze v aplikaci změnilo nebo co text neuváděl:
 *
 *  • **Platby.** Stripe, identifikátory předplatného v tabulce `User`, fronta nespárovaných
 *    plateb a přístup provozovatele do administrace Stripe. Předtím dokument platby nezmínil.
 *  • **Kde data leží.** Ověřeno na produkci, ne odhadnuto (viz `HOSTING` v lib/legal.ts):
 *    funkce Vercelu v iad1 (USA), databáze Neon v AWS eu-central-1 (Frankfurt). Dřívější text
 *    jmenoval „Neon Inc." — Neon mezitím koupil Databricks a smluvní strana je Neon, LLC.
 *    Předání do USA: Vercel standardní smluvní doložky, Neon a Stripe DPF i SCC.
 *  • **Cookies.** Tvrzení „jediná cookie" neplatilo: přepínač jazyka zapisuje `NEXT_LOCALE`
 *    a v úložišti prohlížeče leží kromě `kh_user` i `kh-hide-done` a `kh-chunk-reload`.
 *  • **Mapa a hlášení chyb.** Dlaždice stahuje prohlížeč přímo z OpenFreeMap a pád v prohlížeči
 *    se hlásí do logu Vercelu. Obojí je tok údajů, o kterém dokument mlčel.
 *  • **Ukázkové hledání.** Text sliboval smazání otisku IP „po 24 hodinách", ale úklid běží jen
 *    u zhruba každého dvacátého zápisu (lib/rate-limit.ts). Text teď říká, co se skutečně děje.
 *
 * Starší kola doplnila údaje o nalezených OSVČ (čl. 14 GDPR a výjimka podle odst. 5), právní
 * základ a dobu uchování u každého účelu a obrácenou roli u importu CSV (čl. 28).
 *
 * Právní texty napsal vývojář, ne advokát. Před větším spuštěním je nechte zkontrolovat.
 */

const M = {
  title: {
    cs: 'Ochrana osobních údajů',
    sk: 'Ochrana osobných údajov',
    en: 'Privacy Policy',
  },
  description: {
    cs: 'Jaké osobní údaje KlientHunter zpracovává, z jakého důvodu, kde, jak dlouho a jaká máte práva.',
    sk: 'Aké osobné údaje KlientHunter spracúva, z akého dôvodu, kde, ako dlho a aké máte práva.',
    en: 'What personal data KlientHunter processes, on what basis, where, for how long, and what your rights are.',
  },
};

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: `${localized(M.title, locale)} – KlientHunter`,
    description: localized(M.description, locale),
  };
}

/**
 * Lidský název regionu z `HOSTING`. Neznámý kód se vypíše tak, jak je — raději syrový kód než
 * vymyšlené město.
 */
const REGION_NAMES: Record<string, { cs: string; sk: string; en: string }> = {
  iad1: { cs: 've Washingtonu, D.C. (USA)', sk: 'vo Washingtone, D.C. (USA)', en: 'in Washington, D.C. (USA)' },
  fra1: { cs: 've Frankfurtu (Německo)', sk: 'vo Frankfurte (Nemecko)', en: 'in Frankfurt (Germany)' },
  'aws-eu-central-1': { cs: 've Frankfurtu (Německo)', sk: 'vo Frankfurte (Nemecko)', en: 'in Frankfurt (Germany)' },
};
const region = (code: string) =>
  REGION_NAMES[code] ?? { cs: `v regionu ${code}`, sk: `v regióne ${code}`, en: `in region ${code}` };
const FN = region(HOSTING.functionsRegion);
const DB = region(HOSTING.database.region);

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
        cs: `Správcem osobních údajů je ${OPERATOR.name}, IČO ${OPERATOR.ico}, se sídlem ${OPERATOR.address}, kontaktní e-mail ${OPERATOR.email}. Provozovatel nejmenoval pověřence pro ochranu osobních údajů — zpracování nedosahuje rozsahu, který by ho podle čl. 37 GDPR vyžadoval. S čímkoli ohledně svých údajů se obracejte na uvedený e-mail nebo písemně na adresu sídla.`,
        sk: `Prevádzkovateľom osobných údajov je ${OPERATOR.name}, IČO ${OPERATOR.ico}, so sídlom ${OPERATOR.address}, Česká republika, kontaktný e-mail ${OPERATOR.email}. Prevádzkovateľ nemenoval zodpovednú osobu — spracúvanie nedosahuje rozsah, ktorý by ju podľa čl. 37 GDPR vyžadoval. So všetkým ohľadom svojich údajov sa obracajte na uvedený e-mail alebo písomne na adresu sídla.`,
        en: `The data controller is ${OPERATOR.name}, company ID (IČO) ${OPERATOR.ico}, registered address ${OPERATOR.address}, Czech Republic, contact e-mail ${OPERATOR.email}. No data protection officer has been appointed — the processing does not reach the scale that would require one under Art. 37 GDPR. Please direct anything concerning your data to the e-mail above or in writing to the registered address.`,
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
        cs: 'Použijete-li při registraci kód pozvánky, evidujeme, který kód to byl a kdy jste ho použili, a případně datum, do kdy je přístup k účtu omezen. Právní základ: plnění smlouvy.',
        sk: 'Ak pri registrácii použijete kód pozvánky, evidujeme, ktorý kód to bol a kedy ste ho použili, a prípadne dátum, do kedy je prístup k účtu obmedzený. Právny základ: plnenie zmluvy.',
        en: 'If you register with an invite code, we record which code it was, when you used it and, where applicable, the date until which access to the account is limited. Legal basis: performance of a contract.',
      },
      {
        cs: 'Profil, který vyplníte při registraci: co nabízíte, komu a kde, a podle jakých kritérií chcete výsledky řadit. Právní základ: plnění smlouvy. Profil je nepovinný, onboarding jde přeskočit a kdykoli ho změníte nebo vymažete v nastavení.',
        sk: 'Profil, ktorý vyplníte pri registrácii: čo ponúkate, komu a kde, a podľa akých kritérií chcete výsledky zoraďovať. Právny základ: plnenie zmluvy. Profil je nepovinný, onboarding sa dá preskočiť a kedykoľvek ho zmeníte alebo vymažete v nastaveniach.',
        en: 'The profile you fill in at registration: what you offer, to whom and where, and which criteria should rank your results. Legal basis: performance of a contract. The profile is optional, onboarding can be skipped, and you can change or clear it at any time in settings.',
      },
      {
        cs: 'Historii hledání, nalezené firmy, vaše značky u firem (stav oslovení, případně s poznámkou) a uložené importy včetně názvu nahraného souboru. K hledání běžícímu na pozadí ukládáme i jeho průběh (stav, počty, případnou chybovou hlášku), aby mohlo navázat a vy jste viděli, co se děje. Právní základ: plnění smlouvy. Do poznámek prosím nepište o podnikatelích nic, co k obchodnímu oslovení nepotřebujete.',
        sk: 'Históriu hľadaní, nájdené firmy, vaše značky pri firmách (stav oslovenia, prípadne s poznámkou) a uložené importy vrátane názvu nahraného súboru. Pri hľadaní bežiacom na pozadí ukladáme aj jeho priebeh (stav, počty, prípadnú chybovú hlášku), aby mohlo nadviazať a vy ste videli, čo sa deje. Právny základ: plnenie zmluvy. Do poznámok prosím nepíšte o podnikateľoch nič, čo na obchodné oslovenie nepotrebujete.',
        en: 'Your search history, the businesses found, the tags you put on them (outreach status, optionally with a note) and stored imports including the uploaded file name. For searches running in the background we also store their progress (status, counts, any error message) so they can resume and you can see what is happening. Legal basis: performance of a contract. Please do not write anything about a trader in a note that you do not need for a business introduction.',
      },
    ],
  },
  {
    heading: { cs: 'Předplatné a platby', sk: 'Predplatné a platby', en: 'Subscriptions and payments' },
    body: [
      {
        cs: 'Když si objednáte placený tarif, platbu zpracovává Stripe. Údaje o platební kartě zadáváte přímo na platební stránce Stripe — my je nevidíme a neukládáme. K vašemu účtu evidujeme:',
        sk: 'Keď si objednáte platený tarif, platbu spracúva Stripe. Údaje o platobnej karte zadávate priamo na platobnej stránke Stripe — my ich nevidíme a neukladáme. K vášmu účtu evidujeme:',
        en: 'When you order a paid plan, the payment is processed by Stripe. You enter your card details directly on Stripe’s payment page — we never see or store them. For your account we record:',
      },
    ],
    bullets: [
      {
        cs: 'Identifikátor zákazníka, předplatného a ceny ve Stripe, stav předplatného (zkušební období, aktivní, neprošlá platba, zrušené) a konec zkušebního a zaplaceného období. Stripe k tomu od nás dostane váš e-mail, jméno a identifikátor účtu, aby platba patřila ke správnému účtu. Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR); bez těchto údajů předplatné uzavřít nejde.',
        sk: 'Identifikátor zákazníka, predplatného a ceny v Stripe, stav predplatného (skúšobné obdobie, aktívne, neprešlá platba, zrušené) a koniec skúšobného a zaplateného obdobia. Stripe k tomu od nás dostane váš e-mail, meno a identifikátor účtu, aby platba patrila k správnemu účtu. Právny základ: plnenie zmluvy (čl. 6 ods. 1 písm. b) GDPR); bez týchto údajov predplatné uzavrieť nejde.',
        en: 'Your Stripe customer, subscription and price identifiers, the subscription status (trial, active, payment failed, cancelled) and the end of the trial and of the paid period. Stripe receives your e-mail, name and account identifier from us so the payment is linked to the right account. Legal basis: performance of a contract (Art. 6(1)(b) GDPR); a subscription cannot be made without this data.',
      },
      {
        cs: 'Údaj o tom, že účet už předplatné měl, a identifikátor zákazníka ve Stripe držíme i po zrušení předplatného — jinak by šlo zkušební období získávat opakovaně. Právní základ: oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR).',
        sk: 'Údaj o tom, že účet už predplatné mal, a identifikátor zákazníka v Stripe držíme aj po zrušení predplatného — inak by sa dalo skúšobné obdobie získavať opakovane. Právny základ: oprávnený záujem (čl. 6 ods. 1 písm. f) GDPR).',
        en: 'We keep the fact that the account has had a subscription, and the Stripe customer identifier, after the subscription ends — otherwise the free trial could be claimed again and again. Legal basis: legitimate interest (Art. 6(1)(f) GDPR).',
      },
      {
        cs: 'Záznamy o platbách uchováváme, jak ukládají daňové předpisy. Právní základ: plnění právní povinnosti (čl. 6 odst. 1 písm. c) GDPR).',
        sk: 'Záznamy o platbách uchovávame, ako ukladajú daňové predpisy. Právny základ: plnenie zákonnej povinnosti (čl. 6 ods. 1 písm. c) GDPR).',
        en: 'Payment records are kept as tax law requires. Legal basis: compliance with a legal obligation (Art. 6(1)(c) GDPR).',
      },
      {
        cs: 'Platbu, kterou nejde přiřadit k žádnému účtu (například zaplacenou mimo aplikaci), zapíšeme s identifikátorem zákazníka ve Stripe a e-mailem do fronty k ručnímu spárování nebo vrácení peněz. Právní základ: plnění smlouvy a oprávněný zájem na vyřízení platby.',
        sk: 'Platbu, ktorú nejde priradiť k žiadnemu účtu (napríklad zaplatenú mimo aplikácie), zapíšeme s identifikátorom zákazníka v Stripe a e-mailom do frontu na ručné spárovanie alebo vrátenie peňazí. Právny základ: plnenie zmluvy a oprávnený záujem na vybavení platby.',
        en: 'A payment that cannot be matched to any account (for example one made outside the app) is recorded with the Stripe customer identifier and e-mail in a queue for manual matching or refund. Legal basis: performance of a contract and legitimate interest in settling the payment.',
      },
      {
        cs: 'Stripe Payments Europe, Ltd. je při zpracování plateb zčásti samostatným správcem — například při prevenci podvodů a plnění svých regulatorních povinností. Jak s údaji nakládá, popisují jeho zásady na stripe.com/privacy.',
        sk: 'Stripe Payments Europe, Ltd. je pri spracúvaní platieb sčasti samostatným prevádzkovateľom — napríklad pri prevencii podvodov a plnení svojich regulačných povinností. Ako s údajmi nakladá, opisujú jeho zásady na stripe.com/privacy.',
        en: 'Stripe Payments Europe, Ltd. acts partly as an independent controller when processing payments — for example for fraud prevention and its own regulatory duties. Its policy at stripe.com/privacy explains how it handles data.',
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
        cs: `Podnikatele o zpracování jednotlivě neinformujeme. Čl. 14 odst. 5 písm. b) GDPR tuhle výjimku připouští, pokud by to znamenalo nepřiměřené úsilí — a rozeslat oznámení statisícům subjektů zapsaných v ARESu takové úsilí je. Místo toho je informace veřejně dostupná tady, jak tentýž článek vyžaduje. Pokud jste podnikatel a přejete si být z databáze odstraněn, napište na ${OPERATOR.email} a údaje smažeme, aniž bychom zkoumali důvod.`,
        sk: `Podnikateľov o spracúvaní jednotlivo neinformujeme. Čl. 14 ods. 5 písm. b) GDPR túto výnimku pripúšťa, ak by to znamenalo neprimerané úsilie — a rozoslať oznámenie státisícom subjektov zapísaných v registri takým úsilím je. Namiesto toho je informácia verejne dostupná tu, ako ten istý článok vyžaduje. Ak ste podnikateľ a želáte si byť z databázy odstránený, napíšte na ${OPERATOR.email} a údaje zmažeme bez skúmania dôvodu.`,
        en: `We do not notify each trader individually. Art. 14(5)(b) GDPR allows this where notification would involve disproportionate effort — and writing to the hundreds of thousands of subjects listed in the register is exactly that. Instead the information is publicly available here, as the same article requires. If you are a trader and want to be removed from the database, write to ${OPERATOR.email} and we will delete the record without asking why.`,
      },
    ],
  },
  {
    heading: { cs: 'Odkud data pocházejí', sk: 'Odkiaľ dáta pochádzajú', en: 'Where the data comes from' },
    body: [
      {
        cs: 'Aplikace nemá vlastní sběr dat v terénu. Všechno pochází z těchto veřejných zdrojů. Dotazy do nich posílá náš server a obsahují název firmy, obor, obec nebo IČO — údaje o vašem účtu v nich nejsou.',
        sk: 'Aplikácia nemá vlastný zber dát v teréne. Všetko pochádza z týchto verejných zdrojov. Dopyty do nich posiela náš server a obsahujú názov firmy, odbor, obec alebo IČO — údaje o vašom účte v nich nie sú.',
        en: 'The app collects nothing in the field. Everything comes from these public sources. Our server sends the queries, which contain a business name, trade, municipality or company number — never details of your account.',
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
        cs: 'RÚIAN (Český úřad zeměměřický a katastrální) — souřadnice adresních míst, aby šly firmy ukázat na mapě.',
        sk: 'RÚIAN (Český úřad zeměměřický a katastrální) — súradnice adresných miest, aby sa dali firmy ukázať na mape.',
        en: 'RÚIAN (Czech Office for Surveying, Mapping and Cadastre) — coordinates of address points, so businesses can be shown on the map.',
      },
      {
        cs: 'Veřejně dostupné webové stránky firmy, ze kterých aplikace čte kontakt uvedený na stránce. Respektujeme soubor robots.txt a stránky nenavštěvujeme častěji, než je nutné.',
        sk: 'Verejne dostupné webové stránky firmy, z ktorých aplikácia číta kontakt uvedený na stránke. Rešpektujeme súbor robots.txt a stránky nenavštevujeme častejšie, než je nutné.',
        en: 'The business’s own public website, from which the app reads the contact details shown on the page. We honour robots.txt and do not request pages more often than necessary.',
      },
    ],
  },
  {
    heading: {
      cs: 'Seznam, který nahrajete sami',
      sk: 'Zoznam, ktorý nahráte sami',
      en: 'The list you upload yourself',
    },
    body: [
      {
        cs: 'Aplikace umí vzít seznam firem, který už máte, a projet ho stejným zpracováním jako výsledek hledání. Tady se role obracejí: ten seznam jste sestavili vy, ne my. Za to, že jste ho získali oprávněně a že smíte údaje v něm zpracovávat, odpovídáte vy jako správce; my ho zpracováváme výhradně podle vašeho pokynu, tedy v pozici zpracovatele podle čl. 28 GDPR. Podmínky tohoto zpracování jsou ve zpracovatelské doložce v Obchodních podmínkách.',
        sk: 'Aplikácia vie vziať zoznam firiem, ktorý už máte, a prejsť ho rovnakým spracovaním ako výsledok hľadania. Tu sa roly obracajú: ten zoznam ste zostavili vy, nie my. Za to, že ste ho získali oprávnene a že smiete údaje v ňom spracúvať, zodpovedáte vy ako prevádzkovateľ; my ho spracúvame výhradne podľa vášho pokynu, teda v pozícii sprostredkovateľa podľa čl. 28 GDPR. Podmienky tohto spracúvania sú v sprostredkovateľskej doložke v Obchodných podmienkach.',
        en: 'The app can take a list of businesses you already have and run it through the same processing as a search result. Here the roles reverse: you compiled that list, not us. You are the controller and you are responsible for having obtained it lawfully and for being allowed to process what is in it; we process it solely on your instruction, as a processor under Art. 28 GDPR. The terms of that processing are in the data processing clause of the Terms of Service.',
      },
      {
        cs: 'Z nahraného souboru čteme pouze sloupce, které sami přiřadíte: název, IČO, web, telefon, e-mail a adresu. Soubor se rozloží ve vašem prohlížeči a na server odejdou jen tyto sloupce a název souboru. Při doplnění se podle IČO ptáme ARES a registru plátců DPH a ověřujeme uvedené weby. Uložený import se chová jako každé jiné hledání: kdykoli ho smažete a spolu s ním zmizí i nahrané řádky. Nenahrávejte prosím údaje o spotřebitelích ani nic ze zvláštních kategorií podle čl. 9 GDPR — aplikace na to není určená.',
        sk: 'Z nahraného súboru čítame iba stĺpce, ktoré sami priradíte: názov, IČO, web, telefón, e-mail a adresu. Súbor sa rozloží vo vašom prehliadači a na server odídu len tieto stĺpce a názov súboru. Pri doplnení sa podľa IČO pýtame ARES a registra platiteľov DPH a overujeme uvedené weby. Uložený import sa správa ako každé iné hľadanie: kedykoľvek ho zmažete a spolu s ním zmiznú aj nahrané riadky. Nenahrávajte prosím údaje o spotrebiteľoch ani nič z osobitných kategórií podľa čl. 9 GDPR — aplikácia na to nie je určená.',
        en: 'From the uploaded file we read only the columns you map yourself: name, company number, website, phone, e-mail and address. The file is parsed in your browser and only those columns and the file name are sent to the server. To enrich the list we query ARES and the VAT register by company number and check the listed websites. A stored import behaves like any other search: delete it and the uploaded rows go with it. Please do not upload consumer data or anything in the special categories of Art. 9 GDPR — the app is not built for it.',
      },
    ],
  },
  {
    heading: {
      cs: 'Ukázkové hledání bez přihlášení',
      sk: 'Ukážkové hľadanie bez prihlásenia',
      en: 'The preview search without an account',
    },
    body: [
      {
        cs: 'Jedno hledání si můžete vyzkoušet i bez účtu. Aby to nešlo opakovat donekonečna — každé hledání se ptá veřejných rejstříků a stahuje stovky cizích stránek — potřebujeme rozeznat, že jde o stejného návštěvníka. Vaši IP adresu k tomu neukládáme: počítá se z ní otisk (SHA-256 se serverovou solí) a do databáze jde jen ten otisk. Počítají se jen záznamy z posledních 24 hodin; starší se už k ničemu nepoužívají a průběžně je mažeme. Zpátky na IP adresu se z otisku dostat nedá, protože sůl server nikdy neopouští.',
        sk: 'Jedno hľadanie si môžete vyskúšať aj bez účtu. Aby sa to nedalo opakovať donekonečna — každé hľadanie sa pýta verejných registrov a sťahuje stovky cudzích stránok — potrebujeme rozoznať, že ide o rovnakého návštevníka. Vašu IP adresu na to neukladáme: počíta sa z nej odtlačok (SHA-256 so serverovou soľou) a do databázy ide len ten odtlačok. Počítajú sa len záznamy z posledných 24 hodín; staršie sa už na nič nepoužívajú a priebežne ich mažeme. Späť na IP adresu sa z odtlačku dostať nedá, pretože soľ server nikdy neopúšťa.',
        en: 'You can try one search without an account. To stop that being repeated endlessly — every search queries public registers and fetches hundreds of third-party pages — we need to recognise the same visitor. We do not store your IP address for this: we derive a fingerprint from it (SHA-256 with a server-side salt) and store only the fingerprint. Only records from the last 24 hours count; older ones are no longer used for anything and are deleted as we go. The fingerprint cannot be turned back into an IP address, because the salt never leaves the server.',
      },
      {
        cs: 'I tak jde podle GDPR o osobní údaj — otisk je pseudonymizace, ne anonymizace — a proto je tady popsaný. Právním základem je oprávněný zájem na tom, aby služba nešla zneužít a aby nám veřejné zdroje dat kvůli přetížení nezablokovaly přístup (čl. 6 odst. 1 písm. f) GDPR). Stejný otisk používáme i na strop počtu účtů založených z jedné adresy. Samotné ukázkové hledání se do databáze neukládá.',
        sk: 'Aj tak ide podľa GDPR o osobný údaj — odtlačok je pseudonymizácia, nie anonymizácia — a preto je tu popísaný. Právnym základom je oprávnený záujem na tom, aby sa služba nedala zneužiť a aby nám verejné zdroje dát kvôli preťaženiu nezablokovali prístup (čl. 6 ods. 1 písm. f) GDPR). Rovnaký odtlačok používame aj na strop počtu účtov založených z jednej adresy. Samotné ukážkové hľadanie sa do databázy neukladá.',
        en: 'It is still personal data under the GDPR — a fingerprint is pseudonymisation, not anonymisation — which is why it is described here. The legal basis is our legitimate interest in keeping the service from being abused and in not getting blocked by the public data sources for overloading them (Art. 6(1)(f) GDPR). The same fingerprint caps how many accounts can be created from one address. The preview search itself is never stored in the database.',
      },
    ],
  },
  {
    heading: {
      cs: 'Cookies a úložiště prohlížeče',
      sk: 'Cookies a úložisko prehliadača',
      en: 'Cookies and browser storage',
    },
    body: [
      {
        cs: 'Všechno, co aplikace ve vašem prohlížeči ukládá, slouží jen fungování služby, o kterou jste sami požádali. Podle § 89 odst. 3 zákona č. 127/2005 Sb. se na to souhlas nevyžaduje — proto vás aplikace neotravuje lištou. Konkrétně:',
        sk: 'Všetko, čo aplikácia vo vašom prehliadači ukladá, slúži len na fungovanie služby, o ktorú ste sami požiadali, preto sa na to súhlas nevyžaduje a aplikácia vás neobťažuje lištou. Konkrétne:',
        en: 'Everything the app stores in your browser serves only the service you asked for, so no consent is required — which is why there is no cookie banner. Specifically:',
      },
    ],
    bullets: [
      {
        cs: 'Cookie auth-token drží vaše přihlášení. Platí 7 dní, JavaScript v prohlížeči k ní nemá přístup a odhlášením se smaže.',
        sk: 'Cookie auth-token drží vaše prihlásenie. Platí 7 dní, JavaScript v prehliadači k nej nemá prístup a odhlásením sa zmaže.',
        en: 'The auth-token cookie keeps you signed in. It lasts 7 days, browser JavaScript cannot read it, and signing out deletes it.',
      },
      {
        cs: 'Cookie NEXT_LOCALE si pamatuje jazyk, který jste zvolili v přepínači jazyků. Zapíše se jen kliknutím na přepínač a platí 1 rok.',
        sk: 'Cookie NEXT_LOCALE si pamätá jazyk, ktorý ste zvolili v prepínači jazykov. Zapíše sa len kliknutím na prepínač a platí 1 rok.',
        en: 'The NEXT_LOCALE cookie remembers the language you picked in the language switcher. It is written only when you click the switcher and lasts 1 year.',
      },
      {
        cs: 'Položka kh_user v local storage obsahuje identifikátor účtu, jméno, e-mail, tarif a příznak správce nebo VIP účtu, aby stránka po načtení hned věděla, koho má pozdravit. Je to místní kopie údajů, které už máme, nikam se neodesílá a odhlášením se maže.',
        sk: 'Položka kh_user v local storage obsahuje identifikátor účtu, meno, e-mail, tarif a príznak správcu alebo VIP účtu, aby stránka po načítaní hneď vedela, koho má pozdraviť. Je to miestna kópia údajov, ktoré už máme, nikam sa neodosiela a odhlásením sa maže.',
        en: 'The kh_user entry in local storage holds your account identifier, name, e-mail, plan and admin or VIP flag, so the page knows who to greet on load. It is a local copy of data we already hold, is never sent anywhere, and signing out clears it.',
      },
      {
        cs: 'Položka kh-hide-done v local storage si pamatuje, jestli na mapě skrývat vyřízené firmy. Obsahuje jen 1 nebo 0 a po odhlášení zůstává.',
        sk: 'Položka kh-hide-done v local storage si pamätá, či na mape skrývať vybavené firmy. Obsahuje len 1 alebo 0 a po odhlásení zostáva.',
        en: 'The kh-hide-done entry in local storage remembers whether to hide handled businesses on the map. It holds only 1 or 0 and stays after you sign out.',
      },
      {
        cs: 'Položka kh-chunk-reload v session storage drží čas posledního automatického obnovení stránky, když se po nasazení nové verze aplikace nepodaří načíst její část. Zmizí zavřením karty.',
        sk: 'Položka kh-chunk-reload v session storage drží čas posledného automatického obnovenia stránky, keď sa po nasadení novej verzie aplikácie nepodarí načítať jej časť. Zmizne zatvorením karty.',
        en: 'The kh-chunk-reload entry in session storage holds the time of the last automatic page reload after part of a newly deployed version failed to load. It disappears when you close the tab.',
      },
      {
        cs: 'Neprovozujeme žádnou analytiku ani reklamní nebo sledovací skripty. Platební stránka a zákaznický portál běží na doménách Stripe, které nastavují vlastní cookies podle zásad společnosti Stripe.',
        sk: 'Neprevádzkujeme žiadnu analytiku ani reklamné alebo sledovacie skripty. Platobná stránka a zákaznícky portál bežia na doménach Stripe, ktoré nastavujú vlastné cookies podľa zásad spoločnosti Stripe.',
        en: 'We run no analytics and no advertising or tracking scripts. The payment page and customer portal run on Stripe’s domains, which set their own cookies under Stripe’s policies.',
      },
    ],
  },
  {
    heading: { cs: 'Mapa a hlášení chyb', sk: 'Mapa a hlásenie chýb', en: 'The map and error reports' },
    body: [
      {
        cs: 'Mapa výsledků se načítá přímo z OpenFreeMap, kterou provozuje Hyperknot Software Kft. (Maďarsko). Při zobrazení mapy stahuje váš prohlížeč z jejich serverů mapové dlaždice, styl a písma, a ti se tak dozvědí vaši IP adresu, údaje, které prohlížeč běžně posílá, a oblast, kterou si prohlížíte. Údaje o firmách ani o vašem účtu se tam neposílají. Jak s údaji nakládají, popisují jejich zásady na openfreemap.org/privacy. Právní základ: oprávněný zájem na tom, aby šly výsledky ukázat na mapě.',
        sk: 'Mapa výsledkov sa načítava priamo z OpenFreeMap, ktorú prevádzkuje Hyperknot Software Kft. (Maďarsko). Pri zobrazení mapy sťahuje váš prehliadač z ich serverov mapové dlaždice, štýl a písma, a tí sa tak dozvedia vašu IP adresu, údaje, ktoré prehliadač bežne posiela, a oblasť, ktorú si prezeráte. Údaje o firmách ani o vašom účte sa tam neposielajú. Ako s údajmi nakladajú, opisujú ich zásady na openfreemap.org/privacy. Právny základ: oprávnený záujem na tom, aby sa dali výsledky ukázať na mape.',
        en: 'The results map loads directly from OpenFreeMap, operated by Hyperknot Software Kft. (Hungary). When the map is shown, your browser downloads map tiles, the style and fonts from their servers, which therefore learn your IP address, the details a browser normally sends, and the area you are viewing. No business data or account data is sent there. Their policy at openfreemap.org/privacy explains how they handle data. Legal basis: legitimate interest in showing results on a map.',
      },
      {
        cs: 'Když aplikace ve vašem prohlížeči spadne, odešle nám technické hlášení: text chyby a výpis míst v kódu, adresu stránky, jazyk a typ prohlížeče. Hlášení se neukládá do databáze, jen se zapíše do provozního logu u Vercelu (viz níže). Právní základ: oprávněný zájem na funkční službě.',
        sk: 'Keď aplikácia vo vašom prehliadači spadne, odošle nám technické hlásenie: text chyby a výpis miest v kóde, adresu stránky, jazyk a typ prehliadača. Hlásenie sa neukladá do databázy, len sa zapíše do prevádzkového logu vo Verceli (pozri nižšie). Právny základ: oprávnený záujem na funkčnej službe.',
        en: 'If the app crashes in your browser, it sends us a technical report: the error text and code locations, the page address, language and browser type. The report is not stored in the database; it is only written to the operational log at Vercel (see below). Legal basis: legitimate interest in a working service.',
      },
    ],
  },
  {
    heading: { cs: 'Kdo se k datům dostane a kde leží', sk: 'Kto sa k dátam dostane a kde sú uložené', en: 'Who else touches the data, and where it is' },
    body: [
      {
        cs: 'Údaje neprodáváme. Ke zpracování využíváme tyto poskytovatele; jako zpracovatelé jednají podle našich pokynů, pokud není uvedeno jinak:',
        sk: 'Údaje nepredávame. Na spracúvanie využívame týchto poskytovateľov; ako sprostredkovatelia konajú podľa našich pokynov, ak nie je uvedené inak:',
        en: 'We do not sell data. We use the following providers; they act as processors on our instructions unless stated otherwise:',
      },
    ],
    bullets: [
      {
        cs: `Vercel Inc. (USA) — provoz aplikace. Serverová část běží v datovém centru Vercelu ${FN.cs}, takže se tam zpracovává každý požadavek na aplikaci. Vercel vede provozní logy s IP adresou, časem a adresou požadavku a s hlášeními chyb; podle tarifu hostingu je drží nejvýše jeden den. Předání údajů do USA kryjí standardní smluvní doložky Evropské komise ve smlouvě o zpracování s Vercelem. Právní základ provozních logů: oprávněný zájem na bezpečném provozu.`,
        sk: `Vercel Inc. (USA) — prevádzka aplikácie. Serverová časť beží v dátovom centre Vercelu ${FN.sk}, takže sa tam spracúva každá požiadavka na aplikáciu. Vercel vedie prevádzkové logy s IP adresou, časom a adresou požiadavky a s hláseniami chýb; podľa tarifu hostingu ich drží najviac jeden deň. Prenos údajov do USA kryjú štandardné zmluvné doložky Európskej komisie v zmluve o spracúvaní s Vercelom. Právny základ prevádzkových logov: oprávnený záujem na bezpečnej prevádzke.`,
        en: `Vercel Inc. (USA) — application hosting. The server side runs in Vercel’s data centre ${FN.en}, so every request to the app is processed there. Vercel keeps operational logs with IP address, time and request path, together with error reports, for no more than one day depending on the hosting plan. Transfers to the USA rely on the European Commission’s standard contractual clauses in Vercel’s data processing agreement. Legal basis for operational logs: legitimate interest in secure operation.`,
      },
      {
        cs: `${HOSTING.database.provider}, LLC (skupina Databricks, USA) — databáze. Data jsou uložená v datovém centru AWS ${DB.cs}. Pokud se k nim poskytovatel dostane z USA, kryje předání jeho certifikace podle EU-U.S. Data Privacy Framework a standardní smluvní doložky.`,
        sk: `${HOSTING.database.provider}, LLC (skupina Databricks, USA) — databáza. Dáta sú uložené v dátovom centre AWS ${DB.sk}. Ak sa k nim poskytovateľ dostane z USA, kryje prenos jeho certifikácia podľa EU-U.S. Data Privacy Framework a štandardné zmluvné doložky.`,
        en: `${HOSTING.database.provider}, LLC (part of Databricks, USA) — database. The data is stored in an AWS data centre ${DB.en}. Any access by the provider from the USA is covered by its certification under the EU-U.S. Data Privacy Framework and by standard contractual clauses.`,
      },
      {
        cs: 'Stripe Payments Europe, Ltd. (Irsko) — platby a předplatné. Stripe předává část údajů společnosti Stripe, LLC v USA na základě EU-U.S. Data Privacy Framework a standardních smluvních doložek. Při prevenci podvodů a plnění svých regulatorních povinností je samostatným správcem.',
        sk: 'Stripe Payments Europe, Ltd. (Írsko) — platby a predplatné. Stripe prenáša časť údajov spoločnosti Stripe, LLC v USA na základe EU-U.S. Data Privacy Framework a štandardných zmluvných doložiek. Pri prevencii podvodov a plnení svojich regulačných povinností je samostatným prevádzkovateľom.',
        en: 'Stripe Payments Europe, Ltd. (Ireland) — payments and subscriptions. Stripe transfers some data to Stripe, LLC in the USA under the EU-U.S. Data Privacy Framework and standard contractual clauses. For fraud prevention and its own regulatory duties it is an independent controller.',
      },
      {
        cs: 'Hyperknot Software Kft. (Maďarsko) — mapové podklady OpenFreeMap, viz oddíl o mapě. Požadavky mu posílá přímo váš prohlížeč.',
        sk: 'Hyperknot Software Kft. (Maďarsko) — mapové podklady OpenFreeMap, pozri oddiel o mape. Požiadavky mu posiela priamo váš prehliadač.',
        en: 'Hyperknot Software Kft. (Hungary) — OpenFreeMap map tiles, see the section on the map. Your browser sends it requests directly.',
      },
      {
        cs: 'Kromě nich se k údajům dostane provozovatel — tedy člověk, ne jen aplikace. Správcovská část webu ukazuje seznam účtů se jménem, e-mailem, tarifem, datem registrace, omezením přístupu a počtem hledání a umožňuje účet zablokovat nebo mu přidělit VIP či správcovská práva; obsah vašich hledání se v ní nezobrazuje. Do administrace Stripe se provozovatel dívá kvůli vyřizování plateb, reklamací a vracení peněz a vidí tam jméno, e-mail, typ a poslední čtyři číslice karty a historii plateb. Do databáze samotné se dostane, když je potřeba opravit chybu nebo vyřídit vaši žádost. Právní základ: oprávněný zájem na správě a bezpečnosti služby.',
        sk: 'Okrem nich sa k údajom dostane prevádzkovateľ — teda človek, nielen aplikácia. Správcovská časť webu ukazuje zoznam účtov s menom, e-mailom, tarifom, dátumom registrácie, obmedzením prístupu a počtom hľadaní a umožňuje účet zablokovať alebo mu prideliť VIP či správcovské práva; obsah vašich hľadaní sa v nej nezobrazuje. Do administrácie Stripe sa prevádzkovateľ pozerá kvôli vybavovaniu platieb, reklamácií a vracaniu peňazí a vidí tam meno, e-mail, typ a posledné štyri číslice karty a históriu platieb. Do databázy samotnej sa dostane, keď je potrebné opraviť chybu alebo vybaviť vašu žiadosť. Právny základ: oprávnený záujem na správe a bezpečnosti služby.',
        en: 'Beyond them, the operator — a person, not just the application — can reach the data. The admin area lists accounts with name, e-mail, plan, registration date, access limit and search count, and allows an account to be blocked or given VIP or admin rights; the contents of your searches are not shown there. The operator uses the Stripe dashboard to handle payments, complaints and refunds, and sees there your name, e-mail, card brand and last four digits, and payment history. The operator reaches the database itself when a fault has to be fixed or a request of yours handled. Legal basis: legitimate interest in administering and securing the service.',
      },
    ],
  },
  {
    heading: { cs: 'Jak dlouho data držíme', sk: 'Ako dlho dáta držíme', en: 'How long we keep data' },
    bullets: [
      {
        cs: `Účet, profil, hledání, značky a importy: po dobu existence účtu. Hledání i import můžete kdykoli smazat sami; smazání celého účtu si vyžádáte na ${OPERATOR.email} a provedeme ho do 30 dnů.`,
        sk: `Účet, profil, hľadania, značky a importy: po dobu existencie účtu. Hľadanie aj import môžete kedykoľvek zmazať sami; zmazanie celého účtu si vyžiadate na ${OPERATOR.email} a vykonáme ho do 30 dní.`,
        en: `Account, profile, searches, tags and imports: for as long as the account exists. You can delete a search or an import yourself at any time; to have the whole account deleted, write to ${OPERATOR.email} and we do so within 30 days.`,
      },
      {
        cs: 'Údaje o firmách jsou vázané na hledání, ze kterého vzešly — mažou se spolu s ním.',
        sk: 'Údaje o firmách sú viazané na hľadanie, z ktorého vzišli — mažú sa spolu s ním.',
        en: 'Business records belong to the search that produced them and are deleted along with it.',
      },
      {
        cs: 'Údaje o předplatném: identifikátor předplatného a ceny a data období mažeme, jakmile předplatné skončí. Identifikátor zákazníka ve Stripe a údaj, že účet předplatné měl, zůstávají po dobu existence účtu.',
        sk: 'Údaje o predplatnom: identifikátor predplatného a ceny a dátumy obdobia mažeme, len čo predplatné skončí. Identifikátor zákazníka v Stripe a údaj, že účet predplatné mal, zostávajú po dobu existencie účtu.',
        en: 'Subscription data: the subscription and price identifiers and period dates are deleted as soon as the subscription ends. The Stripe customer identifier and the fact that the account had a subscription remain for as long as the account exists.',
      },
      {
        cs: 'Záznamy o platbách a nespárované platby: po dobu, kterou ukládají daňové předpisy, zpravidla do uplynutí lhůty pro stanovení daně.',
        sk: 'Záznamy o platbách a nespárované platby: po dobu, ktorú ukladajú daňové predpisy, spravidla do uplynutia lehoty na vyrubenie dane.',
        en: 'Payment records and unmatched payments: for as long as tax law requires, usually until the tax assessment period expires.',
      },
      {
        cs: 'Otisk IP adresy z ukázkového hledání a registrace: používá se 24 hodin, starší záznamy průběžně mažeme.',
        sk: 'Odtlačok IP adresy z ukážkového hľadania a registrácie: používa sa 24 hodín, staršie záznamy priebežne mažeme.',
        en: 'IP fingerprint from the preview search and registration: used for 24 hours; older records are deleted as we go.',
      },
      {
        cs: 'Provozní logy a hlášení chyb u Vercelu: podle tarifu hostingu nejvýše jeden den.',
        sk: 'Prevádzkové logy a hlásenia chýb vo Verceli: podľa tarifu hostingu najviac jeden deň.',
        en: 'Operational logs and error reports at Vercel: no more than one day, depending on the hosting plan.',
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
        cs: 'U nalezených firem aplikace počítá skóre z kritérií, která jste si sami nastavili, a ukazuje, jak snadno se dají oslovit podle nalezených veřejných kontaktů. Nejde o hodnocení bonity, spolehlivosti ani čehokoli jiného o dané firmě či člověku — a nemá to vůči nim žádný právní ani jiný podstatný účinek, takže nejde o automatizované rozhodování ve smyslu čl. 22 GDPR. Je to řazení výsledků, nic víc.',
        sk: 'Pri nájdených firmách aplikácia počíta skóre z kritérií, ktoré ste si sami nastavili, a ukazuje, ako ľahko sa dajú osloviť podľa nájdených verejných kontaktov. Nejde o hodnotenie bonity, spoľahlivosti ani čohokoľvek iného o danej firme či človeku — a nemá to voči nim žiadny právny ani iný podstatný účinok, takže nejde o automatizované rozhodovanie v zmysle čl. 22 GDPR. Je to zoraďovanie výsledkov, nič viac.',
        en: 'For each business found, the app computes a score from the criteria you set yourself and shows how easy it is to reach based on the public contacts found. It is not an assessment of creditworthiness, reliability, or anything else about that business or person — and it has no legal or similarly significant effect on them, so it is not automated decision-making within the meaning of Art. 22 GDPR. It orders a list, nothing more.',
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
        cs: `Žádost pošlete na ${OPERATOR.email} nebo písemně na adresu sídla. Odpovíme do jednoho měsíce. Pokud s vyřízením nebudete spokojeni, můžete podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, uoou.gov.cz. Uživatelé ze Slovenska se mohou obrátit na Úrad na ochranu osobných údajov SR.`,
        sk: `Žiadosť pošlite na ${OPERATOR.email} alebo písomne na adresu sídla. Odpovieme do jedného mesiaca. Ak s vybavením nebudete spokojní, môžete podať sťažnosť na Úrade na ochranu osobných údajov SR, Hraničná 12, 820 07 Bratislava, dataprotection.gov.sk. Používatelia z Česka sa môžu obrátiť na Úřad pro ochranu osobních údajů.`,
        en: `Send any request to ${OPERATOR.email} or in writing to the registered address. We reply within one month. If you are not satisfied with how we handle it, you may lodge a complaint with the Czech Data Protection Authority (Úřad pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Prague 7, uoou.gov.cz) or with the supervisory authority in your country of residence.`,
      },
    ],
  },
  {
    heading: { cs: 'Zabezpečení', sk: 'Zabezpečenie', en: 'Security' },
    body: [
      {
        cs: 'Komunikace probíhá výhradně přes HTTPS. Hesla ukládáme jako otisk algoritmem bcrypt, takže je nedokážeme přečíst ani my. Přihlašovací token je uložen v cookie, ke které nemá přístup JavaScript v prohlížeči. K databázi má přístup aplikace a provozovatel; poskytovatel databáze jen v rozsahu, který potřebuje k jejímu provozu.',
        sk: 'Komunikácia prebieha výhradne cez HTTPS. Heslá ukladáme ako odtlačok algoritmom bcrypt, takže ich nedokážeme prečítať ani my. Prihlasovací token je uložený v cookie, ku ktorej nemá prístup JavaScript v prehliadači. K databáze má prístup aplikácia a prevádzkovateľ; poskytovateľ databázy len v rozsahu, ktorý potrebuje na jej prevádzku.',
        en: 'All traffic runs over HTTPS. Passwords are stored as bcrypt hashes, so not even we can read them. The session token lives in a cookie that browser JavaScript cannot reach. The database is accessed by the application and the operator; the database provider only as far as running it requires.',
      },
    ],
  },
  {
    heading: { cs: 'Změny tohoto dokumentu', sk: 'Zmeny tohto dokumentu', en: 'Changes to this document' },
    body: [
      {
        cs: 'Zásady se mohou měnit, typicky když přibude funkce nebo poskytovatel. Datum poslední úpravy je uvedeno nahoře. O podstatné změně vás informujeme e-mailem nebo oznámením v aplikaci.',
        sk: 'Zásady sa môžu meniť, typicky keď pribudne funkcia alebo poskytovateľ. Dátum poslednej úpravy je uvedený hore. O podstatnej zmene vás informujeme e-mailom alebo oznámením v aplikácii.',
        en: 'This policy may change, typically when a feature or a provider is added. The date of the last revision is shown at the top. We tell you about any material change by e-mail or by a notice in the app.',
      },
    ],
  },
];

export default function PrivacyPage({ params: { locale } }: { params: { locale: string } }) {
  return <LegalDocument title={M.title} intro={INTRO} blocks={BLOCKS} locale={locale} />;
}
