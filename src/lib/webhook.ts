import { createHmac, randomBytes } from 'node:crypto';
import { prisma } from './db';
import { leadReason } from './lead-reason';
import { websiteAudit } from './website-audit';
import { withoutOptouts } from './optout';

/**
 * Webhook pro Make, Zapier a spol.
 *
 * Konkurence (Saleskit) prodává seznam integrací; my potřebujeme jednu věc, ze které si
 * každý postaví, co chce: když doběhne hledání, pošleme firmy jako JSON na adresu, kterou
 * si uživatel nastavil v profilu. „Catch hook" v Make i Zapieru přijme cokoli, zbytek už
 * je jejich scénář — řádek do tabulky, karta v CRM, zpráva na Slack.
 *
 * Podpis: hlavička `X-KlientHunter-Signature: sha256=<HMAC-SHA256 těla tajemstvím>`. Tajemství
 * vzniká při uložení adresy a uživatel ho vidí v profilu, aby si mohl ověřit, že událost
 * přišla od nás. Selhání se jen zaloguje — hledání kvůli cizímu serveru nesmí spadnout.
 *
 * Co se posílá: jen to, co uživatel vidí v exportu. Vyřazené subjekty ne.
 */
export const WEBHOOK_TIMEOUT_MS = 8_000;
export const WEBHOOK_MAX_FIRMS = 500;

export function newWebhookSecret(): string {
  return randomBytes(24).toString('hex');
}

export function isWebhookUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname);
  } catch {
    return false;
  }
}

export async function postWebhook(url: string, secret: string, event: string, data: Record<string, unknown>): Promise<{ ok: boolean; status: number | null }> {
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), ...data });
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KlientHunter-Signature': signature, 'X-KlientHunter-Event': event },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn('webhook:', url, err instanceof Error ? err.message : err);
    return { ok: false, status: null };
  }
}

/** Po doběhnutí hledání: firmy z běhu na adresu uživatele, pokud si ji nastavil. */
export async function notifySearchDone(searchId: string): Promise<void> {
  const search = await prisma.search.findUnique({
    where: { id: searchId },
    include: {
      user: { select: { webhookUrl: true, webhookSecret: true, targetFilters: true } },
      results: { orderBy: { leadScore: 'desc' }, take: WEBHOOK_MAX_FIRMS },
    },
  });
  if (!search?.user.webhookUrl || !search.user.webhookSecret) return;

  const rows = await withoutOptouts(search.results);
  const firms = rows.map(b => ({
    id: b.id,
    name: b.name,
    ico: b.ico,
    phone: b.phone,
    email: b.email,
    website: b.website,
    websiteStatus: b.websiteStatus,
    address: b.address,
    category: b.category,
    foundedAt: b.foundedAt,
    vatPayer: b.vatPayer,
    score: b.leadScore,
    reason: leadReason(b, search.user.targetFilters, 'cs'),
    websiteAudit: websiteAudit(b, 'cs')?.sentence ?? null,
    source: b.source,
  }));

  await postWebhook(search.user.webhookUrl, search.user.webhookSecret, 'search.done', {
    search: { id: search.id, name: search.name, industry: search.query, region: search.region, createdAt: search.createdAt },
    count: firms.length,
    firms,
  });
}
