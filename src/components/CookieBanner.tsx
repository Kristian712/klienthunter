'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Cookie } from 'lucide-react';

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
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-line animate-fade-up">
      <div className="max-w-5xl mx-auto px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie size={16} className="shrink-0 text-ink-faint" />
        <p className="flex-1 text-sm text-ink-muted">
          {t.text}{' '}
          <Link href={`/${locale}/privacy`} className="text-ink underline underline-offset-2 hover:text-accent transition-colors">
            {t.privacy}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button onClick={decline} className="btn-outline btn-sm">{t.decline}</button>
          <button onClick={accept} className="btn-primary btn-sm">{t.accept}</button>
        </div>
      </div>
    </div>
  );
}
