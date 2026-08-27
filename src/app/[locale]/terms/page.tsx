import type { Metadata } from 'next';
import { LegalDocument } from '@/components/LegalDocument';
import { localized } from '@/lib/lead-filters';
import { OPERATOR, type LegalBlock } from '@/lib/legal';

/**
 * Podmínky použití.
 *
 * Původní verze měla šest vět a mlčela přesně tam, kde je riziko: aplikace píše obchodní
 * e-maily. Odesílá je ale uživatel ze své schránky — a tím se z něj podle § 7 zákona
 * č. 480/2004 Sb. stává šiřitel obchodního sdělení se všemi povinnostmi, které z toho plynou
 * (pokuta až 10 000 000 Kč). Zároveň se stává správcem osobních údajů, které si vyexportoval.
 * Oddíly o oslovování a o exportu to říkají nahlas, protože uživatel, který to netuší, si může
 * udělat vážný problém.
 *
 * Druhé kolo přidalo dva oddíly, které chyběly:
 *
 *  • **Cena.** Původní text tvrdil, že „přístup k placeným plánům se sjednává individuálně,
 *    cena je uvedena v ceníku a je konečná". Žádný placený plán ale sjednat nejde — v aplikaci
 *    není platební brána a stavy `PRO` a `BUSINESS` nikdo nikomu nemůže nastavit. Slibovat
 *    smlouvu, kterou nelze uzavřít, je horší než nic neslíbit.
 *  • **Import CSV.** U nahraného seznamu je správcem uživatel a provozovatel zpracovatelem —
 *    přesně obráceně než u výsledků hledání. Bez tohohle oddílu podmínky mlčely o jediném
 *    místě, kudy do aplikace tečou osobní údaje, které jsme nesebrali my.
 */

const M = {
  title: { cs: 'Podmínky použití', sk: 'Podmienky používania', en: 'Terms of Service' },
  description: {
    cs: 'Pravidla používání KlientHunteru, odpovědnost za oslovování firem a omezení záruk.',
    sk: 'Pravidlá používania KlientHunteru, zodpovednosť za oslovovanie firiem a obmedzenie záruk.',
    en: 'Rules for using KlientHunter, responsibility for outreach, and limits of warranty.',
  },
};

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: `${localized(M.title, locale)} – KlientHunter`,
    description: localized(M.description, locale),
  };
}

const INTRO = {
  cs: 'Používáním KlientHunteru souhlasíte s těmito podmínkami. Pokud s nimi nesouhlasíte, službu prosím nepoužívejte.',
  sk: 'Používaním KlientHunteru súhlasíte s týmito podmienkami. Ak s nimi nesúhlasíte, službu prosím nepoužívajte.',
  en: 'By using KlientHunter you agree to these terms. If you do not agree with them, please do not use the service.',
};

const BLOCKS: LegalBlock[] = [
  {
    heading: { cs: 'Kdo službu provozuje', sk: 'Kto službu prevádzkuje', en: 'Who operates the service' },
    body: [
      {
        cs: `KlientHunter provozuje ${OPERATOR.name}, kontakt ${OPERATOR.email}. Smluvní vztah vzniká mezi vámi a provozovatelem okamžikem založení účtu.`,
        sk: `KlientHunter prevádzkuje ${OPERATOR.name}, kontakt ${OPERATOR.email}. Zmluvný vzťah vzniká medzi vami a prevádzkovateľom okamihom založenia účtu.`,
        en: `KlientHunter is operated by ${OPERATOR.name}, contact ${OPERATOR.email}. A contract between you and the operator comes into being when you create an account.`,
      },
    ],
  },
  {
    heading: { cs: 'Co služba dělá', sk: 'Čo služba robí', en: 'What the service does' },
    body: [
      {
        cs: 'KlientHunter vyhledává firmy ve veřejných rejstřících a mapách, řadí je podle kritérií, která si nastavíte, a umožňuje výsledky exportovat. Kromě toho umí připravit koncept oslovovacího e-mailu.',
        sk: 'KlientHunter vyhľadáva firmy vo verejných registroch a mapách, zoraďuje ich podľa kritérií, ktoré si nastavíte, a umožňuje výsledky exportovať. Okrem toho vie pripraviť koncept oslovovacieho e-mailu.',
        en: 'KlientHunter searches public registers and maps, ranks the results by criteria you choose, and lets you export them. It can also prepare a draft outreach e-mail.',
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
        cs: 'Registrace je zatím na pozvánku. Za bezpečnost svého hesla odpovídáte vy; účet nesmíte sdílet s dalšími osobami. Provozovatel může účet zrušit při porušení těchto podmínek.',
        sk: 'Registrácia je zatiaľ na pozvánku. Za bezpečnosť svojho hesla zodpovedáte vy; účet nesmiete zdieľať s ďalšími osobami. Prevádzkovateľ môže účet zrušiť pri porušení týchto podmienok.',
        en: 'Registration is currently by invitation. You are responsible for the security of your password and must not share the account. The operator may close an account that breaches these terms.',
      },
    ],
  },
  {
    heading: { cs: 'Cena', sk: 'Cena', en: 'Price' },
    body: [
      {
        cs: 'Služba je momentálně bezplatná v celém rozsahu, který účet nabízí. Placené tarify zatím neexistují: v aplikaci není platební brána, nelze na ně přejít a nikdo za službu nic neplatí. Ceny uvedené v ceníku jsou orientačním výhledem, nikoli nabídkou k uzavření smlouvy ve smyslu § 1732 odst. 2 občanského zákoníku.',
        sk: 'Služba je momentálne bezplatná v celom rozsahu, ktorý účet ponúka. Platené tarify zatiaľ neexistujú: v aplikácii nie je platobná brána, nedá sa na ne prejsť a nikto za službu nič neplatí. Ceny uvedené v cenníku sú orientačným výhľadom, nie ponukou na uzavretie zmluvy v zmysle § 1732 ods. 2 občianskeho zákonníka.',
        en: 'The service is currently free in full. Paid plans do not exist yet: there is no payment gateway in the app, no account can be moved onto one, and nobody pays anything. The prices listed on the pricing page are an indicative outlook, not an offer to contract within the meaning of § 1732(2) of the Czech Civil Code.',
      },
      {
        cs: 'Až se placené tarify spustí, dáme registrovaným uživatelům vědět e-mailem předem a účet se na placený nepřevede jinak než vaším výslovným úkonem. Bezplatné používání se nikdy nezmění v placené samo od sebe.',
        sk: 'Keď sa platené tarify spustia, dáme registrovaným používateľom vedieť e-mailom vopred a účet sa na platený neprevedie inak než vaším výslovným úkonom. Bezplatné používanie sa nikdy nezmení na platené samo od seba.',
        en: 'When paid plans launch we will tell registered users by e-mail in advance, and no account will move onto one except by your own explicit act. Free use will never turn into paid use by itself.',
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
        cs: 'Aplikace koncept zprávy pouze napíše. Nikdy nic neodesílá. Zprávu odesíláte vy, ze své vlastní schránky, a tím se z vás podle § 7 zákona č. 480/2004 Sb. stává šiřitel obchodního sdělení.',
        sk: 'Aplikácia koncept správy iba napíše. Nikdy nič neodosiela. Správu odosielate vy, zo svojej vlastnej schránky, a tým sa z vás podľa § 7 zákona č. 480/2004 Zb. stáva šíriteľ obchodného oznámenia.',
        en: 'The app only writes the draft. It never sends anything. You send the message, from your own mailbox, and in doing so you become the sender of a commercial communication under § 7 of Czech Act No. 480/2004 Coll.',
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
        cs: 'Do aplikace lze nahrát vlastní seznam firem v CSV. Nahráním prohlašujete, že jste ho získali oprávněně a že jste oprávněni údaje v něm zpracovávat a předat je nám ke zpracování. Vůči těmto údajům jste správcem vy; provozovatel je zpracovatelem a nakládá s nimi jen podle vašeho pokynu a v rozsahu potřebném k provedení importu.',
        sk: 'Do aplikácie možno nahrať vlastný zoznam firiem v CSV. Nahraním vyhlasujete, že ste ho získali oprávnene a že ste oprávnení údaje v ňom spracúvať a odovzdať nám ich na spracovanie. Voči týmto údajom ste prevádzkovateľom vy; prevádzkovateľ služby je sprostredkovateľom a nakladá s nimi len podľa vášho pokynu a v rozsahu potrebnom na vykonanie importu.',
        en: 'You can upload your own list of businesses as CSV. By uploading it you represent that you obtained it lawfully and that you are entitled to process the data in it and to pass it to us for processing. For that data you are the controller; the operator is a processor and handles it only on your instruction and only as far as running the import requires.',
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
      cs: 'Dostupnost a omezení odpovědnosti',
      sk: 'Dostupnosť a obmedzenie zodpovednosti',
      en: 'Availability and limitation of liability',
    },
    body: [
      {
        cs: 'Služba je poskytována „tak jak je", bez záruky nepřetržité dostupnosti. Závisí na veřejných rozhraních třetích stran (ARES, OpenStreetMap), která mohou být nedostupná nebo změnit své chování. Provozovatel neodpovídá za ušlý zisk ani za nepřímou škodu. Odpovědnost za škodu způsobenou úmyslně nebo z hrubé nedbalosti se nevylučuje ani neomezuje.',
        sk: 'Služba je poskytovaná „tak ako je", bez záruky nepretržitej dostupnosti. Závisí od verejných rozhraní tretích strán (ARES, OpenStreetMap), ktoré môžu byť nedostupné alebo zmeniť svoje správanie. Prevádzkovateľ nezodpovedá za ušlý zisk ani za nepriamu škodu. Zodpovednosť za škodu spôsobenú úmyselne alebo z hrubej nedbanlivosti sa nevylučuje ani neobmedzuje.',
        en: 'The service is provided “as is”, with no guarantee of uninterrupted availability. It depends on third-party public interfaces (ARES, OpenStreetMap) which may be unavailable or change their behaviour. The operator is not liable for lost profit or indirect damage. Liability for damage caused intentionally or by gross negligence is neither excluded nor limited.',
      },
    ],
  },
  {
    heading: { cs: 'Rozhodné právo', sk: 'Rozhodné právo', en: 'Governing law' },
    body: [
      {
        cs: 'Vztah se řídí právem České republiky. Spory rozhodují české soudy. Jste-li spotřebitel, nejste tímto ujednáním zbaveni ochrany, kterou vám poskytují kogentní předpisy státu vašeho bydliště; mimosoudně se můžete obrátit na Českou obchodní inspekci (adr.coi.cz).',
        sk: 'Vzťah sa riadi právom Českej republiky. Spory rozhodujú české súdy. Ak ste spotrebiteľ, nie ste týmto dojednaním zbavení ochrany, ktorú vám poskytujú kogentné predpisy štátu vášho bydliska; mimosúdne sa môžete obrátiť na Českú obchodnú inšpekciu (adr.coi.cz).',
        en: 'This relationship is governed by the law of the Czech Republic and disputes are decided by Czech courts. If you are a consumer, this does not deprive you of the protection of mandatory rules of your country of residence; out of court you may turn to the Czech Trade Inspection Authority (adr.coi.cz).',
      },
    ],
  },
  {
    heading: { cs: 'Změny podmínek', sk: 'Zmeny podmienok', en: 'Changes to these terms' },
    body: [
      {
        cs: 'Podmínky se mohou měnit. O podstatné změně dáme registrovaným uživatelům vědět e-mailem alespoň 14 dnů předem. Pokud se změnou nebudete souhlasit, můžete účet do té doby zrušit.',
        sk: 'Podmienky sa môžu meniť. O podstatnej zmene dáme registrovaným používateľom vedieť e-mailom aspoň 14 dní vopred. Ak so zmenou nebudete súhlasiť, môžete účet do tej doby zrušiť.',
        en: 'These terms may change. We give registered users at least 14 days’ notice by e-mail of any material change. If you do not accept it, you may close your account before it takes effect.',
      },
    ],
  },
];

export default function TermsPage({ params: { locale } }: { params: { locale: string } }) {
  return <LegalDocument title={M.title} intro={INTRO} blocks={BLOCKS} locale={locale} />;
}
