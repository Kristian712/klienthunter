'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Cookie, X } from 'lucide-react';

export function CookieBanner() {
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('kh_cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem('kh_cookie_consent', 'accepted');
    setVisible(false);
  };
  const decline = () => {
    localStorage.setItem('kh_cookie_consent', 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  const t = {
    cs: {
      text: 'Používáme cookies pro zajištění funkčnosti aplikace a analýzu návštěvnosti.',
      privacy: 'Ochrana osobních údajů',
      accept: 'Přijmout vše',
      decline: 'Jen nezbytné',
    },
    sk: {
      text: 'Používame cookies na zabezpečenie funkčnosti aplikácie a analýzu návštevnosti.',
      privacy: 'Ochrana osobných údajov',
      accept: 'Prijať všetko',
      decline: 'Len nevyhnutné',
    },
    en: {
      text: 'We use cookies to ensure app functionality and analyse traffic.',
      privacy: 'Privacy Policy',
      accept: 'Accept all',
      decline: 'Essential only',
    },
  }[locale as 'cs' | 'sk' | 'en'] ?? {
    text: 'We use cookies.',
    privacy: 'Privacy Policy',
    accept: 'Accept',
    decline: 'Decline',
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-3xl mx-auto bg-[#07071a] border border-white/10 rounded-2xl p-5 shadow-card-hover flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie size={20} className="text-brand-400 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-white/70 text-sm flex-1">
          {t.text}{' '}
          <Link href={`/${locale}/privacy`} className="text-brand-400 underline hover:text-brand-300">
            {t.privacy}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={decline} className="px-4 py-2 rounded-xl text-sm text-white/50 border border-white/10 hover:border-white/20 transition-colors">
            {t.decline}
          </button>
          <button onClick={accept} className="px-4 py-2 rounded-xl text-sm bg-brand-600 text-white hover:bg-brand-700 transition-colors font-medium">
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
