import { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://klienthunter-vanek.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/cs/admin', '/en/admin', '/sk/admin'] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
