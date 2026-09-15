import type { Metadata } from 'next';
import { localized } from '@/lib/lead-filters';

/**
 * Titulek karty. Stránka sama je klientská komponenta a `metadata` exportovat nemůže — do
 * 15. 9. 2026 měla proto stejný titulek jako úvod a v liště prohlížeče se nedala najít.
 */
export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return { title: `${localized({"cs": "Ceník", "sk": "Cenník", "en": "Pricing"}, locale)} – KlientHunter` };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
