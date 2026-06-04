'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Mail, Send, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // mailto fallback (no backend email service needed)
    const subject = encodeURIComponent(`KlientHunter – zpráva od ${form.name}`);
    const body = encodeURIComponent(`Jméno: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.open(`mailto:krstnjanku@gmail.com?subject=${subject}&body=${body}`);
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-subtle pt-16">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-100 text-brand-600 mb-4">
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
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold text-ink mb-2">
              {isCs ? 'Děkujeme!' : 'Thank you!'}
            </h2>
            <p className="text-ink-muted">
              {isCs ? 'Otevřel se váš emailový klient. Odešlete zprávu.' : 'Your email client opened. Please send the message.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">{isCs ? 'Jméno' : 'Name'}</label>
                <input className="input" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="label">{isCs ? 'Zpráva' : 'Message'}</label>
              <textarea className="input min-h-[140px] resize-none" value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              <Send size={16} />
              {isCs ? 'Odeslat zprávu' : 'Send message'}
            </button>
            <p className="text-xs text-ink-faint text-center">
              {isCs ? 'Nebo nás kontaktujte přímo: ' : 'Or contact us directly: '}
              <a href="mailto:krstnjanku@gmail.com" className="text-brand-600">krstnjanku@gmail.com</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
