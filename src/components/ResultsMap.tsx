'use client';

import { useEffect, useRef, useState } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { localized } from '@/lib/lead-filters';
import { LEAD_STATUSES, pointColor, type LeadStatus } from '@/lib/lead-tags';

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
  noCoords: { cs: 'U zbylých neznáme souřadnice — ARES je nevrací, jen adresu textem.',
              sk: 'Pri zvyšných nepoznáme súradnice — ARES ich nevracia, len adresu textom.',
              en: 'We have no coordinates for the rest — ARES returns only a postal address.' },
  none:     { cs: 'Žádnou z nalezených firem neumíme umístit na mapu. Zkuste seznam.',
              sk: 'Žiadnu z nájdených firiem nevieme umiestniť na mapu. Skúste zoznam.',
              en: 'None of the firms found can be placed on the map. Try the list.' },
  webHas:   { cs: 'Web ověřen',      sk: 'Web overený',    en: 'Website verified' },
  webNone:  { cs: 'Web neuveden',    sk: 'Web neuvedený',  en: 'No website listed' },
  openMaps: { cs: 'Otevřít na Google Maps', sk: 'Otvoriť na Google Maps', en: 'Open in Google Maps' },
  status:   { cs: 'Stav',            sk: 'Stav',           en: 'Status' },
  attrib:   { cs: 'Mapa © OpenFreeMap, data © přispěvatelé OpenStreetMap',
              sk: 'Mapa © OpenFreeMap, dáta © prispievatelia OpenStreetMap',
              en: 'Map © OpenFreeMap, data © OpenStreetMap contributors' },
};

/** Odkaz na Google Maps. Jen adresa, žádné API a žádný klíč — vyhledání podle názvu a adresy. */
export function googleMapsHref(lead: MapLead): string {
  const q = [lead.name, lead.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

interface Props {
  leads: MapLead[];
  /** Kolik firem je celkem ve výsledku, včetně těch bez souřadnic. */
  total: number;
  locale: string;
  onSetStatus: (leadId: string, status: LeadStatus) => void;
}

export function ResultsMap({ leads, total, locale, onSetStatus }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  /** Na výsledky se doskočí jednou. Další dávky už mapu pod rukama neposouvají. */
  const fitted = useRef(false);
  const [selected, setSelected] = useState<MapLead | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const placeable = leads.filter(l => typeof l.lat === 'number' && typeof l.lon === 'number');

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
    m.on('load', () => setReady(true));
    // Když se nepovede načíst styl nebo dlaždice, ať to není tichý prázdný obdélník.
    m.on('error', e => { console.warn('mapa:', e?.error?.message ?? e); setFailed(true); });
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

    for (const lead of placeable) {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', lead.name);
      el.style.cssText = `width:13px;height:13px;border-radius:50%;cursor:pointer;border:2px solid #fff;
        box-shadow:0 1px 3px rgba(0,0,0,.4);background:${pointColor(lead.hasWebsite, lead.status)}`;
      el.addEventListener('click', e => { e.stopPropagation(); setSelected(lead); });
      markers.current.push(
        new Marker({ element: el }).setLngLat([lead.lon!, lead.lat!]).addTo(m),
      );
    }

    // Po prvním naplnění doskoč na výsledky. Později už ne — uživatel si mapu posouvá sám
    // a skákat mu pod rukama při každé dávce by bylo nepoužitelné.
    if (placeable.length > 0 && !fitted.current) {
      fitted.current = true;
      const b = new LngLatBounds();
      placeable.forEach(l => b.extend([l.lon!, l.lat!]));
      m.fitBounds(b, { padding: 48, maxZoom: 14, duration: 400 });
    }
  }, [placeable.map(l => `${l.id}:${l.status ?? ''}`).join(',')]);

  return (
    <div className="relative">
      <div ref={container} className="w-full h-[26rem] md:h-[34rem] rounded-xl overflow-hidden border border-line" />

      {/* Kolik z výsledků je vidět. Bez téhle věty by mapa tvrdila, že firem je třetina. */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-2">
        <p className="text-xs text-ink-muted">
          {localized(T.onMap, locale).replace('{n}', String(placeable.length)).replace('{total}', String(total))}
        </p>
        {placeable.length < total && (
          <p className="text-[11px] text-ink-faint">{localized(T.noCoords, locale)}</p>
        )}
      </div>
      <p className="text-[11px] text-ink-faint mt-1">{localized(T.attrib, locale)}</p>

      {failed && (
        <p className="text-[11px] text-ink-faint mt-1">
          {localized({ cs: 'Podklad mapy se nepodařilo načíst — body jsou na správných místech, jen bez mapy pod nimi.',
                       sk: 'Podklad mapy sa nepodarilo načítať — body sú na správnych miestach, len bez mapy pod nimi.',
                       en: 'The basemap failed to load — the points are in the right places, just without a map under them.' }, locale)}
        </p>
      )}

      {placeable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="bg-white/90 border border-line px-4 py-3 text-sm text-ink-muted max-w-xs text-center">
            {localized(T.none, locale)}
          </p>
        </div>
      )}

      {selected && (
        <div className="absolute left-3 bottom-16 md:bottom-20 w-[min(20rem,calc(100%-1.5rem))] bg-white border border-ink p-4 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{selected.name}</p>
              {selected.category && <p className="text-[11px] text-ink-faint mt-0.5">{selected.category}</p>}
            </div>
            <button onClick={() => setSelected(null)} className="text-ink-faint hover:text-ink text-lg leading-none">×</button>
          </div>

          {selected.address && <p className="text-xs text-ink-muted mt-2">{selected.address}</p>}

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="badge">
              {localized(selected.hasWebsite ? T.webHas : T.webNone, locale)}
            </span>
            {selected.ico && <span className="badge">IČO {selected.ico}</span>}
          </div>

          <div className="flex flex-col gap-1.5 mt-3 text-xs">
            {selected.phone && (
              <a href={`tel:${selected.phone}`} className="text-ink hover:text-accent transition-colors">{selected.phone}</a>
            )}
            {selected.email && (
              <a href={`mailto:${selected.email}`} className="text-ink-muted hover:text-accent transition-colors truncate">{selected.email}</a>
            )}
            {selected.website && (
              <a href={selected.website} target="_blank" rel="noopener noreferrer"
                 className="text-ink-muted hover:text-accent transition-colors truncate">
                {selected.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            <a href={googleMapsHref(selected)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"
               className="text-ink-muted hover:text-accent transition-colors">
              {localized(T.openMaps, locale)}
            </a>
          </div>

          <div className="border-t border-line mt-3 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">
              {localized(T.status, locale)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STATUSES.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSetStatus(selected.id, s.id); setSelected({ ...selected, status: s.id }); }}
                  className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                    (selected.status ?? 'new') === s.id
                      ? 'border-ink bg-ink text-white'
                      : 'border-line text-ink-muted hover:border-ink hover:text-ink'
                  }`}
                >
                  {localized(s.label, locale)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
