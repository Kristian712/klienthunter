import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { localized } from '@/lib/lead-filters';
import { OPERATOR, type LegalBlock } from '@/lib/legal';
import { PLAN_LIMITS, PLAN_PRICES_CZK, TRIAL_DAYS } from '@/lib/plans';

/**
 * Obchodní podmínky.
 *
 * Verze z 11. 9. 2026 je přepsaná kvůli placeným tarifům. Předchozí text tvrdil, že v aplikaci
 * není platební brána, ceny jsou jen „orientační výhled" a registrace je na pozvánku — nic
 * z toho už neplatilo. Nově podmínky popisují, jak skutečně funguje Stripe Checkout, zkušební
 * období, zrušení ke konci zaplaceného období a co z toho plyne pro spotřebitele: odstoupení
 * do 14 dnů s poměrnou platbou (§ 1834a obč. zák.), vzorový formulář, reklamace a ČOI jako
 * subjekt ADR. Odkaz na evropskou platformu ODR tu schválně není — platforma skončila
 * 20. 7. 2025 a odkaz na ni by byl zavádějící.
 *
 * Čísla (ceny, limity, délka zkušebního období) se berou z `lib/plans.ts`, ze stejného místa
 * jako ceník a API. Podmínky tak nemůžou slibovat něco jiného, než co aplikace vynucuje.
 *
 * Oddíly o oslovování, exportu a nahraném seznamu zůstaly z dřívějších kol: uživatel, který
 * z vyexportovaných kontaktů rozesílá obchodní e-maily, je podle § 7 zákona č. 480/2004 Sb.
 * šiřitel obchodního sdělení a pro exportovaná data samostatný správce. U nahraného seznamu
 * je naopak správcem on a provozovatel zpracovatelem — proto zpracovatelská doložka podle
 * čl. 28 GDPR.
 *
 * Právní texty napsal vývojář, ne advokát. Před větším spuštěním je nechte zkontrolovat.
 */

const M = {
  title: { cs: 'Obchodní podmínky', sk: 'Obchodné podmienky', en: 'Terms of Service' },
  description: {
    cs: 'Podmínky používání KlientHunteru: tarify a platby, zkušební období, zrušení, odstoupení od smlouvy, reklamace a odpovědnost za oslovování firem.',
    sk: 'Podmienky používania KlientHunteru: tarify a platby, skúšobné obdobie, zrušenie, odstúpenie od zmluvy, reklamácie a zodpovednosť za oslovovanie firiem.',
    en: 'Terms for using KlientHunter: plans and payments, free trial, cancellation, withdrawal, complaints, and responsibility for outreach.',
  },
};

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: `${localized(M.title, locale)} – KlientHunter`,
    description: localized(M.description, locale),
  };
}

// ── Čísla z jednoho místa ───────────────────────────────────────────────────
const kc = (n: number) => `${n.toLocaleString('cs-CZ')} Kč`;
const czk = (n: number) => `CZK ${n.toLocaleString('en-GB')}`;
const PRO = PLAN_PRICES_CZK.PRO;
const BIZ = PLAN_PRICES_CZK.BUSINESS;
const L = PLAN_LIMITS;
const D = TRIAL_DAYS;

const INTRO = {
  cs: 'Tyto obchodní podmínky upravují používání KlientHunteru — bezplatného účtu i placeného předplatného. Založením účtu s nimi souhlasíte; objednáním předplatného se stávají součástí smlouvy o předplatném. Ustanovení, která platí jen pro spotřebitele, jsou tak výslovně označena.',
  sk: 'Tieto obchodné podmienky upravujú používanie KlientHunteru — bezplatného účtu aj plateného predplatného. Založením účtu s nimi súhlasíte; objednaním predplatného sa stávajú súčasťou zmluvy o predplatnom. Ustanovenia, ktoré platia len pre spotrebiteľov, sú tak výslovne označené.',
  en: 'These terms govern the use of KlientHunter — both the free account and the paid subscription. By creating an account you accept them; by ordering a subscription they become part of the subscription contract. Provisions that apply to consumers only are marked as such.',
};

const BLOCKS: LegalBlock[] = [
  {
    heading: { cs: 'Provozovatel', sk: 'Prevádzkovateľ', en: 'Operator' },
    body: [
      {
        cs: `Službu KlientHunter provozuje ${OPERATOR.name}, IČO ${OPERATOR.ico}, se sídlem ${OPERATOR.address}, fyzická osoba podnikající na základě živnostenského oprávnění, zapsaná v živnostenském rejstříku. Provozovatel není plátcem DPH. Kontaktní e-mail: ${OPERATOR.email}; písemnosti lze posílat i na adresu sídla.`,
        sk: `Službu KlientHunter prevádzkuje ${OPERATOR.name}, IČO ${OPERATOR.ico}, so sídlom ${OPERATOR.address}, Česká republika, fyzická osoba podnikajúca na základe živnostenského oprávnenia, zapísaná v českom živnostenskom registri. Prevádzkovateľ nie je platiteľom DPH. Kontaktný e-mail: ${OPERATOR.email}; písomnosti možno posielať aj na adresu sídla.`,
        en: `KlientHunter is operated by ${OPERATOR.name}, company ID (IČO) ${OPERATOR.ico}, registered address ${OPERATOR.address}, Czech Republic, a sole trader registered in the Czech Trade Register. The operator is not registered for VAT. Contact e-mail: ${OPERATOR.email}; letters may also be sent to the registered address.`,
      },
    ],
  },
  {
    heading: { cs: 'Spotřebitel a podnikatel', sk: 'Spotrebiteľ a podnikateľ', en: 'Consumers and businesses' },
    body: [
      {
        cs: 'Spotřebitelem je každý člověk, který službu nepoužívá v rámci své podnikatelské činnosti ani samostatného výkonu povolání (§ 419 občanského zákoníku). Službu si mohou objednat spotřebitelé i podnikatelé. Nic v těchto podmínkách neomezuje práva, která spotřebiteli dává zákon.',
        sk: 'Spotrebiteľom je každý človek, ktorý službu nepoužíva v rámci svojej podnikateľskej činnosti ani samostatného výkonu povolania (§ 419 českého Občianskeho zákonníka). Službu si môžu objednať spotrebitelia aj podnikatelia. Nič v týchto podmienkach neobmedzuje práva, ktoré spotrebiteľovi dáva zákon.',
        en: 'A consumer is any individual who does not use the service in the course of their business or profession (Section 419 of the Czech Civil Code). Both consumers and businesses may order the service. Nothing in these terms limits the rights that the law gives consumers.',
      },
    ],
  },
  {
    heading: { cs: 'Co služba dělá', sk: 'Čo služba robí', en: 'What the service does' },
    body: [
      {
        cs: 'KlientHunter vyhledává firmy ve veřejných rejstřících a mapách, dohledává jejich weby a veřejně uvedené kontakty, řadí je podle kritérií, která si nastavíte, a umožňuje výsledky exportovat. Samotné oslovení firem je na vás — službou žádná zpráva neodchází.',
        sk: 'KlientHunter vyhľadáva firmy vo verejných registroch a mapách, dohľadáva ich weby a verejne uvedené kontakty, zoraďuje ich podľa kritérií, ktoré si nastavíte, a umožňuje výsledky exportovať. Samotné oslovenie firiem je na vás — službou žiadna správa neodchádza.',
        en: 'KlientHunter searches public registers and maps, looks up businesses’ websites and publicly listed contacts, ranks the results by criteria you choose, and lets you export them. Approaching the businesses is up to you — the service sends no messages.',
      },
      {
        cs: 'Službu nelze používat k žádnému účelu, který zákon zakazuje, ani k obtěžování nalezených firem nebo osob. Zakázané je zejména rozesílání nevyžádaných sdělení v rozporu se zákonem, podvodné jednání, získávání údajů pro jejich další prodej a jakýkoli pokus službu automatizovaně vytěžit nad rámec běžného používání.',
        sk: 'Službu nemožno používať na žiadny účel, ktorý zákon zakazuje, ani na obťažovanie nájdených firiem alebo osôb. Zakázané je najmä rozosielanie nevyžiadaných oznámení v rozpore so zákonom, podvodné konanie, získavanie údajov na ich ďalší predaj a akýkoľvek pokus službu automatizovane vyťažiť nad rámec bežného používania.',
        en: 'The service may not be used for any unlawful purpose, nor to harass the businesses or people it finds. Prohibited in particular: sending unsolicited messages contrary to law, fraud, harvesting data for resale, and any attempt to scrape the service beyond ordinary use.',
      },
    ],
  },
  {
    heading: { cs: 'Účet a přístup', sk: 'Účet a prístup', en: 'Account and access' },
    body: [
      {
        cs: 'Registrace je otevřená, stačí k ní e-mail a heslo. Kód pozvánky je nepovinný; může účtu nastavit časově omezený přístup, po jehož uplynutí se do účtu nelze přihlásit. Za bezpečnost hesla odpovídáte vy a účet nesmíte sdílet s dalšími osobami.',
        sk: 'Registrácia je otvorená, stačí na ňu e-mail a heslo. Kód pozvánky je nepovinný; môže účtu nastaviť časovo obmedzený prístup, po ktorého uplynutí sa do účtu nedá prihlásiť. Za bezpečnosť hesla zodpovedáte vy a účet nesmiete zdieľať s ďalšími osobami.',
        en: 'Registration is open; an e-mail address and a password are all you need. An invite code is optional; it may give the account time-limited access, after which the account can no longer be signed into. You are responsible for keeping your password safe and must not share the account.',
      },
      {
        cs: 'Provozovatel může účet zablokovat nebo zrušit, pokud závažně porušíte tyto podmínky, zejména pravidla o zakázaném používání. Předem vás vyzve k nápravě, ledaže porušení nápravu nesnese (například podvod nebo útok na službu). Běží-li placené předplatné, ukončí ho zároveň. Při zrušení účtu pro porušení podmínek se za běžící období nic nevrací; při zrušení z jiného důvodu vrátíme poměrnou část ceny za nevyužité dny.',
        sk: 'Prevádzkovateľ môže účet zablokovať alebo zrušiť, ak závažne porušíte tieto podmienky, najmä pravidlá o zakázanom používaní. Vopred vás vyzve na nápravu, ibaže porušenie nápravu neznesie (napríklad podvod alebo útok na službu). Ak beží platené predplatné, ukončí ho zároveň. Pri zrušení účtu pre porušenie podmienok sa za bežiace obdobie nič nevracia; pri zrušení z iného dôvodu vrátime pomernú časť ceny za nevyužité dni.',
        en: 'The operator may block or close an account for a serious breach of these terms, in particular the rules on prohibited use. You will first be asked to remedy the breach unless it cannot be remedied (for example fraud or an attack on the service). Any running paid subscription ends at the same time. If the account is closed for a breach, nothing is refunded for the current period; if it is closed for any other reason, we refund the proportional price of the unused days.',
      },
    ],
  },
  {
    heading: { cs: 'Tarify a limity', sk: 'Tarify a limity', en: 'Plans and limits' },
    body: [
      {
        cs: 'Aktuální tarify jsou na stránce Ceník. Ke dni vydání těchto podmínek platí níže uvedené. Počet hledání se počítá za posledních 30 dní (plovoucí okno), ne za kalendářní měsíc. Počet firem na hledání je strop, ne slib — kolik jich hledání najde, závisí na tom, co o oboru a místě obsahují veřejné zdroje.',
        sk: 'Aktuálne tarify sú na stránke Cenník. Ku dňu vydania týchto podmienok platí nižšie uvedené. Počet hľadaní sa počíta za posledných 30 dní (kĺzavé okno), nie za kalendárny mesiac. Počet firiem na hľadanie je strop, nie sľub — koľko ich hľadanie nájde, závisí od toho, čo o odbore a mieste obsahujú verejné zdroje.',
        en: 'Current plans are listed on the Pricing page. As of the date of these terms the following applies. Searches are counted over the last 30 days (a rolling window), not per calendar month. The number of businesses per search is a ceiling, not a promise — how many a search finds depends on what public sources hold for that trade and place.',
      },
    ],
    bullets: [
      {
        cs: `Zdarma: ${L.FREE.searches} hledání za 30 dní, až ${L.FREE.resultsPerSearch} firem v jednom hledání, export do CSV.`,
        sk: `Zdarma: ${L.FREE.searches} hľadaní za 30 dní, až ${L.FREE.resultsPerSearch} firiem v jednom hľadaní, export do CSV.`,
        en: `Free: ${L.FREE.searches} searches per 30 days, up to ${L.FREE.resultsPerSearch} businesses per search, CSV export.`,
      },
      {
        cs: `Pro — ${kc(PRO)} měsíčně: ${L.PRO.searches} hledání za 30 dní, až ${L.PRO.resultsPerSearch} firem v jednom hledání, export do CSV i Excelu.`,
        sk: `Pro — ${kc(PRO)} mesačne: ${L.PRO.searches} hľadaní za 30 dní, až ${L.PRO.resultsPerSearch} firiem v jednom hľadaní, export do CSV aj Excelu.`,
        en: `Pro — ${czk(PRO)} per month: ${L.PRO.searches} searches per 30 days, up to ${L.PRO.resultsPerSearch} businesses per search, CSV and Excel export.`,
      },
      {
        cs: `Business — ${kc(BIZ)} měsíčně: hledání bez omezení počtu, až ${L.BUSINESS.resultsPerSearch} firem v jednom hledání, export do CSV i Excelu.`,
        sk: `Business — ${kc(BIZ)} mesačne: hľadanie bez obmedzenia počtu, až ${L.BUSINESS.resultsPerSearch} firiem v jednom hľadaní, export do CSV aj Excelu.`,
        en: `Business — ${czk(BIZ)} per month: unlimited searches, up to ${L.BUSINESS.resultsPerSearch} businesses per search, CSV and Excel export.`,
      },
    ],
  },
  {
    heading: { cs: 'Jak vzniká smlouva o předplatném', sk: 'Ako vzniká zmluva o predplatnom', en: 'How the subscription contract is made' },
    body: [
      {
        cs: 'Založením účtu vzniká smlouva o bezplatném užívání služby v tarifu Zdarma. Smlouva o předplatném tarifu Pro nebo Business je samostatná a uzavírá se takto:',
        sk: 'Založením účtu vzniká zmluva o bezplatnom užívaní služby v tarife Zdarma. Zmluva o predplatnom tarifu Pro alebo Business je samostatná a uzatvára sa takto:',
        en: 'Creating an account makes a contract for free use of the service on the Free plan. A subscription to the Pro or Business plan is a separate contract, made as follows:',
      },
    ],
    bullets: [
      {
        cs: 'Na stránce Ceník zvolíte tarif a kliknete na tlačítko u něj.',
        sk: 'Na stránke Cenník zvolíte tarif a kliknete na tlačidlo pri ňom.',
        en: 'On the Pricing page you choose a plan and click its button.',
      },
      {
        cs: 'Přesměrujeme vás na zabezpečenou platební stránku Stripe. Uvidíte na ní cenu, případné zkušební období a datum první platby a zadáte platební údaje. Dokud objednávku nepotvrdíte, můžete údaje opravit nebo se vrátit zpět na ceník.',
        sk: 'Presmerujeme vás na zabezpečenú platobnú stránku Stripe. Uvidíte na nej cenu, prípadné skúšobné obdobie a dátum prvej platby a zadáte platobné údaje. Kým objednávku nepotvrdíte, môžete údaje opraviť alebo sa vrátiť späť na cenník.',
        en: 'You are taken to Stripe’s secure payment page, which shows the price, any free trial and the date of the first charge, and where you enter your payment details. Until you confirm the order you can correct your details or go back to the Pricing page.',
      },
      {
        cs: 'Potvrzením objednávky na platební stránce je smlouva uzavřena. Pak se vrátíte do aplikace a tarif se během několika okamžiků aktivuje.',
        sk: 'Potvrdením objednávky na platobnej stránke je zmluva uzavretá. Potom sa vrátite do aplikácie a tarif sa v priebehu niekoľkých okamihov aktivuje.',
        en: 'The contract is made when you confirm the order on the payment page. You then return to the app and the plan activates within moments.',
      },
      {
        cs: 'Objednáním výslovně žádáte, aby vám byl tarif zpřístupněn ihned, ještě před uplynutím lhůty pro odstoupení od smlouvy.',
        sk: 'Objednaním výslovne žiadate, aby vám bol tarif sprístupnený ihneď, ešte pred uplynutím lehoty na odstúpenie od zmluvy.',
        en: 'By ordering you expressly ask for the plan to be made available immediately, before the withdrawal period has ended.',
      },
      {
        cs: 'Smlouvu lze uzavřít v češtině, slovenštině nebo angličtině. Tvoří ji tyto podmínky ve znění platném v den objednávky spolu s údaji z platební stránky. Znění podmínek archivujeme a na požádání vám ho pošleme e-mailem.',
        sk: 'Zmluvu možno uzavrieť v češtine, slovenčine alebo angličtine. Tvoria ju tieto podmienky v znení platnom v deň objednávky spolu s údajmi z platobnej stránky. Znenie podmienok archivujeme a na požiadanie vám ho pošleme e-mailom.',
        en: 'The contract can be made in Czech, Slovak or English. It consists of these terms as in force on the day of the order together with the details shown on the payment page. We archive each version of the terms and will e-mail it to you on request.',
      },
    ],
  },
  {
    heading: { cs: 'Cena a platby', sk: 'Cena a platby', en: 'Price and payment' },
    bullets: [
      {
        cs: 'Ceny jsou v českých korunách a jsou konečné — provozovatel není plátcem DPH, takže se k nim nic nepřičítá. V korunách se účtuje i ve slovenské a anglické verzi.',
        sk: 'Ceny sú v českých korunách a sú konečné — prevádzkovateľ nie je platiteľom DPH, takže sa k nim nič nepripočítava. V korunách sa účtuje aj v slovenskej a anglickej verzii.',
        en: 'Prices are in Czech crowns (CZK) and are final — the operator is not VAT-registered, so nothing is added. Charges are in CZK in the Slovak and English versions too.',
      },
      {
        cs: 'Předplatné se platí předem, vždy na jeden měsíc, a automaticky se obnovuje, dokud ho nezrušíte.',
        sk: 'Predplatné sa platí vopred, vždy na jeden mesiac, a automaticky sa obnovuje, kým ho nezrušíte.',
        en: 'The subscription is paid in advance, one month at a time, and renews automatically until you cancel it.',
      },
      {
        cs: 'Platby zpracovává Stripe Payments Europe, Ltd. (Irsko). Platební údaje zadáváte přímo u Stripe; provozovatel číslo karty nevidí ani neukládá. Nabízené způsoby platby vidíte na platební stránce.',
        sk: 'Platby spracúva Stripe Payments Europe, Ltd. (Írsko). Platobné údaje zadávate priamo v Stripe; prevádzkovateľ číslo karty nevidí ani neukladá. Ponúkané spôsoby platby vidíte na platobnej stránke.',
        en: 'Payments are processed by Stripe Payments Europe, Ltd. (Ireland). You enter your payment details directly with Stripe; the operator never sees or stores your card number. The available payment methods are shown on the payment page.',
      },
      {
        cs: 'Slevový kód, pokud nějaký máte, uplatníte na platební stránce.',
        sk: 'Zľavový kód, ak nejaký máte, uplatníte na platobnej stránke.',
        en: 'If you have a promotion code, you can apply it on the payment page.',
      },
      {
        cs: 'Když se platba nepodaří, Stripe ji v následujících dnech zkusí strhnout znovu. Tarif mezitím běží dál a aplikace vás na neprošlou platbu upozorní. Nepodaří-li se platbu strhnout ani tak, předplatné skončí a účet přejde na tarif Zdarma; hledání a data zůstávají.',
        sk: 'Keď sa platba nepodarí, Stripe ju v nasledujúcich dňoch skúsi strhnúť znova. Tarif medzitým beží ďalej a aplikácia vás na neprešlú platbu upozorní. Ak sa platbu nepodarí strhnúť ani tak, predplatné skončí a účet prejde na tarif Zdarma; hľadania a dáta zostávajú.',
        en: 'If a payment fails, Stripe retries it over the following days. Your plan keeps running meanwhile and the app warns you about the failed payment. If the payment still cannot be collected, the subscription ends and the account moves to the Free plan; your searches and data remain.',
      },
    ],
  },
  {
    heading: { cs: 'Zkušební období', sk: 'Skúšobné obdobie', en: 'Free trial' },
    bullets: [
      {
        cs: `Kdo si tarif Pro nebo Business objednává poprvé, má prvních ${D} dní zdarma. Nárok má jen účet, který předplatné nikdy neměl — po zrušení a nové objednávce se platí hned.`,
        sk: `Kto si tarif Pro alebo Business objednáva prvýkrát, má prvých ${D} dní zadarmo. Nárok má len účet, ktorý predplatné nikdy nemal — po zrušení a novej objednávke sa platí hneď.`,
        en: `If you order Pro or Business for the first time, the first ${D} days are free. Only an account that has never had a subscription qualifies — after cancelling and ordering again, payment starts immediately.`,
      },
      {
        cs: 'Platební údaje zadáte už při objednávce, ale během zkušebního období se nic nestrhává.',
        sk: 'Platobné údaje zadáte už pri objednávke, ale počas skúšobného obdobia sa nič nestrháva.',
        en: 'You enter your payment details when ordering, but nothing is charged during the trial.',
      },
      {
        cs: `Nezrušíte-li předplatné do konce zkušebního období, strhne se první měsíční platba (${kc(PRO)} u tarifu Pro, ${kc(BIZ)} u tarifu Business) a předplatné pokračuje po měsících. Konec zkušebního období vidíte při objednávce na platební stránce a pak v aplikaci na stránce Ceník a v Profilu.`,
        sk: `Ak nezrušíte predplatné do konca skúšobného obdobia, strhne sa prvá mesačná platba (${kc(PRO)} pri tarife Pro, ${kc(BIZ)} pri tarife Business) a predplatné pokračuje po mesiacoch. Koniec skúšobného obdobia vidíte pri objednávke na platobnej stránke a potom v aplikácii na stránke Cenník a v Profile.`,
        en: `Unless you cancel before the trial ends, the first monthly payment is charged (${czk(PRO)} for Pro, ${czk(BIZ)} for Business) and the subscription continues month by month. The trial end date is shown on the payment page when you order and then in the app on the Pricing and Profile pages.`,
      },
      {
        cs: 'Zrušíte-li předplatné během zkušebního období, nezaplatíte nic.',
        sk: 'Ak zrušíte predplatné počas skúšobného obdobia, nezaplatíte nič.',
        en: 'If you cancel during the trial, you pay nothing.',
      },
    ],
  },
  {
    heading: { cs: 'Zrušení předplatného', sk: 'Zrušenie predplatného', en: 'Cancelling the subscription' },
    bullets: [
      {
        cs: `Předplatné zrušíte kdykoli v aplikaci v Profilu — tlačítko pro správu předplatného otevře zákaznický portál Stripe. Můžete také napsat na ${OPERATOR.email}.`,
        sk: `Predplatné zrušíte kedykoľvek v aplikácii v Profile — tlačidlo na správu predplatného otvorí zákaznícky portál Stripe. Môžete tiež napísať na ${OPERATOR.email}.`,
        en: `You can cancel at any time in the app under Profile — the manage subscription button opens Stripe’s customer portal. You can also write to ${OPERATOR.email}.`,
      },
      {
        cs: 'Zrušení platí ke konci již zaplaceného období, během zkušebního období k jeho konci. Do té doby máte tarif k dispozici, pak účet přejde na Zdarma. Hledání a data zůstávají.',
        sk: 'Zrušenie platí ku koncu už zaplateného obdobia, počas skúšobného obdobia k jeho koncu. Dovtedy máte tarif k dispozícii, potom účet prejde na Zdarma. Hľadania a dáta zostávajú.',
        en: 'Cancellation takes effect at the end of the period already paid for, or at the end of the trial. Until then you keep the plan; afterwards the account moves to Free. Your searches and data remain.',
      },
      {
        cs: 'Za nevyužitou část měsíce se po běžném zrušení peníze nevracejí. Tím nejsou dotčena práva spotřebitele z odstoupení od smlouvy ani práva z vadného plnění.',
        sk: 'Za nevyužitú časť mesiaca sa po bežnom zrušení peniaze nevracajú. Tým nie sú dotknuté práva spotrebiteľa z odstúpenia od zmluvy ani práva zo zodpovednosti za vady.',
        en: 'No money is refunded for the unused part of a month after an ordinary cancellation. This does not affect a consumer’s right of withdrawal or rights in respect of defective performance.',
      },
      {
        cs: `Smazání účtu i všech jeho dat si vyžádáte e-mailem na ${OPERATOR.email}. Provedeme ho do 30 dnů a zároveň ukončíme případné předplatné.`,
        sk: `Zmazanie účtu aj všetkých jeho dát si vyžiadate e-mailom na ${OPERATOR.email}. Vykonáme ho do 30 dní a zároveň ukončíme prípadné predplatné.`,
        en: `To have your account and all its data deleted, e-mail ${OPERATOR.email}. We do so within 30 days and end any running subscription at the same time.`,
      },
    ],
  },
  {
    heading: {
      cs: 'Odstoupení od smlouvy — pro spotřebitele',
      sk: 'Odstúpenie od zmluvy — pre spotrebiteľov',
      en: 'Right of withdrawal — for consumers',
    },
    body: [
      {
        cs: 'Jste-li spotřebitel, můžete od smlouvy o předplatném odstoupit bez udání důvodu do 14 dnů ode dne jejího uzavření, tedy od potvrzení objednávky na platební stránce (§ 1829 odst. 1 občanského zákoníku). Lhůta je zachována, pokud odstoupení v jejím průběhu odešlete.',
        sk: 'Ak ste spotrebiteľ, môžete od zmluvy o predplatnom odstúpiť bez udania dôvodu do 14 dní odo dňa jej uzavretia, teda od potvrdenia objednávky na platobnej stránke (§ 1829 ods. 1 českého Občianskeho zákonníka). Lehota je zachovaná, ak odstúpenie počas nej odošlete.',
        en: 'If you are a consumer, you may withdraw from the subscription contract without giving any reason within 14 days of the day it was made, i.e. of confirming the order on the payment page (Section 1829(1) of the Czech Civil Code). The deadline is met if you send your withdrawal before it expires.',
      },
      {
        cs: `Odstoupení pošlete e-mailem na ${OPERATOR.email} nebo dopisem na adresu sídla. Můžete použít vzorový formulář níže, ale nemusíte — stačí jakékoli jednoznačné prohlášení. Přijetí odstoupení vám potvrdíme e-mailem.`,
        sk: `Odstúpenie pošlite e-mailom na ${OPERATOR.email} alebo listom na adresu sídla. Môžete použiť vzorový formulár nižšie, ale nemusíte — stačí akékoľvek jednoznačné vyhlásenie. Prijatie odstúpenia vám potvrdíme e-mailom.`,
        en: `Send your withdrawal by e-mail to ${OPERATOR.email} or by letter to the registered address. You may use the model form below but do not have to — any clear statement is enough. We will confirm receipt by e-mail.`,
      },
      {
        cs: 'Peníze vrátíme do 14 dnů od doručení odstoupení stejným způsobem, jakým jste platili, bez jakýchkoli poplatků.',
        sk: 'Peniaze vrátime do 14 dní od doručenia odstúpenia rovnakým spôsobom, akým ste platili, bez akýchkoľvek poplatkov.',
        en: 'We refund you within 14 days of receiving your withdrawal, using the same means of payment you used, without any fees.',
      },
      {
        cs: `Protože jste objednávkou výslovně požádali o zpřístupnění tarifu ihned, zaplatíte při odstoupení poměrnou část ceny za dny, kdy vám byl placený tarif do odstoupení k dispozici (§ 1834a občanského zákoníku). Dny zkušebního období se neplatí. Příklad: odstoupíte-li od tarifu Pro desátý den po objednávce, využívali jste po ${D} dnech zdarma placený tarif 3 dny; z ${kc(PRO)} za třicetidenní období vám vrátíme zhruba ${kc(Math.round((PRO * 27) / 30))}.`,
        sk: `Keďže ste objednávkou výslovne požiadali o sprístupnenie tarifu ihneď, zaplatíte pri odstúpení pomernú časť ceny za dni, keď vám bol platený tarif do odstúpenia k dispozícii (§ 1834a českého Občianskeho zákonníka). Dni skúšobného obdobia sa neplatia. Príklad: ak odstúpite od tarifu Pro desiaty deň po objednávke, využívali ste po ${D} dňoch zadarmo platený tarif 3 dni; z ${kc(PRO)} za tridsaťdňové obdobie vám vrátime zhruba ${kc(Math.round((PRO * 27) / 30))}.`,
        en: `Because your order expressly asked for the plan to be made available immediately, on withdrawal you pay the proportional price for the days on which the paid plan was available to you (Section 1834a of the Czech Civil Code). Trial days are not charged. Example: if you withdraw from Pro on the tenth day after ordering, you used the paid plan for 3 days after ${D} free days; of ${czk(PRO)} for a thirty-day period we refund about ${czk(Math.round((PRO * 27) / 30))}.`,
      },
    ],
  },
  {
    heading: {
      cs: 'Vzorový formulář pro odstoupení od smlouvy',
      sk: 'Vzorový formulár na odstúpenie od zmluvy',
      en: 'Model withdrawal form',
    },
    body: [
      {
        cs: 'Vyplňte a pošlete jen v případě, že chcete od smlouvy odstoupit.',
        sk: 'Vyplňte a pošlite len v prípade, že chcete od zmluvy odstúpiť.',
        en: 'Complete and return this form only if you wish to withdraw from the contract.',
      },
    ],
    bullets: [
      {
        cs: `Adresát: ${OPERATOR.name}, ${OPERATOR.address}, ${OPERATOR.email}`,
        sk: `Adresát: ${OPERATOR.name}, ${OPERATOR.address}, ${OPERATOR.email}`,
        en: `To: ${OPERATOR.name}, ${OPERATOR.address}, Czech Republic, ${OPERATOR.email}`,
      },
      {
        cs: 'Oznamuji, že tímto odstupuji od smlouvy o poskytnutí této služby: předplatné KlientHunter, tarif …………',
        sk: 'Oznamujem, že týmto odstupujem od zmluvy o poskytnutí tejto služby: predplatné KlientHunter, tarif …………',
        en: 'I hereby give notice that I withdraw from my contract for the provision of the following service: KlientHunter subscription, plan …………',
      },
      { cs: 'Datum objednání: …………', sk: 'Dátum objednania: …………', en: 'Ordered on: …………' },
      { cs: 'Jméno a příjmení spotřebitele: …………', sk: 'Meno a priezvisko spotrebiteľa: …………', en: 'Name of consumer: …………' },
      { cs: 'Adresa spotřebitele a e-mail účtu: …………', sk: 'Adresa spotrebiteľa a e-mail účtu: …………', en: 'Address of consumer and account e-mail: …………' },
      {
        cs: 'Podpis spotřebitele (jen při zaslání v listinné podobě): …………',
        sk: 'Podpis spotrebiteľa (len pri zaslaní v listinnej podobe): …………',
        en: 'Signature of consumer (only if this form is sent on paper): …………',
      },
      { cs: 'Datum: …………', sk: 'Dátum: …………', en: 'Date: …………' },
    ],
  },
  {
    heading: { cs: 'Vrácení peněz', sk: 'Vrátenie peňazí', en: 'Refunds' },
    body: [
      {
        cs: 'Peníze vracíme přes Stripe na platební prostředek, kterým jste platili, do 14 dnů. Po běžném zrušení předplatného se za zbývající dny zaplaceného období nevrací nic — tarif ale do jeho konce běží. Peníze vracíme v těchto případech:',
        sk: 'Peniaze vraciame cez Stripe na platobný prostriedok, ktorým ste platili, do 14 dní. Po bežnom zrušení predplatného sa za zostávajúce dni zaplateného obdobia nevracia nič — tarif však do jeho konca beží. Peniaze vraciame v týchto prípadoch:',
        en: 'Refunds are made through Stripe to the means of payment you used, within 14 days. After an ordinary cancellation nothing is refunded for the rest of the paid period — but the plan keeps running until it ends. We refund money in these cases:',
      },
    ],
    bullets: [
      {
        cs: 'odstoupení spotřebitele od smlouvy do 14 dnů, po odečtení poměrné části podle oddílu o odstoupení;',
        sk: 'odstúpenie spotrebiteľa od zmluvy do 14 dní, po odpočítaní pomernej časti podľa oddielu o odstúpení;',
        en: 'a consumer’s withdrawal within 14 days, less the proportional amount described in the withdrawal section;',
      },
      {
        cs: 'uznaná reklamace, pokud se vyřizuje slevou z ceny nebo odstoupením od smlouvy;',
        sk: 'uznaná reklamácia, ak sa vybavuje zľavou z ceny alebo odstúpením od zmluvy;',
        en: 'an upheld complaint settled by a price reduction or by termination of the contract;',
      },
      {
        cs: 'zrušení účtu provozovatelem z jiného důvodu než pro porušení podmínek — poměrná část za nevyužité dny;',
        sk: 'zrušenie účtu prevádzkovateľom z iného dôvodu než pre porušenie podmienok — pomerná časť za nevyužité dni;',
        en: 'closure of the account by the operator for any reason other than a breach of these terms — the proportional amount for unused days;',
      },
      {
        cs: 'platba, která omylem proběhla dvakrát nebo ji nešlo přiřadit k žádnému účtu — celá částka.',
        sk: 'platba, ktorá omylom prebehla dvakrát alebo ju nebolo možné priradiť k žiadnemu účtu — celá suma.',
        en: 'a payment taken twice by mistake or one that could not be matched to any account — in full.',
      },
    ],
  },
  {
    heading: { cs: 'Reklamace', sk: 'Reklamácie', en: 'Complaints about defects' },
    body: [
      {
        cs: `Pokud služba nefunguje tak, jak ji popisují tyto podmínky a stránka Ceník, máte práva z vadného plnění podle občanského zákoníku. Reklamaci pošlete na ${OPERATOR.email}: uveďte e-mail účtu, co nefunguje a odkdy, případně přiložte snímek obrazovky.`,
        sk: `Ak služba nefunguje tak, ako ju opisujú tieto podmienky a stránka Cenník, máte práva zo zodpovednosti za vady podľa českého Občianskeho zákonníka. Reklamáciu pošlite na ${OPERATOR.email}: uveďte e-mail účtu, čo nefunguje a odkedy, prípadne priložte snímku obrazovky.`,
        en: `If the service does not work as described in these terms and on the Pricing page, you have rights in respect of defective performance under the Czech Civil Code. Send your complaint to ${OPERATOR.email}, stating the account e-mail, what does not work and since when, with a screenshot if you can.`,
      },
      {
        cs: 'Přijetí reklamace potvrdíme e-mailem a vyřídíme ji bez zbytečného odkladu, nejpozději do 30 dnů od jejího přijetí, nedohodneme-li se na delší lhůtě. Podle povahy vady můžete požadovat její odstranění, přiměřenou slevu z ceny, a jde-li o vadu podstatnou nebo neodstraněnou, odstoupit od smlouvy.',
        sk: 'Prijatie reklamácie potvrdíme e-mailom a vybavíme ju bez zbytočného odkladu, najneskôr do 30 dní od jej prijatia, ak sa nedohodneme na dlhšej lehote. Podľa povahy vady môžete požadovať jej odstránenie, primeranú zľavu z ceny, a ak ide o vadu podstatnú alebo neodstránenú, odstúpiť od zmluvy.',
        en: 'We confirm receipt by e-mail and resolve the complaint without undue delay and within 30 days of receiving it at the latest, unless we agree on a longer period. Depending on the defect you may ask for it to be remedied, for a reasonable price reduction, or — if the defect is material or is not remedied — terminate the contract.',
      },
      {
        cs: 'Vadou není, že veřejný zdroj (ARES, OpenStreetMap a další) o firmě nic neuvádí, uvádí zastaralý údaj nebo je dočasně nedostupný — služba data z těchto zdrojů jen zprostředkuje, jak popisuje oddíl o správnosti dat.',
        sk: 'Vadou nie je, že verejný zdroj (ARES, OpenStreetMap a ďalšie) o firme nič neuvádza, uvádza zastaraný údaj alebo je dočasne nedostupný — služba dáta z týchto zdrojov len sprostredkúva, ako opisuje oddiel o správnosti dát.',
        en: 'It is not a defect that a public source (ARES, OpenStreetMap and others) holds nothing on a business, holds outdated data, or is temporarily unavailable — the service merely relays data from these sources, as the section on data accuracy explains.',
      },
    ],
  },
  {
    heading: {
      cs: 'Oslovování firem je na vás — a je to vaše odpovědnost',
      sk: 'Oslovovanie firiem je na vás — a je to vaša zodpovednosť',
      en: 'Outreach is yours to send — and yours to answer for',
    },
    body: [
      {
        cs: 'Aplikace žádnou zprávu nepíše ani neodesílá — dá vám jen kontakty. Zprávu formulujete a odesíláte vy, ze své vlastní schránky, a tím se z vás podle § 7 zákona č. 480/2004 Sb. stává šiřitel obchodního sdělení.',
        sk: 'Aplikácia žiadnu správu nepíše ani neodosiela — dá vám len kontakty. Správu formulujete a odosielate vy, zo svojej vlastnej schránky, a tým sa z vás podľa § 7 českého zákona č. 480/2004 Sb. stáva šíriteľ obchodného oznámenia.',
        en: 'The app neither writes nor sends any message — it only gives you the contacts. You write and send the message yourself, from your own mailbox, and in doing so you become the sender of a commercial communication under § 7 of Czech Act No. 480/2004 Coll.',
      },
      {
        cs: 'Z toho pro vás plyne, že obchodní sdělení musí být jako obchodní sdělení zřetelně označeno, musí být zjevné, kdo je odesílá, a musí obsahovat funkční způsob, jak další zprávy odmítnout. Za dodržení těchto povinností odpovídáte vy, nikoli provozovatel. Česká obchodní inspekce může za jejich porušení uložit pokutu až 10 000 000 Kč. To, že adresa je veřejně uvedená, sama o sobě souhlas s oslovením nezakládá — Úřad pro ochranu osobních údajů to opakovaně potvrdil.',
        sk: 'Z toho pre vás plynie, že obchodné oznámenie musí byť ako obchodné oznámenie zreteľne označené, musí byť zjavné, kto ho odosiela, a musí obsahovať funkčný spôsob, ako ďalšie správy odmietnuť. Za dodržanie týchto povinností zodpovedáte vy, nie prevádzkovateľ. Za ich porušenie hrozí pokuta až 10 000 000 Kč. To, že adresa je verejne uvedená, samo osebe súhlas s oslovením nezakladá.',
        en: 'That means the message must be clearly identifiable as a commercial communication, must make plain who is sending it, and must offer a working way to refuse further messages. Compliance is your responsibility, not the operator’s. The Czech Trade Inspection Authority can impose fines of up to CZK 10,000,000 for breaches. The fact that an address is published does not by itself constitute consent to be contacted — the Czech data protection authority has confirmed this repeatedly.',
      },
    ],
  },
  {
    heading: {
      cs: 'Exportovaná data a ochrana osobních údajů',
      sk: 'Exportované dáta a ochrana osobných údajov',
      en: 'Exported data and data protection',
    },
    body: [
      {
        cs: 'Jakmile si výsledky vyexportujete do svého souboru nebo je přenesete do vlastního systému, stáváte se vůči těmto údajům samostatným správcem podle GDPR. Od té chvíle je na vás, abyste je zpracovávali v souladu s předpisy — tedy pro určený účel, po přiměřenou dobu a s vyřízením případných námitek. Provozovatel na vaše kopie dat nemá žádný vliv a neodpovídá za to, jak s nimi naložíte.',
        sk: 'Akonáhle si výsledky vyexportujete do svojho súboru alebo ich prenesiete do vlastného systému, stávate sa voči týmto údajom samostatným prevádzkovateľom podľa GDPR. Od tej chvíle je na vás, aby ste ich spracúvali v súlade s predpismi — teda na určený účel, po primeranú dobu a s vybavením prípadných námietok. Prevádzkovateľ na vaše kópie dát nemá žiadny vplyv a nezodpovedá za to, ako s nimi naložíte.',
        en: 'Once you export results to a file or move them into your own system, you become an independent data controller for that data under the GDPR. From then on it is on you to process it lawfully — for a defined purpose, for a reasonable period, and handling any objections you receive. The operator has no control over your copies and is not responsible for what you do with them.',
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
        cs: 'Do aplikace lze nahrát vlastní seznam firem v CSV. Nahráním prohlašujete, že jste ho získali oprávněně a že jste oprávněni údaje v něm zpracovávat a předat je nám ke zpracování. Vůči těmto údajům jste správcem vy; provozovatel je zpracovatelem podle doložky níže.',
        sk: 'Do aplikácie možno nahrať vlastný zoznam firiem v CSV. Nahraním vyhlasujete, že ste ho získali oprávnene a že ste oprávnení údaje v ňom spracúvať a odovzdať nám ich na spracovanie. Voči týmto údajom ste prevádzkovateľom vy; prevádzkovateľ služby je sprostredkovateľom podľa doložky nižšie.',
        en: 'You can upload your own list of businesses as CSV. By uploading it you represent that you obtained it lawfully and that you are entitled to process the data in it and to pass it to us for processing. For that data you are the controller; the operator is a processor under the clause below.',
      },
      {
        cs: 'Nenahrávejte údaje o spotřebitelích, údaje ze zvláštních kategorií podle čl. 9 GDPR ani seznamy, které jste koupili nebo získali z cizí databáze bez oprávnění. Za škodu a za sankce, které by z porušení tohoto ustanovení vznikly, odpovídáte vy; provozovatel obsah nahraného souboru nekontroluje a kontrolovat nemůže.',
        sk: 'Nenahrávajte údaje o spotrebiteľoch, údaje z osobitných kategórií podľa čl. 9 GDPR ani zoznamy, ktoré ste kúpili alebo získali z cudzej databázy bez oprávnenia. Za škodu a za sankcie, ktoré by z porušenia tohto ustanovenia vznikli, zodpovedáte vy; prevádzkovateľ obsah nahraného súboru nekontroluje a kontrolovať nemôže.',
        en: 'Do not upload consumer data, data in the special categories of Art. 9 GDPR, or lists you bought or took from someone else’s database without authorisation. Any damage or penalty arising from a breach of this clause is yours to bear; the operator does not inspect the contents of the uploaded file and cannot do so.',
      },
    ],
  },
  {
    heading: {
      cs: 'Zpracovatelská doložka (čl. 28 GDPR)',
      sk: 'Sprostredkovateľská doložka (čl. 28 GDPR)',
      en: 'Data processing clause (Art. 28 GDPR)',
    },
    body: [
      {
        cs: 'Pro osobní údaje z nahraného seznamu tvoří tento oddíl smlouvu o zpracování mezi vámi jako správcem a provozovatelem jako zpracovatelem.',
        sk: 'Pre osobné údaje z nahraného zoznamu tvorí tento oddiel zmluvu o spracúvaní medzi vami ako prevádzkovateľom a prevádzkovateľom služby ako sprostredkovateľom.',
        en: 'For personal data in an uploaded list, this section is the data processing agreement between you as controller and the operator as processor.',
      },
    ],
    bullets: [
      {
        cs: 'Předmět a účel: import seznamu, jeho doplnění z veřejných rejstříků (ARES, registr plátců DPH), ověření webů a zobrazení a export výsledků ve vašem účtu.',
        sk: 'Predmet a účel: import zoznamu, jeho doplnenie z verejných registrov (ARES, register platiteľov DPH), overenie webov a zobrazenie a export výsledkov vo vašom účte.',
        en: 'Subject matter and purpose: importing the list, enriching it from public registers (ARES, the VAT register), checking websites, and showing and exporting the results in your account.',
      },
      {
        cs: 'Doba: dokud import nesmažete, nejdéle do smazání účtu.',
        sk: 'Doba: kým import nezmažete, najdlhšie do zmazania účtu.',
        en: 'Duration: until you delete the import, and no longer than until the account is deleted.',
      },
      {
        cs: 'Údaje a subjekty: název, IČO, web, telefon, e-mail a adresa firem a podnikatelů a kontaktních osob, pokud je v seznamu uvedete.',
        sk: 'Údaje a subjekty: názov, IČO, web, telefón, e-mail a adresa firiem a podnikateľov a kontaktných osôb, ak ich v zozname uvediete.',
        en: 'Data and data subjects: name, company ID, website, phone, e-mail and address of businesses, sole traders and contact persons, where your list includes them.',
      },
      {
        cs: 'Pokyny a mlčenlivost: provozovatel zpracovává údaje jen podle vašeho pokynu, který dáváte nahráním a používáním aplikace, nepoužije je k vlastním účelům a zachovává o nich mlčenlivost.',
        sk: 'Pokyny a mlčanlivosť: prevádzkovateľ spracúva údaje len podľa vášho pokynu, ktorý dávate nahraním a používaním aplikácie, nepoužije ich na vlastné účely a zachováva o nich mlčanlivosť.',
        en: 'Instructions and confidentiality: the operator processes the data only on your instructions, given by uploading and using the app, does not use it for its own purposes, and keeps it confidential.',
      },
      {
        cs: 'Zabezpečení: šifrovaný přenos, přístup k datům jen přes váš účet a provozovatele, hesla jako nevratný otisk; podrobnosti jsou v Zásadách ochrany osobních údajů.',
        sk: 'Zabezpečenie: šifrovaný prenos, prístup k dátam len cez váš účet a prevádzkovateľa, heslá ako nevratný odtlačok; podrobnosti sú v Zásadách ochrany osobných údajov.',
        en: 'Security: encrypted transfer, data reachable only through your account and by the operator, passwords stored as irreversible hashes; details are in the Privacy Policy.',
      },
      {
        cs: 'Další zpracovatelé: Vercel Inc. (provoz aplikace) a Neon, LLC (databáze). Jejich zapojením souhlasíte; o plánované změně vás předem informujeme a můžete proti ní vznést námitku.',
        sk: 'Ďalší sprostredkovatelia: Vercel Inc. (prevádzka aplikácie) a Neon, LLC (databáza). S ich zapojením súhlasíte; o plánovanej zmene vás vopred informujeme a môžete proti nej vzniesť námietku.',
        en: 'Sub-processors: Vercel Inc. (application hosting) and Neon, LLC (database). You authorise their engagement; we will tell you in advance about any intended change and you may object to it.',
      },
      {
        cs: 'Součinnost: provozovatel vám pomůže vyřídit žádosti subjektů údajů a splnit povinnosti podle čl. 32 až 36 GDPR a bez zbytečného odkladu vás informuje o porušení zabezpečení, které se nahraných údajů týká. Na požádání vám doloží, jak tyto povinnosti plní.',
        sk: 'Súčinnosť: prevádzkovateľ vám pomôže vybaviť žiadosti dotknutých osôb a splniť povinnosti podľa čl. 32 až 36 GDPR a bez zbytočného odkladu vás informuje o porušení zabezpečenia, ktoré sa nahraných údajov týka. Na požiadanie vám doloží, ako tieto povinnosti plní.',
        en: 'Assistance: the operator helps you handle data subject requests and meet your obligations under Art. 32–36 GDPR, notifies you without undue delay of any security breach affecting the uploaded data, and on request shows you how it meets these obligations.',
      },
      {
        cs: 'Konec zpracování: smazáním importu nebo účtu se nahrané údaje z databáze vymažou.',
        sk: 'Koniec spracúvania: zmazaním importu alebo účtu sa nahrané údaje z databázy vymažú.',
        en: 'End of processing: deleting the import or the account erases the uploaded data from the database.',
      },
    ],
  },
  {
    heading: {
      cs: 'Za správnost dat neručíme',
      sk: 'Za správnosť dát neručíme',
      en: 'We do not warrant the data',
    },
    body: [
      {
        cs: 'Všechna data pocházejí z veřejných rejstříků, map a webů třetích stran. Aplikace je pouze zprostředkovává a nijak je neověřuje. Mohou být zastaralá, neúplná nebo chybná — firma může mít jiný kontakt, než je zapsán, a údaj o webu vypovídá jen o tom, co se aplikaci podařilo najít, nikoli o tom, jak na tom firma skutečně je. Před obchodním rozhodnutím si údaje ověřte u zdroje.',
        sk: 'Všetky dáta pochádzajú z verejných registrov, máp a webov tretích strán. Aplikácia ich iba sprostredkúva a nijako ich neoveruje. Môžu byť zastarané, neúplné alebo chybné — firma môže mať iný kontakt, než je zapísaný, a údaj o webe vypovedá len o tom, čo sa aplikácii podarilo nájsť, nie o tom, ako na tom firma skutočne je. Pred obchodným rozhodnutím si údaje overte pri zdroji.',
        en: 'All data comes from public registers, maps and third-party websites. The app merely relays it and does not verify it. It may be out of date, incomplete or wrong — a business may use a contact other than the one on record, and a website field tells you what the app managed to find, not how the business actually stands. Verify at source before making a commercial decision.',
      },
    ],
  },
  {
    heading: {
      cs: 'Dostupnost a odpovědnost',
      sk: 'Dostupnosť a zodpovednosť',
      en: 'Availability and liability',
    },
    body: [
      {
        cs: 'Služba závisí na veřejných rozhraních třetích stran (ARES, OpenStreetMap, mapové podklady OpenFreeMap) a na poskytovatelích hostingu. Ti mohou být dočasně nedostupní nebo změnit své chování, a nepřetržitou dostupnost proto nezaručujeme.',
        sk: 'Služba závisí od verejných rozhraní tretích strán (ARES, OpenStreetMap, mapové podklady OpenFreeMap) a od poskytovateľov hostingu. Tí môžu byť dočasne nedostupní alebo zmeniť svoje správanie, a nepretržitú dostupnosť preto nezaručujeme.',
        en: 'The service depends on third-party public interfaces (ARES, OpenStreetMap, OpenFreeMap map tiles) and on hosting providers, which may be temporarily unavailable or change their behaviour. We therefore do not guarantee uninterrupted availability.',
      },
      {
        cs: 'Jste-li spotřebitel, vaše zákonná práva — včetně práv z vadného plnění a práva na náhradu škody — tím nejsou nijak omezena.',
        sk: 'Ak ste spotrebiteľ, vaše zákonné práva — vrátane práv zo zodpovednosti za vady a práva na náhradu škody — tým nie sú nijako obmedzené.',
        en: 'If you are a consumer, your statutory rights — including rights in respect of defective performance and to compensation for damage — are not limited in any way.',
      },
      {
        cs: 'Jste-li podnikatel, provozovatel vám neodpovídá za ušlý zisk ani za nepřímou škodu a celková náhrada škody je omezena částkou, kterou jste za službu zaplatili za posledních 12 měsíců. Omezení se nevztahuje na škodu způsobenou úmyslně nebo z hrubé nedbalosti ani na újmu na přirozených právech člověka.',
        sk: 'Ak ste podnikateľ, prevádzkovateľ vám nezodpovedá za ušlý zisk ani za nepriamu škodu a celková náhrada škody je obmedzená sumou, ktorú ste za službu zaplatili za posledných 12 mesiacov. Obmedzenie sa nevzťahuje na škodu spôsobenú úmyselne alebo z hrubej nedbanlivosti ani na ujmu na prirodzených právach človeka.',
        en: 'If you are a business, the operator is not liable to you for lost profit or indirect damage, and total liability is capped at the amount you paid for the service in the last 12 months. The cap does not apply to damage caused intentionally or by gross negligence, or to harm to a person’s natural rights.',
      },
    ],
  },
  {
    heading: { cs: 'Rozhodné právo a řešení sporů', sk: 'Rozhodné právo a riešenie sporov', en: 'Governing law and disputes' },
    body: [
      {
        cs: 'Smlouva se řídí právem České republiky. Jste-li spotřebitel s obvyklým bydlištěm v jiném státě, nepřicházíte o ochranu, kterou vám dávají kogentní předpisy státu vašeho bydliště, a spor můžete vést i u soudu v místě svého bydliště.',
        sk: 'Zmluva sa riadi právom Českej republiky. Ak ste spotrebiteľ s obvyklým pobytom v inom štáte, neprichádzate o ochranu, ktorú vám dávajú kogentné predpisy štátu vášho pobytu, a spor môžete viesť aj na súde v mieste svojho bydliska.',
        en: 'The contract is governed by the law of the Czech Republic. If you are a consumer habitually resident in another country, you keep the protection of the mandatory rules of that country and may also bring proceedings in the courts where you live.',
      },
      {
        cs: `Stížnost můžete nejdřív poslat provozovateli na ${OPERATOR.email}. Spotřebitel se může obrátit na subjekt mimosoudního řešení spotřebitelských sporů, kterým je Česká obchodní inspekce, Gorazdova 1969/24, 120 00 Praha 2, www.coi.gov.cz; návrh se podává přes její web. Česká obchodní inspekce také dohlíží na dodržování povinností na ochranu spotřebitele.`,
        sk: `Sťažnosť môžete najprv poslať prevádzkovateľovi na ${OPERATOR.email}. Spotrebiteľ sa môže obrátiť na subjekt alternatívneho riešenia spotrebiteľských sporov, ktorým je Česká obchodní inspekce, Gorazdova 1969/24, 120 00 Praha 2, Česká republika, www.coi.gov.cz; návrh sa podáva cez jej web. Česká obchodní inspekce zároveň dohliada na dodržiavanie povinností na ochranu spotrebiteľa.`,
        en: `You may first send a complaint to the operator at ${OPERATOR.email}. Consumers may turn to the out-of-court consumer dispute resolution body, the Czech Trade Inspection Authority (Česká obchodní inspekce), Gorazdova 1969/24, 120 00 Prague 2, Czech Republic, www.coi.gov.cz; proposals are filed through its website. The same authority supervises compliance with consumer protection duties.`,
      },
    ],
  },
  {
    heading: { cs: 'Změny podmínek', sk: 'Zmeny podmienok', en: 'Changes to these terms' },
    body: [
      {
        cs: 'Podmínky můžeme změnit, typicky když přibude funkce, změní se tarify nebo to vyžádá zákon. Novou verzi zveřejníme na této stránce s datem vydání. O podstatné změně vás informujeme e-mailem nebo oznámením v aplikaci nejméně 30 dní předem.',
        sk: 'Podmienky môžeme zmeniť, typicky keď pribudne funkcia, zmenia sa tarify alebo to vyžiada zákon. Novú verziu zverejníme na tejto stránke s dátumom vydania. O podstatnej zmene vás informujeme e-mailom alebo oznámením v aplikácii najmenej 30 dní vopred.',
        en: 'We may change these terms, typically when a feature is added, plans change or the law requires it. The new version is published on this page with its date. We tell you about any material change by e-mail or by a notice in the app at least 30 days in advance.',
      },
      {
        cs: 'Změna ceny se u běžícího předplatného projeví nejdříve v období, které začne po uplynutí této lhůty. Se změnou nemusíte souhlasit: předplatné můžete do té doby zrušit a požádat o smazání účtu. Pro již zaplacené období platí dosavadní podmínky.',
        sk: 'Zmena ceny sa pri bežiacom predplatnom prejaví najskôr v období, ktoré začne po uplynutí tejto lehoty. So zmenou nemusíte súhlasiť: predplatné môžete dovtedy zrušiť a požiadať o zmazanie účtu. Pre už zaplatené obdobie platia doterajšie podmienky.',
        en: 'A price change affects a running subscription no earlier than the first period starting after that notice period. You do not have to accept a change: you can cancel the subscription before then and ask for your account to be deleted. The previous terms apply to any period already paid for.',
      },
    ],
  },
];

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  return <LegalDocument title={M.title} intro={INTRO} blocks={BLOCKS} locale={locale} />;
}
