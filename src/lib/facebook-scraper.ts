import axios from 'axios';

export interface FbLead {
  name: string;
  facebookPageUrl: string;
  hasWebsite: boolean;
  website?: string;
  postCount: number;
}

export interface ScrapeResult {
  leads: FbLead[];
  error?: string;
  total?: number;
}

const SKIP_SLUGS = new Set([
  'groups', 'pages', 'events', 'marketplace', 'gaming', 'watch',
  'login', 'logout', 'register', 'help', 'settings', 'privacy',
  'terms', 'about', 'home', 'search', 'friends', 'notifications',
  'messages', 'saved', 'reels', 'stories', 'live', 'fundraisers',
  'dialog', 'sharer', 'share', 'plugins', 'video', 'photo',
  'hashtag', 'explore', 'trending', 'reel', 'story', 'ads',
  'business', 'news', 'jobs', 'dating', 'bookmarks', 'campus',
]);

const SKIP_NAMES = new Set([
  'facebook', 'messenger', 'instagram', 'whatsapp', 'meta',
  'install', 'download', 'nainstalovat', 'stáhnout',
  'log in', 'sign up', 'přihlásit', 'registrovat',
  'login', 'register', 'help', 'settings', 'privacy', 'terms',
  'back', 'next', 'more', 'see all', 'load more', 'show more',
  'home', 'groups', 'pages', 'events', 'search', 'notifications',
  'friends', 'watch', 'gaming', 'saved', 'marketplace',
  'přátelé', 'skupiny', 'hledat', 'oznámení', 'zprávy',
]);

function isValidName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 80) return false;
  const lower = name.toLowerCase().trim();
  if (SKIP_NAMES.has(lower)) return false;
  if (SKIP_NAMES.has(lower.split(' ')[0])) return false;
  if (lower.includes('facebook') || lower.includes('instagram') || lower.includes('meta ')) return false;
  if (!/[a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/.test(name)) return false;
  return true;
}

function hrefToProfileUrl(href: string): string | null {
  // Normalise — strip absolute FB prefix
  const cleaned = href
    .replace(/&amp;/g, '&')
    .replace(/^https?:\/\/(mbasic\.|m\.|www\.)?facebook\.com/, '');

  if (!cleaned.startsWith('/')) return null;

  if (cleaned.includes('profile.php')) {
    const id = cleaned.match(/id=(\d+)/)?.[1];
    return id ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }

  const slug = cleaned.replace(/^\//, '').split(/[/?#]/)[0];
  if (!slug || slug.length < 2) return null;
  if (SKIP_SLUGS.has(slug.toLowerCase())) return null;
  if (!/^[a-zA-Z0-9._-]{2,80}$/.test(slug)) return null;

  return `https://www.facebook.com/${slug}`;
}

// Parse Facebook group HTML/JSON (pasted page source) and extract post authors
function extractAuthors(html: string): Map<string, { name: string; count: number }> {
  const found = new Map<string, { name: string; count: number }>();

  const add = (href: string, rawName: string) => {
    const name = rawName.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"').replace(/\\u0026/g, '&').trim();
    if (!isValidName(name)) return;
    const url = hrefToProfileUrl(href);
    if (!url) return;
    const existing = found.get(url);
    if (existing) {
      existing.count++;
      if (name.length > existing.name.length) existing.name = name;
    } else {
      found.set(url, { name, count: 1 });
    }
  };

  let m: RegExpExecArray | null;

  // ── Strategy A: regular Facebook JSON embedded in <script> tags ──
  // Facebook embeds all post/actor data as JSON in script tags
  // Pattern: "actor":{"__typename":"User","name":"Jan Novak","url":"https://..."}
  // Also: "node":{"actor":{"name":...,"url":...}}
  const actorRe = /"(?:actor|author|node_actor|owner)"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]{2,80})"[^}]*?"url"\s*:\s*"(https?:\\?\/\\?\/(?:www\.)?facebook\.com\\?\/[^"\\]{2,80})"/gi;
  while ((m = actorRe.exec(html)) !== null) {
    const name = m[1].replace(/\\n/g, ' ').replace(/\\/g, '');
    const url = m[2].replace(/\\/g, '');
    add(url, name);
  }

  // Also try reversed order (url before name)
  const actorRe2 = /"(?:actor|author|node_actor|owner)"\s*:\s*\{[^}]*?"url"\s*:\s*"(https?:\\?\/\\?\/(?:www\.)?facebook\.com\\?\/[^"\\]{2,80})"[^}]*?"name"\s*:\s*"([^"]{2,80})"/gi;
  while ((m = actorRe2.exec(html)) !== null) {
    const url = m[1].replace(/\\/g, '');
    const name = m[2].replace(/\\n/g, ' ').replace(/\\/g, '');
    add(url, name);
  }

  // Broader JSON pattern: any object with both "name" and a facebook.com "url"
  const jsonPersonRe = /"name"\s*:\s*"([^"]{3,80})"(?:[^}]{0,200}?)"url"\s*:\s*"(https?:\\?\/\\?\/(?:www\.)?facebook\.com\\?\/(?:profile\.php\?id=\d+|[\w.]{3,60}))"/gi;
  while ((m = jsonPersonRe.exec(html)) !== null) {
    const name = m[1].replace(/\\n/g, ' ').replace(/\\/g, '');
    const url = m[2].replace(/\\/g, '');
    if (name.split(' ').length >= 1) add(url, name);
  }

  // ── Strategy B: HTML <a> tags (mbasic or m.facebook.com) ──
  const h3Re = /<h[34][^>]*>[\s\S]{0,120}<a\s+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = h3Re.exec(html)) !== null) add(m[1], m[2]);

  const strongRe = /<strong[^>]*>[\s\S]{0,60}<a\s+href="([^"]+)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = strongRe.exec(html)) !== null) add(m[1], m[2]);

  const phpRe = /<a\s+href="([^"]*profile\.php[^"]*)"[^>]*>([^<]{2,80})<\/a>/gi;
  while ((m = phpRe.exec(html)) !== null) add(m[1], m[2]);

  // ── Strategy C: broad fallback ──
  if (found.size === 0) {
    const broadRe = /<a\s+href="([^"]{5,150})"[^>]*>([^<]{3,60})<\/a>/gi;
    while ((m = broadRe.exec(html)) !== null) {
      const href = m[1];
      if (href.includes('facebook.com') || href.startsWith('/')) add(href, m[2]);
    }
  }

  console.log(`[FB parser] found ${found.size} authors in ${html.length} chars`);
  return found;
}

// Check if a Facebook page/profile has a website by fetching their About page
async function checkWebsite(fbUrl: string): Promise<{ hasWebsite: boolean; website?: string }> {
  try {
    // Use the plain www.facebook.com about page — public info is often visible
    const aboutUrl = fbUrl.includes('profile.php')
      ? fbUrl + '&sk=about'
      : fbUrl + '/about';

    const res = await axios.get(aboutUrl, {
      timeout: 8_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html',
      },
      maxContentLength: 500_000,
      maxRedirects: 3,
    });

    const html = typeof res.data === 'string' ? res.data : '';

    // Look for website links in OG tags or structured data
    const ogUrl = html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i)?.[1];
    const websiteMatch = html.match(/"website"\s*:\s*"([^"]+)"/i)?.[1]
      ?? html.match(/href="(https?:\/\/(?!(?:www\.)?facebook\.com|instagram\.com|linkedin\.com|whatsapp\.com)[^"]{5,100})"/i)?.[1];

    if (websiteMatch && !websiteMatch.includes('facebook.com')) {
      return { hasWebsite: true, website: websiteMatch };
    }
    if (ogUrl && !ogUrl.includes('facebook.com')) {
      return { hasWebsite: true, website: ogUrl };
    }

    return { hasWebsite: false };
  } catch {
    return { hasWebsite: false };
  }
}

export async function parseGroupHtml(html: string): Promise<ScrapeResult> {
  const authors = extractAuthors(html);

  if (authors.size === 0) {
    return {
      leads: [],
      error: 'Nepodařilo se najít žádné přispěvatele. Ujisti se, že: 1) jsi otevřel stránku skupiny na www.facebook.com a jsi přihlášen, 2) zobrazil zdrojový kód (Cmd+U / Ctrl+U), 3) zkopíroval vše (Cmd+A + Cmd+C) a vložil sem.',
    };
  }

  // Sort by post count, take top 30
  const sorted = Array.from(authors.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);

  const leads: FbLead[] = [];

  for (const [fbUrl, { name, count }] of sorted) {
    const { hasWebsite, website } = await checkWebsite(fbUrl);
    leads.push({ name, facebookPageUrl: fbUrl, hasWebsite, website, postCount: count });
  }

  const noWebsite = leads.filter(l => !l.hasWebsite);

  return {
    leads: noWebsite,
    total: authors.size,
  };
}
