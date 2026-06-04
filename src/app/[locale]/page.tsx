import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, BarChart3, Download, CheckCircle2, ArrowRight,
  Globe, Users, Star, Zap, Shield, TrendingUp
} from 'lucide-react';

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();
  const isCs = locale === 'cs';

  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden bg-[#07071a]">
        <div className="hero-orb-1" />
        <div className="hero-orb-2" />

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(rgba(97,82,248,.15) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(97,82,248,.15) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/15 border border-brand-500/25 text-brand-300 text-xs font-semibold mb-8 animate-fade-up">
            <Zap size={12} className="fill-brand-400 text-brand-400" />
            {isCs ? 'Powered by Google Maps API' : 'Powered by Google Maps API'}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.08] tracking-tight mb-6 animate-fade-up" style={{ animationDelay: '.05s' }}>
            {isCs ? (
              <>Najdi firmy,{' '}<br />
                <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                  které potřebují tě
                </span>
              </>
            ) : (
              <>Find businesses{' '}<br />
                <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                  that need you
                </span>
              </>
            )}
          </h1>

          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-up" style={{ animationDelay: '.1s' }}>
            {t('hero_subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-up" style={{ animationDelay: '.15s' }}>
            <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg shadow-glow">
              {t('cta_start')}
              <ArrowRight size={18} />
            </Link>
            <Link href={`/${locale}/search`} className="btn-lg border border-white/10 text-white/80 hover:bg-white/5 transition-colors rounded-2xl inline-flex items-center gap-2 px-7 py-3.5 text-base">
              {t('cta_demo')}
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-14 text-white/30 text-xs animate-fade-up" style={{ animationDelay: '.2s' }}>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> {isCs ? 'Bez kreditní karty' : 'No credit card'}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> {isCs ? '5 vyhledávání zdarma' : '5 free searches'}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> {isCs ? 'Zrušení kdykoliv' : 'Cancel anytime'}</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 text-xs animate-bounce">
          <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/20" />
        </div>
      </section>

      {/* ── Logos / Trust bar ── */}
      <section className="py-10 border-y border-ink/5 bg-surface-subtle">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-8 text-ink-faint text-sm font-medium">
          {['Google Maps API', 'Next.js 14', 'PostgreSQL', 'TypeScript', 'Stripe'].map(t => (
            <span key={t} className="opacity-50 hover:opacity-80 transition-opacity">{t}</span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section bg-surface">
        <div className="container">
          <div className="text-center mb-16">
            <div className="chip mb-4">{isCs ? 'Funkce' : 'Features'}</div>
            <h2 className="text-3xl md:text-4xl font-bold text-ink mb-4">
              {isCs ? 'Vše co potřebuješ k získání klientů' : 'Everything you need to get clients'}
            </h2>
            <p className="text-ink-muted max-w-xl mx-auto">
              {isCs
                ? 'KlientHunter automatizuje průzkum trhu a pomáhá ti najít firmy, které potřebují tvé služby.'
                : 'KlientHunter automates market research and helps you find businesses that need your services.'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Search size={22} />,
                color: 'brand',
                title_cs: 'Vyhledávání firem',
                title_en: 'Business Search',
                desc_cs: 'Hledej firmy podle regionu a oboru pomocí Google Maps API. Tisíce výsledků během sekund.',
                desc_en: 'Search for businesses by region and industry via Google Maps API. Thousands of results in seconds.',
              },
              {
                icon: <BarChart3 size={22} />,
                color: 'emerald',
                title_cs: 'Automatická analýza',
                title_en: 'Automatic Analysis',
                desc_cs: 'Zkontrolujeme web, sociální sítě a recenze každé firmy automaticky. Bez ručního hledání.',
                desc_en: 'We automatically check every business for website, social media, and reviews. No manual searching.',
              },
              {
                icon: <Download size={22} />,
                color: 'violet',
                title_cs: 'Export do Excelu',
                title_en: 'Excel Export',
                desc_cs: 'Stáhni kompletní seznam firem se všemi kontakty připravený pro cold outreach.',
                desc_en: 'Download a complete list of businesses with all contacts ready for cold outreach.',
              },
              {
                icon: <Globe size={22} />,
                color: 'orange',
                title_cs: 'Kontrola webu',
                title_en: 'Website Check',
                desc_cs: 'Okamžitě víš které firmy nemají web – to jsou tvoji ideální zákazníci.',
                desc_en: 'Instantly know which businesses have no website – those are your ideal customers.',
              },
              {
                icon: <Users size={22} />,
                color: 'pink',
                title_cs: 'Sociální sítě',
                title_en: 'Social Media',
                desc_cs: 'Zjistíme zda firma má Facebook, Instagram nebo LinkedIn přítomnost.',
                desc_en: 'We detect whether the business has Facebook, Instagram or LinkedIn presence.',
              },
              {
                icon: <Star size={22} />,
                color: 'yellow',
                title_cs: 'Kvalita recenzí',
                title_en: 'Review Quality',
                desc_cs: 'Firmy s málo recenzemi nebo nízkým hodnocením jsou otevřeny pomoci.',
                desc_en: 'Businesses with few reviews or low ratings are open to help.',
              },
            ].map((f, i) => {
              const colorMap: Record<string, string> = {
                brand: 'bg-brand-50 text-brand-600',
                emerald: 'bg-emerald-50 text-emerald-600',
                violet: 'bg-violet-50 text-violet-600',
                orange: 'bg-orange-50 text-orange-600',
                pink: 'bg-pink-50 text-pink-600',
                yellow: 'bg-yellow-50 text-yellow-600',
              };
              return (
                <div key={i} className="card group hover:shadow-card-hover transition-all duration-200">
                  <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 ${colorMap[f.color]}`}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-ink mb-2">{isCs ? f.title_cs : f.title_en}</h3>
                  <p className="text-sm text-ink-muted leading-relaxed">{isCs ? f.desc_cs : f.desc_en}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section bg-surface-subtle">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="chip mb-4">{isCs ? 'Jak to funguje' : 'How it works'}</div>
              <h2 className="text-3xl md:text-4xl font-bold text-ink mb-6">
                {isCs ? 'Najdi klienty za 3 minuty' : 'Find clients in 3 minutes'}
              </h2>
              <div className="space-y-6">
                {[
                  { n: '01', cs: 'Zadej region a obor', en: 'Enter region and industry' },
                  { n: '02', cs: 'Automaticky prohledáme Google Maps', en: 'We automatically search Google Maps' },
                  { n: '03', cs: 'Zkontrolujeme web, soc. sítě a recenze', en: 'We check website, social media & reviews' },
                  { n: '04', cs: 'Filtruj a exportuj do Excelu', en: 'Filter and export to Excel' },
                ].map(s => (
                  <div key={s.n} className="flex gap-4 items-start">
                    <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {s.n}
                    </span>
                    <p className="text-ink-muted leading-relaxed pt-1">{isCs ? s.cs : s.en}</p>
                  </div>
                ))}
              </div>
              <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg mt-8 inline-flex">
                {isCs ? 'Začít zdarma' : 'Start for free'}
                <ArrowRight size={18} />
              </Link>
            </div>
            {/* Mock UI preview */}
            <div className="relative">
              <div className="card shadow-card-hover p-0 overflow-hidden">
                <div className="bg-surface-subtle px-4 py-3 border-b border-ink/5 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="ml-2 text-xs text-ink-faint font-mono">klienthunter.app/search</span>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { name: 'Restaurace U Karla', web: false, soc: false, rating: 3.2, reviews: 4 },
                    { name: 'Instalatér Novák', web: false, soc: false, rating: 4.8, reviews: 2 },
                    { name: 'Kadeřnictví Hana', web: true, soc: false, rating: 4.1, reviews: 28 },
                  ].map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-b border-ink/5 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-ink">{b.name}</p>
                        <div className="flex gap-2 mt-1">
                          <span className={b.web ? 'badge-green text-xs' : 'badge-red text-xs'}>
                            {b.web ? '✓ Web' : '✗ Web'}
                          </span>
                          <span className={b.soc ? 'badge-green text-xs' : 'badge-red text-xs'}>
                            {b.soc ? '✓ Soc.' : '✗ Soc.'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${b.rating < 3.5 ? 'text-red-500' : 'text-ink'}`}>
                          ★ {b.rating}
                        </p>
                        <p className="text-xs text-ink-faint">{b.reviews} recenzí</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -top-3 -right-3 badge-purple text-xs py-1.5 px-3 shadow-card">
                🎯 {isCs ? '3 potenciální klienti' : '3 potential clients'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="section bg-[#07071a] text-white">
        <div className="container">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '10k+', label_cs: 'Firem analyzováno', label_en: 'Businesses analyzed' },
              { value: '500+', label_cs: 'Spokojených uživatelů', label_en: 'Happy users' },
              { value: '30+', label_cs: 'Zemí', label_en: 'Countries' },
            ].map(s => (
              <div key={s.value}>
                <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent mb-2">
                  {s.value}
                </div>
                <div className="text-white/40 text-sm">{isCs ? s.label_cs : s.label_en}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section bg-surface">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <div className="chip mb-4">FAQ</div>
            <h2 className="text-3xl font-bold text-ink">
              {isCs ? 'Nejčastější otázky' : 'Frequently asked questions'}
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q_cs: 'Je to opravdu zdarma?',
                q_en: 'Is it really free?',
                a_cs: 'Základní plán je zdarma – 5 vyhledávání měsíčně, 20 výsledků každé. Pro více výsledků nabízíme placené plány.',
                a_en: 'The basic plan is free – 5 searches per month, 20 results each. For more results we offer paid plans.',
              },
              {
                q_cs: 'Jak získám přístup? Potřebuji invite kód?',
                q_en: 'How do I get access? Do I need an invite code?',
                a_cs: 'Ano, registrace je momentálně pouze na pozvánku. Kontaktujte nás a rádi vám invite kód zašleme.',
                a_en: 'Yes, registration is currently invite-only. Contact us and we\'ll send you an invite code.',
              },
              {
                q_cs: 'Odkud pocházejí data o firmách?',
                q_en: 'Where does the business data come from?',
                a_cs: 'Data čerpáme z Google Maps API – stejná databáze, kterou používá Google při vyhledávání.',
                a_en: 'Data comes from Google Maps API – the same database Google uses for searches.',
              },
              {
                q_cs: 'Jak funguje detekce webu a sociálních sítí?',
                q_en: 'How does website and social media detection work?',
                a_cs: 'Při každém vyhledávání automaticky navštívíme web každé firmy a zkontrolujeme přítomnost FB/IG/LI odkazů a stáří webu.',
                a_en: 'With each search we automatically visit each business website and check for FB/IG/LI links and site age.',
              },
              {
                q_cs: 'Mohu exportovat výsledky do Excelu?',
                q_en: 'Can I export results to Excel?',
                a_cs: 'Ano – export do Excelu je dostupný pro Pro a Business plán. Získáte kompletní tabulku se všemi kontakty.',
                a_en: 'Yes – Excel export is available for Pro and Business plans. You get a complete table with all contacts.',
              },
            ].map((item, i) => (
              <details key={i} className="card group">
                <summary className="font-medium text-ink cursor-pointer list-none flex items-center justify-between">
                  {isCs ? item.q_cs : item.q_en}
                  <span className="text-ink-faint group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <p className="text-ink-muted text-sm mt-3 leading-relaxed">
                  {isCs ? item.a_cs : item.a_en}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA bottom ── */}
      <section className="section bg-[#07071a] text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {isCs ? 'Začni získávat klienty ještě dnes' : 'Start getting clients today'}
          </h2>
          <p className="text-white/40 mb-8">
            {isCs ? 'Zdarma. Bez platební karty. Zrušení kdykoliv.' : 'Free. No credit card. Cancel anytime.'}
          </p>
          <Link href={`/${locale}/auth/register`} className="btn-primary btn-lg shadow-glow">
            {isCs ? 'Vytvořit účet zdarma' : 'Create free account'}
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 bg-[#07071a] py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="text-white/20 text-xs font-semibold uppercase tracking-wider mb-3">
                {isCs ? 'Produkt' : 'Product'}
              </p>
              <div className="space-y-2">
                <Link href={`/${locale}/search`} className="block text-sm text-white/40 hover:text-white/70">{isCs ? 'Vyhledávání' : 'Search'}</Link>
                <Link href={`/${locale}/pricing`} className="block text-sm text-white/40 hover:text-white/70">{isCs ? 'Ceník' : 'Pricing'}</Link>
              </div>
            </div>
            <div>
              <p className="text-white/20 text-xs font-semibold uppercase tracking-wider mb-3">
                {isCs ? 'Podpora' : 'Support'}
              </p>
              <div className="space-y-2">
                <Link href={`/${locale}/contact`} className="block text-sm text-white/40 hover:text-white/70">{isCs ? 'Kontakt' : 'Contact'}</Link>
              </div>
            </div>
            <div>
              <p className="text-white/20 text-xs font-semibold uppercase tracking-wider mb-3">
                {isCs ? 'Právní' : 'Legal'}
              </p>
              <div className="space-y-2">
                <Link href={`/${locale}/privacy`} className="block text-sm text-white/40 hover:text-white/70">{isCs ? 'Ochrana údajů' : 'Privacy Policy'}</Link>
                <Link href={`/${locale}/terms`} className="block text-sm text-white/40 hover:text-white/70">{isCs ? 'Podmínky použití' : 'Terms of Service'}</Link>
              </div>
            </div>
            <div>
              <p className="text-white/20 text-xs font-semibold uppercase tracking-wider mb-3">
                {isCs ? 'Jazyk' : 'Language'}
              </p>
              <div className="space-y-2">
                <Link href="/cs" className="block text-sm text-white/40 hover:text-white/70">🇨🇿 Čeština</Link>
                <Link href="/sk" className="block text-sm text-white/40 hover:text-white/70">🇸🇰 Slovenčina</Link>
                <Link href="/en" className="block text-sm text-white/40 hover:text-white/70">🇬🇧 English</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
            <span className="text-white/20 text-sm">© 2026 KlientHunter</span>
            <span className="text-white/20 text-xs">
              {isCs ? 'Vytvořeno s ❤️ v České republice' : 'Made with ❤️ in Czech Republic'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
