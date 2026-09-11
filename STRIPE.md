# Platby: jak to funguje a jak to otestovat

Předplatné jede na Stripe Checkoutu a zákaznickém portálu. Aplikace sama žádnou kartu nevidí
a nezpracovává — zákazník platí na stránce Stripe, a co se stalo, řekne Stripe zpátky webhookem.

## Jak to funguje

```
uživatel klikne „Koupit"
  → POST /api/stripe/checkout          založí zákazníka a Checkout Session, vrátí adresu
  → prohlížeč jde na checkout.stripe.com
  → zákazník zaplatí
  → Stripe pošle událost na /api/stripe/webhook
  → webhook ověří podpis a zapíše plan, stav a konec období do databáze
  → uživatel se vrátí na /cs/pricing?checkout=success
```

Klíčové pravidlo: **tarif nastavuje jedině webhook.** Návrat z Checkoutu je jen věta na obrazovce.
Kdyby tarif nastavoval prohlížeč, stačilo by si otevřít `?checkout=success` ručně.

Změny tarifu, výměna karty, faktury a zrušení se dělají v zákaznickém portálu
(`POST /api/stripe/portal`), ne v aplikaci. Aplikace o nich zase ví jen z webhooku.

### Které soubory to jsou

| Soubor | Co dělá |
|---|---|
| `src/lib/stripe.ts` | klient Stripe, mapa `priceId → plan`, adresy pro návrat |
| `src/app/api/stripe/checkout/route.ts` | založí zákazníka a Checkout Session |
| `src/app/api/stripe/webhook/route.ts` | ověří podpis, zapíše stav do databáze |
| `src/app/api/stripe/portal/route.ts` | otevře zákaznický portál |
| `src/lib/subscription.ts` | stav pro UI: běží trial, neprošla platba |
| `src/lib/plans.ts` | limity tarifů — jediné místo, odkud je bere API i ceník |

## Proměnné prostředí

Do `.env` lokálně, do Vercelu jako **Sensitive** (Settings → Environment Variables).

| Proměnná | Kde ji vzít |
|---|---|
| `STRIPE_SECRET_KEY` | Developers → API keys. Radši omezený klíč `rk_…` s právy Customers, Checkout Sessions, Subscriptions a Billing Portal než plný `sk_…` |
| `STRIPE_WEBHOOK_SECRET` | Developers → Webhooks → endpoint → Signing secret (`whsec_…`). Lokálně ho vypíše `stripe listen` |
| `STRIPE_PRICE_PRO` | Product catalog → produkt Pro → cena → `price_…` |
| `STRIPE_PRICE_BUSINESS` | totéž u produktu Business |

Testovací a ostrý režim mají **oddělené** klíče, produkty i webhooky. Co nastavíš v testu,
v ostrém režimu neexistuje a naopak.

**Publikovatelný klíč (`pk_…`) tenhle projekt nepotřebuje.** Používá se jen tam, kde formulář
s kartou běží na vlastní stránce (Stripe.js, Payment Element); my posíláme zákazníka na hostovaný
Checkout, takže v prohlížeči nic Stripe není.

Nikdy nedávej `STRIPE_SECRET_KEY` do proměnné začínající `NEXT_PUBLIC_` — všechno s tou předponou
Next vloží do JavaScriptu, který si stáhne každý návštěvník.

## Lokální testování

1. Nainstaluj CLI a přihlas se:

```bash
npm i -g @stripe/cli
```

```bash
stripe login
```

2. Nech CLI přeposílat události na běžící aplikaci. Příkaz vypíše `whsec_…` — ten patří
   do `.env` jako `STRIPE_WEBHOOK_SECRET` (jen pro lokální běh, v produkci je jiný):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Pozor na cestu: endpoint je **`/api/stripe/webhook`** — lomítko, ne pomlčka.

3. V druhém okně spusť aplikaci a projdi nákup přes ceník.

Události jde poslat i ručně, bez placení:

```bash
stripe trigger customer.subscription.updated
```

## Nastavení v produkci

1. **Produkty.** Product catalog → dva produkty, každý s měsíční cenou v CZK:
   Pro 499 Kč, Business 1 499 Kč.

   **Zkušební období 7 dní u obou tarifů** nastavuje aplikace, ne cena v dashboardu —
   Checkout trial z ceny nepřevezme, zná jen `subscription_data.trial_period_days` při zakládání
   session. Délka je `TRIAL_DAYS` v `src/lib/stripe.ts`. Dostane ho jen účet, který předplatné
   ještě nikdy neměl (`subscriptionStatus = none`); kdo zrušil a kupuje znovu, platí hned.
   Karta se zadává při nákupu, strhává se až po skončení zkušební doby. U ceny v dashboardu
   trial **nenastavuj**, nic by neudělal a jen by mátl.
2. **Webhook.** Developers → Webhooks → Add endpoint:
   - URL `https://klienthunter.vercel.app/api/stripe/webhook`
   - události: `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - po uložení zkopíruj **Signing secret** do `STRIPE_WEBHOOK_SECRET` na Vercelu
3. **Portál.** Settings → Billing → Customer portal → zapnout, povolit zrušení a změnu tarifu,
   přidat oba produkty. Bez toho tlačítko „Správa předplatného" vrátí chybu.
4. Po uložení proměnných na Vercelu **nasadit znovu** — nová hodnota platí až pro nové nasazení.

## Testovací karty

| Číslo | Co udělá |
|---|---|
| `4242 4242 4242 4242` | projde |
| `4000 0000 0000 0341` | projde při zadání, ale opakovaná platba selže — na `past_due` |
| `4000 0000 0000 9995` | odmítnuta pro nedostatek prostředků |

Datum expirace libovolné budoucí, CVC libovolné tři číslice.

## Co projít, než se pustí ostrý režim

- [ ] **Nákup.** Ceník → Koupit → testovací karta. Do pár vteřin se na ceníku ukáže „Váš tarif".
      V databázi má uživatel `plan`, `stripeSubscriptionId` a `subscriptionStatus`.
- [ ] **Zkušební období.** Checkout ukazuje „7 dní zdarma". Po nákupu je stav `trialing`,
      tarif platí hned a na ceníku i v profilu se ukazuje, kolik dní zbývá.
- [ ] **Trial jen jednou.** Zrušit předplatné v portálu a koupit znovu — Checkout už zkušební
      období nenabídne a strhne platbu hned.
- [ ] **Konec zkušebního období.** Ve Stripe u předplatného Actions → *End trial now*.
      Stav přeskočí na `active`, tarif zůstává.
- [ ] **Neúspěšná platba.** `stripe trigger invoice.payment_failed`, nebo karta `…0341` a počkat
      na obnovu. Stav `past_due`, tarif **běží dál**, v aplikaci je vidět varování s odkazem
      do portálu.
- [ ] **Zrušení.** Profil → Správa předplatného → Cancel. Po doručení události spadne tarif
      na FREE, ale účet ani data se nemažou.
- [ ] **Opakované doručení.** Ve Stripe → Webhooks → událost → *Resend*. V odpovědi je
      `"duplicate": true` a v databázi se nic nezmění.
- [ ] **Falšovaný požadavek.** `curl -X POST …/api/stripe/webhook -d '{}'` musí vrátit 400.
- [ ] **Limity.** Účet zdarma narazí po pěti hledáních na 403 a v aplikaci vidí odkaz na ceník.
      Po nákupu limit povolí bez odhlášení — tarif se čte z databáze, ne z přihlašovacího tokenu.

## Když se něco pokazí

**Ve Stripe svítí u webhooku chyba podpisu.** V `STRIPE_WEBHOOK_SECRET` je secret z jiného
prostředí (lokální z `stripe listen` vs. produkční z dashboardu), nebo se tělo požadavku někde
parsuje. Handler musí číst `await req.text()`.

**Zákazník zaplatil a tarif nedostal.** Podívej se do tabulky `UnmatchedPayment` — tam padají
platby, ke kterým se nenašel účet (typicky když platba nevznikla přes ceník, ale přes Payment
Link nebo ručně v dashboardu). Řeší se ručně: doplnit uživateli `stripeCustomerId` a poslat
z dashboardu událost `customer.subscription.updated` znovu.

**Webhook vrací 500.** Nejčastěji „neznámá cena": `STRIPE_PRICE_PRO` nebo `STRIPE_PRICE_BUSINESS`
nesedí s cenou, kterou zákazník koupil (třeba testovací ID v produkci). Oprav proměnnou a ve
Stripe událost pošli znovu — 500 je schválně, aby se o to Stripe pokusil sám.
