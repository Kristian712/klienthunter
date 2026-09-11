/**
 * Who runs this service, in one place.
 *
 * Není to kosmetika. Čl. 13 odst. 1 písm. a) GDPR ukládá správci sdělit subjektu údajů svou
 * *totožnost a kontaktní údaje*, § 435 obč. zák. chce u podnikatele na webu jméno, IČO a sídlo
 * a § 1811 obč. zák. totéž před uzavřením smlouvy se spotřebitelem. Údaje odpovídají zápisu
 * v ARESu (ověřeno 11. 9. 2026): fyzická osoba podnikající podle živnostenského zákona,
 * živnost aktivní od 27. 8. 2026, neregistrovaná k DPH.
 *
 * Kdyby některé pole zůstalo prázdné, aplikace to na právních stránkách viditelně přizná, místo
 * aby předstírala, že je vše v pořádku. Falešná identita správce je horší než přiznaná mezera.
 */
// Typ vypsaný ručně, ne `as const`: s doslovnými typy by TypeScript porovnání s '' níž
// označil za nesmyslné a prázdné pole by se pak nedalo hlídat.
export const OPERATOR: { name: string; email: string; address: string; ico: string; vatPayer: boolean } = {
  name: 'Kristián Janků',
  /** Kontaktní e-mail značky Webovky Vanek. Chodí sem žádosti zákazníků i subjektů údajů. */
  email: 'vanekwebovky@gmail.com',
  /** Sídlo podle živnostenského rejstříku. */
  address: 'č.p. 45, 686 04 Popovice',
  ico: '29987342',
  /** Neplátce DPH — ceny na ceníku jsou konečné. */
  vatPayer: false,
};

/** True, když provozovatel ještě není plnohodnotně identifikovaný. Řídí varovný banner. */
export const OPERATOR_INCOMPLETE = OPERATOR.address === '' || OPERATOR.ico === '' || OPERATOR.email === '';

/**
 * Kde běží aplikace a data. Patří do zásad ochrany osobních údajů jako příjemci a místo
 * zpracování — a nesmí se odhadovat.
 *
 * Ověřeno 11. 9. 2026 na produkčním nasazení `dpl_Bn1SrQp2wthGe9hSPGKkR7JTZkWv`:
 *  • funkce: `regions: ["iad1"]` v detailu nasazení — Washington, D.C., USA;
 *  • databáze: build log Prismy, `Datasource "db" … at "ep-…-pooler.eu-central-1.aws.neon.tech"`
 *    — Neon na AWS ve Frankfurtu.
 *
 * Když se region funkcí ve Vercelu (Settings → Functions) nebo databáze změní, musí se změnit
 * i tady, jinak zásady tvrdí nepravdu o tom, kde se data zpracovávají.
 */
export const HOSTING: { functionsRegion: string; database: { provider: string; region: string } } = {
  functionsRegion: 'iad1',
  database: { provider: 'Neon', region: 'aws-eu-central-1' },
};

/** True, dokud nejsou region a poskytovatel databáze ověřené. */
export const HOSTING_UNVERIFIED =
  HOSTING.functionsRegion === '' || HOSTING.database.provider === '' || HOSTING.database.region === '';

/**
 * Datum poslední změny právních textů. Měň ho ručně při každé věcné úpravě — čl. 12 GDPR stojí
 * na tom, že subjekt pozná, kterou verzi četl.
 */
export const LEGAL_UPDATED = '11. 9. 2026';

/** Jeden odstavec nebo odrážkový seznam, ve třech jazycích. */
export interface LegalBlock {
  heading: { cs: string; sk?: string; en: string };
  /** Odstavce. */
  body?: Array<{ cs: string; sk?: string; en: string }>;
  /** Odrážky pod odstavci. */
  bullets?: Array<{ cs: string; sk?: string; en: string }>;
}
