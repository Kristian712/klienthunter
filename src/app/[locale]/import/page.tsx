'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, Download, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Import of the user's own list.
 *
 * The file is parsed here in the browser: the mapping screen needs the headers anyway, so
 * sending the raw file to the server would mean handling an upload for nothing. Only the
 * mapped rows travel to `/api/import`, where they go through the same verification as a
 * search — same website probe, same registers, same robots.txt rules.
 */

/** Fields we can use. Everything except the name is optional. */
const FIELDS = [
  { key: 'name',    label: 'Název firmy', required: true,  hints: ['nazev', 'název', 'firma', 'name', 'company', 'obchodni'] },
  { key: 'ico',     label: 'IČO',         required: false, hints: ['ico', 'ičo', 'ic', 'reg'] },
  { key: 'website', label: 'Web',         required: false, hints: ['web', 'www', 'url', 'stranky', 'stránky', 'site'] },
  { key: 'phone',   label: 'Telefon',     required: false, hints: ['tel', 'phone', 'mobil'] },
  { key: 'email',   label: 'E-mail',      required: false, hints: ['mail', 'email', 'e-mail'] },
  { key: 'address', label: 'Adresa',      required: false, hints: ['adres', 'address', 'ulice', 'sidlo', 'sídlo'] },
] as const;

type FieldKey = typeof FIELDS[number]['key'];
type Mapping = Partial<Record<FieldKey, string>>;
type Row = Record<string, string>;

/** Pre-selects the obvious columns so most files need no clicking at all. */
function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const taken = new Set<string>();
  for (const field of FIELDS) {
    const found = headers.find(h => {
      if (taken.has(h)) return false;
      const norm = h.toLowerCase().trim();
      return field.hints.some(hint => norm.includes(hint));
    });
    if (found) {
      mapping[field.key] = found;
      taken.add(found);
    }
  }
  return mapping;
}

interface ImportResult {
  searchId: string;
  imported: number;
  skipped: number;
}

export default function ImportPage() {
  const locale = useLocale();

  const [filename, setFilename] = useState('');
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rows, setRows]         = useState<Row[]>([]);
  const [mapping, setMapping]   = useState<Mapping>({});
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState<ImportResult | null>(null);

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({}); setError(''); setDone(null);
  };

  const onFile = (file: File) => {
    reset();
    setFilename(file.name);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: res => {
        const cols = (res.meta.fields ?? []).filter(Boolean);
        if (cols.length === 0 || res.data.length === 0) {
          setError('Soubor je prázdný nebo nemá hlavičku s názvy sloupců.');
          return;
        }
        setHeaders(cols);
        setRows(res.data);
        setMapping(guessMapping(cols));
      },
      error: () => setError('Soubor se nepodařilo přečíst. Je to opravdu CSV?'),
    });
  };

  const nameColumn = mapping.name;
  // Rows without a name have nothing to search for, so they never leave the browser.
  const usable = nameColumn ? rows.filter(r => (r[nameColumn] ?? '').trim()).length : 0;

  const submit = async () => {
    if (!nameColumn) return;
    setBusy(true);
    setError('');
    try {
      const payload = rows
        .map(r => {
          const out: Record<string, string> = { name: (r[nameColumn] ?? '').trim() };
          for (const field of FIELDS) {
            if (field.key === 'name') continue;
            const col = mapping[field.key];
            const value = col ? (r[col] ?? '').trim() : '';
            if (value) out[field.key] = value;
          }
          return out;
        })
        .filter(r => r.name);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename, rows: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Import se nepovedl.');
        return;
      }
      setDone(data);
    } catch {
      setError('Import se nepovedl – zkuste to prosím znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pt-24">
      <h1 className="text-3xl font-bold mb-2">
        {locale === 'cs' ? 'Import vlastního seznamu' : 'Import your own list'}
      </h1>
      <p className="text-ink-muted mb-8">
        Nahrajte CSV se svými firmami. Doplníme jim údaje z rejstříku ARES a ověříme, jestli
        mají web – stejně jako u běžného hledání.
      </p>

      {/* Krok 1 – soubor */}
      <div className="card mb-6">
        <label className="flex flex-col items-center justify-center gap-3 py-10 border border-dashed border-line rounded-lg cursor-pointer hover:border-ink transition-colors">
          <Upload size={24} className="text-ink" />
          <span className="font-medium">{filename || 'Vyberte soubor CSV'}</span>
          <span className="text-xs text-ink-faint">první řádek musí být hlavička s názvy sloupců</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </div>

      {/* Krok 2 – mapování sloupců */}
      {headers.length > 0 && !done && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-1">Které sloupce jsou které?</h2>
          <p className="text-sm text-ink-muted mb-4">
            Načteno {rows.length} řádků. Povinný je jen název firmy.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {FIELDS.map(field => (
              <label key={field.key} className="text-sm">
                <span className="block mb-1 font-medium">
                  {field.label}{field.required && <span className="text-accent"> *</span>}
                </span>
                <select
                  className="input w-full"
                  value={mapping[field.key] ?? ''}
                  onChange={e =>
                    setMapping(m => ({ ...m, [field.key]: e.target.value || undefined }))
                  }
                >
                  <option value="">— nepoužít —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              className="btn-primary"
              disabled={!nameColumn || usable === 0 || busy}
              onClick={submit}
            >
              {busy ? 'Zpracovávám…' : `Importovat ${usable} firem`}
            </button>
            {!nameColumn && (
              <span className="text-sm text-ink-muted flex items-center gap-1.5">
                <AlertTriangle size={14} /> Vyberte sloupec s názvem firmy.
              </span>
            )}
          </div>
          <p className="text-xs text-ink-faint mt-3">
            Import trvá až minutu – ověřujeme weby jeden po druhém. Nezavírejte stránku.
          </p>
        </div>
      )}

      {error && (
        <div className="card mb-6 border-ink text-sm font-medium text-ink">{error}</div>
      )}

      {/* Krok 3 – hotovo */}
      {done && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-ink-faint" />
            Hotovo – {done.imported} firem
          </h2>
          {done.skipped > 0 && (
            <p className="text-sm text-ink-muted mb-3">
              {done.skipped} řádků jsme nezpracovali – jedno hledání zvládne omezený počet firem.
              Zbytek nahrajte v dalším souboru.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => window.open(`/api/export/${done.searchId}?format=csv`, '_blank')}>
              <Download size={14} /> Stáhnout CSV
            </button>
            <button className="btn-outline btn-sm" onClick={() => window.open(`/api/export/${done.searchId}`, '_blank')}>
              <Download size={14} /> Stáhnout Excel
            </button>
            <Link href={`/${locale}/dashboard`} className="btn-primary btn-sm">
              Přehled importů
            </Link>
          </div>
        </div>
      )}

      {/* GDPR */}
      <div className="card text-sm text-ink-muted flex gap-3">
        <ShieldCheck size={16} className="text-ink-faint shrink-0 mt-0.5" />
        <p>
          Nahraná data zpracováváme jen pro vás a nikomu je nepředáváme. Kdykoli je smažete
          v <Link href={`/${locale}/dashboard`} className="text-ink underline underline-offset-2 hover:text-accent">přehledu</Link> –
          smazáním importu zmizí i všechny jeho řádky. Za to, že máte právo tyto kontakty
          zpracovávat, odpovídáte vy.
        </p>
      </div>
    </div>
  );
}
