import { Resend } from 'resend';

/**
 * Jedna poštovní služba pro celou aplikaci (Resend).
 *
 * Odesílatel je na subdoméně `mail.webovkyvanek.cz` — vlastní subdoména kvůli reputaci
 * (kdyby se něco pokazilo, nestrhne to hlavní doménu) a kvůli DKIM/SPF, které se nastavují
 * jen pro ni. Bez `RESEND_API_KEY` se nic neposílá a funkce to řekne návratovou hodnotou,
 * nikdy výjimkou: reset hesla nebo opt-out nesmí spadnout kvůli poště.
 *
 * Co se posílá: reset hesla, potvrzení opt-outu. Nic marketingového, žádné hromadné
 * rozesílky — na to appka nemá souhlasy a nikdy je nesbírala.
 */
export const MAIL_FROM = process.env.MAIL_FROM || 'KlientHunter <klienthunter@mail.webovkyvanek.cz>';
const REPLY_TO = process.env.MAIL_REPLY_TO || undefined;

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function mailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;

export async function sendMail(mail: Mail): Promise<'sent' | 'disabled' | 'failed'> {
  if (!mailEnabled()) {
    console.info(`mail: vypnuto (chybí RESEND_API_KEY) — ${mail.subject} → ${mail.to}`);
    return 'disabled';
  }
  try {
    client ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await client.emails.send({
      from: MAIL_FROM,
      to: mail.to,
      replyTo: REPLY_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? textToHtml(mail.text),
    });
    if (error) { console.error('mail:', error); return 'failed'; }
    return 'sent';
  } catch (err) {
    console.error('mail:', err);
    return 'failed';
  }
}

/** Prostý text → HTML: odstavce a odkazy. Bez šablon, bez obrázků — má to projít spamovým filtrem, ne oslnit. */
function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = text.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 14px;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">${esc(p).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1d4ed8">$1</a>').replace(/\n/g, '<br>')}</p>`,
  );
  return `<div style="max-width:560px;margin:0 auto;padding:24px">${paragraphs.join('')}</div>`;
}
