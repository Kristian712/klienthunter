'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ShieldOff } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { OPERATOR } from '@/lib/legal';

/**
 * Trvalé vyřazení subjektu na jeho žádost — veřejná stránka bez přihlášení.
 *
 * Vyřazení platí od odeslání formuláře a žádné potvrzení nepotřebuje. Kontrola provozovatelem
 * přijde potom; kdyby se žádost ukázala jako neplatná, subjekt se vrátí. Stránka neříká, jestli
 * subjekt v seznamu vůbec je — nesmí sloužit jako ověřovač. E-mail je nepovinný.
 */
const T = {
  title:   { cs: 'Nechci být v seznamu', sk: 'Nechcem byť v zozname', en: 'Remove me from the list' },
  intro:   { cs: 'KlientHunter zobrazuje podnikatelské subjekty z veřejných rejstříků (ARES, RES ČSÚ, OpenStreetMap). Pokud si nepřejete, aby se váš subjekt v aplikaci zobrazoval, zadejte IČO. Vyřazení platí okamžitě po odeslání a je trvalé.',
             sk: 'KlientHunter zobrazuje podnikateľské subjekty z verejných registrov (ARES, RES ČSÚ, OpenStreetMap). Ak si neželáte, aby sa váš subjekt v aplikácii zobrazoval, zadajte IČO. Vyradenie platí okamžite po odoslaní a je trvalé.',
             en: 'KlientHunter shows business entities from public registers (ARES, the Czech Statistical Office register, OpenStreetMap). If you do not want your entity shown in the app, enter its company ID. The removal takes effect immediately and is permanent.' },
  ico:     { cs: 'IČO', sk: 'IČO', en: 'Company ID (IČO)' },
  email:   { cs: 'Váš e-mail (nepovinné)', sk: 'Váš e-mail (nepovinné)', en: 'Your e-mail (optional)' },
  emailHint: { cs: 'Jen abychom se vám mohli ozvat, kdyby žádost byla nejasná. Vyřazení proběhne i bez něj. Nikde se nezobrazuje.',
               sk: 'Len aby sme sa vám mohli ozvať, keby bola žiadosť nejasná. Vyradenie prebehne aj bez neho. Nikde sa nezobrazuje.',
               en: 'Only so we can reach you if the request is unclear. The removal happens without it. Never shown anywhere.' },
  submit:  { cs: 'Vyřadit ze seznamu', sk: 'Vyradiť zo zoznamu', en: 'Remove from the list' },
  working: { cs: 'Odesílám…', sk: 'Odosielam…', en: 'Sending…' },
  done:    { cs: 'Hotovo. Subjekt s tímto IČO je vyřazen od této chvíle — v aplikaci se nezobrazuje, nezapisuje se do nových hledání a neexportuje. Žádné potvrzení není potřeba. Pokud by byla žádost nejasná a uvedli jste e-mail, ozveme se.',
             sk: 'Hotovo. Subjekt s týmto IČO je vyradený od tejto chvíle — v aplikácii sa nezobrazuje, nezapisuje sa do nových hľadaní a neexportuje. Žiadne potvrdenie nie je potrebné. Ak by bola žiadosť nejasná a uviedli ste e-mail, ozveme sa.',
             en: 'Done. The entity with this ID is removed as of now — not shown in the app, not written into new searches, not exported. No confirmation is needed. If the request is unclear and you gave an e-mail, we will get in touch.' },
  confirmed: { cs: 'Žádost je potvrzená. Děkujeme.', sk: 'Žiadosť je potvrdená. Ďakujeme.', en: 'The request is confirmed. Thank you.' },
  invalid: { cs: 'Tenhle potvrzovací odkaz neznáme. Vyřazení z původní žádosti platí dál.',
             sk: 'Tento potvrdzovací odkaz nepoznáme. Vyradenie z pôvodnej žiadosti platí ďalej.',
             en: 'We do not recognise this confirmation link. The removal from the original request still stands.' },
  errIco:  { cs: 'IČO má nejvýš 8 číslic.', sk: 'IČO má najviac 8 číslic.', en: 'A company ID has at most 8 digits.' },
  errRate: { cs: 'Z této adresy přišlo za den příliš mnoho žádostí. Zkuste to zítra, nebo nám napište.',
             sk: 'Z tejto adresy prišlo za deň príliš veľa žiadostí. Skúste to zajtra, alebo nám napíšte.',
             en: 'Too many requests from this address today. Try again tomorrow or write to us.' },
  errServer: { cs: 'Odeslání se nepovedlo — chyba na naší straně. Zkuste to prosím znovu, nebo napište na ',
               sk: 'Odoslanie sa nepodarilo — chyba na našej strane. Skúste to prosím znova, alebo napíšte na ',
               en: 'Sending failed on our side. Please try again or write to ' },
  legal:   { cs: 'Právní základ: námitka proti zpracování podle čl. 21 GDPR. Podrobnosti v ',
             sk: 'Právny základ: námietka proti spracovaniu podľa čl. 21 GDPR. Podrobnosti v ',
             en: 'Legal basis: objection to processing under Art. 21 GDPR. Details in the ' },
  privacy: { cs: 'zásadách ochrany osobních údajů', sk: 'zásadách ochrany osobných údajov', en: 'privacy policy' },
};

export default function OptoutPage() {
  const locale = useLocale();
  const t = (k: keyof typeof T) => localized(T[k], locale);
  const [ico, setIco] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'idle' | 'done' | 'confirmed' | 'invalid'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.has('confirmed')) setState('confirmed');
    else if (q.has('invalid')) setState('invalid');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/optout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ico, email }),
      });
      if (res.ok) { setState('done'); return; }
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.code === 'INVALID_ICO') setError(t('errIco'));
      else if (res.status === 429) setError(t('errRate'));
      else setError(`${t('errServer')}${OPERATOR.email}.`);
    } catch (err) {
      console.error('optout:', err);
      setError(`${t('errServer')}${OPERATOR.email}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 pt-24">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
        <ShieldOff size={22} className="text-ink-faint" />{t('title')}
      </h1>
      <p className="text-ink-muted mb-8">{t('intro')}</p>

      {state === 'confirmed' && <div className="card mb-6 text-sm font-medium">{t('confirmed')}</div>}
      {state === 'invalid' && <div className="card mb-6 text-sm font-medium border-ink">{t('invalid')}</div>}

      {state === 'done' ? (
        <div className="card text-sm font-medium">{t('done')}</div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="optout-ico">{t('ico')}</label>
            <input id="optout-ico" className="input" inputMode="numeric" autoComplete="off" required
                   value={ico} onChange={e => setIco(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="optout-email">{t('email')}</label>
            <input id="optout-email" className="input" type="email" autoComplete="email"
                   value={email} onChange={e => setEmail(e.target.value)} />
            <p className="text-xs text-ink-faint mt-1">{t('emailHint')}</p>
          </div>
          {error && <p className="text-sm font-medium border border-ink px-3 py-2">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy || !ico}>
            {busy ? t('working') : t('submit')}
          </button>
        </form>
      )}

      <p className="text-xs text-ink-faint mt-6">
        {t('legal')}
        <Link href={`/${locale}/privacy`} className="underline underline-offset-2 hover:text-ink">{t('privacy')}</Link>.
      </p>
    </div>
  );
}
