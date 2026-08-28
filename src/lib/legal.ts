/**
 * Who runs this service, in one place.
 *
 * ⚠️ NEŽ TO PUSTÍŠ NA OSTRO: vyplň `address` a `ico` níže.
 *
 * Není to kosmetika. Čl. 13 odst. 1 písm. a) GDPR ukládá správci sdělit subjektu údajů svou
 * *totožnost a kontaktní údaje*, a samotná e-mailová adresa za totožnost nepovažuje — subjekt
 * musí být schopen zjistit, komu vlastně své údaje svěřil, a kam poslat žádost o výmaz.
 * U placené služby k tomu přistupuje § 1811 obč. zák.: spotřebitel musí před uzavřením smlouvy
 * znát totožnost a sídlo podnikatele.
 *
 * Dokud jsou pole prázdná, aplikace to na právních stránkách viditelně přizná, místo aby
 * předstírala, že je vše v pořádku. Falešná identita správce je horší než přiznaná mezera.
 */
export const OPERATOR = {
  name: 'Kristián Janků',
  email: 'krstnjanku@gmail.com',
  /** Ulice, město, PSČ. Prázdné = nevyplněno. */
  address: '',
  /** IČO, pokud podnikáš na živnostenský list. Prázdné = nevyplněno. */
  ico: '',
} as const;

/** True, když provozovatel ještě není plnohodnotně identifikovaný. Řídí varovný banner. */
export const OPERATOR_INCOMPLETE = OPERATOR.address === '' || OPERATOR.ico === '';

/**
 * Datum poslední změny právních textů. Měň ho ručně při každé věcné úpravě — čl. 12 GDPR stojí
 * na tom, že subjekt pozná, kterou verzi četl.
 */
export const LEGAL_UPDATED = '28. 8. 2026';

/** Jeden odstavec nebo odrážkový seznam, ve třech jazycích. */
export interface LegalBlock {
  heading: { cs: string; sk?: string; en: string };
  /** Odstavce. */
  body?: Array<{ cs: string; sk?: string; en: string }>;
  /** Odrážky pod odstavci. */
  bullets?: Array<{ cs: string; sk?: string; en: string }>;
}
