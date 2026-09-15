/**
 * Pozadí celé aplikace: velké rozostřené slovo KlientHunter, měkké světlo shora, jemné zrno
 * a vinětace. Jedna vrstva `position: fixed` pod veškerým obsahem, takže při scrollu stojí
 * na místě a prosvítá každou sekcí i poloprůhlednými kartami.
 *
 * Výkon: nic se nehýbe. Rozostření (`filter: blur`) se spočítá jednou a vrstva má vlastní
 * kompozitní plochu (`will-change: transform`), takže scroll ji nepřekresluje. Karty samy
 * `backdrop-filter` nemají — u pěti set výsledků by blur za každou kartou při scrollu dusil
 * grafickou kartu; skleněný dojem dělá poloprůhlednost nad už rozostřeným slovem.
 *
 * Styly jsou v globals.css (`.kh-site-bg`). Čtečka vrstvu přeskočí (`aria-hidden`).
 */
export function SiteBackdrop() {
  return (
    <div className="kh-site-bg" aria-hidden="true">
      <div className="kh-site-bg__light" />
      <div className="kh-site-bg__word">KlientHunter</div>
      <div className="kh-site-bg__word kh-site-bg__word--edge">KlientHunter</div>
      <div className="kh-site-bg__grain" />
      <div className="kh-site-bg__vignette" />
    </div>
  );
}
