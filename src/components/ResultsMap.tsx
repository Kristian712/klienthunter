'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { localized } from '@/lib/lead-filters';
import {
  LEAD_STATUSES, WEB_COLORS, isTagged, pointColor, pointShape,
  type LeadStatus, type PointShape,
} from '@/lib/lead-tags';

/**
 * Mapa výsledků.
 *
 * Dlaždice bere z OpenFreeMap: bez API klíče, bez registrace, bez limitu na počet zobrazení,
 * open source, data z OpenStreetMap. Je to jediný zdroj map, u kterého se nemůže stát, že
 * jednoho dne přijde faktura — a to je u aplikace, která má běžet zadarmo, důležitější než
 * hezčí styl.
 *
 * Co mapa **neumí a umět nemá**: ukázat firmu, u které neznáme souřadnice. Ty dnes nese jen
 * OpenStreetMap; firmy nalezené v ARESu mají adresu textem a na mapě chybí. Komponenta proto
 * nahlásí, kolik firem z celkového počtu vykreslila — tichý výběr třetiny dat by čtenář přečetl
 * jako „tolik jich tam je".
 *
 * Bod nese dvě informace naráz a každou jiným kanálem: **tvar** říká, jestli firma má web,
 * **barva** ukazuje uživatelovu značku. Díky tomu jde web přečíst i u označené firmy a mapa
 * dává smysl i barvoslepému — legenda vedle mapy oboje pojmenovává, aby se na nic neklikalo.
 */

export interface MapLead {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  category?: string;
  ico?: string;
  lat?: number | null;
  lon?: number | null;
  hasWebsite: boolean;
  websiteStatus?: string | null;
  leadScore: number;
  status?: string | null;
}

const T = {
  onMap:    { cs: 'Na mapě {n} z {total} firem', sk: 'Na mape {n} z {total} firiem', en: '{n} of {total} firms on the map' },
  withWeb:  { cs: '{n} s webem', sk: '{n} s webom', en: '{n} with a website' },
  noWeb:    { cs: '{n} bez nalezeného webu', sk: '{n} bez nájdeného webu', en: '{n} with no website found' },
  noCoords: { cs: 'U zbylých neznáme souřadnice — ARES je nevrací, jen adresu textem.',
              sk: 'Pri zvyšných nepoznáme súradnice — ARES ich nevracia, len adresu textom.',
              en: 'We have no coordinates for the rest — ARES returns only a postal address.' },
  none:     { cs: 'Žádnou z nalezených firem neumíme umístit na mapu. Zkuste seznam.',
              sk: 'Žiadnu z nájdených firiem nevieme umiestniť na mapu. Skúste zoznam.',
              en: 'None of the firms found can be placed on the map. Try the list.' },
  webHas:   { cs: 'Web ověřen',      sk: 'Web overený',    en: 'Website verified' },
  webNone:  { cs: 'Web neuveden',    sk: 'Web neuvedený',  en: 'No website listed' },
  // Krátká varianta do popisku u bodu — vedle názvu firmy musí být co nejúspornější.
  hasShort: { cs: 'má web',          sk: 'má web',         en: 'has a site' },
  noneShort:{ cs: 'web neuveden',    sk: 'web neuvedený',  en: 'no site listed' },
  openMaps: { cs: 'Otevřít na Google Maps', sk: 'Otvoriť na Google Maps', en: 'Open in Google Maps' },
  close:    { cs: 'Zavřít',          sk: 'Zavrieť',        en: 'Close' },
  legend:   { cs: 'Legenda',         sk: 'Legenda',        en: 'Legend' },
  legWeb:   { cs: 'Web',             sk: 'Web',            en: 'Website' },
  legTags:  { cs: 'Vaše značky',     sk: 'Vaše značky',    en: 'Your tags' },
  legHint:  { cs: 'Tvar říká web, barva vaši značku.',
              sk: 'Tvar hovorí web, farba vašu značku.',
              en: 'Shape shows the website, colour shows your tag.' },
  zoomHint: { cs: 'Názvy firem se ukážou po přiblížení.',
              sk: 'Názvy firiem sa ukážu po priblížení.',
              en: 'Firm names appear as you zoom in.' },
  attrib:   { cs: 'Mapa © OpenFreeMap, data © přispěvatelé OpenStreetMap',
              sk: 'Mapa © OpenFreeMap, dáta © prispievatelia OpenStreetMap',
              en: 'Map © OpenFreeMap, data © OpenStreetMap contributors' },
  hideDone: { cs: 'Skrýt vyřízené', sk: 'Skryť vybavené', en: 'Hide handled' },
  hiddenNote: { cs: 'Skryto {n}',   sk: 'Skryté {n}',     en: '{n} hidden' },
};

/**
 * „Skryto 24 vyřízených".
 *
 * Čeština i slovenština mají u čísel tři tvary a jazyk, který napíše „24 vyřízená", zní jako
 * strojový překlad — v aplikaci, která jinak mluví normálně, to bije do očí víc, než by se
 * čekalo. Angličtina má tvary dva.
 */
function doneCountLabel(n: number, locale: string): string {
  if (locale === 'en') return `${n} handled ${n === 1 ? 'firm' : 'firms'}`;
  const forms = locale === 'sk'
    ? ['vybavená', 'vybavené', 'vybavených']
    : ['vyřízená', 'vyřízené', 'vyřízených'];
  const form = n === 1 ? forms[0] : n >= 2 && n <= 4 ? forms[1] : forms[2];
  return `${n} ${form}`;
}

/** Odkaz na Google Maps. Jen adresa, žádné API a žádný klíč — vyhledání podle názvu a adresy. */
export function googleMapsHref(lead: MapLead): string {
  const q = [lead.name, lead.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * Přebarví načtený podklad do palety webovkyvanek.cz.
 *
 * Positron je nejtišší styl, jaký OpenFreeMap nabízí, ale je studeně šedozelený a maluje plochy
 * zeleně, které na mapě firem nic neznamenají. Tady dostane teplou špinavě bílou `#f6f5f2` —
 * tedy přesně pozadí webu — bílé silnice a tlumené popisky. Body jsou pak jediná sytá věc na
 * obrazovce, což je celý smysl té mapy.
 *
 * Mění se hotový styl po načtení, ne jeho JSON před vytvořením mapy: kdyby se čekalo na stažení
 * a úpravu stylu, neexistovala by mapa, do které se dají sázet body, a první dávka firem by se
 * ztratila.
 */
function tintVanek(m: MapLibreMap) {
  const style = m.getStyle();
  if (!style?.layers) return;

  for (const layer of style.layers) {
    const id = layer.id;
    // POI a půdorysy budov: na mapě, kde každý bod je firma, jsou to jen další tečky navíc.
    if (/poi|building/i.test(id)) {
      if (m.getLayer(id)) m.removeLayer(id);
      continue;
    }
    try {
      if (layer.type === 'background') m.setPaintProperty(id, 'background-color', '#f6f5f2');
      if (layer.type === 'fill') {
        const voda = /water/i.test(id);
        m.setPaintProperty(id, 'fill-color', voda ? '#e4e3de' : '#f0efeb');
      }
      if (layer.type === 'line') {
        if (/water|river|stream/i.test(id)) m.setPaintProperty(id, 'line-color', '#dcdbd6');
        else if (/boundary|admin/i.test(id)) m.setPaintProperty(id, 'line-color', 'rgba(16,16,17,.22)');
        else m.setPaintProperty(id, 'line-color', '#ffffff');
      }
      if (layer.type === 'symbol') {
        m.setPaintProperty(id, 'text-color', '#83848a');
        m.setPaintProperty(id, 'text-halo-color', '#f6f5f2');
        m.setPaintProperty(id, 'text-halo-width', 1.4);
      }
    } catch {
      // Vrstva, která tuhle vlastnost nemá. Přeskočit ji je správně — styl se mezi verzemi mění
      // a jedna neznámá vrstva nesmí shodit celý podklad.
    }
  }
}

/**
 * Od jakého přiblížení se u bodů píšou názvy.
 *
 * Níž by to nemělo smysl ani s odklízením překryvů: na pohledu na celý kraj by popisek dostala
 * hrstka náhodných firem a zbytek by mlčel, což čte hůř než čistá mapa.
 */
const LABEL_MIN_ZOOM = 13;
/**
 * Strop pro počet popisků ve výřezu.
 *
 * Šedesát bylo číslo proti úplnému zčernání, ne proti nečitelnosti — v Liberci jich na běžném
 * zoomu vyšlo přes třicet a mapa se změnila v seznam. Dvanáct je tak akorát: pořád je z čeho
 * číst, ale mezi popisky zbude mapa. Dostanou je nejlepší leady ve výřezu, ne náhodné.
 */
const MAX_LABELS = 12;
/** Odstup mezi popisky. Dva rámečky na sraz čtou jako jeden odstavec. */
const LABEL_GAP = 6;

// ── Body ──────────────────────────────────────────────────────────────────────

/** Styl puntíku. Sdílí ho marker na mapě i vzorek v legendě, aby se nemohly rozejít. */
function dotStyle(color: string, shape: PointShape, tagged: boolean, size: number): CSSProperties {
  return {
    display: 'block',
    width: size,
    height: size,
    background: color,
    border: '2px solid #fff',
    boxShadow: '0 1px 3px rgba(0,0,0,.4)',
    borderRadius: shape === 'diamond' ? 2 : '50%',
    transform: shape === 'diamond' ? 'rotate(45deg)' : undefined,
    // Označená firma dostane tmavý kroužek. Je to nebarevný klíč navíc: „už jsem ji řešil"
    // se pozná i bez rozeznání odstínu.
    outline: tagged ? '1.5px solid rgba(0,0,0,.55)' : undefined,
  };
}

/** Marker si MapLibre bere jako hotový DOM prvek, ne jako JSX — styl mu musíme podat textem. */
function toCssText(style: CSSProperties): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}:${typeof v === 'number' ? `${v}px` : v}`)
    .join(';');
}

/** Šířka popisku v pixelech. Měří se doopravdy, odhad podle počtu znaků by u „ě" a „i" lhal. */
function makeMeasurer(): (text: string) => number {
  let ctx: CanvasRenderingContext2D | null = null;
  return (text: string) => {
    if (!ctx) {
      ctx = document.createElement('canvas').getContext('2d');
      if (ctx) ctx.font = '11px system-ui, -apple-system, sans-serif';
    }
    return ctx ? ctx.measureText(text).width : text.length * 6;
  };
}

// ── Legenda ───────────────────────────────────────────────────────────────────

function Swatch({ color, shape, tagged }: { color: string; shape: PointShape; tagged: boolean }) {
  return (
    <span className="inline-flex w-4 h-4 shrink-0 items-center justify-center" aria-hidden>
      <span style={dotStyle(color, shape, tagged, 11)} />
    </span>
  );
}

function Legend({ locale, labelsOn }: { locale: string; labelsOn: boolean }) {
  const tags = LEAD_STATUSES.filter(s => s.id !== 'new');
  return (
    <aside className="md:w-52 shrink-0 border border-line rounded-xl p-3 bg-surface-subtle">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">
        {localized(T.legend, locale)}
      </p>

      <p className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">{localized(T.legWeb, locale)}</p>
      <ul className="grid grid-cols-2 md:grid-cols-1 gap-x-3 gap-y-1 mb-3">
        <li className="flex items-center gap-2 text-xs text-ink-muted">
          <Swatch color={WEB_COLORS.has} shape="circle" tagged={false} />
          {localized(T.webHas, locale)}
        </li>
        <li className="flex items-center gap-2 text-xs text-ink-muted">
          <Swatch color={WEB_COLORS.none} shape="diamond" tagged={false} />
          {localized(T.webNone, locale)}
        </li>
      </ul>

      <p className="text-[10px] uppercase tracking-wider text-ink-faint mb-1">{localized(T.legTags, locale)}</p>
      <ul className="grid grid-cols-2 md:grid-cols-1 gap-x-3 gap-y-1">
        {tags.map(s => (
          <li key={s.id} className="flex items-center gap-2 text-xs text-ink-muted">
            <Swatch color={s.color} shape="circle" tagged />
            {localized(s.label, locale)}
          </li>
        ))}
      </ul>

      <p className="text-[10px] text-ink-faint mt-3 leading-snug">{localized(T.legHint, locale)}</p>
      {!labelsOn && (
        <p className="text-[10px] text-ink-faint mt-1 leading-snug">{localized(T.zoomHint, locale)}</p>
      )}
    </aside>
  );
}

// ── Mapa ──────────────────────────────────────────────────────────────────────

interface Props {
  leads: MapLead[];
  /** Kolik firem je celkem ve výsledku, včetně těch bez souřadnic. */
  total: number;
  locale: string;
  onSetStatus: (leadId: string, status: LeadStatus) => void;
  /** Skrývají se firmy, se kterými už uživatel skončil? Rozhoduje stránka, mapa jen kreslí. */
  hideDone: boolean;
  /** Kolik firem přepínač právě schoval. Nula znamená, že se o něm nemá co říkat. */
  hiddenDone: number;
  onToggleHideDone: () => void;
}

export function ResultsMap({ leads, total, locale, onSetStatus, hideDone, hiddenDone, onToggleHideDone }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  /** Popisky u bodů: k čemu patří a který prvek je nese. Přepočítávají se při každém pohybu mapy. */
  const labels = useRef<Array<{ lead: MapLead; el: HTMLElement; root: HTMLElement }>>([]);
  /** Přepočet popisků. V refu, aby ho posluchače mapy mohly volat, i když se mezitím změnila data. */
  const relayout = useRef<() => void>(() => {});
  const measure = useRef(makeMeasurer());
  /** Na výsledky se doskočí jednou. Další dávky už mapu pod rukama neposouvají. */
  const fitted = useRef(false);
  const [selected, setSelected] = useState<MapLead | null>(null);
  const [failed, setFailed] = useState(false);
  const [labelsOn, setLabelsOn] = useState(false);

  const placeable = leads.filter(l => typeof l.lat === 'number' && typeof l.lon === 'number');
  const withWeb = placeable.filter(l => l.hasWebsite).length;
  const withoutWeb = placeable.length - withWeb;

  // Mapa se vytváří jednou. Kdyby se přetvářela při každé změně výsledků, ztratil by uživatel
  // pozici i přiblížení pokaždé, když doběhne další dávka firem.
  useEffect(() => {
    if (!container.current || map.current) return;
    const m = new MapLibreMap({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [15.47, 49.82], // střed ČR, než dorazí první firmy
      zoom: 6.5,
      attributionControl: false,
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    m.on('style.load', () => tintVanek(m));
    // Když se nepovede načíst styl nebo dlaždice, ať to není tichý prázdný obdélník.
    m.on('error', e => { console.warn('mapa:', e?.error?.message ?? e); setFailed(true); });
    // Popisky se přerovnávají až po dojetí pohybu. Během posouvání jedou s body samy — jsou
    // jejich potomci — takže překreslovat je v každém snímku by nic nepřidalo.
    m.on('moveend', () => relayout.current());
    m.on('zoomend', () => relayout.current());
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, []);

  // Body. Překreslují se při každé změně dat — je jich řádově stovky, takže je levnější je
  // vysázet znovu než držet a párovat diff.
  useEffect(() => {
    const m = map.current;
    // Schválně bez čekání na `load`: body jsou obyčejné HTML prvky ukotvené k souřadnicím,
    // se stylem mapy nemají nic společného. Vázat je na načtení dlaždic znamenalo prázdnou
    // mapu pokaždé, když se styl načítal pomalu nebo vůbec.
    if (!m) return;

    markers.current.forEach(mk => mk.remove());
    markers.current = [];
    labels.current = [];

    for (const lead of placeable) {
      const shape = pointShape(lead.hasWebsite);
      const webShort = localized(lead.hasWebsite ? T.hasShort : T.noneShort, locale);

      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', `${lead.name} — ${webShort}`);
      // Bez `position`: MapLibre dává markeru `position:absolute` vlastní třídou a přebít mu ji
      // znamená body poslepovat do rohu mapy. Absolutně umístěný popisek se stejně kotví k němu.
      el.style.cssText = 'display:block;padding:0;border:0;background:none;cursor:pointer';

      const dot = document.createElement('span');
      dot.style.cssText = toCssText(dotStyle(pointColor(lead.hasWebsite, lead.status), shape, isTagged(lead.status), 13));
      el.appendChild(dot);

      // Popisek visí mimo tok, takže neposouvá kotvu bodu. Ukazuje se až podle `relayout`.
      const label = document.createElement('span');
      label.textContent = `${lead.name} · ${webShort}`;
      label.style.cssText = [
        'position:absolute;left:14px;top:50%;transform:translateY(-50%)',
        'white-space:nowrap;font:11px system-ui,-apple-system,sans-serif;color:#111',
        'background:rgba(255,255,255,.95);padding:1px 4px;border-radius:3px',
        'pointer-events:none;display:none',
      ].join(';');
      el.appendChild(label);

      el.addEventListener('click', e => { e.stopPropagation(); setSelected(lead); });
      labels.current.push({ lead, el: label, root: el });
      markers.current.push(
        new Marker({ element: el }).setLngLat([lead.lon!, lead.lat!]).addTo(m),
      );
    }

    /**
     * Které body dostanou popisek.
     *
     * Pod hranicí přiblížení žádný. Nad ní se jde od nejlepšího leadu dolů a popisek dostane jen
     * ten, jehož obdélník se nekříží s žádným už přijatým — takže při odzoomování mizí ty méně
     * zajímavé, ne náhodné. Body mimo výřez se ani nepočítají.
     */
    relayout.current = () => {
      const map0 = map.current;
      if (!map0) return;
      // Markery jsou sourozenci ve stejné vrstvě, takže ty vysázené později kreslí přes popisky
      // těch dřívějších. Bod s popiskem se proto na dobu, co ho má, zvedne nad ostatní.
      labels.current.forEach(l => { l.el.style.display = 'none'; l.root.style.zIndex = ''; });

      const on = map0.getZoom() >= LABEL_MIN_ZOOM;
      setLabelsOn(on);
      if (!on) return;

      const canvas = map0.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const taken: Array<[number, number, number, number]> = [];

      const byScore = [...labels.current].sort((a, b) => b.lead.leadScore - a.lead.leadScore);
      for (const item of byScore) {
        if (taken.length >= MAX_LABELS) break;
        const p = map0.project([item.lead.lon!, item.lead.lat!]);
        if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) continue;

        const width = measure.current(item.el.textContent ?? '') + 10;
        const box: [number, number, number, number] = [
          p.x + 14 - LABEL_GAP, p.y - 9 - LABEL_GAP,
          p.x + 14 + width + LABEL_GAP, p.y + 9 + LABEL_GAP,
        ];
        // Popisek, který by přetekl přes okraj mapy, se ořízne v půlce slova a vypadá to jako
        // chyba. Radši ho nedat — bod je pořád vidět a po posunutí mapy se popisek objeví.
        if (box[0] < 0 || box[1] < 0 || box[2] > w || box[3] > h) continue;
        const collides = taken.some(t => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
        if (collides) continue;

        taken.push(box);
        item.el.style.display = 'block';
        item.root.style.zIndex = '1';
      }
    };

    // Po prvním naplnění doskoč na výsledky. Bez animace: `duration` běží přes requestAnimationFrame,
    // a když je záložka na pozadí, rAF nejede — kamera by zůstala na výchozím pohledu na celou ČR
    // a `fitted` už je nastavené, takže by se to nikdy nedohnalo. Později se nedoskakuje: uživatel
    // si mapu posouvá sám a skákat mu pod rukama při každé dávce by bylo nepoužitelné.
    if (placeable.length > 0 && !fitted.current) {
      fitted.current = true;
      const b = new LngLatBounds();
      placeable.forEach(l => b.extend([l.lon!, l.lat!]));
      m.fitBounds(b, { padding: 48, maxZoom: 14, duration: 0 });
    }

    relayout.current();
  }, [placeable.map(l => `${l.id}:${l.status ?? ''}`).join(','), locale]);

  return (
    <div>
      {/* Počítadlo. Odpovídá na „kolik jich je a kolik z nich stojí za oslovení" bez jediného kliknutí. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
        <p className="text-xs text-ink">
          {localized(T.onMap, locale).replace('{n}', String(placeable.length)).replace('{total}', String(total))}
        </p>
        <span className="text-ink-faint text-xs">·</span>
        <p className="text-xs text-ink-muted">{localized(T.withWeb, locale).replace('{n}', String(withWeb))}</p>
        <span className="text-ink-faint text-xs">·</span>
        <p className="text-xs text-ink-muted">{localized(T.noWeb, locale).replace('{n}', String(withoutWeb))}</p>

        {/*
          Přepínač i počet stojí v jedné řadě s počítadlem, ne nad mapou zvlášť: kdo čte, kolik
          firem mapa ukazuje, má hned vedle napsáno, kolik jich neukazuje a proč. Kolik je
          schovaných, se říká jen když se opravdu něco schovalo — nula by byla jen šum.
        */}
        <span className="text-ink-faint text-xs ml-auto">
          {hideDone && hiddenDone > 0 && (
            <span className="text-xs text-ink-muted mr-2">
              {localized(T.hiddenNote, locale).replace('{n}', doneCountLabel(hiddenDone, locale))}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleHideDone}
            aria-pressed={hideDone}
            className={`text-xs px-2 py-1 border rounded-lg transition-colors ${
              hideDone ? 'border-ink text-ink font-semibold' : 'border-line text-ink-muted hover:text-ink'
            }`}
          >
            {localized(T.hideDone, locale)}
          </button>
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <div ref={container} className="w-full h-[26rem] md:h-[34rem] rounded-xl overflow-hidden border border-line" />

          {placeable.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="bg-surface-subtle/95 border border-line px-4 py-3 text-sm text-ink-muted max-w-xs text-center">
                {localized(T.none, locale)}
              </p>
            </div>
          )}

          {selected && (
            /**
             * Karta firmy.
             *
             * `z-30`, protože popisky zvedají svůj bod na `z-index: 1` a kreslily se přes IČO
             * i přes přepínač stavu. Na mobilu je to spodní pruh přes celou šířku se stropem
             * na 38 % výšky mapy — plovoucí karta by tam ukrojila skoro celou mapu.
             */
            <div className="absolute z-30 inset-x-2 bottom-2 md:inset-x-auto md:left-3 md:bottom-20
                            md:w-80 max-h-[33%] md:max-h-none overflow-y-auto
                            bg-surface-subtle border border-ink rounded-lg p-3 md:p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-extrabold text-[15px] leading-tight tracking-[-0.02em] min-w-0">
                  {selected.name}
                </p>
                <button
                  onClick={() => setSelected(null)}
                  aria-label={localized(T.close, locale)}
                  className="text-ink-faint hover:text-ink text-lg leading-none shrink-0 -mt-1"
                >
                  ×
                </button>
              </div>

              {/* Jeden řádek na to, co firmu identifikuje. Dřív to byly tři odstavce a dva badge. */}
              <p className="text-[11px] text-ink-faint mt-1 leading-snug line-clamp-1 md:line-clamp-none">
                {selected.ico && <span className="font-mono">IČO {selected.ico}</span>}
                {selected.ico && selected.address && ' · '}
                {selected.address}
              </p>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]">
                {/* Kontakty nese jen menšina řádků (ARES je nemá), ale když je má, patří sem. */}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="font-mono text-ink hover:text-accent transition-colors">
                    {selected.phone}
                  </a>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="text-ink-muted hover:text-accent transition-colors truncate max-w-[11rem]">
                    {selected.email}
                  </a>
                )}
                {selected.website ? (
                  <a href={selected.website} target="_blank" rel="noopener noreferrer"
                     className="text-ink underline underline-offset-2 hover:text-accent transition-colors truncate max-w-[11rem]">
                    {selected.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <span className="text-ink-muted">{localized(T.webNone, locale)}</span>
                )}
                <a href={googleMapsHref(selected)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
                   className="text-ink-muted hover:text-accent transition-colors">
                  {localized(T.openMaps, locale)}
                </a>
              </div>

              {/**
               * Přepínač stavu. Čtyři pole v mřížce 2×2, ne pět tlačítek v řadě — ta se na úzké
               * kartě lámala. „Neosloveno" mezi nimi není: je to výchozí stav, ne volba, a dá se
               * do něj vrátit dalším klikem na už zapnutou možnost.
               */}
              <div className="grid grid-cols-4 md:grid-cols-2 gap-1 mt-2.5 pt-2.5 md:mt-3 md:pt-3 border-t border-line">
                {LEAD_STATUSES.filter(st => st.id !== 'new').map(st => {
                  const zapnuto = (selected.status ?? 'new') === st.id;
                  return (
                    <button
                      key={st.id}
                      aria-pressed={zapnuto}
                      onClick={() => {
                        const dalsi: LeadStatus = zapnuto ? 'new' : st.id;
                        onSetStatus(selected.id, dalsi);
                        setSelected({ ...selected, status: dalsi });
                      }}
                      className={`flex items-center justify-center md:justify-start gap-1 md:gap-1.5
                        text-[10px] md:text-[11px] px-1 md:px-2 py-1 md:py-1.5 rounded-md border transition-colors ${
                        zapnuto
                          ? 'border-ink bg-ink text-surface'
                          : 'border-line text-ink-muted hover:border-ink hover:text-ink'
                      }`}
                    >
                      <span
                        className="hidden md:block w-2 h-2 rounded-full shrink-0"
                        style={{ background: st.color, outline: zapnuto ? '1px solid rgba(255,255,255,.5)' : undefined }}
                      />
                      {localized(st.label, locale)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <Legend locale={locale} labelsOn={labelsOn} />
      </div>

      {/* Kolik z výsledků chybí a proč. Bez téhle věty by mapa tvrdila, že firem je třetina. */}
      {placeable.length < total && (
        <p className="text-[11px] text-ink-faint mt-2">{localized(T.noCoords, locale)}</p>
      )}
      <p className="text-[11px] text-ink-faint mt-1">{localized(T.attrib, locale)}</p>

      {failed && (
        <p className="text-[11px] text-ink-faint mt-1">
          {localized({ cs: 'Podklad mapy se nepodařilo načíst — body jsou na správných místech, jen bez mapy pod nimi.',
                       sk: 'Podklad mapy sa nepodarilo načítať — body sú na správnych miestach, len bez mapy pod nimi.',
                       en: 'The basemap failed to load — the points are in the right places, just without a map under them.' }, locale)}
        </p>
      )}
    </div>
  );
}
