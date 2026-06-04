import { useLocale } from 'next-intl';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Podmínky použití – KlientHunter' };

export default function TermsPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 pt-24">
      <h1 className="text-3xl font-bold text-ink mb-8">
        {isCs ? 'Podmínky použití' : 'Terms of Service'}
      </h1>
      <div className="space-y-6 text-ink-muted">
        {[
          {
            cs: '1. Používáním KlientHunter souhlasíte s těmito podmínkami.',
            en: '1. By using KlientHunter you agree to these terms.',
          },
          {
            cs: '2. Aplikace slouží výhradně pro legální účely – vyhledávání firemních kontaktů pro obchodní komunikaci.',
            en: '2. The app is for legal purposes only – finding business contacts for commercial communication.',
          },
          {
            cs: '3. Zakazuje se hromadný spam, phishing nebo jakékoli obtěžování nalezených kontaktů.',
            en: '3. Mass spam, phishing or any harassment of found contacts is prohibited.',
          },
          {
            cs: '4. Provozovatel si vyhrazuje právo zrušit účet při porušení podmínek.',
            en: '4. The operator reserves the right to terminate accounts for violations.',
          },
          {
            cs: '5. Služba je poskytována "tak jak je" bez záruky dostupnosti. Provozovatel nenese odpovědnost za škody vzniklé použitím aplikace.',
            en: '5. The service is provided "as is" without uptime guarantees. The operator is not liable for damages from using the app.',
          },
          {
            cs: '6. Podmínky se mohou měnit. O změnách budete informováni emailem.',
            en: '6. Terms may change. You will be notified by email of changes.',
          },
        ].map((item, i) => (
          <p key={i}>{isCs ? item.cs : item.en}</p>
        ))}
        <p className="text-sm text-ink-faint pt-4">
          {isCs ? 'Kontakt: krstnjanku@gmail.com' : 'Contact: krstnjanku@gmail.com'}
        </p>
      </div>
    </div>
  );
}
