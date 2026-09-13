/**
 * Živé pozadí pro úvodku a ceník: dvě pomalu se přelévající barevné skvrny a jemná mřížka.
 *
 * Rodič musí být `relative` a obsah `relative z-10`, jinak skvrny překryjí text. Vrstva nic
 * nepřijímá (pointer-events: none) a při `prefers-reduced-motion` stojí — animace vypíná
 * globální pravidlo v globals.css.
 */
export function Backdrop() {
  return (
    <div className="kh-backdrop" aria-hidden="true">
      <div className="kh-backdrop__grid" />
      <div className="kh-blob kh-blob--accent" />
      <div className="kh-blob kh-blob--warm" />
    </div>
  );
}
