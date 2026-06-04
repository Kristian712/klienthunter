import { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://klienthunter-vanek.vercel.app';
const locales = ['cs', 'en', 'sk'];
const pages = ['', '/pricing', '/search', '/contact', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const page of pages) {
      entries.push({
        url: `${BASE}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'weekly' : 'monthly',
        priority: page === '' ? 1 : 0.8,
      });
    }
  }
  return entries;
}
