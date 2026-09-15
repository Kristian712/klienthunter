'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { OPERATOR } from '@/lib/legal';

export default function ContactPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Aplikace poštu neodesílá, formulář jen připraví zprávu v e-mailovém klientovi. Stejná karta,
    // ne `window.open`: to v některých prohlížečích nechá po `mailto:` otevřenou prázdnou kartu.
    const subject = encodeURIComponent(isCs ? `KlientHunter – zpráva od ${form.name}` : `KlientHunter – message from ${form.name}`);
    const body = encodeURIComponent(`${isCs ? 'Jméno' : 'Name'}: ${form.name}\n${isCs ? 'E-mail' : 'E-mail'}: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:${OPERATOR.email}?subject=${subject}&body=${body}`;
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg border border-line text-ink mb-4">
            <Mail size={26} />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-3">
            {isCs ? 'Kontaktujte nás' : 'Contact us'}
          </h1>
          <p className="text-ink-muted">
            {isCs ? 'Máte otázku nebo nápad? Napište nám.' : 'Have a question or idea? Write to us.'}
          </p>
        </div>

        {sent ? (
          <div className="card text-center py-12">
            <CheckCircle2 size={40} className="mx-auto text-accent mb-4" />
            <h2 className="text-xl font-semibold text-ink mb-2">
              {isCs ? 'Zpráva je připravená' : 'Your message is ready'}
            </h2>
            <p className="text-ink-muted">
              {isCs
                ? 'Zpráva je připravená ve vašem e-mailovém klientovi, stačí ji odeslat. Pokud se klient neotevřel, napište přímo na '
                : 'The message is ready in your e-mail client; just send it. If no e-mail client opened, write directly to '}
              <a href={`mailto:${OPERATOR.email}`} className="text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors">{OPERATOR.email}</a>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="kh-contact-name">{isCs ? 'Jméno' : 'Name'}</label>
                <input id="kh-contact-name" className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label" htmlFor="kh-contact-email">E-mail</label>
                <input id="kh-contact-email" type="email" className="input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="kh-contact-message">{isCs ? 'Zpráva' : 'Message'}</label>
              <textarea id="kh-contact-message" className="input min-h-[140px] resize-none" value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              <Send size={16} />
              {isCs ? 'Otevřít v e-mailu' : 'Open in your e-mail app'}
            </button>
            <p className="text-xs text-ink-faint text-center">
              {isCs ? 'Nebo nás kontaktujte přímo: ' : 'Or contact us directly: '}
              <a href={`mailto:${OPERATOR.email}`} className="text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors">{OPERATOR.email}</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
