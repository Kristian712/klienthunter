import axios from 'axios';
import { unzipSync } from 'fflate';
import proj4 from 'proj4';

/**
 * Souřadnice firem z RÚIAN — zadarmo a bez podmínek.
 *
 * ARES vrací adresu textem, ale spolu s ní i `kodAdresnihoMista` (u 97 % subjektů, změřeno na
 * stovce autoservisů ve Zlíně). To je klíč do Registru územní identifikace, adres a nemovitostí,
 * kde má každé adresní místo v republice přesné souřadnice. ČÚZK ta data publikuje jako otevřená,
 * po obcích, a ve svém ATOM feedu k nim píše doslova: „žádné podmínky neplatí".
 *
 * Bez tohohle by mapa ukazovala jen firmy z OpenStreetMap — na hledání „Autoservis, Zlínský kraj"
 * to bylo 0 z 500, protože Overpass v tom běhu vůbec neodpověděl. S RÚIAN je jich 495.
 *
 * Proč se to nestahuje pro celou republiku: celostátní soubor má 63 MB a přes tři miliony řádků,
 * což je na databázi zbytečná zátěž. Soubor jedné obce má sto až čtyři sta kilobajtů a stáhne se
 * za desetinu sekundy — bereme jen ty obce, ve kterých hledání skutečně něco našlo.
 */

/** S-JTSK / Křovák East North, v jakém RÚIAN publikuje souřadnice. */
proj4.defs(
  'EPSG:5514',
  '+proj=krovak +lat_0=49.5 +lon_0=24.8333333333333 +alpha=30.2881397527778 ' +
    '+k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs',
);

export interface LatLon { lat: number; lon: number }

/** Kolik obcí smí jedno hledání stáhnout. Pojistka proti dotazu rozesetému po celé republice. */
const MAX_OBCE_PER_SEARCH = 25;
const FEED_TIMEOUT_MS = 8_000;
const FILE_TIMEOUT_MS = 15_000;

/**
 * Paměť procesu. Adresní místa obce se mění jednou měsíčně, takže je zbytečné stahovat je
 * podruhé — a při jednom hledání se tatáž obec potká u stovek firem.
 */
const cache = new Map<number, Promise<Map<number, LatLon>>>();

/** Z ATOM feedu obce vytáhne adresu aktuálního CSV. Název souboru nese datum, proto ten mezikrok. */
async function csvUrlForObec(obecCode: number): Promise<string | null> {
  const feed = `https://atom.cuzk.cz/RUIAN-CSV-ADR-OB/datasetFeeds/CZ-00025712-CUZK_RUIAN-CSV-ADR-OB_${obecCode}.xml`;
  const res = await axios.get<string>(feed, {
    timeout: FEED_TIMEOUT_MS,
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    responseType: 'text',
    validateStatus: () => true,
  });
  if (res.status !== 200 || typeof res.data !== 'string') return null;
  const match = res.data.match(/href="(https:\/\/[^"]*_ADR\.csv\.zip)"/);
  return match?.[1] ?? null;
}

/**
 * Stáhne a rozparsuje adresní místa jedné obce.
 *
 * Ze všech devatenácti sloupců potřebujeme tři: kód adresního místa a dvě souřadnice. Ty jsou
 * číselné, takže na kódování nezáleží — hlavička je ale v cp1250 a sloupce se hledají podle ní.
 */
async function loadObec(obecCode: number): Promise<Map<number, LatLon>> {
  const out = new Map<number, LatLon>();
  try {
    const url = await csvUrlForObec(obecCode);
    if (!url) return out;

    const zip = await axios.get<ArrayBuffer>(url, {
      timeout: FILE_TIMEOUT_MS,
      signal: AbortSignal.timeout(FILE_TIMEOUT_MS),
      responseType: 'arraybuffer',
      validateStatus: () => true,
    });
    if (zip.status !== 200) return out;

    const files = unzipSync(new Uint8Array(zip.data));
    const first = Object.values(files)[0];
    if (!first) return out;

    const text = new TextDecoder('windows-1250').decode(first);
    const lines = text.split(/\r?\n/);
    const header = lines[0]?.split(';') ?? [];
    const iAdm = header.findIndex(h => h.includes('Kód ADM'));
    const iX = header.findIndex(h => h.includes('Souřadnice X'));
    const iY = header.findIndex(h => h.includes('Souřadnice Y'));
    if (iAdm < 0 || iX < 0 || iY < 0) return out;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      const adm = Number(cols[iAdm]);
      const x = Number(cols[iX]);
      const y = Number(cols[iY]);
      // Adresní místa bez souřadnic v datech existují — přeskakují se, nedopočítávají.
      if (!adm || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      // V CSV jsou kladné magnitudy, EPSG:5514 očekává záporné hodnoty.
      const [lon, lat] = proj4('EPSG:5514', 'WGS84', [-y, -x]);
      if (Number.isFinite(lat) && Number.isFinite(lon)) out.set(adm, { lat, lon });
    }
  } catch {
    // Výpadek ČÚZK nesmí položit hledání. Firmy prostě zůstanou bez souřadnic, tedy ve stavu,
    // ve kterém byly předtím, než tenhle modul existoval.
  }
  return out;
}

function obecTable(obecCode: number): Promise<Map<number, LatLon>> {
  const hit = cache.get(obecCode);
  if (hit) return hit;
  const pending = loadObec(obecCode);
  cache.set(obecCode, pending);
  return pending;
}

export interface Geocodable {
  obecCode?: number;
  ruianCode?: number;
  lat?: number;
  lon?: number;
}

/**
 * Doplní souřadnice těm firmám, které je ještě nemají. Mění předané objekty na místě.
 *
 * Obce se berou od nejčastější po nejvzácnější, aby se strop `MAX_OBCE_PER_SEARCH` utratil tam,
 * kde přinese nejvíc bodů. Souřadnice ze zdroje (OpenStreetMap) se nepřepisují — ta je u firmy,
 * ne u adresy jejího sídla, a je tedy přesnější.
 */
export async function fillCoordinates(leads: Geocodable[]): Promise<number> {
  const missing = leads.filter(l => l.lat === undefined && l.obecCode && l.ruianCode);
  if (missing.length === 0) return 0;

  const byObec = new Map<number, number>();
  for (const l of missing) byObec.set(l.obecCode!, (byObec.get(l.obecCode!) ?? 0) + 1);
  const obce = Array.from(byObec.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_OBCE_PER_SEARCH)
    .map(([code]) => code);

  const tables = new Map<number, Map<number, LatLon>>();
  await Promise.all(obce.map(async code => { tables.set(code, await obecTable(code)); }));

  let filled = 0;
  for (const lead of missing) {
    const point = tables.get(lead.obecCode!)?.get(lead.ruianCode!);
    if (!point) continue;
    lead.lat = point.lat;
    lead.lon = point.lon;
    filled++;
  }
  return filled;
}
