'use client';

import { useEffect } from 'react';

/**
 * Světlo pod kurzorem na kartách (`.card-hover`, `.card-glow`).
 *
 * Jeden pasivní posluchač na celý dokument místo posluchače v každé kartě. Pozici zapíše
 * jen kartě pod myší a nejvýš jednou za snímek (requestAnimationFrame); CSS v globals.css
 * z `--mx`/`--my` kreslí kruhový přechod. Na dotykovém zařízení a při `prefers-reduced-motion`
 * se nic neděje — bez kurzoru efekt nemá smysl a pohyb si uživatel nepřeje.
 */
export function Spotlight() {
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let target: HTMLElement | null = null;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      if (!target) return;
      const r = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${x - r.left}px`);
      target.style.setProperty('--my', `${y - r.top}px`);
    };

    const onMove = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.card-hover, .card-glow') as HTMLElement | null;
      if (!el) return;
      target = el;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
