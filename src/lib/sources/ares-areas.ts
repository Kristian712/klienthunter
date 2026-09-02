/**
 * Městské části a obvody velkých měst — poslední úroveň, na kterou se dá dotaz na ARES rozdělit.
 *
 * ARES odmítne dotaz, jehož výsledek by přesáhl tisíc řádků: nevrátí prvních tisíc, vrátí
 * HTTP 400 a nulu. U velkého města to znamená, že se dnes z ARESu nedozvíme nic — změřeno
 * 2. 9. 2026 na NACE 96210 (kadeřnictví): „Praha", „Brno", „Ostrava" i „Plzeň" jako
 * `textovaAdresa` skončily s `VYSTUP_PRILIS_MNOHO_VYSLEDKU`, zatímco Liberec (939)
 * a Olomouc (894) prošly. Rozpad podle právní formy nepomůže, protože živnostníků samotných
 * je v Praze osmdesát tisíc.
 *
 * Z klíčů, kterými ARES umí zúžit sídlo, funguje pro tenhle účel jediný:
 * `sidlo.kodMestskeCastiObvodu`. (`kodKraje`, `kodOkresu`, `nazevKraje`, `psc` a
 * `kodAdresnihoMista` ARES tiše ignoruje — vrátí stejný celkový počet, jako by tam nebyly.)
 * Po rozpadu je Praha 1 = 720 řádků, Brno-střed = 796, Moravská Ostrava a Přívoz = 361;
 * všechno pod stropem.
 *
 * ## Odkud čísla jsou
 *
 * Nejsou opsaná z internetu ani vymyšlená. Vygenerovaly se ze stejného zdroje, ze kterého bere
 * souřadnice `ruian.ts` — z otevřených dat RÚIAN, ze souboru adresních míst obce
 * (`https://atom.cuzk.cz/RUIAN-CSV-ADR-OB/datasetFeeds/…_<kód obce>.xml` → CSV, sloupce
 * „Kód MOMC" a „Název MOMC"). Odtud i kontrola, že kód obce sedí: v datech Pardubic stojí
 * u každého řádku „Pardubice".
 *
 * ## Proč statická tabulka a ne stahování za běhu
 *
 * Městské části vznikají a zanikají zákonem, tedy jednou za desítky let; poslední změna v Praze
 * je z roku 1990. Stahovat kvůli nim při každém hledání dvacetimegabajtový CSV soubor by bylo
 * o tři řády dražší než užitek. Kdyby přesto přibyla nová část, hledání o ni přijde — ne
 * o celé město —, a přidá se sem jedním řádkem.
 *
 * Seznam obsahuje všech osm českých měst členěných na obvody nebo části. Čtyři z nich strop
 * skutečně přetékají; u Liberce, Opavy, Pardubic a Ústí nad Labem je to pojistka pro obory
 * hustší, než je kadeřnictví.
 */

/** Bez diakritiky a malými písmeny, aby „Plzeň" a „Plzen" byly totéž. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface CityAreas {
  /** Kód obce v RÚIAN — jen pro dohledatelnost, odkud se seznam vzal. */
  obec: number;
  /** Kódy MOMC, tedy hodnoty do `sidlo.kodMestskeCastiObvodu`. */
  areas: number[];
}

const CITIES: Record<string, CityAreas> = {
  praha: {
    obec: 554782,
    areas: [
      500054, 500089, 500097, 500119, 500143, 500178, 500186, 500208, 500216, 500224,
      538060, 538078, 538124, 538175, 538205, 538213, 538302, 538353, 538361, 538388,
      538400, 538531, 538736, 538931, 538949, 539007, 539449, 539465, 539589, 539601,
      539635, 539678, 539694, 539724, 539791, 539864, 539899, 547034, 547042, 547051,
      547107, 547115, 547140, 547158, 547174, 547271, 547298, 547301, 547310, 547328,
      547344, 547361, 547379, 547387, 547395, 547409, 547417,
    ],
  },
  brno: {
    obec: 582786,
    areas: [
      550973, 550990, 551007, 551031, 551058, 551066, 551074, 551082, 551091, 551112,
      551147, 551171, 551198, 551210, 551228, 551236, 551244, 551252, 551279, 551287,
      551295, 551309, 551317, 551325, 551368, 551376, 551406, 551422, 551431,
    ],
  },
  ostrava: {
    obec: 554821,
    areas: [
      545911, 546046, 546135, 546224, 554219, 554227, 554235, 554243, 554286, 554308,
      554324, 554332, 554367, 554375, 554430, 554537, 554561, 554570, 554588, 554669,
      554685, 554715, 554723,
    ],
  },
  plzen: {
    obec: 554791,
    areas: [545970, 545988, 546003, 546208, 554731, 554758, 554766, 554774, 557978, 559199],
  },
  pardubice: {
    obec: 555134,
    areas: [555096, 555100, 555118, 555126, 557064, 557072, 574716, 575020],
  },
  'usti nad labem': {
    obec: 554804,
    areas: [501298, 502081, 502316, 567892],
  },
  liberec: {
    obec: 563889,
    areas: [556891, 556904],
  },
  opava: {
    obec: 505927,
    areas: [555321, 555339, 555355, 555371, 555401, 555410, 555436, 555461, 556700],
  },
};

/**
 * Na jaké části se dá město rozdělit. Prázdné pole znamená „tohle město dělit neumíme" —
 * volající pak nemá co zkoušet a vrátí, co má.
 *
 * Porovnává se přesný název (bez diakritiky a bez toho, co je za čárkou, protože region chodí
 * jako „Brno, Jihomoravský kraj"). Schválně to není hledání podle začátku: kdo napsal
 * „Praha 4" nebo „Ostrava-Poruba", chce jednu část, a vrátit mu celé město by bylo horší než
 * nevrátit nic — dostal by stovky firem odjinud a nepoznal by to.
 */
export function subAreasFor(city: string): number[] {
  const norm = normalize(city.split(',')[0]);
  return norm ? CITIES[norm]?.areas ?? [] : [];
}
