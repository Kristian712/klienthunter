/**
 * Shared shape for every data source. Sources are deliberately split into two kinds:
 *
 *  - discovery  — answers "which businesses match this trade and place?"
 *  - enrichment — answers "given this business, what else is known about it?"
 *
 * The distinction matters because our only high-volume source (ARES) carries no contact
 * details at all, while the sources that do carry them cannot be searched by trade.
 */

export interface RawLead {
  /** Which source produced this record: 'ares' | 'osm' | 'csv'. */
  sourceId: string;
  /** Stable per-source identifier, used as the dedup key in the database. */
  externalId: string;
  name: string;
  /** Czech company registration number. The strongest key we have for merging. */
  ico?: string;
  dic?: string;
  phone?: string;
  email?: string;
  website?: string;
  /**
   * Profil na sociální síti, jak ho uvádí zdroj.
   *
   * Ověřit se nedá: Facebook i Instagram mají v robots.txt `User-agent: * / Disallow: /`
   * a výslovný zákaz automatizovaného sběru dat, takže profil nenačítáme a nikdy načítat
   * nebudeme. Platí pro něj tedy stejný standard jako pro telefon a e-mail z OpenStreetMap —
   * je to tvrzení zdroje, které předáváme dál i s tím, odkud pochází.
   */
  facebookUrl?: string;
  instagramUrl?: string;
  address?: string;
  lat?: number;
  lon?: number;
  category?: string;
  /**
   * Date the business was entered in the register. Only the registry sources have it, so a
   * lead that never matched an ARES record stays undated — and is excluded from age filters
   * rather than guessed at.
   */
  foundedAt?: Date;
  /** Registered for VAT. A weak size hint only — small firms register voluntarily. */
  vatPayer?: boolean;
  /** Listed by the tax office as an unreliable payer. A genuine red flag. */
  vatUnreliable?: boolean;
}

export interface DiscoverySource {
  id: string;
  label: string;
  /** Never throws — a failing source must degrade the result, not break the search. */
  search(niche: string, city: string, limit: number): Promise<RawLead[]>;
}

export interface EnrichmentSource {
  id: string;
  label: string;
  /** Returns only the fields it can add. Never throws. */
  enrich(lead: RawLead): Promise<Partial<RawLead>>;
}
