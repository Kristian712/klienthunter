'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeCtx { theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void }

const Ctx = createContext<ThemeCtx>({ theme: 'system', resolved: 'light', setTheme: () => {} });

export function useTheme() { return useContext(Ctx); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  const apply = (t: Theme) => {
    const isDark =
      t === 'dark' ||
      (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    setResolved(isDark ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = (localStorage.getItem('kh_theme') as Theme) || 'system';
    setThemeState(saved);
    apply(saved);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if ((localStorage.getItem('kh_theme') || 'system') === 'system') apply('system');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('kh_theme', t);
    apply(t);
  };

  return <Ctx.Provider value={{ theme, resolved, setTheme }}>{children}</Ctx.Provider>;
}
