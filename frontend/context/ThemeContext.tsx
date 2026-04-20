'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Read persisted theme
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored);
      document.documentElement.classList.toggle('dark', stored === 'dark');
    } else {
      // Respect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = prefersDark ? 'dark' : 'light';
      setThemeState(initial);
      document.documentElement.classList.toggle('dark', initial === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    setThemeState(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  };

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
