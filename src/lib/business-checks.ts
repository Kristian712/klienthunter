import axios from 'axios';

export interface BusinessChecks {
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  email?: string;
}

const SOCIAL_PATTERNS = {
  facebook: /facebook\.com|fb\.com/i,
  instagram: /instagram\.com/i,
  linkedin: /linkedin\.com/i,
};

export async function checkWebsite(websiteUrl: string | undefined): Promise<boolean> {
  if (!websiteUrl) return false;
  try {
    const res = await axios.head(websiteUrl, { timeout: 5000 });
    return res.status < 400;
  } catch {
    return false;
  }
}

export async function checkSocialMedia(websiteUrl: string | undefined): Promise<{
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
}> {
  if (!websiteUrl) {
    return { hasFacebook: false, hasInstagram: false, hasLinkedIn: false };
  }

  try {
    const res = await axios.get(websiteUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KlientHunterBot/1.0)' },
    });
    const html: string = res.data;

    return {
      hasFacebook: SOCIAL_PATTERNS.facebook.test(html),
      hasInstagram: SOCIAL_PATTERNS.instagram.test(html),
      hasLinkedIn: SOCIAL_PATTERNS.linkedin.test(html),
    };
  } catch {
    return { hasFacebook: false, hasInstagram: false, hasLinkedIn: false };
  }
}

export async function extractEmail(websiteUrl: string | undefined): Promise<string | undefined> {
  if (!websiteUrl) return undefined;

  try {
    const res = await axios.get(websiteUrl, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KlientHunterBot/1.0)' },
    });
    const html: string = res.data;
    const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    return emailMatch?.[0];
  } catch {
    return undefined;
  }
}

export async function analyzeBusinessFull(websiteUrl: string | undefined): Promise<BusinessChecks> {
  const hasWebsite = await checkWebsite(websiteUrl);

  if (!hasWebsite) {
    return {
      hasWebsite: false,
      hasFacebook: false,
      hasInstagram: false,
      hasLinkedIn: false,
    };
  }

  const [social, email] = await Promise.all([
    checkSocialMedia(websiteUrl),
    extractEmail(websiteUrl),
  ]);

  return {
    hasWebsite: true,
    ...social,
    email,
  };
}
