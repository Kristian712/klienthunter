'use client';

import { useEffect, useRef } from 'react';

/**
 * Fades a block in the first time it scrolls into view — 220 ms, eight pixels of travel,
 * nothing flying in from the side. Once shown it stays shown; re-animating on the way back up
 * is the kind of motion that makes a page feel restless.
 *
 * Users with `prefers-reduced-motion` never see the hidden state: the CSS neutralises it.
 */
export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
