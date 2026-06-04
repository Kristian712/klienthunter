import { useLocale } from 'next-intl';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Ochrana osobních údajů – KlientHunter' };

export default function PrivacyPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 pt-24">
      <h1 className="text-3xl font-bold text-ink mb-8">
        {isCs ? 'Ochrana osobních údajů' : 'Privacy Policy'}
      </h1>
      <div className="prose prose-gray max-w-none space-y-6 text-ink-muted">
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '1. Správce osobních údajů' : '1. Data Controller'}
          </h2>
          <p>KlientHunter · krstnjanku@gmail.com</p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '2. Jaké údaje zpracováváme' : '2. What data we process'}
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>{isCs ? 'Email a jméno (registrace)' : 'Email and name (registration)'}</li>
            <li>{isCs ? 'Historie vyhledávání' : 'Search history'}</li>
            <li>{isCs ? 'Technické cookies (přihlašovací token)' : 'Technical cookies (login token)'}</li>
          </ul>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '3. Účel zpracování' : '3. Purpose of processing'}
          </h2>
          <p>
            {isCs
              ? 'Údaje zpracováváme výhradně pro provoz aplikace, přihlašování uživatelů a ukládání výsledků vyhledávání. Údaje neprodáváme třetím stranám.'
              : 'We process data solely for app operation, user authentication and saving search results. We do not sell data to third parties.'}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '4. Cookies' : '4. Cookies'}
          </h2>
          <p>
            {isCs
              ? 'Používáme technické cookies nutné pro přihlašování (auth-token). Analytické cookies používáme pouze s vaším souhlasem.'
              : 'We use technical cookies required for login (auth-token). We use analytical cookies only with your consent.'}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '5. Vaše práva' : '5. Your rights'}
          </h2>
          <p>
            {isCs
              ? 'Máte právo na přístup, opravu, výmaz a přenositelnost vašich údajů. Žádost zašlete na krstnjanku@gmail.com.'
              : 'You have the right to access, correct, delete and port your data. Send requests to krstnjanku@gmail.com.'}
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold text-ink mb-3">
            {isCs ? '6. Třetí strany' : '6. Third parties'}
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Google Maps API – {isCs ? 'vyhledávání firem' : 'business search'}</li>
            <li>Neon (PostgreSQL) – {isCs ? 'uložení dat' : 'data storage'}</li>
            <li>Vercel – {isCs ? 'hosting aplikace' : 'app hosting'}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
