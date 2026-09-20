import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Jedna poštovní služba pro celou aplikaci. Dva možné odesílatelé, vybírá se z prostředí:
 *
 * 1. **Gmail** (`GMAIL_USER` + `GMAIL_APP_PASSWORD`, heslo aplikace z Google účtu) — start bez
 *    jakéhokoli DNS: Google má svou doménu ověřenou sám. Odesílatel je ta gmailová adresa
 *    (Gmail cizí `From` stejně přepíše), limit zhruba 500 e-mailů za den. Volba majitele
 *    20. 9. 2026: „nic složitého na založení".
 * 2. **Resend** (`RESEND_API_KEY`) — odesílatel na subdoméně `mail.webovkyvanek.cz`; vlastní
 *    subdoména kvůli reputaci a kvůli DKIM/SPF, které se nastavují jen pro ni. Vyžaduje DNS
 *    záznamy u Wedosu; až bude pošty víc než na Gmail.
 *
 * Když je nastavené obojí, má přednost Gmail (je to ten, který majitel zapne první; přepnutí
 * na Resend = smazat proměnné Gmailu). Bez obojího se nic neposílá a funkce to řekne návratovou
 * hodnotou, nikdy výjimkou: reset hesla nebo opt-out nesmí spadnout kvůli poště.
 *
 * Co se posílá: reset hesla, potvrzení opt-outu. Nic marketingového, žádné hromadné
 * rozesílky — na to appka nemá souhlasy a nikdy je nesbírala.
 */
const RESEND_FROM = process.env.MAIL_FROM || 'KlientHunter <klienthunter@mail.webovkyvanek.cz>';
const REPLY_TO = process.env.MAIL_REPLY_TO || undefined;

type Transport = 'gmail' | 'resend';

function transport(): Transport | null {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return null;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function mailEnabled(): boolean {
  return transport() !== null;
}

let resend: Resend | null = null;
let gmail: Transporter | null = null;

export async function sendMail(mail: Mail): Promise<'sent' | 'disabled' | 'failed'> {
  const via = transport();
  if (!via) {
    console.info(`mail: vypnuto (chybí GMAIL_USER+GMAIL_APP_PASSWORD nebo RESEND_API_KEY) — ${mail.subject} → ${mail.to}`);
    return 'disabled';
  }
  const html = mail.html ?? textToHtml(mail.text);
  try {
    if (via === 'gmail') {
      gmail ??= nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      await gmail.sendMail({
        from: `KlientHunter <${process.env.GMAIL_USER}>`,
        to: mail.to,
        replyTo: REPLY_TO,
        subject: mail.subject,
        text: mail.text,
        html,
      });
      return 'sent';
    }
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: RESEND_FROM,
      to: mail.to,
      replyTo: REPLY_TO,
      subject: mail.subject,
      text: mail.text,
      html,
    });
    if (error) { console.error('mail:', error); return 'failed'; }
    return 'sent';
  } catch (err) {
    // Špatné heslo aplikace, vypnuté SMTP, síť — volající dostane 'failed' a zaloguje si to sám.
    console.error(`mail (${via}):`, err instanceof Error ? err.message : err);
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
