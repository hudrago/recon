'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale, MessageKey } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

type ThemePreference = 'system' | 'light' | 'dark';

interface PreferencesContextValue {
  locale: Locale;
  theme: ThemePreference;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ locale, initialTheme, children }: { locale: Locale; initialTheme: ThemePreference; children: ReactNode }) {
  const router = useRouter();
  const [theme, updateTheme] = useState(initialTheme);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applySystemTheme = () => { document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'; };
    applySystemTheme();
    media.addEventListener('change', applySystemTheme);
    return () => media.removeEventListener('change', applySystemTheme);
  }, [theme]);

  function setTheme(nextTheme: ThemePreference) {
    updateTheme(nextTheme);
    localStorage.setItem('recon-theme', nextTheme);
    document.cookie = `recon-theme=${nextTheme}; path=/; max-age=31536000; samesite=lax`;
    const resolvedTheme = nextTheme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : nextTheme;
    document.documentElement.dataset.theme = resolvedTheme;
  }

  function setLocale(nextLocale: Locale) {
    document.cookie = `recon-locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <PreferencesContext.Provider value={{ locale, theme, setLocale, setTheme, t: (key, values) => translate(locale, key, values) }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider');
  return context;
}